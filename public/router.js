const routes = new Map();

export function addRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function navigate(path) {
  window.location.hash = path;
}

function parseHash() {
  const hash = window.location.hash.replace("#", "") || "/";
  const [path, qs = ""] = hash.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { path, query };
}

export function startRouter(mount) {
  function handle() {
    const { path, query } = parseHash();
    const render = routes.get(path) || routes.get("/");
    render(mount, { path, query });
  }
  window.addEventListener("hashchange", handle);
  handle();
}