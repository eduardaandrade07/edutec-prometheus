// Exploração 3D das dez áreas da biotecnologia.
// Um único visualizador (three.js) carrega sob demanda o modelo de cada área,
// com pontos de interesse, destaques e interações específicas.
import * as THREE from "../jogo/assets/vendor/three/three.module.min.js";
import { OrbitControls } from "../jogo/assets/vendor/three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "../jogo/assets/vendor/three/addons/environments/RoomEnvironment.js";

export const AREAS = [
  { id: "saude", n: "01", espectro: "Vermelha", nome: "Saúde Humana", cor: "#cf6248", resumo: "Medicamentos, vacinas, terapias gênicas, diagnósticos e anticorpos que transformam o cuidado com a vida humana.", pergunta: "Como os anticorpos monoclonais são usados como medicamentos?" },
  { id: "industrial", n: "02", espectro: "Branca", nome: "Industrial", cor: "#b9b1a2", resumo: "Enzimas, biocombustíveis e biomateriais que tornam processos industriais mais eficientes e sustentáveis.", pergunta: "Como funciona um biorreator industrial?" },
  { id: "agricola", n: "03", espectro: "Verde", nome: "Agricultura", cor: "#8b9a55", resumo: "Melhoramento de plantas, culturas aprimoradas, biofertilizantes e biopesticidas para uma agricultura mais produtiva.", pergunta: "Como as bactérias dos nódulos fixam nitrogênio para as plantas?" },
  { id: "marinha", n: "04", espectro: "Azul", nome: "Recursos Marinhos", cor: "#5a90b5", resumo: "Organismos marinhos, algas e microrganismos aquáticos que originam novos produtos e tecnologias.", pergunta: "Por que as diatomáceas interessam à biotecnologia?" },
  { id: "alimentar", n: "05", espectro: "Amarela", nome: "Alimentos e Fermentação", cor: "#d9a944", resumo: "Produção de alimentos, bebidas, fermentação e probióticos que moldam a indústria alimentícia.", pergunta: "O que acontece dentro da levedura durante a fermentação?" },
  { id: "ambiental", n: "06", espectro: "Cinza", nome: "Meio Ambiente", cor: "#a39d93", resumo: "Tratamento de resíduos, biorremediação, descontaminação e reciclagem aplicados a desafios ambientais.", pergunta: "Como o lodo ativado limpa o esgoto?" },
  { id: "bioinformatica", n: "07", espectro: "Dourada", nome: "Bioinformática e Nanotecnologia", cor: "#c9a25c", resumo: "Análise de dados biológicos, bioinformática e nanotecnologia aplicada à compreensão da biologia.", pergunta: "Como uma nanopartícula lipídica leva o mRNA até a célula?" },
  { id: "etica", n: "08", espectro: "Roxa", nome: "Ética e Regulamentação", cor: "#9a7d9a", resumo: "Bioética, legislação, regulamentação, segurança e impactos sociais da biotecnologia.", pergunta: "Como se avaliam riscos e benefícios de uma nova biotecnologia?" },
  { id: "florestal", n: "09", espectro: "Marrom", nome: "Florestal", cor: "#9a7452", resumo: "Conservação, manejo de recursos florestais e aproveitamento sustentável de espécies vegetais.", pergunta: "Como funciona a clonagem de árvores para reflorestamento?" },
  { id: "forense", n: "10", espectro: "Preta", nome: "Forense e Criminalística", cor: "#8a847b", resumo: "Análise de DNA, identificação genética e investigação criminal aplicadas à perícia.", pergunta: "O que são marcadores STR e por que identificam pessoas?" },
];

