import { addRoute, startRouter } from "./router.js";
import { renderHome } from "./views/home.js";
import { renderNewProduct } from "./views/new-product.js";
import { renderCustomers } from "./views/customers.js";

addRoute("/", renderHome);
addRoute("/novo-produto", renderNewProduct);
addRoute("/clientes", renderCustomers);

startRouter();