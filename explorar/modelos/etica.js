// Biotecnologia Roxa — balança da decisão: riscos e benefícios de uma nova biotecnologia.
import { THREE, mat, mesh, lathe, rbox, textPlane, damp } from "./_comum.js";

const CRITERIOS = [
  { id: "eficacia", lado: "beneficio", peso: 3, rotulo: "Eficácia comprovada", inicial: true },
  { id: "acesso", lado: "beneficio", peso: 2, rotulo: "Acesso equitativo", inicial: false },
  { id: "ambiente", lado: "beneficio", peso: 1, rotulo: "Ganho ambiental", inicial: false },
  { id: "adversos", lado: "risco", peso: 3, rotulo: "Efeitos adversos graves", inicial: true },
  { id: "biosseguranca", lado: "risco", peso: 2, rotulo: "Risco à biossegurança", inicial: false },
  { id: "dados", lado: "risco", peso: 2, rotulo: "Dados insuficientes", inicial: false },
];

export function criar() {
  const grupo = new THREE.Group();
  const latao = mat("#c9a24e", { rough: 0.28, metal: 1 });
  const lataoEscuro = mat("#8f6f2e", { rough: 0.35, metal: 1 });
  const marmore = mat("#e9e4dc", { rough: 0.35, clearcoat: 0.4 });

  // Base de mármore e coluna.
  grupo.add(mesh(lathe([[0, 0], [0.5, 0], [0.52, 0.03], [0.48, 0.07], [0.4, 0.09], [0.38, 0.16], [0.3, 0.19], [0, 0.19]], 64), marmore));
  grupo.add(mesh(lathe([[0, 0.19], [0.1, 0.19], [0.06, 0.3], [0.045, 0.4], [0.045, 1.42], [0.07, 1.48], [0.05, 1.52], [0, 1.53]], 48), latao));
  grupo.add(mesh(new THREE.SphereGeometry(0.06, 24, 16), latao, { y: 1.72 }));
  grupo.add(mesh(new THREE.ConeGeometry(0.025, 0.12, 16), lataoEscuro, { y: 1.83 }));

  // Travessão (gira) e pratos (permanecem nivelados).
  const pivo = new THREE.Group();
  pivo.position.y = 1.6;
  grupo.add(pivo);
  const travessao = new THREE.Group();
  pivo.add(travessao);
  travessao.add(mesh(rbox(1.84, 0.045, 0.05, 0.02), latao));
  travessao.add(mesh(new THREE.TorusGeometry(0.07, 0.014, 10, 32), lataoEscuro, { z: 0.03 }));
  const ponteiro = mesh(new THREE.ConeGeometry(0.02, 0.28, 12), lataoEscuro, { y: 0.14 });
  travessao.add(ponteiro);
  [-1, 1].forEach((s) => travessao.add(mesh(new THREE.SphereGeometry(0.035, 16, 12), lataoEscuro, { x: s * 0.92 })));
  // Mostrador do ponteiro.
  const mostrador = mesh(new THREE.TorusGeometry(0.3, 0.008, 6, 48, Math.PI * 0.5), lataoEscuro, { y: 1.6, z: -0.03, rz: Math.PI * 0.25 });
  grupo.add(mostrador);

  const criarPrato = (corEtiqueta, rotulo) => {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [0.3, 0.0], [0.33, 0.05], [0.335, 0.07], [0.31, 0.06], [0, 0.02]], 48), latao));
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const de = new THREE.Vector3(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3), ate = new THREE.Vector3(0, 0.7, 0);
      const d = ate.clone().sub(de);
      const corrente = mesh(new THREE.CylinderGeometry(0.004, 0.004, d.length(), 5), lataoEscuro);
      corrente.position.copy(de).add(ate).multiplyScalar(0.5);
      corrente.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      g.add(corrente);
    }
    const etiqueta = textPlane(rotulo, { width: 0.42, color: "#fff", background: corEtiqueta });
    etiqueta.position.set(0, -0.08, 0.34);
    g.add(etiqueta);
    const pesos = new THREE.Group();
    pesos.position.y = 0.05;
    g.add(pesos);
    g.userData.pesos = pesos;
    return g;
  };
  const pratoBeneficio = criarPrato("rgba(63,128,82,.9)", "BENEFÍCIOS");
  const pratoRisco = criarPrato("rgba(160,64,52,.9)", "RISCOS");
  grupo.add(pratoBeneficio, pratoRisco);

  // Pesos com o nome de cada critério.
  const pesos = {};
  CRITERIOS.forEach((c) => {
    const g = new THREE.Group();
    const h = 0.05 + c.peso * 0.035;
    const corBloco = c.lado === "beneficio" ? "#5e9c6c" : "#b85a48";
    g.add(mesh(rbox(0.44, h, 0.2, 0.025), mat(corBloco, { rough: 0.4, clearcoat: 0.5 }), { y: h / 2 }));
    const rotulo = textPlane(c.rotulo, { width: 0.4, color: "#fff", background: null, font: "700 44px Inter, Arial, sans-serif" });
    rotulo.position.set(0, h / 2, 0.101);
    g.add(rotulo);
    g.userData.h = h;
    g.visible = false;
    (c.lado === "beneficio" ? pratoBeneficio : pratoRisco).userData.pesos.add(g);
    pesos[c.id] = g;
  });

  // Documentos de comitê e selo de aprovação.
  const docs = new THREE.Group();
  docs.position.set(0.62, 0.0, 0.42);
  docs.rotation.y = -0.4;
  for (let i = 0; i < 6; i += 1) docs.add(mesh(rbox(0.3, 0.008, 0.4, 0.003), mat(i % 2 ? "#f2ede2" : "#e6e0d2", { rough: 0.9 }), { y: 0.004 + i * 0.009, ry: (i % 3 - 1) * 0.05 }));
  const capa = textPlane("PARECER DO COMITÊ", { width: 0.26, color: "#3b2f4a", background: "rgba(0,0,0,0)", font: "700 36px Inter, Arial, sans-serif" });
  capa.rotation.x = -Math.PI / 2;
  capa.position.set(0, 0.06, -0.1);
  docs.add(capa);
  grupo.add(docs);
  const selo = new THREE.Group();
  selo.position.set(-0.62, 0, 0.44);
  selo.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.04, 32), mat("#6b5470", { rough: 0.4 }), { y: 0.02 }));
  selo.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 20), mat("#2c2430", { rough: 0.5 }), { y: 0.11 }));
  selo.add(mesh(new THREE.SphereGeometry(0.05, 20, 14), mat("#2c2430", { rough: 0.5 }), { y: 0.2 }));
  grupo.add(selo);

  const estado = { ativos: new Set(CRITERIOS.filter((c) => c.inicial).map((c) => c.id)), theta: 0, omega: 0 };
  const somar = (lado) => CRITERIOS.filter((c) => c.lado === lado && estado.ativos.has(c.id)).reduce((s, c) => s + c.peso, 0);
  const atualizarPesos = () => {
    [pratoBeneficio, pratoRisco].forEach((prato) => {
      let y = 0;
      prato.userData.pesos.children.forEach((g) => {
        const id = Object.keys(pesos).find((k) => pesos[k] === g);
        g.visible = estado.ativos.has(id);
        if (g.visible) { g.position.y = y; g.rotation.y = (y * 7) % 0.3 - 0.15; y += g.userData.h + 0.005; }
      });
    });
  };
  atualizarPesos();
  const veredito = () => {
    const b = somar("beneficio"), r = somar("risco");
    const dif = b - r;
    let texto;
    if (!b && !r) texto = "Sem critérios na balança: nenhuma decisão pode ser tomada sem evidências.";
    else if (estado.ativos.has("dados")) texto = "Com dados insuficientes, a decisão responsável é pedir mais estudos antes de aprovar — mesmo que os benefícios pareçam grandes.";
    else if (dif >= 2) texto = "Os benefícios superam os riscos: aprovação possível, com monitoramento após o uso e transparência para a sociedade.";
    else if (dif <= -2) texto = "Os riscos superam os benefícios: a tecnologia não deve ser aprovada nesta forma.";
    else texto = "Equilíbrio delicado: a decisão depende de mais evidências, de medidas de proteção e do diálogo com a sociedade.";
    return `Benefícios ${b} × Riscos ${r}. ${texto}`;
  };

  const pontos = [
    { id: "balanca", titulo: "Avaliação risco-benefício", posicao: [0, 1.85, 0.05], destaque: [travessao],
      texto: "Toda nova biotecnologia — um medicamento, uma planta editada, uma terapia gênica — passa por uma análise que pesa benefícios esperados contra riscos possíveis, com base em evidências científicas." },
    { id: "beneficios", titulo: "Benefícios", posicao: [-0.92, 1.1, 0.25], destaque: [pratoBeneficio], dinamico: () => pratoBeneficio,
      texto: "Eficácia, alcance social e ganhos ambientais contam a favor. Ética também pergunta: quem terá acesso? A tecnologia reduz ou aumenta desigualdades?" },
    { id: "riscos", titulo: "Riscos", posicao: [0.92, 1.1, 0.25], destaque: [pratoRisco], dinamico: () => pratoRisco,
      texto: "Efeitos adversos, impactos ambientais e incertezas contam contra. O princípio da precaução orienta a agir com cuidado quando os dados ainda são insuficientes." },
    { id: "comite", titulo: "Comitês de ética", posicao: [0.62, 0.15, 0.42], destaque: [docs],
      texto: "Pesquisas com pessoas precisam de aprovação de comitês de ética (no Brasil, o sistema CEP/Conep). Eles avaliam riscos, benefícios e o consentimento livre e esclarecido dos participantes." },
    { id: "regulacao", titulo: "Regulamentação", posicao: [-0.62, 0.3, 0.44], destaque: [selo],
      texto: "Agências reguladoras analisam produtos antes do uso — no Brasil, por exemplo, a Anvisa (saúde) e a CTNBio (organismos geneticamente modificados) — e acompanham seus efeitos depois da aprovação." },
  ];
  pontos.forEach((p) => {
    if (!p.dinamico) return;
    const ref = p.dinamico;
    Object.defineProperty(p, "posicao", { get: () => { const g = ref(); return [g.position.x, g.position.y + 0.32, g.position.z + 0.2]; } });
  });

  return {
    grupo,
    titulo: "Balança da decisão",
    descricao: "Decidir se uma biotecnologia pode ser usada exige pesar benefícios e riscos com base em evidências. Coloque critérios na balança e veja como a recomendação muda.",
    camera: { distancia: 5.0, alvo: [0, 1.05, 0], angulo: 0.18, elevacao: 0.12 },
    pontos,
    acoes: CRITERIOS.map((c) => ({ id: c.id, tipo: "alternar", rotulo: `${c.lado === "beneficio" ? "Benefício" : "Risco"}: ${c.rotulo} (${c.peso})`, valor: c.inicial })),
    status: veredito(),
    acao(id, valor) {
      if (valor) estado.ativos.add(id); else estado.ativos.delete(id);
      atualizarPesos();
      return veredito();
    },
    reiniciar() {
      estado.ativos = new Set(CRITERIOS.filter((c) => c.inicial).map((c) => c.id));
      this.acoes.forEach((a) => { a.valor = estado.ativos.has(a.id); });
      atualizarPesos();
      this.status = veredito();
    },
    atualizar(dt, t) {
      const alvo = THREE.MathUtils.clamp((somar("beneficio") - somar("risco")) * 0.055, -0.3, 0.3);
      // Mola amortecida: o travessão oscila um pouco antes de parar.
      estado.omega += ((alvo - estado.theta) * 26 - estado.omega * 4.2) * dt;
      estado.theta += estado.omega * dt;
      travessao.rotation.z = estado.theta;
      const c = Math.cos(estado.theta), s = Math.sin(estado.theta);
      pratoBeneficio.position.set(-0.92 * c, 1.6 - 0.92 * s - 0.7, 0);
      pratoRisco.position.set(0.92 * c, 1.6 + 0.92 * s - 0.7, 0);
      const balanco = Math.sin(t * 1.3) * 0.01;
      pratoBeneficio.rotation.z = balanco - estado.omega * 0.05;
      pratoRisco.rotation.z = -balanco - estado.omega * 0.05;
    },
  };
}
