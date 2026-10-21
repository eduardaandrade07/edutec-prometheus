// Assistente Prometheus: interface de conversa.
// Envia o histórico para /api/prometheus (função serverless) e exibe a
// resposta em streaming. A chave da API nunca passa pelo navegador.
import { PrometheusPortrait } from "./prometheus-portrait.js";

const API = "/api/prometheus";
const STORAGE_KEY = "prometheus-conversa-v1";
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
  stop: $("#parar"),
  counter: $("#contador"),
  suggestions: $("#sugestoes"),
  suggestionList: $("#listaSugestoes"),
  reset: $("#novaConversa"),
  notice: $("#avisoServico"),
  service: $("#statusServico"),
  state: $("#estadoMentor"),
  figure: document.querySelector(".ia-mentor__retrato"),
  canvas: $("#retratoCanvas"),
};

let history = [];
let busy = false;
let controller = null;
let portrait = null;
let available = true;

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
// Estado visual do mentor
// --------------------------------------------------------------------------
const STATE_TEXT = {
  repouso: "Pronto para conversar",
  pensando: "Refletindo sobre a sua pergunta…",
  falando: "Respondendo…",
  erro: "Não foi possível responder agora",
  inativo: "Assistente ainda não ativado",
};

function setMentorState(state) {
  els.state.dataset.estado = state;
  els.state.querySelector("span").textContent = STATE_TEXT[state] || STATE_TEXT.repouso;
  els.figure.dataset.estado = state;
  portrait?.setState(state === "pensando" ? "thinking" : state === "falando" ? "speaking" : "idle");
}

function startPortrait() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    portrait = new PrometheusPortrait(els.canvas, { reducedMotion: reduced });
    portrait.frame(performance.now());
    els.figure.classList.add("is-vivo");
    portrait.loop();
  } catch (error) {
    // Sem WebGL2: a imagem estática de alta qualidade permanece visível.
    console.info("Retrato em tempo real indisponível; usando imagem.", error);
    portrait = null;
  }
}

// --------------------------------------------------------------------------
// Mensagens
// --------------------------------------------------------------------------
function scrollToEnd(force = false) {
  const log = els.log;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 140;
  if (force || nearBottom) log.scrollTop = log.scrollHeight;
}

function addMessage(role, content, { pending = false } = {}) {
  const article = document.createElement("article");
  article.className = `ia-msg ia-msg--${role === "user" ? "usuario" : "prometheus"}`;
  if (role === "user") {
    article.innerHTML = '<div class="ia-msg__corpo"><span class="visualmente-oculto">Você disse:</span><div class="ia-msg__texto"></div></div>';
    article.querySelector(".ia-msg__texto").textContent = content;
  } else {
    article.innerHTML = '<img class="ia-avatar" src="prometheus-avatar.jpg" alt="" width="40" height="40"><div class="ia-msg__corpo"><span class="ia-msg__autor">Prometheus</span><div class="ia-msg__texto"></div></div>';
    const body = article.querySelector(".ia-msg__texto");
    if (pending) body.innerHTML = '<span class="ia-pensando"><span class="ia-pensando__brasas" aria-hidden="true"><i></i><i></i><i></i></span>Refletindo…</span>';
    else body.innerHTML = renderMarkdown(content);
  }
  els.log.appendChild(article);
  scrollToEnd(true);
  return article;
}

function showFailure(article, message, retry) {
  article.classList.add("ia-msg--erro");
  const body = article.querySelector(".ia-msg__texto");
  body.innerHTML = "";
  const box = document.createElement("div");
  box.className = "ia-msg__falha";
  box.setAttribute("role", "alert");
  box.textContent = message;
  body.appendChild(box);
  if (retry) {
    const actions = document.createElement("div");
    actions.className = "ia-msg__acoes";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Tentar novamente";
    button.addEventListener("click", () => { article.remove(); retry(); });
    actions.appendChild(button);
    body.appendChild(actions);
  }
}

function saveHistory() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-40))); } catch { /* armazenamento indisponível */ }
}

function restoreHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved) && saved.length) {
      history = saved.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
      history.forEach((m) => addMessage(m.role, m.content));
    }
  } catch { history = []; }
  updateChrome();
}

function updateChrome() {
  const hasConversation = history.length > 0;
  els.suggestions.hidden = hasConversation;
  els.reset.hidden = !hasConversation;
}

function setBusy(value) {
  busy = value;
  els.send.hidden = value;
  els.stop.hidden = !value;
  updateSendState();
}

