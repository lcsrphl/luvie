const routes = new Map();

export function addRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function navigate(path) {
  window.location.hash = path;
}

export function startRouter() {
  function handle() {
    const path = window.location.hash.replace("#", "") || "/";
    const render = routes.get(path) || routes.get("/");
    render();
  }
  window.addEventListener("hashchange", handle);
  handle();
}