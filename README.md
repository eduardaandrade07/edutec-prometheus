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

O assistente usa a API do Claude (Anthropic). A chave fica **somente no servidor**, em uma variável
de ambiente — ela nunca aparece no navegador nem nos arquivos do repositório.

Sem a chave, a página `ia/` funciona normalmente, mas mostra o aviso “Assistente ainda não ativado”
e não envia perguntas.

### 1. Criar a chave da API

1. Acesse <https://platform.claude.com> e crie uma conta (ou entre na sua).
2. Adicione créditos ou um método de pagamento em **Billing**.
3. Em **API Keys**, crie uma chave (começa com `sk-ant-…`). Copie e guarde em local seguro.
4. Recomendado: nas configurações da organização, defina um limite mensal de gastos (*spend limit*).

### 2. Configurar na Vercel

1. No painel da Vercel, abra o projeto do site → **Settings** → **Environment Variables**.
2. Adicione:

   | Nome | Valor | Obrigatória |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | a chave `sk-ant-…` | sim |
   | `PROMETHEUS_MODEL` | `claude-haiku-5-5` (padrão) ou `claude-sonnet-5-5` | não |
   | `PROMETHEUS_MAX_TOKENS` | tamanho máximo da resposta (padrão `1200`) | não |
   | `PROMETHEUS_ALLOWED_ORIGINS` | domínios extras autorizados, separados por vírgula | não |

3. Faça um novo deploy (**Deployments → Redeploy**) para que a variável entre em vigor.
4. Abra `https://seu-site/ia/` — o topo da conversa deve mostrar “Assistente educacional · online”.

> Nunca coloque a chave em arquivos `.js`, `.html` ou no GitHub. Se uma chave vazar, apague-a no
> console da Anthropic e crie outra.

### 3. Testar no computador (opcional)

Requer Node.js 18 ou superior.

```bash
# na raiz do projeto
echo "ANTHROPIC_API_KEY=sk-ant-sua-chave" > .env.local
node scripts/dev-server.js
# abra http://localhost:3000/ia/
```

O arquivo `.env.local` está no `.gitignore` e não é enviado ao GitHub.

### Custos e limites

- Modelo padrão: **Claude Haiku 5.5**, o mais rápido e econômico (a partir de US$ 0,10 por milhão de
  tokens de entrada e US$ 0,50 por milhão de tokens de saída). Uma pergunta típica usa cerca de
  3 mil tokens de entrada (instruções + conversa) e 500 de saída — algo em torno de
  **US$ 0,0006 por resposta**, ou cerca de US$ 0,60 a cada mil respostas. Conversas longas custam mais,
  porque o histórico é reenviado a cada pergunta. Confira os preços atuais em
  <https://platform.claude.com/docs/en/about-claude/pricing>.
- `claude-sonnet-5-5` dá respostas mais elaboradas, por um custo cerca de 20 vezes maior.
- Proteções já incluídas na função:
  - até **12 perguntas por minuto por visitante** (por instância do servidor);
  - perguntas de até **2.000 caracteres** e histórico limitado às últimas **24 mensagens**;
  - só aceita chamadas vindas do próprio site;
  - tempo máximo de 60 s por resposta.
- Para controle de gastos definitivo, use o limite mensal no console da Anthropic.

### Personalidade e segurança

As instruções do personagem ficam em `api/_prometheus-persona.js` (arquivos iniciados por `_` não
viram rotas na Vercel). Elas definem o tom de mentor, priorizam as dez áreas do site, pedem que o
assistente diferencie fatos de incertezas, não invente dados e recuse pedidos perigosos (por exemplo,
instruções para modificar patógenos). Para mudar o comportamento, edite esse arquivo.

---

## Exploração 3D

Não precisa de configuração. Usa a mesma biblioteca three.js do jogo (`jogo/assets/vendor/three`),
servida pelo próprio site. Cada área tem um modelo em `explorar/modelos/<area>.js`, carregado apenas
quando é escolhido. Links diretos: `explorar/index.html#saude`, `#forense` etc.

Requer um navegador com WebGL 2 (Chrome, Edge, Firefox e Safari atuais).
