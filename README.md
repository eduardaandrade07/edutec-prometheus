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

### Opção gratuita: Google Gemini

O código também funciona com o Google Gemini, que tem um nível gratuito (sem cartão), porque ele aceita o mesmo formato da OpenAI.
Crie uma chave em https://aistudio.google.com/apikey e cadastre na Vercel:

| Variável | Valor |
|---|---|
| `OPENAI_API_KEY` | a chave do Gemini (começa com `AIza`) |
| `OPENAI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `OPENAI_MODEL` | `gemini-3.8-flash` |

Depois faça Redeploy. O nível gratuito tem limite de pedidos por minuto e por dia.


> A IA só funciona onde a pasta `api/` é executada como função: no site publicado na Vercel ou no
> servidor local abaixo. Abrir o `index.html` direto do computador (ou com o Live Server) não roda a
> função, e o chat mostrará que o servidor não foi encontrado.

### 3. Testar no computador (opcional)

Requer Node.js 18 ou superior.

```bash
# na raiz do projeto
echo "OPENAI_API_KEY=sk-sua-chave" > .env.local
node scripts/dev-server.js
# abra http://localhost:3000/ia/
```

O arquivo `.env.local` está no `.gitignore` e não é enviado ao GitHub.

### Custos

O modelo padrão `gpt-5-mini` é um dos mais econômicos da OpenAI. Uma pergunta típica (instruções +
conversa + resposta) custa uma fração de centavo de dólar; conversas longas custam mais, porque o
histórico é reenviado a cada pergunta (o servidor envia no máximo as últimas 20 mensagens). Confira
os preços atuais em <https://openai.com/api/pricing>.

### Mensagens de erro do chat

| Mensagem | O que fazer |
|---|---|
| “falta a variável OPENAI_API_KEY” | Cadastre a chave na Vercel e faça Redeploy. |
| “servidor do assistente não foi encontrado (código 404/405/501)” | A página não está na Vercel (arquivo local, Live Server ou GitHub Pages), ou a pasta `api/` não foi enviada ao GitHub. |
| “o servidor do assistente falhou (código …)” | Veja Vercel → Deployments → Functions/Logs. |
| “A chave da API … é inválida” | Gere uma nova chave e substitua a variável. |
| “Os créditos da API acabaram” | Adicione créditos no faturamento da OpenAI. |
| “O modelo configurado não está disponível” | Remova `OPENAI_MODEL` ou use um modelo disponível para a conta. |
| “servidor do assistente não foi encontrado” | Use o site publicado na Vercel ou o servidor local. |

### Personalidade

As instruções do personagem ficam em `api/_prometheus-persona.js` (arquivos iniciados por `_` não
viram rotas na Vercel). Edite esse arquivo para ajustar o tom.

---

## Exploração 3D

Não precisa de configuração. Usa a mesma biblioteca three.js do jogo (`jogo/assets/vendor/three`),
servida pelo próprio site. Cada área tem um modelo em `explorar/modelos/<area>.js`, carregado apenas
quando é escolhido. Links diretos: `explorar/index.html#saude`, `#forense` etc.

Requer um navegador com WebGL 2 (Chrome, Edge, Firefox e Safari atuais).
