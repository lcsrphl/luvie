import { addRoute, startRouter } from "./router.js";
import { renderHome } from "./views/home.js";
import { renderNewProduct } from "./views/new-product.js";

const mount = document.querySelector("#app");

addRoute("/", () => renderHome(mount));
addRoute("/novo-produto", () => renderNewProduct(mount));

startRouter();