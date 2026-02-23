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
// Coloque como variável de ambiente no deploy (GitHub Actions).
const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");
// (opcional) webhook secret
const MP_WEBHOOK_SECRET = defineSecret("MP_WEBHOOK_SECRET");
// (opcional) base url
const PUBLIC_FUNCTIONS_BASE_URL = defineSecret("PUBLIC_FUNCTIONS_BASE_URL");

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

    // procura o pedido pelo token público
    const snap = await db.collection("pedidos").where("publicToken", "==", token).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Pedido não encontrado" });

    const doc = snap.docs[0];
    const pedido = { id: doc.id, ...doc.data() };

    // Se já tiver preferenceId salvo, reutiliza (evita criar preferências infinitas)
    let preferenceId = pedido?.checkout?.preferenceId || "";

    if (!preferenceId) {
      // monta items para o MP
      const items = (pedido.itens || []).map((it) => ({
        title: it.titulo,
        quantity: Number(it.qtd || 1),
        unit_price: Number(it.preco || 0)
      }));

      const preference = new Preference(mpClient());
      const created = await preference.create({
        body: {
          items,
          // seu “pedido interno”
          external_reference: doc.id,
          notification_url: `${PUBLIC_FUNCTIONS_BASE_URL.value()}/webhookMercadoPago`,
          metadata: {
            pedidoId: doc.id,
            token
          }
        }
      });

      preferenceId = created.id;

      await doc.ref.set(
        { status: "awaiting_payment", checkout: { preferenceId } },
        { merge: true }
      );
    }

    // dados pro front renderizar a página bonita
    const orderForClient = {
      clienteNome: pedido.clienteNome || "",
      itens: pedido.itens || [],
      total: Number(pedido.total || 0)
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
    // MP manda diferentes formatos dependendo do evento.
    // O mais comum é vir um id de payment.
    const data = req.body?.data;
    const type = req.body?.type;

    // responde rápido pro MP
    res.status(200).send("ok");

    // se não tiver payment id, não dá pra processar
    const paymentId = data?.id;
    if (!paymentId) return;

    const paymentApi = new Payment(mpClient());
    const payment = await paymentApi.get({ id: paymentId });

    const status = payment.status; // approved, rejected, pending...
    const pedidoId = payment.metadata?.pedidoId || payment.external_reference;

    if (!pedidoId) return;

    const ref = db.collection("pedidos").doc(String(pedidoId));

    await ref.set(
      {
        pagamento: {
          mpPaymentId: paymentId,
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        status: status === "approved" ? "paid" : "awaiting_payment"
      },
      { merge: true }
    );
  } catch (err) {
    console.error("webhook error:", err);
    // já respondeu 200 acima, então só loga
  }
});

export const api = onRequest({ region: "us-central1" }, app);