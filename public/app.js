// ✅ configs globais (fronti)
window.__MP_PUBLIC_KEY__ = "APP_USR-5638c864-e6ba-41e1-8940-ad618742560e";
window.__API_BASE_URL__ = "https://us-central1-luvie-app-2026.cloudfunctions.net/api";

import { addRoute, startRouter } from "./router.js";

import { renderHome } from "./views/home.js";
import { renderNewProduct } from "./views/new-product.js";
import { renderCustomers } from "./views/customers.js";
import { renderCheckout } from "./views/checkout.js";

// ✅ NOVAS TELAS
import { renderOrders } from "./views/orders.js";
import { renderOrderDetails } from "./views/order-details.js";
import { renderTracking } from "./views/tracking.js";

// rotas existentes
addRoute("/", renderHome);
addRoute("/novo-produto", renderNewProduct);
addRoute("/clientes", renderCustomers);
addRoute("/checkout", renderCheckout);

// ✅ rotas novas
addRoute("/pedidos", renderOrders);
addRoute("/pedido", renderOrderDetails);     // usa /pedido?id=XXXX
addRoute("/acompanhar", renderTracking);     // usa /acompanhar?t=TOKEN

startRouter(document.getElementById("app"));