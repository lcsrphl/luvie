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

    const statusConfig = {
  paid: {
    title: "Pedido em separação ✅",
    message:
      "Seu pagamento foi confirmado e estamos separando seus produtos.",
  },

  awaiting_shipping: {
    title: "Pedido aguardando envio 📦",
    message:
      "Seu pedido já foi separado e embalado. Agora ele está aguardando o envio.",
  },

  shipped: {
    title: "Pedido enviado 🚚",
    message:
      "Seu pedido já foi enviado e está a caminho.",
  },

  delivered: {
    title: "Pedido entregue ✅",
    message:
      "Seu pedido foi marcado como entregue.",
  },
};

const currentStatus =
  statusConfig[pedido.status] ||
  statusConfig.paid;

mount.querySelector("#title").textContent =
  currentStatus.title;

mount.querySelector("#msg").textContent =
  `Olá ${pedido.clienteNome || "cliente"}, ${currentStatus.message}`;
  });
}