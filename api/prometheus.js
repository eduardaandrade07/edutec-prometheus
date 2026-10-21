// Função serverless (Vercel) do assistente Prometheus.
// Recebe o histórico da conversa, valida a entrada, chama a API do Claude
// (Anthropic) com as instruções de sistema do personagem e devolve a resposta
// em streaming (Server-Sent Events). A chave fica APENAS no servidor, na
// variável de ambiente ANTHROPIC_API_KEY.
//
// Variáveis de ambiente:
//   ANTHROPIC_API_KEY   (obrigatória) chave da API do Claude
//   PROMETHEUS_MODEL    (opcional)    padrão: claude-haiku-5-5
//   PROMETHEUS_MAX_TOKENS (opcional)  padrão: 1200
//   PROMETHEUS_ALLOWED_ORIGINS (opcional) domínios extras autorizados, separados por vírgula
//   ANTHROPIC_BASE_URL  (opcional)    usado apenas em testes locais

"use strict";

const { SYSTEM_PROMPT } = require("./_prometheus-persona.js");

const MAX_MESSAGES = 24; // últimas mensagens enviadas como contexto
const MAX_CHARS_PER_MESSAGE = 2000; // limite de uma pergunta do usuário
const MAX_TOTAL_CHARS = 24000; // limite do histórico inteiro
const RATE_LIMIT = { windowMs: 60_000, max: 12 }; // por IP, por instância

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || [];
  const recent = entry.filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, list] of hits) if (!list.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(key);
  }
  return recent.length > RATE_LIMIT.max;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 200_000) throw Object.assign(new Error("payload"), { code: "too_large" });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// Só aceita chamadas vindas do próprio site (reduz uso indevido da chave).
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // chamadas do mesmo domínio sem cabeçalho Origin
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const extras = (process.env.PROMETHEUS_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return host === req.headers.host || host.startsWith("localhost:") || host.startsWith("127.0.0.1:") || extras.some((d) => host === d || host.endsWith(`.${d}`));
}

function validateMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return { error: "A conversa está vazia." };
  const messages = input.slice(-MAX_MESSAGES).map((m) => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    content: typeof m?.content === "string" ? m.content.trim() : "",
  })).filter((m) => m.content.length > 0);
  // A API exige que a conversa comece pelo usuário e alterne os papéis.
  while (messages.length && messages[0].role !== "user") messages.shift();
  const merged = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  }
  if (!merged.length || merged[merged.length - 1].role !== "user") return { error: "A última mensagem precisa ser uma pergunta." };
  const lastUser = merged[merged.length - 1].content;
  if (lastUser.length > MAX_CHARS_PER_MESSAGE) return { error: `A pergunta pode ter no máximo ${MAX_CHARS_PER_MESSAGE} caracteres.` };
  let total = merged.reduce((sum, m) => sum + m.content.length, 0);
  while (total > MAX_TOTAL_CHARS && merged.length > 1) {
    const removed = merged.splice(0, 2);
    total -= removed.reduce((sum, m) => sum + m.content.length, 0);
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return { messages: merged };
}

function friendlyApiError(status) {
  if (status === 401 || status === 403) return { code: "auth", message: "A chave da API foi recusada. Verifique a configuração do servidor." };
  if (status === 429) return { code: "rate_limit", message: "Muitas perguntas ao mesmo tempo. Aguarde alguns segundos e tente novamente." };
  if (status === 529 || status >= 500) return { code: "overloaded", message: "O serviço de IA está sobrecarregado no momento. Tente novamente em instantes." };
  if (status === 400) return { code: "bad_request", message: "Não foi possível processar esta conversa. Tente iniciar uma nova." };
  return { code: "unknown", message: "Ocorreu um erro inesperado ao gerar a resposta." };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "POST, OPTIONS");
    return res.end();
  }
  if (req.method === "GET") {
    // Verificação simples de estado usada pela página (não revela a chave).
    return sendJson(res, 200, { configured: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.PROMETHEUS_MODEL || "claude-haiku-5-5" });
  }
  if (req.method !== "POST") return sendJson(res, 405, { code: "method", message: "Método não permitido." });
  if (!originAllowed(req)) return sendJson(res, 403, { code: "origin", message: "Origem não autorizada." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, {
      code: "not_configured",
      message: "O assistente ainda não foi ativado: falta configurar a chave da API (ANTHROPIC_API_KEY) no servidor.",
    });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local").split(",")[0].trim();
  if (rateLimited(ip)) return sendJson(res, 429, { code: "rate_limit", message: "Você enviou muitas perguntas em pouco tempo. Aguarde um minuto." });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, error.code === "too_large" ? 413 : 400, { code: "invalid", message: "Não foi possível ler a mensagem enviada." });
  }
  const { messages, error } = validateMessages(body.messages);
  if (error) return sendJson(res, 400, { code: "invalid", message: error });

  const model = process.env.PROMETHEUS_MODEL || "claude-haiku-5-5";
  const maxTokens = Math.min(4000, Math.max(200, Number(process.env.PROMETHEUS_MAX_TOKENS) || 1200));
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  req.on("close", () => { if (!res.writableEnded) controller.abort(); });

  let upstream;
  try {
    upstream = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages, stream: true }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    return sendJson(res, 502, { code: "network", message: "Não foi possível conectar ao serviço de IA. Tente novamente." });
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    let detail = "";
    try { detail = (await upstream.text()).slice(0, 300); } catch { /* ignorado */ }
    console.error("Prometheus: erro da API", upstream.status, detail);
    const info = friendlyApiError(upstream.status);
    return sendJson(res, upstream.status === 429 ? 429 : 502, info);
  }

  // Repassa somente o texto gerado, em eventos SSE próprios e simples.
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  const decoder = new TextDecoder();
  let buffer = "";
  let stopReason = null;
  try {
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        let event;
        try { event = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") send({ t: event.delta.text });
        else if (event.type === "message_delta" && event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        else if (event.type === "error") {
          const info = friendlyApiError(event.error?.type === "overloaded_error" ? 529 : 500);
          send({ error: info.message, code: info.code });
        }
      }
    }
    send({ done: true, stop: stopReason });
  } catch (err) {
    if (!controller.signal.aborted) send({ error: "A resposta foi interrompida. Tente novamente.", code: "interrupted" });
  } finally {
    clearTimeout(timeout);
    res.end();
  }
};

// Exportado para testes.
module.exports.validateMessages = validateMessages;
