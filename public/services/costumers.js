import { db } from "../firebase.js";
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const col = collection(db, "clientes");

export function subscribeCustomers(callback) {
  const q = query(col, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export async function createCustomer({ nome, telefone, endereco }) {
  const docRef = await addDoc(col, {
    nome: String(nome || "").trim(),
    telefone: String(telefone || "").trim(),
    endereco: String(endereco || "").trim(),
    createdAt: serverTimestamp()
  });
  return docRef.id;
}