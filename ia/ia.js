// Assistente Prometheus: interface de conversa.
// Envia a conversa para /api/prometheus (função serverless na Vercel), que
// consulta a OpenAI e devolve a resposta. A chave nunca passa pelo navegador.
import { PrometheusPortrait } from "./prometheus-portrait.js";

const API = "/api/prometheus";
const MAX_CHARS = 2000;

const AREAS = [
  { id: "saude", cor: "#cf6248", nome: "Saúde Humana", pergunta: "Como uma vacina de mRNA ensina o corpo a se defender?" },
  { id: "industrial", cor: "#a9a193", nome: "Industrial", pergunta: "O que é uma biorrefinaria e por que ela é mais sustentável?" },
  { id: "agricola", cor: "#8b9a55", nome: "Agricultura", pergunta: "Qual a diferença entre um transgênico e uma planta editada com CRISPR?" },
  { id: "marinha", cor: "#5a90b5", nome: "Recursos Marinhos", pergunta: "Que medicamentos já foram descobertos em organismos do oceano?" },
  { id: "alimentar", cor: "#d9a944", nome: "Alimentos e Fermentação", pergunta: "Por que a fermentação transforma leite em iogurte?" },
  { id: "ambiental", cor: "#97928a", nome: "Meio Ambiente", pergunta: "Como microrganismos conseguem limpar um solo contaminado?" },
  { id: "bioinformatica", cor: "#c9a25c", nome: "Bioinformática e Nanotecnologia", pergunta: "O que significa sequenciar um genoma, passo a passo?" },
  { id: "etica", cor: "#9a7d9a", nome: "Ética e Regulamentação", pergunta: "Quem decide se uma nova terapia gênica é segura para uso?" },
  { id: "florestal", cor: "#9a7452", nome: "Florestal", pergunta: "Como a biotecnologia ajuda a recuperar uma floresta degradada?" },
  { id: "forense", cor: "#807a72", nome: "Forense e Criminalística", pergunta: "Como um perfil de DNA identifica uma pessoa com segurança?" },
];

const $ = (sel) => document.querySelector(sel);
const els = {
  log: $("#mensagens"),
  form: $("#formulario"),
  input: $("#pergunta"),
  send: $("#enviar"),
  counter: $("#contador"),
  suggestions: $("#sugestoes"),
  suggestionList: $("#listaSugestoes"),
  reset: $("#novaConversa"),
  state: $("#estadoMentor"),
  figure: document.querySelector(".ia-mentor__retrato"),
  canvas: $("#retratoCanvas"),
};

let history = []; // mensagens da sessão: { role: "user" | "assistant", content }
let busy = false;
let portrait = null;

// --------------------------------------------------------------------------
// Markdown seguro (somente o subconjunto pedido nas instruções do assistente)
// --------------------------------------------------------------------------
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function safeHref(url) {
  const value = url.trim();
  if (/^\/(?!\/)[\w\-./#?=&%]*$/.test(value)) return value;
  if (/^https:\/\/[\w.-]+(\/[\w\-./#?=&%~+:@!]*)?$/i.test(value)) return value;
  return null;
}

function inline(text) {
  let out = escapeHtml(text);
  const codes = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => { codes.push(code); return `\u0000${codes.length - 1}\u0000`; });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const href = safeHref(url.replace(/&amp;/g, "&"));
    if (!href) return label;
    const external = href.startsWith("https://");
    return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return out;
}

function renderMarkdown(source) {
  const lines = source.replace(/\r/g, "").split("\n");
  const html = [];
  let list = null;
  let paragraph = [];
  let code = null;
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line)) { html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`); code = null; }
      else code.push(line);
      continue;
    }
    if (/^```/.test(line)) { flushParagraph(); flushList(); code = []; continue; }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (heading) { flushParagraph(); flushList(); html.push(`<h3>${inline(heading[1])}</h3>`); }
    else if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((bullet || ordered)[1]);
    } else if (quote) { flushParagraph(); flushList(); html.push(`<blockquote>${inline(quote[1])}</blockquote>`); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line); }
  }
  if (code !== null) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushParagraph();
  flushList();
  return html.join("");
}

// --------------------------------------------------------------------------
// Retrato e estado do mentor
// --------------------------------------------------------------------------
const STATE_TEXT = {
  repouso: "Pronto para conversar",
  pensando: "Refletindo sobre a sua pergunta…",
  erro: "Não foi possível responder agora",
};

function setMentorState(state) {
  els.state.dataset.estado = state;
  els.state.querySelector("span").textContent = STATE_TEXT[state];
  els.figure.dataset.estado = state;
  portrait?.setState(state === "pensando" ? "thinking" : "idle");
}

