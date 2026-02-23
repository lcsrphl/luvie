const KEY = "luvie_state_v1";

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function save(s) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function getSelectedProductIds() {
  const s = load();
  return Array.isArray(s.selectedProductIds) ? s.selectedProductIds : [];
}

export function setSelectedProductIds(ids) {
  const s = load();
  s.selectedProductIds = Array.from(new Set(ids));
  save(s);
}

export function clearSelectedProductIds() {
  const s = load();
  s.selectedProductIds = [];
  save(s);
}

export function getSelectedCustomerId() {
  const s = load();
  return s.selectedCustomerId || "";
}

export function setSelectedCustomerId(id) {
  const s = load();
  s.selectedCustomerId = id;
  save(s);
}

export function clearSelectedCustomerId() {
  const s = load();
  s.selectedCustomerId = "";
  save(s);
}