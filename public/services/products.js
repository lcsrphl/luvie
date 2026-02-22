import { db, storage } from "./firebase.js";
import {
  collection, addDoc, updateDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const col = collection(db, "produtos");

export function subscribeProducts(callback) {
  const q = query(col, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export async function createProduct({ titulo, preco, file }) {
  // 1) cria o doc primeiro (pra gerar ID)
  const docRef = await addDoc(col, {
    titulo,
    preco: Number(preco),
    fotoUrl: "",
    fotoPath: "",
    createdAt: serverTimestamp()
  });

  // 2) sobe foto no Storage usando o ID
  const path = `produtos/${docRef.id}/capa.jpg`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg"
  });

  const fotoUrl = await getDownloadURL(storageRef);

  // 3) atualiza doc com url/path
  await updateDoc(doc(db, "produtos", docRef.id), {
    fotoUrl,
    fotoPath: path
  });

  return docRef.id;
}