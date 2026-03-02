import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";
import crypto from "crypto";

// SDK Mercado Pago
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 🔒 Secrets
const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");
const MP_WEBHOOK_SECRET = defineSecret("MP_WEBHOOK_SECRET");

// sua base pública das functions (api)
const PUBLIC_FUNCTIONS_BASE_URL =
  "https://us-central1-luvie-app-2026.cloudfunctions.net/api";

/**
 * Cria cliente do MP com token "sanitizado"
 * (evita erro por whitespace/aspas copiadas no Secret)
 */
function mpClient() {
  let token = MP_ACCESS_TOKEN.value();
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado.");

  // sanitiza token: trim + remove aspas acidentais
  token = String(token).trim().replace(/^"+|"+$/g, "");

  // log seguro (não vaza token inteiro)
  console.log("MP token prefix:", token.slice(0, 10), "len:", token.length);

  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 15000 }, // evita travar muito tempo
  });
}

/**
 * POST /createCheckout
 * body: { token: "..." }
 * Retorna: { order, preferenceId }
 */
app.options("/createCheckout", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.status(204).send("");
});

app.post("/createCheckout", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token obrigatório" });

    const snap = await db
      .collection("pedidos")
      .where("publicToken", "==", token)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const doc = snap.docs[0];
    const pedido = { id: doc.id, ...doc.data() };

    // Se já tiver preferenceId salvo, reutiliza
    let preferenceId = pedido?.checkout?.preferenceId || "";

    if (!preferenceId) {
      const items = (pedido.itens || []).map((it) => ({
        title: it.titulo,
        quantity: Number(it.qtd || 1),
        unit_price: Number(it.preco || 0),
      }));

      const preference = new Preference(mpClient());
      const created = await preference.create({
        body: {
          items,
          external_reference: doc.id,
          notification_url: `${PUBLIC_FUNCTIONS_BASE_URL}/webhookMercadoPago`,
          metadata: { pedidoId: doc.id, token },
        },
      });

      preferenceId = created.id;

      await doc.ref.set(
        { status: "awaiting_payment", checkout: { preferenceId } },
        { merge: true }
      );
    }

    const orderForClient = {
      clienteNome: pedido.clienteNome || "",
      clienteEmail: pedido.clienteEmail || "",
      itens: pedido.itens || [],
      total: Number(pedido.total || 0),
      pedidoId: pedido.id || doc.id,
    };

    res.set("Access-Control-Allow-Origin", "*");
    return res.json({ order: orderForClient, preferenceId });
  } catch (err) {
    console.error("createCheckout error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

/**
 * POST /webhookMercadoPago
 * Mercado Pago chama aqui quando houver atualização de pagamento.
 */
app.post("/webhookMercadoPago", async (req, res) => {
  try {
    const data = req.body?.data;

    // responde rápido
    res.status(200).send("ok");

    const paymentId = data?.id;
    if (!paymentId) return;

    const paymentApi = new Payment(mpClient());
    const payment = await paymentApi.get({ id: paymentId });

    const status = payment.status; // approved, rejected, pending...
    const status_detail = payment.status_detail;
    const pedidoId = payment.metadata?.pedidoId || payment.external_reference;

    if (!pedidoId) return;

    const ref = db.collection("pedidos").doc(String(pedidoId));

    await ref.set(
      {
        pagamento: {
          mpPaymentId: paymentId,
          status,
          status_detail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        status: status === "approved" ? "paid" : "awaiting_payment",
      },
      { merge: true }
    );
  } catch (err) {
    console.error("webhook error:", err);
    // já respondeu 200 acima
  }
});

/**
 * OPTIONS /processPayment
 */
app.options("/processPayment", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.status(204).send("");
});

/**
 * POST /processPayment
 * Cria pagamento PIX ou cartão usando o payload do Payment Brick.
 */
app.post("/processPayment", async (req, res) => {
  try {
    const {
      token, // token do cartão (cartão)
      payment_method_id,
      issuer_id,
      installments,
      transaction_amount,
      payer,
      description,
      external_reference,
    } = req.body || {};

    if (!transaction_amount) {
      return res.status(400).json({ error: "transaction_amount obrigatório" });
    }
    if (!payment_method_id) {
      return res.status(400).json({ error: "payment_method_id obrigatório" });
    }

    const payerEmail = (payer?.email || "").trim().toLowerCase();
    if (!payerEmail) {
      return res.status(400).json({ error: "payer.email obrigatório" });
    }

    const paymentApi = new Payment(mpClient());

    // ✅ PIX
    if (payment_method_id === "pix") {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const body = {
        transaction_amount: Number(transaction_amount),
        description: description || "Pedido Luviê",
        payment_method_id: "pix",
        date_of_expiration: expiresAt,
        external_reference: external_reference || undefined,
        payer: { email: payerEmail },
        metadata: { pedidoId: external_reference || "" },
      };

      // log seguro
      console.log("MP create PIX body:", JSON.stringify(body));

      const created = await paymentApi.create({ body });

      const tx = created?.point_of_interaction?.transaction_data || {};

      if (external_reference) {
        await db
          .collection("pedidos")
          .doc(String(external_reference))
          .set(
            {
              pagamento: {
                mpPaymentId: created.id,
                method: "pix",
                status: created.status,
                status_detail: created.status_detail,
                expiresAt,
                pix: {
                  qr_code: tx.qr_code || "",
                  qr_code_base64: tx.qr_code_base64 || "",
                  ticket_url: tx.ticket_url || "",
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              status: "awaiting_payment",
            },
            { merge: true }
          );
      }

      res.set("Access-Control-Allow-Origin", "*");
      return res.json({
        id: created.id,
        status: created.status,
        status_detail: created.status_detail,
        payment_method_id: "pix",
        expiresAt,
        pix: {
          qr_code: tx.qr_code || "",
          qr_code_base64: tx.qr_code_base64 || "",
          ticket_url: tx.ticket_url || "",
        },
      });
    }

    // ✅ CARTÃO
    const body = {
      token: token || undefined,
      payment_method_id,
      issuer_id: issuer_id || undefined,
      installments: installments ? Number(installments) : undefined,
      transaction_amount: Number(transaction_amount),
      description: description || "Pedido Luviê",
      external_reference: external_reference || undefined,
      payer: {
        email: payerEmail,
        ...(payer?.first_name ? { first_name: payer.first_name } : {}),
        ...(payer?.last_name ? { last_name: payer.last_name } : {}),
        ...(payer?.identification?.type && payer?.identification?.number
          ? {
              identification: {
                type: payer.identification.type,
                number: payer.identification.number,
              },
            }
          : {}),
      },
      metadata: { pedidoId: external_reference || "" },
    };

    // log seguro (não vaza token)
    const safeBody = { ...body, token: body.token ? "***" : undefined };
    console.log("MP create CARD body:", JSON.stringify(safeBody));

    const created = await paymentApi.create({ body });

    if (external_reference) {
      await db
        .collection("pedidos")
        .doc(String(external_reference))
        .set(
          {
            pagamento: {
              mpPaymentId: created.id,
              method: "card",
              status: created.status,
              status_detail: created.status_detail,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            status: created.status === "approved" ? "paid" : "awaiting_payment",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    res.set("Access-Control-Allow-Origin", "*");
    return res.json({
      id: created.id,
      status: created.status,
      status_detail: created.status_detail,
      payment_method_id,
    });
  } catch (err) {
    // ✅ logs que ajudam MUITO quando mp vem null
    console.error("processPayment error raw:", err);
    console.error("processPayment err keys:", Object.keys(err || {}));
    console.error("processPayment err message:", String(err?.message || err));
    console.error("processPayment err response:", err?.response);
    console.error("processPayment err cause:", err?.cause);

    // tenta extrair erro do Mercado Pago em vários formatos
    const mpRaw =
      (Array.isArray(err?.cause) ? err.cause : null) ||
      err?.cause ||
      err?.response?.data ||
      err?.response ||
      null;

    const mp = Array.isArray(mpRaw) ? (mpRaw.length ? mpRaw : null) : mpRaw;

    // ✅ Se tem mp => erro do MP (400)
    if (mp) {
      return res.status(400).json({
        error: "mp_error",
        message: err?.message || "Mercado Pago error",
        mp,
      });
    }

    // ✅ Se NÃO tem mp => erro interno/SDK/rede (500)
    return res.status(500).json({
      error: "internal_error",
      message: err?.message || "internal_error",
    });
  }
});

/**
 * OPTIONS /paymentStatus
 */
app.options("/paymentStatus", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.status(204).send("");
});

/**
 * GET /paymentStatus?paymentId=123
 */
app.get("/paymentStatus", async (req, res) => {
  try {
    const paymentId = String(req.query.paymentId || "");
    if (!paymentId) {
      return res.status(400).json({ error: "paymentId obrigatório" });
    }

    const paymentApi = new Payment(mpClient());
    const payment = await paymentApi.get({ id: paymentId });

    res.set("Access-Control-Allow-Origin", "*");
    return res.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
    });
  } catch (err) {
    console.error("paymentStatus error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

export const api = onRequest(
  {
    region: "us-central1",
    secrets: [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET],
  },
  app
);

/**
 * Storage trigger: gera thumb e grava no Firestore
 */
export const generateProductThumb = onObjectFinalized(
  { region: "us-central1" },
  async (event) => {
    const filePath = event.data.name; // ex: produtos/ABC123/capa.jpg
    const bucketName = event.data.bucket;

    if (!filePath) return;
    if (!filePath.startsWith("produtos/")) return;

    // evita loop
    if (filePath.includes("/thumb.")) return;
    if (filePath.includes("_thumb")) return;

    const parts = filePath.split("/");
    const produtoId = parts[1];
    if (!produtoId) return;

    const bucketRef = storage.bucket(bucketName);

    const originalName = parts[parts.length - 1];
    const tmpOriginal = `/tmp/${produtoId}-${originalName}`;
    const tmpThumb = `/tmp/${produtoId}-thumb.jpg`;

    await bucketRef.file(filePath).download({ destination: tmpOriginal });

    await sharp(tmpOriginal).resize({ width: 300 }).jpeg({ quality: 70 }).toFile(tmpThumb);

    const thumbPath = `produtos/${produtoId}/thumb.jpg`;
    const token = crypto.randomUUID();

    await bucketRef.upload(tmpThumb, {
      destination: thumbPath,
      metadata: {
        contentType: "image/jpeg",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const encoded = encodeURIComponent(thumbPath);
    const fotoThumbUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;

    await db.collection("produtos").doc(produtoId).set(
      {
        fotoThumbUrl,
        thumbPath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log("Thumbnail criada + Firestore atualizado:", produtoId);
  }
);