function updateSendState() {
  const length = els.input.value.trim().length;
  els.send.disabled = busy || !available || length === 0 || els.input.value.length > MAX_CHARS;
  els.counter.textContent = `${els.input.value.length} / ${MAX_CHARS}`;
  els.counter.classList.toggle("is-limite", els.input.value.length > MAX_CHARS * 0.9);
}

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 200)}px`;
}

// --------------------------------------------------------------------------
// Comunicação com o servidor
// --------------------------------------------------------------------------
async function ask(question) {
  if (busy || !available) return;
  history.push({ role: "user", content: question });
  saveHistory();
  addMessage("user", question);
  updateChrome();
  await requestAnswer();
}

async function requestAnswer() {
  const article = addMessage("assistant", "", { pending: true });
  const body = article.querySelector(".ia-msg__texto");
  setBusy(true);
  setMentorState("pensando");
  controller = new AbortController();
  let text = "";
  let renderQueued = false;
  let complete = false;
  const render = () => {
    renderQueued = false;
    if (complete) return;
    // Durante o streaming, esconde marcações ainda não fechadas (ex.: "**pala").
    let visible = text;
    if ((visible.match(/\*\*/g) || []).length % 2) visible = visible.replace(/\*\*(?!.*\*\*)/s, "");
    body.innerHTML = renderMarkdown(visible);
    body.lastElementChild?.classList.add("ia-cursor");
    scrollToEnd();
  };

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let info = {};
      try { info = await response.json(); } catch { /* resposta sem JSON */ }
      if (response.status === 404) info.message = "O servidor do assistente não foi encontrado. Ele funciona quando o site está publicado na Vercel ou rodando com o servidor local do projeto.";
      if (info.code === "not_configured" || response.status === 404) markUnavailable(info.message);
      throw Object.assign(new Error(info.message || "Não foi possível obter a resposta."), { retryable: response.status >= 500 || response.status === 429 });
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    setMentorState("falando");
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 2);
        if (!line.startsWith("data:")) continue;
        let event;
        try { event = JSON.parse(line.slice(5)); } catch { continue; }
        if (event.t) {
          text += event.t;
          if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); }
        } else if (event.error) {
          throw Object.assign(new Error(event.error), { retryable: true, partial: text });
        } else if (event.done) {
          finished = true;
        }
      }
    }
    if (!text.trim()) throw Object.assign(new Error("A resposta veio vazia. Tente reformular a pergunta."), { retryable: true });
    complete = true;
    body.innerHTML = renderMarkdown(text);
    history.push({ role: "assistant", content: text });
    saveHistory();
    setMentorState("repouso");
  } catch (error) {
    complete = true;
    if (error.name === "AbortError") {
      if (text.trim()) {
        body.innerHTML = renderMarkdown(`${text}\n\n*(resposta interrompida)*`);
        history.push({ role: "assistant", content: text });
        saveHistory();
      } else {
        article.remove();
        history.pop();
        saveHistory();
        updateChrome();
      }
      setMentorState("repouso");
    } else {
      const message = error instanceof TypeError ? "Sem conexão com o servidor. Verifique sua internet e tente novamente." : error.message;
      showFailure(article, message, error.retryable !== false && available ? () => requestAnswer() : null);
      setMentorState(available ? "erro" : "inativo");
      if (available) setTimeout(() => { if (!busy) setMentorState("repouso"); }, 4000);
    }
  } finally {
    controller = null;
    setBusy(false);
    if (available) els.input.focus({ preventScroll: true });
  }
}

function markUnavailable(message) {
  available = false;
  els.notice.hidden = false;
  els.notice.innerHTML = `<strong>Assistente ainda não ativado.</strong> ${escapeHtml(message || "")} A configuração está descrita no arquivo <code>README.md</code> do projeto.`;
  els.service.textContent = "Aguardando configuração";
  els.input.placeholder = "O assistente estará disponível assim que for configurado.";
  setMentorState("inativo");
  updateSendState();
}

async function checkService() {
  try {
    const response = await fetch(API, { method: "GET", headers: { Accept: "application/json" } });
    if (response.status === 404) return markUnavailable("O servidor do assistente não foi encontrado. Ele funciona quando o site está publicado na Vercel ou rodando com o servidor local do projeto.");
    const info = await response.json();
    if (!info.configured) markUnavailable("Falta definir a chave da API (ANTHROPIC_API_KEY) nas variáveis de ambiente do servidor.");
    else els.service.textContent = "Assistente educacional · online";
  } catch {
    // Rede instável: a verificação real acontece no envio.
  }
}

// --------------------------------------------------------------------------
// Inicialização
// --------------------------------------------------------------------------
function buildSuggestions() {
  const fragment = document.createDocumentFragment();
  AREAS.forEach((area) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ia-sugestao";
    button.style.setProperty("--cor", area.cor);
    button.innerHTML = `<span class="ia-sugestao__ponto" aria-hidden="true"></span><span><small>${escapeHtml(area.nome)}</small>${escapeHtml(area.pergunta)}</span>`;
    button.addEventListener("click", () => ask(area.pergunta));
    fragment.appendChild(button);
  });
  els.suggestionList.appendChild(fragment);
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = els.input.value.trim();
  if (!question || busy || !available) return;
  if (question.length > MAX_CHARS) return;
  els.input.value = "";
  autosize();
  updateSendState();
  ask(question);
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    els.form.requestSubmit();
  }
});
els.input.addEventListener("input", () => { autosize(); updateSendState(); });
els.stop.addEventListener("click", () => controller?.abort());
els.reset.addEventListener("click", () => {
  if (busy) controller?.abort();
  history = [];
  saveHistory();
  els.log.querySelectorAll(".ia-msg:not(.ia-msg--abertura)").forEach((node) => node.remove());
  updateChrome();
  setMentorState(available ? "repouso" : "inativo");
  els.input.focus();
});

buildSuggestions();
restoreHistory();
// Pergunta vinda de outra página (ex.: Exploração 3D): preenche o campo, sem enviar sozinha.
const sugerida = new URLSearchParams(window.location.search).get("pergunta");
if (sugerida) {
  els.input.value = sugerida.slice(0, MAX_CHARS);
  autosize();
  setTimeout(() => els.input.focus({ preventScroll: true }), 300);
}
updateSendState();
startPortrait();
checkService();