const $ = (s) => document.querySelector(s);
const els = {
  palco: $("#palco3d"),
  canvas: $("#canvas3d"),
  pontos: $("#pontos3d"),
  carregando: $("#carregando3d"),
  dica: $("#dica3d"),
  falha: $("#falha3d"),
  lista: $("#listaAreas"),
  anterior: $("#areaAnterior"),
  proxima: $("#areaProxima"),
  rotulo: $("#infoRotulo"),
  titulo: $("#infoTitulo"),
  descricao: $("#infoDescricao"),
  detalhe: $("#infoDetalhe"),
  detalheTitulo: $("#detalheTitulo"),
  detalheTexto: $("#detalheTexto"),
  listaPontos: $("#infoPontos"),
  acoes: $("#infoAcoes"),
  status: $("#infoStatus"),
  linkArea: $("#linkArea"),
  linkIa: $("#linkIa"),
  reiniciar: $("#ctrlReiniciar"),
  zoomMais: $("#ctrlZoomMais"),
  zoomMenos: $("#ctrlZoomMenos"),
  girar: $("#ctrlGirar"),
};

const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const toque = window.matchMedia("(pointer: coarse)").matches;
const cache = new Map();
let atual = null; // { area, modelo }
let pontoAtivo = null;
let renderer, scene, camera, controls, stage, rim, key;
let ocioso = 0;
let visivel = true;
let animacaoCamera = null;
let trocaEmAndamento = null;
const raycaster = new THREE.Raycaster();
const tmp = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------
function iniciarCena() {
  renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, toque ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
  camera.position.set(0, 1.4, 5);

  controls = new OrbitControls(camera, els.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 9;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.rotateSpeed = toque ? 0.7 : 0.85;
  controls.autoRotate = !reduzido;
  controls.autoRotateSpeed = 0.55;
  controls.addEventListener("start", () => { ocioso = 0; controls.autoRotate = false; animacaoCamera = null; esconderDica(); });

  // Iluminação de estúdio: luz principal com sombra suave, preenchimento e contraluz na cor da área.
  scene.add(new THREE.HemisphereLight(0xdfe7ea, 0x2a241d, 0.75));
  key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(3.2, 5.5, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(toque ? 1024 : 2048, toque ? 1024 : 2048);
  const sc = key.shadow.camera;
  sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 14;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd3e6, 0.7);
  fill.position.set(-4, 2.5, 2);
  scene.add(fill);
  rim = new THREE.DirectionalLight(0xcf6248, 1.6);
  rim.position.set(-2.5, 3.0, -4.5);
  scene.add(rim);

  // Palco: pedestal circular com anel luminoso e piso que recebe sombras.
  stage = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.LatheGeometry([[0, -0.2], [1.55, -0.2], [1.62, -0.16], [1.62, -0.03], [1.56, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 96),
    new THREE.MeshStandardMaterial({ color: 0x1b1916, roughness: 0.55, metalness: 0.35 }),
  );
  pedestal.receiveShadow = true;
  stage.add(pedestal);
  const topo = new THREE.Mesh(new THREE.CircleGeometry(1.56, 96), new THREE.MeshStandardMaterial({ color: 0x23201c, roughness: 0.7, metalness: 0.15 }));
  topo.rotation.x = -Math.PI / 2;
  topo.position.y = 0.001;
  topo.receiveShadow = true;
  stage.add(topo);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(1.59, 0.008, 8, 160), new THREE.MeshBasicMaterial({ color: 0xcf6248, toneMapped: false }));
  anel.rotation.x = Math.PI / 2;
  anel.position.y = -0.02;
  stage.add(anel);
  stage.userData.anel = anel;
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.2;
  piso.receiveShadow = true;
  stage.add(piso);
  scene.add(stage);

  const ajustar = () => {
    const w = els.palco.clientWidth, h = els.palco.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  ajustar();
  new ResizeObserver(ajustar).observe(els.palco);
  new IntersectionObserver(([entry]) => { visivel = entry.isIntersecting; }).observe(els.palco);
  els.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); mostrarFalha("A sessão gráfica foi interrompida. Recarregue a página para continuar."); });
  renderer.setAnimationLoop(quadro);
}

