import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// SDK Mercado Pago
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 🔒 NUNCA coloque Access Token no front.
const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");
// (opcional) webhook secret
const MP_WEBHOOK_SECRET = defineSecret("MP_WEBHOOK_SECRET");

// sua base pública das functions (api)
const PUBLIC_FUNCTIONS_BASE_URL =
  "https://us-central1-luvie-app-2026.cloudfunctions.net/api";

function mpClient() {
  const token = MP_ACCESS_TOKEN.value();
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado.");
  return new MercadoPagoConfig({ accessToken: token });
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
    if (snap.empty) return res.status(404).json({ error: "Pedido não encontrado" });

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
      itens: pedido.itens || [],
      total: Number(pedido.total || 0),
      pedidoId: pedido.id || doc.id, // ajuda no front
    };

    res.set("Access-Control-Allow-Origin", "*");
    return res.json({ order: orderForClient, preferenceId });
  } catch (err) {
    console.error(err);
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
      external_reference, // use como pedidoId
    } = req.body || {};

    if (!transaction_amount) {
      return res.status(400).json({ error: "transaction_amount obrigatório" });
    }
    if (!payment_method_id) {
      return res.status(400).json({ error: "payment_method_id obrigatório" });
    }
    if (!payer?.email) {
      return res.status(400).json({ error: "payer.email obrigatório" });
    }

    const paymentApi = new Payment(mpClient());

    // ✅ PIX: copia e cola + expira em 5 min
    if (payment_method_id === "pix") {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const created = await paymentApi.create({
        body: {
          transaction_amount: Number(transaction_amount),
          description: description || "Pedido Luviê",
          payment_method_id: "pix",
          date_of_expiration: expiresAt,
          external_reference: external_reference || undefined,
          payer: { email: payer.email },
          notification_url: `${PUBLIC_FUNCTIONS_BASE_URL}/webhookMercadoPago`,
          metadata: { pedidoId: external_reference || "" },
        },
      });

      const tx = created?.point_of_interaction?.transaction_data || {};

      // salva no Firestore
      if (external_reference) {
        await db.collection("pedidos").doc(String(external_reference)).set(
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

    // ✅ Cartão (mantém seu comportamento)
    const created = await paymentApi.create({
      body: {
        token: token || undefined,
        payment_method_id,
        issuer_id: issuer_id || undefined,
        installments: installments ? Number(installments) : undefined,
        transaction_amount: Number(transaction_amount),
        description: description || "Pedido Luviê",
        external_reference: external_reference || undefined,
        payer: {
          email: payer.email,
          first_name: payer.first_name || undefined,
          last_name: payer.last_name || undefined,
          identification: payer.identification || undefined,
        },
        notification_url: `${PUBLIC_FUNCTIONS_BASE_URL}/webhookMercadoPago`,
        metadata: { pedidoId: external_reference || "" },
      },
    });

    if (external_reference) {
      await db.collection("pedidos").doc(String(external_reference)).set(
        {
          pagamento: {
            mpPaymentId: created.id,
            method: "card",
            status: created.status,
            status_detail: created.status_detail,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
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
    console.error("processPayment error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
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
 * Consulta o status do pagamento no Mercado Pago.
 */
app.get("/paymentStatus", async (req, res) => {
  try {
    const paymentId = String(req.query.paymentId || "");
    if (!paymentId) return res.status(400).json({ error: "paymentId obrigatório" });

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