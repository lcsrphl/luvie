export async function createCheckout(token) {
  const url = window.__API_BASE_URL__ + "/createCheckout";

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error("createCheckout falhou: " + txt);
  }

  return r.json();
}