// ---------------------------------------------------------------------------
// Laço de animação
// ---------------------------------------------------------------------------
const relogio = new THREE.Clock();
function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.05);
  if (!visivel || document.hidden) return;
  const t = relogio.elapsedTime;
  ocioso += dt;
  if (!reduzido && !controls.autoRotate && ocioso > 7 && !pontoAtivo) controls.autoRotate = true;

  if (animacaoCamera) {
    const a = animacaoCamera;
    a.t = Math.min(1, a.t + dt / a.duracao);
    const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.de, a.para, k);
    controls.target.lerpVectors(a.alvoDe, a.alvoPara, k);
    if (a.t >= 1) animacaoCamera = null;
  }
  controls.update(dt);

  if (trocaEmAndamento) trocaEmAndamento(dt);
  if (atual?.modelo) {
    atual.modelo.atualizar?.(dt, t);
    if (atual.destaque) atual.destaque(0.35 + 0.35 * Math.sin(t * 3.2));
  }
  renderer.render(scene, camera);
  posicionarPontos();
}

// ---------------------------------------------------------------------------
// Pontos de interesse (botões HTML projetados sobre o modelo)
// ---------------------------------------------------------------------------
function posicionarPontos() {
  if (!atual?.modelo) return;
  const rect = els.palco.getBoundingClientRect();
  const grupo = atual.modelo.grupo;
  atual.botoes.forEach(({ ponto, botao }) => {
    if (ponto.visivel && !ponto.visivel()) { botao.hidden = true; return; }
    tmp.set(...ponto.posicao);
    grupo.localToWorld(tmp);
    const mundo = tmp.clone();
    tmp.project(camera);
    const fora = tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05;
    botao.hidden = fora;
    if (fora) return;
    botao.style.transform = `translate(${((tmp.x + 1) / 2) * rect.width}px, ${((1 - tmp.y) / 2) * rect.height}px)`;
    // Oculto atrás do modelo: o ponto fica esmaecido.
    const dir = mundo.clone().sub(camera.position);
    const dist = dir.length();
    raycaster.camera = camera;
    raycaster.set(camera.position, dir.normalize());
    raycaster.far = dist;
    const hit = raycaster.intersectObject(grupo, true).find((h) => h.object.visible && !h.object.userData.semOclusao && h.object.material?.opacity !== 0);
    botao.classList.toggle("is-atras", Boolean(hit && hit.distance < dist - 0.06));
  });
}

function criarPontos(modelo) {
  els.pontos.innerHTML = "";
  els.listaPontos.innerHTML = "";
  return modelo.pontos.map((ponto, i) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "ponto3d";
    botao.innerHTML = `<span aria-hidden="true">${i + 1}</span><b>${ponto.titulo}</b>`;
    botao.setAttribute("aria-label", `Ponto ${i + 1}: ${ponto.titulo}`);
    botao.addEventListener("click", () => selecionarPonto(ponto));
    els.pontos.appendChild(botao);
    const item = document.createElement("li");
    const link = document.createElement("button");
    link.type = "button";
    link.innerHTML = `<span>${i + 1}</span>${ponto.titulo}`;
    link.addEventListener("click", () => selecionarPonto(ponto));
    item.appendChild(link);
    els.listaPontos.appendChild(item);
    ponto._botao = botao;
    ponto._item = link;
    return { ponto, botao };
  });
}

function selecionarPonto(ponto) {
  if (!atual) return;
  esconderDica();
  const mesmo = pontoAtivo === ponto;
  pontoAtivo = mesmo ? null : ponto;
  atual.modelo.pontos.forEach((p) => {
    p._botao?.classList.toggle("is-ativo", p === pontoAtivo);
    p._item?.classList.toggle("is-ativo", p === pontoAtivo);
  });
  atual.destaque?.(0);
  atual.destaque = null;
  if (!pontoAtivo) {
    els.detalhe.hidden = true;
    return;
  }
  els.detalhe.hidden = false;
  els.detalheTitulo.textContent = ponto.titulo;
  els.detalheTexto.textContent = ponto.texto;
  if (ponto.destaque?.length) atual.destaque = ponto._realce || (ponto._realce = atual.modelo.realcar(ponto.destaque, atual.area.cor));
  ponto.aoSelecionar?.();
  // Aproxima a câmera do ponto, mantendo a direção atual de observação.
  const alvo = new THREE.Vector3(...ponto.posicao);
  atual.modelo.grupo.localToWorld(alvo);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const distancia = ponto.distancia ?? Math.max(controls.minDistance + 0.4, atual.modelo.camera.distancia * 0.62);
  moverCamera(alvo.clone().add(dir.multiplyScalar(distancia)), alvo, 0.9);
  controls.autoRotate = false;
  ocioso = 0;
}

