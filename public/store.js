const KEY_CUSTOMER = "luvie:selectedCustomer";

export function setSelectedCustomer(customer) {
  // customer: { id, nome, telefone, endereco }
  sessionStorage.setItem(KEY_CUSTOMER, JSON.stringify(customer || null));
}

export function getSelectedCustomer() {
  try { return JSON.parse(sessionStorage.getItem(KEY_CUSTOMER) || "null"); }
  catch { return null; }
}

export function clearSelectedCustomer() {
  sessionStorage.removeItem(KEY_CUSTOMER);
}