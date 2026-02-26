import { db } from "../firebase.js";
import {
  collection, addDoc, serverTimestamp,
  query, where, orderBy, onSnapshot,
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const pedidosCol = collection(db, "pedidos");

function genToken(len = 18) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function cleanUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export async function createOrder({ cliente, itens, total }) {
  // ✅ trava cedo com erro claro
  if (!cliente?.id) throw new Error("createOrder: cliente.id obrigatório");
  if (!cliente?.nome) throw new Error("createOrder: cliente.nome obrigatório");
  if (!cliente?.email) throw new Error("createOrder: cliente.email obrigatório");
  if (!Array.isArray(itens) || itens.length === 0) throw new Error("createOrder: itens obrigatório");

  const publicToken = genToken();

  const payload = cleanUndefined({
    publicToken,
    status: "awaiting_payment",

    clienteId: String(cliente.id),
    clienteNome: String(cliente.nome),
    clienteEmail: String(cliente.email).trim().toLowerCase(), // ✅ AQUI

    itens,
    total: Number(total || 0),

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const docRef = await addDoc(pedidosCol, payload);

  return { pedidoId: docRef.id, publicToken };
}

// ✅ LISTA APENAS PAGOS
export function subscribePaidOrders(callback) {
  const q = query(
    pedidosCol,
    where("status", "==", "paid"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

// ✅ DETALHE
export async function getOrderById(pedidoId) {
  const ref = doc(db, "pedidos", pedidoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ✅ PÁGINA PÚBLICA PELO TOKEN
export function subscribeOrderByToken(token, callback) {
  const q = query(
    pedidosCol,
    where("publicToken", "==", token)
  );

  return onSnapshot(q, (snap) => {
    if (snap.empty) return callback(null);
    const d = snap.docs[0];
    callback({ id: d.id, ...d.data() });
  });
}