function moverCamera(para, alvo, duracao = 1.0) {
  if (reduzido) {
    camera.position.copy(para);
    controls.target.copy(alvo);
    return;
  }
  animacaoCamera = { t: 0, duracao, de: camera.position.clone(), para: para.clone(), alvoDe: controls.target.clone(), alvoPara: alvo.clone() };
}

function enquadrar(modelo, imediato = false) {
  const c = modelo.camera;
  const alvo = new THREE.Vector3(...(c.alvo || [0, 0.9, 0]));
  const ang = c.angulo ?? 0.55;
  const elev = c.elevacao ?? 0.32;
  const para = new THREE.Vector3(Math.sin(ang) * Math.cos(elev), Math.sin(elev), Math.cos(ang) * Math.cos(elev)).multiplyScalar(c.distancia).add(alvo);
  controls.minDistance = c.min ?? c.distancia * 0.45;
  controls.maxDistance = c.max ?? c.distancia * 1.7;
  if (imediato) { camera.position.copy(para); controls.target.copy(alvo); }
  else moverCamera(para, alvo, 1.1);
}

// ---------------------------------------------------------------------------
// Painel de informações e controles do modelo
// ---------------------------------------------------------------------------
function montarAcoes(modelo) {
  els.acoes.innerHTML = "";
  (modelo.acoes || []).forEach((acao) => {
    const wrap = document.createElement("div");
    wrap.className = `acao3d acao3d--${acao.tipo}`;
    if (acao.tipo === "faixa") {
      const id = `acao-${acao.id}`;
      wrap.innerHTML = `<label for="${id}"><span>${acao.rotulo}</span><output id="${id}-valor"></output></label><input id="${id}" type="range" min="${acao.min}" max="${acao.max}" step="${acao.passo}" value="${acao.valor}">`;
      const input = wrap.querySelector("input");
      const out = wrap.querySelector("output");
      const aplicar = () => {
        const v = Number(input.value);
        out.textContent = acao.formatar ? acao.formatar(v) : String(v);
        input.style.setProperty("--p", `${((v - acao.min) / (acao.max - acao.min)) * 100}%`);
        atualizarStatus(modelo.acao(acao.id, v));
      };
      input.addEventListener("input", aplicar);
      aplicar();
    } else {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "acao3d__botao";
      if (acao.tipo === "alternar") botao.setAttribute("aria-pressed", String(Boolean(acao.valor)));
      botao.innerHTML = `<i aria-hidden="true"></i><span>${acao.rotulo}</span>`;
      botao.addEventListener("click", () => {
        esconderDica();
        if (acao.tipo === "alternar") {
          acao.valor = !acao.valor;
          botao.setAttribute("aria-pressed", String(acao.valor));
          atualizarStatus(modelo.acao(acao.id, acao.valor));
        } else {
          atualizarStatus(modelo.acao(acao.id));
          if (acao.grupo) {
            els.acoes.querySelectorAll(`[data-grupo="${acao.grupo}"]`).forEach((b) => b.setAttribute("aria-pressed", "false"));
            botao.setAttribute("aria-pressed", "true");
          }
        }
      });
      if (acao.grupo) { botao.dataset.grupo = acao.grupo; botao.setAttribute("aria-pressed", String(Boolean(acao.ativo))); }
      wrap.appendChild(botao);
      if (acao.descricao) {
        const p = document.createElement("small");
        p.textContent = acao.descricao;
        wrap.appendChild(p);
      }
    }
    els.acoes.appendChild(wrap);
  });
  atualizarStatus(modelo.status);
}

function atualizarStatus(texto) {
  if (texto === undefined) return;
  els.status.hidden = !texto;
  els.status.textContent = texto || "";
}

