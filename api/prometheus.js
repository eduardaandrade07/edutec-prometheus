// Função serverless (Vercel) do assistente Prometheus.
// Recebe as mensagens da conversa, envia para a OpenAI (Chat Completions) e
// devolve a resposta em JSON: { resposta: "..." }.
// A chave fica somente no servidor, na variável de ambiente OPENAI_API_KEY.
//
// Variáveis de ambiente:
//   OPENAI_API_KEY  (obrigatória) chave da API da OpenAI
//   OPENAI_MODEL    (opcional)    padrão: gpt-5-mini
"use strict";

const { SYSTEM_PROMPT } = require("./_prometheus-persona.js");

const MAX_MENSAGENS = 20; // contexto enviado ao modelo
const MAX_CARACTERES = 4000; // por mensagem

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let texto = "";
  for await (const parte of req) texto += parte;
  return texto ? JSON.parse(texto) : {};
}

// Mantém só mensagens válidas, no formato que a API espera.
function limparMensagens(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MENSAGENS)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CARACTERES) }));
}

// Traduz erros da OpenAI em mensagens claras, sem expor detalhes técnicos.
function erroAmigavel(status, codigo) {
  if (status === 401) return { status: 500, mensagem: "A chave da API configurada no servidor é inválida." };
  if (status === 429 && codigo === "insufficient_quota") return { status: 503, mensagem: "Os créditos da API acabaram. Verifique o faturamento da conta OpenAI." };
  if (status === 429) return { status: 429, mensagem: "Muitas perguntas ao mesmo tempo. Aguarde alguns segundos e tente de novo." };
  if (status === 404 || codigo === "model_not_found") return { status: 500, mensagem: "O modelo configurado não está disponível para esta chave." };
  if (status >= 500) return { status: 502, mensagem: "O serviço de IA está instável no momento. Tente novamente em instantes." };
  return { status: 502, mensagem: "Não foi possível gerar a resposta. Tente reformular a pergunta." };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST para enviar mensagens." });

  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return responder(res, 503, { erro: "O assistente ainda não foi configurado: falta a variável OPENAI_API_KEY no servidor." });

  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch {
    return responder(res, 400, { erro: "Não foi possível ler a mensagem enviada." });
  }
  const mensagens = limparMensagens(corpo.messages);
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") {
    return responder(res, 400, { erro: "Escreva uma pergunta antes de enviar." });
  }

  let resposta;
  try {
    resposta = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...mensagens],
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (erro) {
    const tempo = erro && (erro.name === "TimeoutError" || erro.name === "AbortError");
    return responder(res, 504, { erro: tempo ? "A resposta demorou demais. Tente uma pergunta mais curta." : "Não foi possível conectar ao serviço de IA." });
  }

  let dados = null;
  try { dados = await resposta.json(); } catch { /* resposta sem JSON */ }

  if (!resposta.ok) {
    console.error("OpenAI:", resposta.status, dados?.error?.code || "", dados?.error?.message || "");
    const { status, mensagem } = erroAmigavel(resposta.status, dados?.error?.code);
    return responder(res, status, { erro: mensagem });
  }

  if (!dados) return responder(res, 502, { erro: "A IA retornou uma resposta em formato inesperado. Tente novamente." });
  const texto = dados?.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || !texto.trim()) {
    return responder(res, 502, { erro: "A IA retornou uma resposta vazia. Tente novamente." });
  }
  return responder(res, 200, { resposta: texto.trim() });
};
