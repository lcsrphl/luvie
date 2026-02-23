const KEY = "luvie:selectedProducts";

export function getSelectedProducts() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function setSelectedProducts(ids) {
  sessionStorage.setItem(KEY, JSON.stringify(ids));
}

export function toggleSelectedProduct(id) {
  const ids = new Set(getSelectedProducts());
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  const arr = Array.from(ids);
  setSelectedProducts(arr);
  return arr;
}

export function clearSelectedProducts() {
  sessionStorage.removeItem(KEY);
}