function atualizarPainel(area, modelo) {
  document.documentElement.style.setProperty("--area3d", area.cor);
  els.rotulo.textContent = `${area.n} · Biotecnologia ${area.espectro} · ${area.nome}`;
  els.titulo.textContent = modelo.titulo;
  els.descricao.textContent = modelo.descricao;
  els.detalhe.hidden = true;
  els.linkArea.href = `../areas/${area.id}/index.html`;
  els.linkArea.querySelector("span").textContent = `Página da Biotecnologia ${area.espectro}`;
  els.linkIa.href = `../ia/index.html?pergunta=${encodeURIComponent(area.pergunta)}`;
  montarAcoes(modelo);
  els.lista.querySelectorAll("button").forEach((b) => {
    const ativo = b.dataset.area === area.id;
    b.classList.toggle("is-ativo", ativo);
    b.setAttribute("aria-current", ativo ? "true" : "false");
    if (ativo) b.scrollIntoView({ block: "nearest", inline: "center", behavior: reduzido ? "auto" : "smooth" });
  });
}

// ---------------------------------------------------------------------------
// Troca de áreas (sem recarregar a página)
// ---------------------------------------------------------------------------
async function carregarModelo(area) {
  if (cache.has(area.id)) return cache.get(area.id);
  const modulo = await import(`./modelos/${area.id}.js`);
  const comum = await import("./modelos/_comum.js");
  const modelo = modulo.criar({ cor: area.cor, reduzido, toque });
  modelo.realcar = (objs, cor) => comum.highlightable(objs, cor);
  modelo.grupo.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.castShadow !== false;
      if (o.material?.clippingPlanes) o.material.clipShadows = true;
    }
  });
  cache.set(area.id, modelo);
  return modelo;
}

let pedido = 0;
async function mostrarArea(id, { imediato = false } = {}) {
  const area = AREAS.find((a) => a.id === id) || AREAS[0];
  if (atual?.area.id === area.id) return;
  const meu = ++pedido;
  try { history.replaceState(null, "", `#${area.id}`); } catch { /* sem histórico */ }
  els.carregando.hidden = false;
  rim.color.set(area.cor);
  stage.userData.anel.material.color.set(area.cor);
  let modelo;
  try {
    modelo = await carregarModelo(area);
  } catch (error) {
    console.error(error);
    els.carregando.hidden = true;
    mostrarFalha("Não foi possível carregar este modelo. Verifique a conexão e tente novamente.");
    return;
  }
  if (meu !== pedido) return;
  els.carregando.hidden = true;
  const anterior = atual;
  pontoAtivo = null;
  atual = { area, modelo, botoes: [], destaque: null };
  atualizarPainel(area, modelo);
  atual.botoes = criarPontos(modelo);

  const entrar = () => {
    modelo.grupo.scale.setScalar(imediato || reduzido ? 1 : 0.001);
    scene.add(modelo.grupo);
    modelo.aoMostrar?.();
    enquadrar(modelo, imediato);
    controls.autoRotate = !reduzido;
    ocioso = 0;
    if (imediato || reduzido) return;
    let k = 0;
    trocaEmAndamento = (dt) => {
      k = Math.min(1, k + dt / 0.55);
      const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack
      modelo.grupo.scale.setScalar(Math.max(0.001, e));
      if (k >= 1) { modelo.grupo.scale.setScalar(1); trocaEmAndamento = null; }
    };
  };

  if (anterior && !reduzido) {
    let k = 0;
    const saindo = anterior.modelo.grupo;
    trocaEmAndamento = (dt) => {
      k = Math.min(1, k + dt / 0.25);
      saindo.scale.setScalar(Math.max(0.001, 1 - k * k));
      if (k >= 1) { scene.remove(saindo); trocaEmAndamento = null; entrar(); }
    };
  } else {
    if (anterior) scene.remove(anterior.modelo.grupo);
    entrar();
  }
  // Pré-carrega a próxima área em segundo plano.
  const proxima = AREAS[(AREAS.indexOf(area) + 1) % AREAS.length];
  setTimeout(() => carregarModelo(proxima).catch(() => {}), 1200);
}

