import { db } from "../firebase.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const pedidosCol = collection(db, "pedidos");

function genToken(len = 18) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createOrder({ clienteId, clienteNome, itens, total }) {
  const publicToken = genToken();

  const docRef = await addDoc(pedidosCol, {
    publicToken,
    status: "draft",
    clienteId,
    clienteNome,
    itens,
    total: Number(total || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { pedidoId: docRef.id, publicToken };
}