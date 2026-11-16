const $ = (s) => document.querySelector(s);
const lista = $("#metricas");

function slug(t) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "m_$1")
    .slice(0, 33);
}

function addMetrica(nome = "", antes = "", depois = "") {
  const linha = document.createElement("div");
  linha.className = "metrica";
  linha.innerHTML = `
    <input aria-label="nome da métrica" placeholder="usuários" maxlength="33" />
    <input aria-label="valor antes" type="number" min="0" step="any" placeholder="1000" />
    <input aria-label="valor depois" type="number" min="0" step="any" placeholder="4500" />
    <button type="button" class="rm" aria-label="remover métrica">×</button>`;
  const [n, a, d] = linha.querySelectorAll("input");
  n.value = nome;
  a.value = antes;
  d.value = depois;
  linha.querySelector(".rm").onclick = () => {
    if (lista.children.length > 1) linha.remove();
  };
  lista.append(linha);
}

addMetrica();
addMetrica();
$("#add").onclick = () => {
  if (lista.children.length < 8) addMetrica();
};

$("#exemplo").onclick = () => {
  const f = $("#form");
  f.startup_nome.value = "FitTrack";
  f.setor.value = "saúde e bem-estar";
  f.periodo.value = "12 meses";
  f.contexto.value = "Lançamos o plano anual e um programa de indicação entre amigos";
  lista.innerHTML = "";
  addMetrica("usuarios", 1000, 4500);
  addMetrica("receita mensal", 5000, 22000);
  addMetrica("churn", 8, 3);
};

function mostrarErro(msg) {
  const el = $("#erro");
  el.textContent = msg;
  el.hidden = !msg;
}

$("#form").onsubmit = async (e) => {
  e.preventDefault();
  mostrarErro("");
  const f = e.target;
  const metricas = {};
  for (const linha of lista.children) {
    const [n, a, d] = linha.querySelectorAll("input");
    const nome = slug(n.value);
    if (!nome) continue;
    if (a.value !== "") metricas[`${nome}_antes`] = Number(a.value);
    if (d.value !== "") metricas[`${nome}_depois`] = Number(d.value);
  }
  if (!f.startup_nome.value.trim()) return mostrarErro("Faltou o nome da startup.");
  if (!Object.keys(metricas).length) return mostrarErro("Coloca pelo menos uma métrica com valor.");

  const corpo = { startup_nome: f.startup_nome.value, metricas };
  for (const campo of ["setor", "periodo", "contexto"]) {
    if (f[campo].value.trim()) corpo[campo] = f[campo].value;
  }

  const botao = $("#enviar");
  botao.disabled = true;
  botao.textContent = "Escrevendo seu case...";
  try {
    const res = await fetch("/api/case", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await res.json();
    if (!res.ok) {
      const det = json.erros?.map((x) => x.erro).join("; ");
      return mostrarErro(det ? `${json.message}: ${det}` : json.message);
    }
    renderizar(json.data);
  } catch {
    mostrarErro("Não deu pra falar com a API. Confere sua conexão e tenta de novo.");
  } finally {
    botao.disabled = false;
    botao.textContent = "Gerar case";
  }
};

function renderizar(caso) {
  const sec = $("#resultado");
  sec.innerHTML = "";
  const h2 = document.createElement("h2");
  h2.textContent = caso.titulo;
  sec.append(h2);
  for (const p of caso.texto.split(/\n\s*\n/)) {
    const el = document.createElement("p");
    el.textContent = p;
    sec.append(el);
  }
  const rodape = document.createElement("p");
  rodape.className = "rodape";
  const link = document.createElement("a");
  link.href = caso.url;
  link.textContent = "abrir a página do case";
  rodape.append(
    caso.fonte === "gemini" ? "Gerado com Gemini · " : "Modo demo (template) · ",
    link,
  );
  sec.append(rodape);
  sec.hidden = false;
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

fetch("/api")
  .then((r) => r.json())
  .then((j) => {
    $("#modo").textContent =
      j.modo === "gemini"
        ? "Os textos são gerados com o Gemini, do Google."
        : "Rodando em modo demo: o texto sai de um template, sem IA.";
  })
  .catch(() => {});
