const grid = document.getElementById('grid');
const itemsCount = document.getElementById('itemsCount');
const totalValue = document.getElementById('totalValue');
const btnNext = document.getElementById('btnNext');
const hint = document.getElementById('hint');

let products = [];
let cart = new Map(); // productId -> qty

function formatBRL(cents) {
  const v = (cents || 0) / 100;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcTotal() {
  let totalCents = 0;
  let totalItems = 0;
  for (const [id, qty] of cart.entries()) {
    const p = products.find(x => x.id === id);
    if (!p) continue;
    totalItems += qty;
    totalCents += p.price * qty;
  }
  return { totalItems, totalCents };
}

function renderSummary() {
  const { totalItems, totalCents } = calcTotal();
  itemsCount.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
  totalValue.textContent = formatBRL(totalCents);

  const hasItems = totalItems > 0;
  btnNext.disabled = !hasItems;
  hint.textContent = hasItems ? 'Pronto! Agora selecione a cliente' : 'Selecione pelo menos 1 produto';
}

function toggleProduct(id) {
  const current = cart.get(id) || 0;
  cart.set(id, current + 1);
  persistCart();
  render();
}

function persistCart() {
  const obj = Array.from(cart.entries()).map(([id, qty]) => ({ id, qty }));
  localStorage.setItem('newOrderCart', JSON.stringify(obj));
}

function render() {
  grid.innerHTML = '';
  for (const p of products) {
    const qty = cart.get(p.id) || 0;

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="cardWrap ${qty ? 'selected' : ''}">
        <img src="${p.photoUrl}" alt="${p.title}">
        ${qty ? `<div class="badge">+${qty}</div>` : ``}
      </div>
      <div class="info">
        <div class="title">${p.title}</div>
        <div class="price">${formatBRL(p.price)}</div>
      </div>
    `;
    card.addEventListener('click', () => toggleProduct(p.id));
    grid.appendChild(card);
  }

  renderSummary();
}

async function init() {
  // carrega carrinho salvo
  try {
    const saved = JSON.parse(localStorage.getItem('newOrderCart') || '[]');
    cart = new Map(saved.map(x => [x.id, x.qty]));
  } catch {}

  // carrega produtos
  const res = await fetch('./products.json', { cache: 'no-store' });
  products = await res.json();

  render();
}

btnNext.addEventListener('click', () => {
  // por enquanto só demonstra o fluxo.
  // depois você troca por: window.location.href = "/select-customer";
  alert('Próxima etapa: Selecionar cliente (vamos criar depois).');
});

init();