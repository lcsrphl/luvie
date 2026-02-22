import { navigate } from "../router.js";
import { subscribeCustomers, createCustomer } from "../services/customers.js";
import { getSelectedProducts } from "../store.js";

let unsub = null;

export function renderCustomers(mount) {
  const selected = getSelectedProducts();
  if (!selected.length) {
    alert("Nenhum produto selecionado. Volte e selecione produtos.");
    navigate("/");
    return;
  }

  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Clientes</h1>
        <span class="small">${selected.length} item(ns)</span>
      </header>

      <div class="row">
        <button class="btn btn-ghost" id="btnVoltar">Voltar</button>
        <button class="btn btn-primary" id="btnNovoCliente">Cadastrar Cliente</button>
      </div>

      <section class="grid" id="clientesList" style="grid-template-columns: 1fr;"></section>
    </main>

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

  if (unsub) unsub();
  unsub = subscribeCustomers((clientes) => {
    list.innerHTML = "";
    clientes.forEach(c => {
      const card = document.createElement("button");
      card.className = "card";
      card.type = "button";
      card.innerHTML = `
        <div class="meta">
          <p class="name">${escapeHtml(c.nome || "")}</p>
          <p class="price">${escapeHtml(c.telefone || "")}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        // próximo passo depois: salvar cliente selecionado e ir pro checkout
        alert(`Selecionou: ${c.nome}`);
      });
      list.appendChild(card);
    });
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