function passo(delta) {
  const i = AREAS.findIndex((a) => a.id === atual?.area.id);
  mostrarArea(AREAS[(i + delta + AREAS.length) % AREAS.length].id);
}

// ---------------------------------------------------------------------------
// Interface geral
// ---------------------------------------------------------------------------
function montarLista() {
  AREAS.forEach((area) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.area = area.id;
    b.style.setProperty("--cor", area.cor);
    b.innerHTML = `<i aria-hidden="true"></i><span class="lista3d__n">${area.n}</span><span class="lista3d__nome">${area.nome}</span>`;
    b.addEventListener("click", () => mostrarArea(area.id));
    els.lista.appendChild(b);
  });
}

function esconderDica() {
  if (els.dica.hidden) return;
  els.dica.classList.add("is-saindo");
  setTimeout(() => { els.dica.hidden = true; }, 400);
  try { localStorage.setItem("prometheus-3d-dica", "1"); } catch { /* ignorado */ }
}

function mostrarFalha(texto) {
  els.falha.hidden = false;
  els.falha.querySelector("p").textContent = texto;
}

function ligarControles() {
  els.anterior.addEventListener("click", () => passo(-1));
  els.proxima.addEventListener("click", () => passo(1));
  els.reiniciar.addEventListener("click", () => {
    if (!atual) return;
    pontoAtivo = null;
    els.detalhe.hidden = true;
    atual.modelo.pontos.forEach((p) => { p._botao?.classList.remove("is-ativo"); p._item?.classList.remove("is-ativo"); });
    atual.destaque?.(0);
    atual.destaque = null;
    atual.modelo.reiniciar?.();
    montarAcoes(atual.modelo);
    enquadrar(atual.modelo);
  });
  const zoom = (f) => {
    const dir = camera.position.clone().sub(controls.target);
    const d = THREE.MathUtils.clamp(dir.length() * f, controls.minDistance, controls.maxDistance);
    moverCamera(controls.target.clone().add(dir.setLength(d)), controls.target.clone(), 0.45);
    controls.autoRotate = false;
    ocioso = 0;
  };
  els.zoomMais.addEventListener("click", () => zoom(0.8));
  els.zoomMenos.addEventListener("click", () => zoom(1.25));
  els.girar.addEventListener("click", () => {
    controls.autoRotate = !controls.autoRotate;
    els.girar.setAttribute("aria-pressed", String(controls.autoRotate));
    ocioso = -1e9 * Number(!controls.autoRotate); // não retoma sozinho se desligado
  });
  els.girar.setAttribute("aria-pressed", String(!reduzido));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); passo(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); passo(-1); }
    if (e.key === "Escape" && pontoAtivo) selecionarPonto(pontoAtivo);
  });
  window.addEventListener("hashchange", () => mostrarArea(location.hash.slice(1)));
  let visto = false;
  try { visto = localStorage.getItem("prometheus-3d-dica") === "1"; } catch { /* ignorado */ }
  els.dica.hidden = visto;
  els.dica.querySelector("b").textContent = toque ? "Arraste com um dedo para girar · pince para aproximar" : "Arraste para girar · role para aproximar";
  els.dica.addEventListener("click", esconderDica);
}

function iniciar() {
  montarLista();
  ligarControles();
  const temWebGL2 = (() => { try { return Boolean(document.createElement("canvas").getContext("webgl2")); } catch { return false; } })();
  if (!temWebGL2) {
    mostrarFalha("Seu navegador não oferece suporte a gráficos 3D (WebGL 2). Atualize o navegador ou use outro aparelho para explorar os modelos.");
    els.carregando.hidden = true;
    return;
  }
  try {
    iniciarCena();
  } catch (error) {
    console.error(error);
    mostrarFalha("Não foi possível iniciar o visualizador 3D neste aparelho.");
    return;
  }
  const inicial = location.hash.slice(1);
  mostrarArea(AREAS.some((a) => a.id === inicial) ? inicial : AREAS[0].id, { imediato: true });
  if (new URLSearchParams(location.search).has("debug")) window.__explorar = { mostrarArea, get atual() { return atual; }, camera, controls, renderer, scene, selecionarPonto };
}

iniciar();
