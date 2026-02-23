import { createCheckout } from "../services/payments.js";

export async function renderCheckout(mount, ctx) {
  const token = ctx?.query?.t || "";

  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Luviê</h1>
        <span class="small">Pagamento</span>
      </header>

      <section class="card" style="padding:14px;">
        <p class="name" id="hello">Carregando pedido...</p>
        <div id="items" class="small" style="margin-top:10px;"></div>
        <p class="name" style="margin-top:12px;">Total: <span id="total">—</span></p>
      </section>

      <div style="height:12px;"></div>

      <section class="card" style="padding:14px;">
        <p class="name">Pague aqui</p>
        <div id="paymentBrick_container" style="margin-top:10px;"></div>
        <p class="small" id="payMsg" style="margin-top:10px;"></p>
      </section>
    </main>
  `;

  if (!token) {
    mount.querySelector("#hello").textContent = "Link inválido (sem token).";
    return;
  }

  // 1) busca pedido + preferenceId via Cloud Function
  const { order, preferenceId } = await createCheckout(token);

  mount.querySelector("#hello").textContent = `Olá ${order.clienteNome || "cliente"}, confira seu pedido:`;
  mount.querySelector("#total").textContent = `R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}`;

  const itemsDiv = mount.querySelector("#items");
  itemsDiv.innerHTML = (order.itens || []).map(it =>
    `<div>• ${escapeHtml(it.titulo)} — R$ ${Number(it.preco).toFixed(2).replace(".", ",")} (x${it.qtd || 1})</div>`
  ).join("");

  // 2) carrega SDK MP e monta o Brick
  await loadMpSdk();

  // PUBLIC KEY pode ficar no front (não é segredo)
  const MP_PUBLIC_KEY = window.__MP_PUBLIC_KEY__;
  if (!MP_PUBLIC_KEY) {
    mount.querySelector("#payMsg").textContent = "MP Public Key não configurada no front.";
    return;
  }

  const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
  const bricksBuilder = mp.bricks();

  // ⚠️ O formato exato do Payment Brick pode variar por versão/conta.
  // Esta base é a forma padrão (preferência).
  const amount = Number(order.total || 0);

await bricksBuilder.create("payment", "paymentBrick_container", {
  initialization: {
    amount // ✅ OBRIGATÓRIO no payment Brick
  },
  callbacks: {
    onReady: () => {
      mount.querySelector("#payMsg").textContent = "";
    },
    onError: (error) => {
      console.error(error);
      mount.querySelector("#payMsg").textContent =
        "Erro ao carregar pagamento. Veja o console.";
    },
    onSubmit: async ({ formData }) => {
      // ⚠️ ainda não implementamos o endpoint que cria o pagamento de fato.
      // Por enquanto só mostra no console:
      console.log("formData", formData);
      mount.querySelector("#payMsg").textContent =
        "Submit recebido. Falta implementar criação do pagamento na API.";
    }
  }
});
}

function loadMpSdk() {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
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