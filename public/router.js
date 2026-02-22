const routes = new Map();

export function addRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function navigate(path) {
  window.location.hash = path;
}

export function startRouter() {
  const mount = document.getElementById("app"); // 👈 onde as telas serão renderizadas

  function handle() {
    const path = window.location.hash.replace("#", "") || "/";
    const render = routes.get(path) || routes.get("/");

    if (!render) {
      console.error("Rota não encontrada:", path);
      return;
    }

    render(mount); // 👈 passa o mount pra tela
  }

  window.addEventListener("hashchange", handle);
  handle();
}