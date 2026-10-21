#!/usr/bin/env node
// Servidor local para testar o site com o assistente Prometheus.
// Uso:  node scripts/dev-server.js   (abre em http://localhost:3000)
// A chave pode ficar em um arquivo .env.local na raiz do projeto:
//   ANTHROPIC_API_KEY=sk-ant-...
// O arquivo .env.local está no .gitignore e nunca deve ser enviado ao GitHub.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;

// Carrega .env.local (formato CHAVE=valor), sem dependências externas.
const envFile = path.join(ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const prometheus = require(path.join(ROOT, "api", "prometheus.js"));

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/prometheus") {
    try {
      await prometheus(req, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "server", message: "Erro interno no servidor local." }));
    }
    return;
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT) || /[\\/]\.(env|git)/.test(file)) {
    res.writeHead(403);
    return res.end("Proibido");
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Não encontrado");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`EduTec Prometheus em http://localhost:${PORT}`);
  console.log(configured ? "Assistente: chave encontrada ✓" : "Assistente: sem ANTHROPIC_API_KEY (a página mostrará que falta configurar).");
});
