import { subscribeOrderByToken } from "../services/orders.js";

let unsub = null;

export function renderTracking(mount, ctx) {
  const token = ctx?.query?.t || "";

  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Luviê</h1>
        <span class="small">Acompanhamento</span>
      </header>

      <section class="card" style="padding:14px;">
        <p class="name" id="title">Carregando...</p>
        <p class="small" id="msg" style="margin-top:8px;"></p>
      </section>
    </main>
  `;

  if (!token) {
    mount.querySelector("#title").textContent = "Link inválido.";
    return;
  }

  if (unsub) unsub();
  unsub = subscribeOrderByToken(token, (pedido) => {
    if (!pedido) {
      mount.querySelector("#title").textContent = "Pedido não encontrado.";
      mount.querySelector("#msg").textContent = "";
      return;
    }

    mount.querySelector("#title").textContent = "Pedido em separação ✅";
    mount.querySelector("#msg").textContent =
      `Olá ${pedido.clienteNome || "cliente"}, seu pedido foi confirmado e está sendo separado.`;
  });
}