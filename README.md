# EduTec Prometheus — Prometheus Biotecnologia

Site educacional sobre as dez áreas da biotecnologia, com o jogo **SURTO · Protocolo Prometheus**,
a **Exploração 3D** das áreas e o assistente de inteligência artificial **Prometheus**.

| Página | Caminho |
|---|---|
| Início | `index.html` |
| Áreas (11 páginas) | `areas/<area>/index.html` |
| Jogo SURTO | `jogo/index.html` |
| Exploração 3D | `explorar/index.html` |
| Assistente Prometheus (IA) | `ia/index.html` |
| Função do assistente (servidor) | `api/prometheus.js` |

O site é estático (HTML, CSS e JavaScript, sem etapa de compilação). A única parte que roda em
servidor é a função `api/prometheus.js`, executada automaticamente pela Vercel.

---

## Ativar o assistente Prometheus

O chat da página `ia/` envia a conversa para a função `api/prometheus.js`, que consulta a API da
**OpenAI** e devolve a resposta. A chave fica **somente no servidor**, em uma variável de ambiente —
nunca no navegador nem nos arquivos do repositório.

### 1. Criar a chave

1. Acesse <https://platform.openai.com>, entre na conta e adicione créditos em **Billing**.
2. Em **API keys**, crie uma chave (começa com `sk-`). Copie e guarde em local seguro.
3. Recomendado: defina um limite de gastos mensal nas configurações de faturamento.

### 2. Configurar na Vercel

1. No painel da Vercel, abra o projeto → **Settings** → **Environment Variables**.
2. Adicione `OPENAI_API_KEY` com o valor da chave (marque *Production* e *Preview*).
3. Opcional: `OPENAI_MODEL` para trocar o modelo (padrão: `gpt-5-mini`; por exemplo `gpt-6-luna`).
4. Faça um novo deploy (**Deployments → Redeploy**). Variáveis novas só valem após um deploy.

> Antes, confirme que as pastas `api/`, `ia/` e o arquivo `vercel.json` estão no repositório do GitHub
> ligado à Vercel. Sem a pasta `api/`, não existe servidor para a IA.

### Provedores gratuitos (Groq ou Gemini)

O servidor reconhece o provedor pelo início da chave e já usa o endereço e o modelo certos.
Basta cadastrar **só** a variável `OPENAI_API_KEY`:

- **Groq** (grátis, sem cartão): chave em https://console.groq.com/keys (começa com `gsk_`). Modelo padrão: `llama-3.3-70b-versatile`.
- **Gemini** (grátis): chave em https://aistudio.google.com/apikey (começa com `AIza`). Modelo padrão: `gemini-3.8-flash`.

`OPENAI_MODEL` é opcional (troca o modelo). `OPENAI_BASE_URL` só é usada para outros provedores compatíveis com a OpenAI.

## Exploração 3D

Não precisa de configuração. Usa a mesma biblioteca three.js do jogo (`jogo/assets/vendor/three`),
servida pelo próprio site. Cada área tem um modelo em `explorar/modelos/<area>.js`, carregado apenas
quando é escolhido. Links diretos: `explorar/index.html#saude`, `#forense` etc.

Requer um navegador com WebGL 2 (Chrome, Edge, Firefox e Safari atuais).