function startPortrait() {
  try {
    portrait = new PrometheusPortrait(els.canvas, { reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    portrait.frame(performance.now());
    els.figure.classList.add("is-vivo");
    portrait.loop();
  } catch {
    portrait = null; // sem WebGL2: a imagem estática do busto continua visível
  }
}

// --------------------------------------------------------------------------
// Mensagens
// --------------------------------------------------------------------------
function addMessage(role, content, { pending = false } = {}) {
  const article = document.createElement("article");
  article.className = `ia-msg ia-msg--${role === "user" ? "usuario" : "prometheus"}`;
  if (role === "user") {
    article.innerHTML = '<div class="ia-msg__corpo"><span class="visualmente-oculto">Você disse:</span><div class="ia-msg__texto"></div></div>';
    article.querySelector(".ia-msg__texto").textContent = content;
  } else {
    article.innerHTML = '<img class="ia-avatar" src="prometheus-avatar.jpg" alt="" width="40" height="40"><div class="ia-msg__corpo"><span class="ia-msg__autor">Prometheus</span><div class="ia-msg__texto"></div></div>';
    const body = article.querySelector(".ia-msg__texto");
    body.innerHTML = pending
      ? '<span class="ia-pensando"><span class="ia-pensando__brasas" aria-hidden="true"><i></i><i></i><i></i></span>Refletindo…</span>'
      : renderMarkdown(content);
  }
  els.log.appendChild(article);
  els.log.scrollTop = els.log.scrollHeight;
  return article;
}

function showError(article, message) {
  article.classList.add("ia-msg--erro");
  const body = article.querySelector(".ia-msg__texto");
  body.innerHTML = "";
  const box = document.createElement("div");
  box.className = "ia-msg__falha";
  box.setAttribute("role", "alert");
  box.textContent = message;
  const actions = document.createElement("div");
  actions.className = "ia-msg__acoes";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Tentar novamente";
  retry.addEventListener("click", () => { article.remove(); requestAnswer(); });
  actions.appendChild(retry);
  body.append(box, actions);
}

function updateChrome() {
  els.suggestions.hidden = history.length > 0;
  els.reset.hidden = history.length === 0;
}

function updateSendState() {
  els.send.disabled = busy || !els.input.value.trim() || els.input.value.length > MAX_CHARS;
  els.counter.textContent = `${els.input.value.length} / ${MAX_CHARS}`;
}

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 200)}px`;
}

// --------------------------------------------------------------------------
// Comunicação com o servidor
// --------------------------------------------------------------------------
async function ask(question) {
  if (busy) return;
  history.push({ role: "user", content: question });
  addMessage("user", question);
  updateChrome();
  await requestAnswer();
}

// Quando o servidor não devolve JSON, a causa costuma ser a hospedagem.
function explicarFalha(status) {
  if ([404, 405, 501].includes(status)) {
    return `O servidor do assistente não foi encontrado (código ${status}). Esta página está aberta numa hospedagem sem a função da IA (arquivo local, Live Server ou GitHub Pages). A IA funciona no site publicado na Vercel ou com o servidor local (node scripts/dev-server.js).`;
  }
  if (status === 504) return "A resposta demorou demais (código 504). Tente novamente ou faça uma pergunta mais curta.";
  return `O servidor do assistente falhou (código ${status}). Confira os logs da função na Vercel e tente novamente.`;
}

async function requestAnswer() {
  const article = addMessage("assistant", "", { pending: true });
  busy = true;
  updateSendState();
  setMentorState("pensando");
  try {
    let response;
    try {
      response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
    } catch {
      throw new Error("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
    }
    let data = null;
    try { data = await response.json(); } catch { /* resposta sem JSON */ }
    if (!response.ok) throw new Error(data?.erro || explicarFalha(response.status));
    if (!data || typeof data.resposta !== "string") throw new Error("A resposta veio em um formato inesperado. Tente novamente.");
    article.querySelector(".ia-msg__texto").innerHTML = renderMarkdown(data.resposta);
    history.push({ role: "assistant", content: data.resposta });
    setMentorState("repouso");
  } catch (error) {
    showError(article, error.message);
    setMentorState("erro");
  } finally {
    busy = false;
    updateSendState();
    els.log.scrollTop = els.log.scrollHeight;
    els.input.focus({ preventScroll: true });
  }
}

// --------------------------------------------------------------------------
// Inicialização
// --------------------------------------------------------------------------
AREAS.forEach((area) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ia-sugestao";
  button.style.setProperty("--cor", area.cor);
  button.innerHTML = `<span class="ia-sugestao__ponto" aria-hidden="true"></span><span><small>${escapeHtml(area.nome)}</small>${escapeHtml(area.pergunta)}</span>`;
  button.addEventListener("click", () => ask(area.pergunta));
  els.suggestionList.appendChild(button);
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = els.input.value.trim();
  if (!question || busy || question.length > MAX_CHARS) return;
  els.input.value = "";
  autosize();
  updateSendState();
  ask(question);
});

// Enter envia; Shift + Enter quebra a linha.
els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    els.form.requestSubmit();
  }
});
els.input.addEventListener("input", () => { autosize(); updateSendState(); });

els.reset.addEventListener("click", () => {
  if (busy) return;
  history = [];
  els.log.querySelectorAll(".ia-msg:not(.ia-msg--abertura)").forEach((node) => node.remove());
  updateChrome();
  setMentorState("repouso");
  els.input.focus();
});

// Pergunta vinda de outra página (ex.: Exploração 3D): só preenche o campo.
const sugerida = new URLSearchParams(window.location.search).get("pergunta");
if (sugerida) { els.input.value = sugerida.slice(0, MAX_CHARS); autosize(); }

updateChrome();
updateSendState();
startPortrait();
