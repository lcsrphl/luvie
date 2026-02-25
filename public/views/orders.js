import { navigate } from "../router.js";
import { subscribePaidOrders } from "../services/orders.js";

let unsub = null;

export function renderOrders(mount) {
  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Pedidos</h1>
        <span class="small">Pagos</span>
      </header>

      <section class="grid" id="ordersList" style="grid-template-columns: 1fr;"></section>
    </main>

    <nav class="nav">
      <div class="nav-inner">
        <button class="nav-btn" id="navHome" title="Home"></button>
        <button class="nav-btn" id="navPedidos" title="Pedidos"></button>
        <button class="nav-btn" id="navRel" title="Relatórios"></button>
      </div>
    </nav>
  `;

  mount.querySelector("#navHome").addEventListener("click", () => navigate("/"));
mount.querySelector("#navPedidos").addEventListener("click", () => navigate("/pedidos"));
  mount.querySelector("#navHome").addEventListener("click", () => navigate("/"));
  mount.querySelector("#navPedidos").addEventListener("click", () => navigate("/pedidos"));

  const list = mount.querySelector("#ordersList");

  if (unsub) unsub();
  unsub = subscribePaidOrders((pedidos) => {
    list.innerHTML = "";

    if (!pedidos.length) {
      list.innerHTML = `<div class="small" style="padding:12px;">Nenhum pedido pago ainda.</div>`;
      return;
    }

    pedidos.forEach(p => {
      const card = document.createElement("button");
      card.className = "card";
      card.type = "button";
      card.innerHTML = `
        <div class="meta">
          <p class="name">${escapeHtml(p.clienteNome || "Cliente")}</p>
          <p class="price">
            ${formatBRL(p.total)} • ${((p.itens || []).length)} item(ns)
          </p>
        </div>
      `;

      card.addEventListener("click", () => {
        navigate(`/pedido?id=${encodeURIComponent(p.id)}`);
      });

      list.appendChild(card);
    });
  });
}

function formatBRL(v){
  const n = Number(v || 0);
  return "R$ " + n.toFixed(2).replace(".", ",");
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}