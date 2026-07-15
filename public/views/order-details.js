import { navigate } from "../router.js";
import { getOrderById, updateOrderStatus } from "../services/orders.js";

export async function renderOrderDetails(mount, ctx) {
  const id = ctx?.query?.id || "";

  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Pedido</h1>
        <span class="small">Detalhes</span>
      </header>

      <section class="card" style="padding:14px;">
        <p class="name" id="cliente">Carregando...</p>
        <div id="itens" class="small" style="margin-top:10px;"></div>
        <p class="name" style="margin-top:12px;">Total: <span id="total">—</span></p>
      </section>

      <div style="height:12px;"></div>

      <div class="row">
        <button class="btn btn-ghost" id="btnVoltar">Voltar</button>
        <button class="btn btn-primary" id="btnSep">Carregando...</button>
      </div>
    </main>

    <nav class="nav">
      <div class="nav-inner">
        <button class="nav-btn" id="navHome" title="Home"></button>
        <button class="nav-btn" id="navPedidos" title="Pedidos"></button>
        <button class="nav-btn" id="navRel" title="Relatórios"></button>
      </div>
    </nav>
  `;

  mount.querySelector("#btnVoltar").addEventListener("click", () => navigate("/pedidos"));
  mount.querySelector("#navHome").addEventListener("click", () => navigate("/"));
  mount.querySelector("#navPedidos").addEventListener("click", () => navigate("/pedidos"));

  if (!id) {
    mount.querySelector("#cliente").textContent = "Pedido inválido.";
    return;
  }

  const pedido = await getOrderById(id);
  if (!pedido) {
    mount.querySelector("#cliente").textContent = "Pedido não encontrado.";
    return;
  }

  mount.querySelector("#cliente").textContent = pedido.clienteNome || "Cliente";

  mount.querySelector("#total").textContent =
    "R$ " + Number(pedido.total || 0).toFixed(2).replace(".", ",");

  mount.querySelector("#itens").innerHTML = (pedido.itens || []).map(it => {
  const qtd = Number(it.qtd || 1);
  const pr = Number(it.preco || 0);

  const img =
    it.fotoThumbUrl ||
    it.fotoUrl ||
    "";

  return `
    <div
      style="
        display:flex;
        align-items:center;
        gap:12px;
        padding:10px 0;
        border-bottom:1px solid rgba(0,0,0,0.08);
      "
    >
      <div
        style="
          width:72px;
          height:72px;
          flex-shrink:0;
          border-radius:10px;
          overflow:hidden;
          background:#f2f2f2;
          display:flex;
          align-items:center;
          justify-content:center;
        "
      >
        ${
          img
            ? `
              <img
                src="${img}"
                alt="${escapeHtml(it.titulo || "")}"
                style="
                  width:100%;
                  height:100%;
                  object-fit:cover;
                "
              >
            `
            : `<span style="font-size:12px;">Sem foto</span>`
        }
      </div>

      <div style="flex:1;">
        <div class="name">
          ${escapeHtml(it.titulo || "Produto")}
        </div>

        <div class="small" style="margin-top:4px;">
          R$ ${pr.toFixed(2).replace(".", ",")} • Quantidade: ${qtd}
        </div>
      </div>
    </div>
  `;
}).join("");

  // por enquanto só “simula”
  const btnStatus = mount.querySelector("#btnSep");

const statusConfig = {
  paid: {
    buttonText: "Separado e embalado",
    nextStatus: "awaiting_shipping",
  },

  awaiting_shipping: {
    buttonText: "Marcar como enviado",
    nextStatus: "shipped",
  },

  shipped: {
    buttonText: "Marcar como entregue",
    nextStatus: "delivered",
  },

  delivered: {
    buttonText: "Pedido entregue",
    nextStatus: null,
  },
};

let statusAtual = pedido.status || "paid";

function atualizarBotao() {
  const config =
    statusConfig[statusAtual] ||
    statusConfig.paid;

  btnStatus.textContent = config.buttonText;

  if (!config.nextStatus) {
    btnStatus.disabled = true;
  }
}

atualizarBotao();

btnStatus.addEventListener("click", async () => {
  const config =
    statusConfig[statusAtual] ||
    statusConfig.paid;

  if (!config.nextStatus) return;

  btnStatus.disabled = true;
  btnStatus.textContent = "Salvando...";

  try {
    await updateOrderStatus(id, config.nextStatus);

    statusAtual = config.nextStatus;
    atualizarBotao();

    alert("Status do pedido atualizado.");
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);

    btnStatus.disabled = false;
    atualizarBotao();

    alert("Não foi possível atualizar o pedido.");
  }
});
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}