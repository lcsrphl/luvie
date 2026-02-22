import { navigate } from "../router.js";
import { createProduct } from "../services/products.js";

export function renderNewProduct(mount) {
  mount.innerHTML = `
    <main class="screen">
      <header class="header">
        <h1>Novo Produto</h1>
        <button class="btn btn-ghost" id="btnVoltar" type="button">Voltar</button>
      </header>

      <div class="preview" id="previewBox" style="display:none;">
        <img id="previewImg" alt="Preview">
      </div>

      <form class="form" id="form">
        <!-- input invisível que abre câmera/galeria -->
        <input
          id="foto"
          type="file"
          accept="image/*"
          capture="environment"
          style="display:none"
        />

        <button class="btn btn-ghost" id="btnFoto" type="button">Tirar foto do produto</button>

        <div class="field">
          <label>Título</label>
          <input id="titulo" placeholder="Ex: Calça Zara" required />
        </div>

        <div class="field">
          <label>Preço</label>
          <input id="preco" inputmode="decimal" placeholder="Ex: 90" required />
          <div class="small">Dica: pode digitar 90 ou 90.00</div>
        </div>

        <button class="btn btn-primary" id="btnSalvar" type="submit">Salvar produto</button>
      </form>

      <div class="small" id="status" style="margin-top:10px;"></div>
    </main>
  `;

  const btnVoltar = mount.querySelector("#btnVoltar");
  const btnFoto = mount.querySelector("#btnFoto");
  const inputFoto = mount.querySelector("#foto");
  const previewBox = mount.querySelector("#previewBox");
  const previewImg = mount.querySelector("#previewImg");
  const form = mount.querySelector("#form");
  const status = mount.querySelector("#status");

  let selectedFile = null;

  btnVoltar.addEventListener("click", () => navigate("/"));
  btnFoto.addEventListener("click", () => inputFoto.click());

  inputFoto.addEventListener("change", () => {
    const file = inputFoto.files?.[0];
    if (!file) return;
    selectedFile = file;

    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewBox.style.display = "block";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titulo = mount.querySelector("#titulo").value.trim();
    const preco = mount.querySelector("#preco").value.trim().replace(",", ".");

    if (!selectedFile) {
      alert("Tire a foto do produto primeiro.");
      return;
    }
    if (!titulo) {
      alert("Preencha o título.");
      return;
    }
    if (!preco || Number.isNaN(Number(preco))) {
      alert("Preço inválido.");
      return;
    }

    try {
      status.textContent = "Salvando...";

      await createProduct({
        titulo,
        preco,
        file: selectedFile
      });

      status.textContent = "Salvo! Voltando...";
      setTimeout(() => navigate("/"), 400);
    } catch (err) {
      console.error(err);
      status.textContent = "Erro ao salvar. Veja o console.";
      alert("Deu erro ao salvar. Me manda o print do erro do console.");
    }
  });
}