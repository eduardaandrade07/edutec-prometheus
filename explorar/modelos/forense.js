// Biotecnologia Preta — perfil genético forense: marcadores STR e comparação de amostras.
import { THREE, mat, mesh, tube, rbox, textPlane } from "./_comum.js";

// Quatro marcadores STR usados em perícia (alelos = número de repetições).
const LOCI = ["D3S1358", "vWA", "FGA", "TH01"];
const FAIXA = { D3S1358: [12, 19], vWA: [13, 21], FGA: [18, 27], TH01: [5, 10] };
const PERFIS = {
  cena: { nome: "Vestígio da cena", alelos: { D3S1358: [15, 17], vWA: [16, 18], FGA: [21, 24], TH01: [6, 9] } },
  a: { nome: "Suspeito A", alelos: { D3S1358: [15, 17], vWA: [16, 18], FGA: [21, 24], TH01: [6, 9] } },
  b: { nome: "Suspeito B", alelos: { D3S1358: [14, 17], vWA: [17, 19], FGA: [22, 24], TH01: [7, 8] } },
};
const CORES_LOCUS = ["#5aa7ff", "#5ee08f", "#ffc25a", "#ff7a6b"];

export function criar({ cor }) {
  const grupo = new THREE.Group();

  // ---- Dupla hélice com a região STR destacada ----
  const helice = new THREE.Group();
  helice.position.set(-0.15, 1.78, -0.1);
  grupo.add(helice);
  const pares = 46, passo = 0.045, raio = 0.13;
  const fitaA = [], fitaB = [];
  for (let i = 0; i <= pares; i += 1) {
    const a = i * 0.62;
    const x = (i - pares / 2) * passo;
    fitaA.push(new THREE.Vector3(x, Math.cos(a) * raio, Math.sin(a) * raio));
    fitaB.push(new THREE.Vector3(x, Math.cos(a + Math.PI * 0.78) * raio, Math.sin(a + Math.PI * 0.78) * raio));
  }
  const fitaMat = mat("#c9d2dc", { rough: 0.35, metal: 0.2, clearcoat: 0.5 });
  helice.add(mesh(tube(fitaA, 0.016, { segments: 200 }), fitaMat), mesh(tube(fitaB, 0.016, { segments: 200 }), fitaMat));
  const neutro = mat("#7f8790", { rough: 0.5 });
  const strMats = [mat(cor === "#8a847b" ? "#f2b34a" : "#f2b34a", { rough: 0.35, emissive: "#7a4a08", emissiveIntensity: 0.6 }), mat("#ffd98a", { rough: 0.35, emissive: "#8a6a20", emissiveIntensity: 0.5 })];
  const inicioSTR = 14, repeticoes = 6, bpPorRepeticao = 3; // trecho repetitivo visual
  const strDegraus = [];
  for (let i = 0; i < pares; i += 1) {
    const a = fitaA[i], b = fitaB[i];
    const d = b.clone().sub(a);
    const noSTR = i >= inicioSTR && i < inicioSTR + repeticoes * bpPorRepeticao;
    const m = noSTR ? strMats[Math.floor((i - inicioSTR) / bpPorRepeticao) % 2] : neutro;
    const degrau = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, d.length() * 0.9, 8), m);
    degrau.position.copy(a).add(b).multiplyScalar(0.5);
    degrau.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    degrau.castShadow = true;
    helice.add(degrau);
    if (noSTR) strDegraus.push(degrau);
  }
  const rotuloSTR = textPlane("GATA · GATA · GATA …  (repetições curtas em tandem)", { width: 0.95, color: "#ffd98a", background: "rgba(10,10,9,.75)", font: "600 34px Inter, Arial, sans-serif" });
  rotuloSTR.position.set((inicioSTR + 9 - pares / 2) * passo - 0.15, 2.1, -0.1);
  grupo.add(rotuloSTR);

  // Lupa (objeto-símbolo da área) sobre a região STR.
  const lupa = new THREE.Group();
  lupa.add(mesh(new THREE.TorusGeometry(0.2, 0.018, 16, 64), mat("#2a2b2e", { rough: 0.35, metal: 0.6 })));
  lupa.add(mesh(new THREE.CircleGeometry(0.19, 48), mat("#cfe6ee", { rough: 0.02, opacity: 0.18, clearcoat: 1 }), { cast: false }));
  lupa.add(mesh(rbox(0.05, 0.3, 0.04, 0.015), mat("#3a2b22", { rough: 0.6 }), { x: 0.2, y: -0.27, rz: 0.6 }));
  lupa.children[1].userData.semOclusao = true;
  lupa.position.set((inicioSTR + 9 - pares / 2) * passo - 0.15, 1.78, 0.32);
  lupa.rotation.y = 0.15;
  grupo.add(lupa);

  // ---- Eletroferogramas (três amostras) ----
  const painel = new THREE.Group();
  painel.position.set(0.1, 0.0, -0.55);
  grupo.add(painel);
  const W = 1.7, H = 0.28;
  const ordem = ["cena", "a", "b"];
  const posPico = (locus, alelo, k) => {
    const [mn, mx] = FAIXA[locus];
    const largura = W / LOCI.length;
    return -W / 2 + largura * k + largura * (0.12 + ((alelo - mn) / (mx - mn)) * 0.76);
  };
  const linhas = {};
  ordem.forEach((id, li) => {
    const y = 1.12 - li * (H + 0.08);
    const vidro = mesh(rbox(W + 0.08, H, 0.02, 0.01), mat("#0f1416", { rough: 0.2, opacity: 0.72, clearcoat: 1 }), { y, z: 0 });
    painel.add(vidro);
    const nome = textPlane(PERFIS[id].nome, { width: 0.42, color: id === "cena" ? "#ffd98a" : "#e8e2d6", background: null, font: "600 40px Inter, Arial, sans-serif" });
    nome.position.set(-W / 2 + 0.22, y + H / 2 - 0.035, 0.013);
    painel.add(nome);
    // Curva com picos gaussianos em cada alelo, uma cor por marcador.
    LOCI.forEach((locus, k) => {
      const pts = [];
      const x0 = -W / 2 + (W / LOCI.length) * k + 0.01, x1 = x0 + W / LOCI.length - 0.02;
      const picos = PERFIS[id].alelos[locus].map((al) => posPico(locus, al, k));
      for (let s = 0; s <= 60; s += 1) {
        const x = x0 + ((x1 - x0) * s) / 60;
        let v = 0;
        picos.forEach((px) => { v += Math.exp(-((x - px) ** 2) / 0.00012); });
        pts.push(new THREE.Vector3(x, y - H / 2 + 0.03 + v * (H - 0.09), 0.016));
      }
      painel.add(mesh(tube(pts, 0.0045, { segments: 120, radial: 5 }), new THREE.MeshBasicMaterial({ color: CORES_LOCUS[k], toneMapped: false }), { cast: false }));
      if (li === 0) {
        const r = textPlane(locus, { width: 0.2, color: CORES_LOCUS[k], background: null, font: "600 36px Inter, Arial, sans-serif" });
        r.position.set((x0 + x1) / 2, y + H / 2 + 0.03, 0.013);
        painel.add(r);
      }
    });
    linhas[id] = y;
  });
  painel.add(mesh(rbox(W + 0.2, 0.05, 0.12, 0.015), mat("#2a2b2e", { rough: 0.5, metal: 0.4 }), { y: 0.12 }));
  [-1, 1].forEach((s) => painel.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.15, 10), mat("#4a4b4f", { rough: 0.4, metal: 0.6 }), { x: s * (W / 2 + 0.06), y: 0.7 })));

  // Linhas de comparação entre a amostra da cena e o suspeito escolhido.
  const comparacao = new THREE.Group();
  painel.add(comparacao);
  const desenharComparacao = (alvo) => {
    comparacao.clear();
    if (!alvo) return;
    let iguais = 0;
    LOCI.forEach((locus, k) => {
      const cena = PERFIS.cena.alelos[locus], sus = PERFIS[alvo].alelos[locus];
      const bate = cena[0] === sus[0] && cena[1] === sus[1];
      if (bate) iguais += 1;
      cena.forEach((al) => {
        const x = posPico(locus, al, k);
        const encontrou = sus.includes(al);
        const yTopo = linhas.cena - H / 2 + 0.03, yBase = linhas[alvo] + H / 2 - 0.02;
        const barra = mesh(new THREE.BoxGeometry(0.014, yTopo - yBase, 0.006), new THREE.MeshBasicMaterial({ color: encontrou ? "#57e08a" : "#ff5a4e", transparent: true, opacity: 0.95, toneMapped: false }), { x, y: (yTopo + yBase) / 2, z: 0.02, cast: false });
        comparacao.add(barra);
      });
    });
    return iguais;
  };

  // ---- Saco de evidência lacrado com swab ----
  const evidencia = new THREE.Group();
  evidencia.position.set(-0.95, 0.02, 0.45);
  evidencia.rotation.set(-Math.PI / 2 + 0.05, 0, 0.5);
  evidencia.add(mesh(rbox(0.36, 0.5, 0.025, 0.012), mat("#e9eef0", { rough: 0.15, opacity: 0.45, clearcoat: 1 }), { cast: false }));
  evidencia.add(mesh(rbox(0.36, 0.04, 0.03, 0.01), mat("#c0392b", { rough: 0.5 }), { y: 0.23 }));
  const etiqueta = textPlane("EVIDÊNCIA · Nº 0427", { width: 0.28, color: "#1d1d1f", background: "rgba(250,246,236,.95)", font: "700 34px Inter, Arial, sans-serif" });
  etiqueta.position.set(0, 0.12, 0.016);
  evidencia.add(etiqueta);
  const swab = new THREE.Group();
  swab.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 8), mat("#f4f1ea", { rough: 0.6 }), { y: -0.07 }));
  swab.add(mesh(new THREE.CapsuleGeometry(0.018, 0.04, 6, 10), mat("#efe7d6", { rough: 0.9 }), { y: -0.24 }));
  swab.rotation.z = 0.08;
  evidencia.add(swab);
  grupo.add(evidencia);

  const estado = { alvo: null };
  const pontos = [
    { id: "str", titulo: "Região STR", posicao: [(inicioSTR + 9 - pares / 2) * passo - 0.15, 1.78, 0.05], destaque: strDegraus,
      texto: "STRs (repetições curtas em tandem) são trechos de DNA em que uma sequência de 2 a 6 bases se repete várias vezes. O número de repetições varia muito entre as pessoas." },
    { id: "repeticao", titulo: "Unidade de repetição", posicao: [(inicioSTR + 2 - pares / 2) * passo - 0.15, 1.95, 0.0], destaque: strDegraus.slice(0, bpPorRepeticao),
      texto: "Cada bloco destacado representa uma unidade (como GATA). Herdamos uma cópia de cada marcador da mãe e outra do pai — por isso cada pessoa tem dois números por marcador." },
    { id: "eletroferograma", titulo: "Eletroferograma", posicao: [0.1, 1.32, -0.53], destaque: [painel],
      texto: "Depois de extrair e amplificar o DNA por PCR, um equipamento separa os fragmentos por tamanho. Cada pico é um alelo; a posição indica quantas repetições ele tem." },
    { id: "marcadores", titulo: "Marcadores", posicao: [-0.62, 1.2, -0.53], destaque: [painel],
      texto: "Laboratórios analisam dezenas de marcadores ao mesmo tempo. Com muitos marcadores, a chance de duas pessoas sem parentesco terem o mesmo perfil fica extremamente pequena." },
    { id: "custodia", titulo: "Cadeia de custódia", posicao: [-0.95, 0.12, 0.45], destaque: [evidencia],
      texto: "Todo vestígio é coletado, lacrado, identificado e registrado a cada transferência. Sem esse histórico documentado, o resultado pode perder valor como prova." },
  ];

  const resultado = (alvo, iguais) => {
    if (!alvo) return "Escolha um suspeito para comparar com o vestígio da cena.";
    if (iguais === LOCI.length) return `${PERFIS[alvo].nome}: compatível nos ${LOCI.length} marcadores (barras verdes). Compatibilidade não é prova sozinha: exige cálculo estatístico, mais marcadores e cadeia de custódia íntegra.`;
    return `${PERFIS[alvo].nome}: incompatível em ${LOCI.length - iguais} de ${LOCI.length} marcadores (barras vermelhas). Uma única diferença confirmada já exclui a pessoa como fonte do vestígio.`;
  };

  return {
    grupo,
    titulo: "Perfil genético forense",
    descricao: "Como o DNA ajuda a responder perguntas na perícia: marcadores STR, picos no eletroferograma e a comparação entre amostras. Compare o vestígio da cena com os dois suspeitos.",
    camera: { distancia: 5.4, alvo: [0, 1.15, -0.1], angulo: 0.32, elevacao: 0.12 },
    pontos,
    acoes: [
      { id: "a", tipo: "botao", rotulo: "Comparar com o Suspeito A", grupo: "comparar" },
      { id: "b", tipo: "botao", rotulo: "Comparar com o Suspeito B", grupo: "comparar" },
    ],
    status: resultado(null),
    acao(id) {
      estado.alvo = id;
      return resultado(id, desenharComparacao(id));
    },
    reiniciar() { estado.alvo = null; desenharComparacao(null); this.status = resultado(null); },
    atualizar(dt, t) {
      helice.rotation.x = t * 0.25;
      lupa.position.y = 1.78 + Math.sin(t * 0.8) * 0.03;
      lupa.position.x = (inicioSTR + 9 - pares / 2) * passo - 0.15 + Math.sin(t * 0.35) * 0.18;
      strMats.forEach((m, i) => { m.emissiveIntensity = 0.45 + Math.sin(t * 2 + i) * 0.15; });
    },
  };
}
