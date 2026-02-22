import { navigate } from "../router.js";
import { subscribeProducts } from "../services/products.js";

let unsubscribe = null;

export function renderHome(mount) {
  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Luviê</h1>
        <span class="small">Home</span>
      </header>

      <section class="grid" id="grid">
        <button class="card" id="btnNovoProduto" type="button">
          <div class="thumb"><div class="plus">+</div></div>
          <div class="meta">
            <p class="name">Novo Produto</p>
            <p class="price">Adicionar</p>
          </div>
        </button>
      </section>
    </main>

    <button class="cta cta-fixed" id="btnNovoPedido" type="button">Novo Pedido</button>

    <nav class="nav">
      <div class="nav-inner">
        <button class="nav-btn" id="navHome" title="Home"></button>
        <button class="nav-btn" id="navPedidos" title="Pedidos"></button>
        <button class="nav-btn" id="navRel" title="Relatórios"></button>
      </div>
    </nav>
  `;

  mount.querySelector("#btnNovoProduto").addEventListener("click", () => navigate("/novo-produto"));
  mount.querySelector("#btnNovoPedido").addEventListener("click", () => alert("Depois: fluxo de pedido"));

  const grid = mount.querySelector("#grid");

  // evita múltiplas subscriptions se voltar pra home
  if (unsubscribe) unsubscribe();

  unsubscribe = subscribeProducts((produtos) => {
    // mantém o card Novo Produto sempre no topo
    const firstCard = grid.firstElementChild;
    grid.innerHTML = "";
    grid.appendChild(firstCard);

    produtos.forEach(p => {
      const card = document.createElement("button");
      card.className = "card";
      card.type = "button";
      card.innerHTML = `
        <div class="thumb">
          ${p.fotoUrl ? `<img src="${p.fotoUrl}" alt="${p.titulo}">` : `<div class="plus">?</div>`}
        </div>
        <div class="meta">
          <p class="name">${escapeHtml(p.titulo || "")}</p>
          <p class="price">R$ ${formatBRL(p.preco)}</p>
        </div>
      `;
      card.addEventListener("click", () => alert(`Produto: ${p.titulo}`));
      grid.appendChild(card);
    });
  });
}

function formatBRL(value){
  const n = Number(value || 0);
  return n.toFixed(2).replace(".", ",");
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}