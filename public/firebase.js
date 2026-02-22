console.log("firebase.js carregou");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
console.log("BUCKET:", app.options.storageBucket);
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
  // COLE AQUI O CONFIG WEB (apiKey, authDomain, projectId, storageBucket, etc)
apiKey: "AIzaSyBG5APhYUjDK8yG5u8JT_0A7fcsyYALEu0",
authDomain: "luvie-app-2026.firebaseapp.com",
projectId: "luvie-app-2026", 
storageBucket: "luvie-app-2026.firebasestorage.app",
messagingSenderId: "520070032005",
appId: "1:520070032005:web:a5e558440d7680e7d6d7ec"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);