import { navigate } from "../router.js";
import { subscribeCustomers, createCustomer } from "../services/customers.js";
import { subscribeProducts } from "../services/products.js";
import { createOrder } from "../services/orders.js";
import { getSelectedProducts, setSelectedCustomer, getSelectedCustomer, clearSelectedProducts } from "../store.js";

let unsubCustomers = null;
let unsubProducts = null;

export function renderCustomers(mount) {
  const selectedProductIds = getSelectedProducts();
  if (!selectedProductIds.length) {
    alert("Nenhum produto selecionado. Volte e selecione produtos.");
    navigate("/");
    return;
  }

  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Clientes</h1>
        <span class="small">${selectedProductIds.length} item(ns)</span>
      </header>

      <div class="row">
        <button class="btn btn-ghost" id="btnVoltar" type="button">Voltar</button>
        <button class="btn btn-primary" id="btnNovoCliente" type="button">Cadastrar Cliente</button>
      </div>

      <section class="grid" id="clientesList" style="grid-template-columns: 1fr;"></section>
    </main>

    <button class="cta cta-fixed" id="btnGerarLink" type="button">Gerar link</button>

    <nav class="nav">
      <div class="nav-inner">
        <button class="nav-btn" id="navHome" title="Home"></button>
        <button class="nav-btn" id="navPedidos" title="Pedidos"></button>
        <button class="nav-btn" id="navRel" title="Relatórios"></button>
      </div>
    </nav>
  `;

  mount.querySelector("#btnVoltar").addEventListener("click", () => navigate("/"));
  mount.querySelector("#navHome").addEventListener("click", () => navigate("/"));

  mount.querySelector("#btnNovoCliente").addEventListener("click", async () => {
    const nome = prompt("Nome da cliente:");
    if (!nome) return;

    const telefone = prompt("Telefone (opcional):") || "";
    const endereco = prompt("Endereço (opcional):") || "";

    await createCustomer({ nome, telefone, endereco });
  });

  const list = mount.querySelector("#clientesList");
  const btnGerar = mount.querySelector("#btnGerarLink");

  // cache de produtos pra montar itens/total
  let productsCache = [];

  if (unsubProducts) unsubProducts();
  unsubProducts = subscribeProducts((produtos) => { productsCache = produtos; });

  if (unsubCustomers) unsubCustomers();
  unsubCustomers = subscribeCustomers((clientes) => {
    const current = getSelectedCustomer();
    const currentId = current?.id || "";

    list.innerHTML = "";
    clientes.forEach(c => {
      const card = document.createElement("button");
      card.className = "card" + (c.id === currentId ? " selected" : "");
      card.type = "button";
      card.innerHTML = `
        <div class="meta">
          <p class="name">${escapeHtml(c.nome || "")}</p>
          <p class="price">${escapeHtml(c.telefone || "")}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        setSelectedCustomer({
          id: c.id,
          nome: c.nome || "",
          telefone: c.telefone || "",
          endereco: c.endereco || ""
        });

        // re-render pra mostrar destaque
        renderCustomers(mount);
      });
      list.appendChild(card);
    });
  });

  btnGerar.addEventListener("click", async () => {
    const cliente = getSelectedCustomer();
    if (!cliente?.id) return alert("Selecione uma cliente.");

    const ids = getSelectedProducts();
    if (!ids.length) return alert("Selecione pelo menos 1 produto.");

    const set = new Set(ids);

    // monta itens (qtd=1 por enquanto)
    const itens = productsCache
      .filter(p => set.has(p.id))
      .map(p => ({
        produtoId: p.id,
        titulo: p.titulo || "",
        preco: Number(p.preco || 0),
        qtd: 1
      }));

    const total = itens.reduce((sum, it) => sum + (it.preco * (it.qtd || 1)), 0);

    const { publicToken } = await createOrder({ cliente, itens, total });

    const link = `${location.origin}${location.pathname}#/checkout?t=${encodeURIComponent(publicToken)}`;

    // opcional: limpar seleção após gerar pedido
    clearSelectedProducts();

    // compartilhar no iPhone
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Pagamento Luviê",
          text: `Olá ${cliente.nome}, segue o link do pagamento:`,
          url: link
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert("Link copiado!");
      } else {
        alert(link);
      }
    } catch (e) {
      // se usuário cancelar o share, não é erro grave
      console.log("share/copy cancelado:", e);
      alert(link);
    }

    // (mais tarde: navegar direto pro checkout pra você testar)
    // navigate(`/checkout?t=${publicToken}`);
  });
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}