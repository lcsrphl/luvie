// ✅ configs globais (front)
window.__MP_PUBLIC_KEY__ = "TEST-51eb8f56-5597-4c1d-be93-3307bdbcf463"; 
// depois que você criar Cloud Functions, você vai colocar aqui a URL da API:
window.__API_BASE_URL__ = "https://us-central1-luvie-app-2026.cloudfunctions.net/api";


import { addRoute, startRouter } from "./router.js";
import { renderHome } from "./views/home.js";
import { renderNewProduct } from "./views/new-product.js";
import { renderCustomers } from "./views/customers.js";
import { renderCheckout } from "./views/checkout.js";
addRoute("/checkout", renderCheckout);

addRoute("/", renderHome);
addRoute("/novo-produto", renderNewProduct);
addRoute("/clientes", renderCustomers);

startRouter(document.getElementById("app"));