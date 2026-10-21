// Biotecnologia Cinza — estação de tratamento biológico de efluentes (lodo ativado).
import { THREE, mat, mesh, rbox, tube, seeded, damp, lathe } from "./_comum.js";

export function criar() {
  const grupo = new THREE.Group();
  const rnd = seeded(31);
  const concreto = mat("#a7a39b", { rough: 0.85 });
  const concretoEscuro = mat("#7d7971", { rough: 0.9 });
  const metal = mat("#c9ced1", { rough: 0.3, metal: 1 });
  const amarelo = mat("#e0b13a", { rough: 0.5 });
  const grama = mat("#5a7a36", { rough: 0.9 });

  // Tanque aberto: fundo e quatro paredes (a água fica visível por cima).
  const tanqueAberto = (w, h, d, t = 0.04) => {
    const g = new THREE.Group();
    g.add(mesh(rbox(w, t, d, 0.01), concreto, { y: t / 2 }));
    [[0, d / 2 - t / 2, w, t], [0, -d / 2 + t / 2, w, t]].forEach(([x, z, ww, dd]) => g.add(mesh(rbox(ww, h, dd, 0.01), concreto, { x, y: h / 2, z })));
    [[w / 2 - t / 2, 0], [-w / 2 + t / 2, 0]].forEach(([x, z]) => g.add(mesh(rbox(t, h, d - t * 2 + 0.002, 0.01), concreto, { x, y: h / 2, z })));
    return g;
  };

  // Base do terreno.
  const base = mesh(rbox(2.7, 0.12, 1.5, 0.05), mat("#8a8273", { rough: 0.95 }), { y: 0.06 });
  grupo.add(base);
  grupo.add(mesh(rbox(2.66, 0.02, 1.46, 0.02), grama, { y: 0.125 }));

  const aguaCor = { bruta: new THREE.Color("#6b5636"), lodo: new THREE.Color("#6f6a3a"), clara: new THREE.Color("#4f8f99"), limpa: new THREE.Color("#5fb0c8") };
  const agua = (cor) => mat(cor, { rough: 0.08, clearcoat: 1, opacity: 0.72 });
  const y0 = 0.13;

  // 1) Gradeamento: canal com grade de barras e resíduos retidos.
  const grade = new THREE.Group();
  grade.position.set(-1.05, y0, 0.25);
  grade.add(tanqueAberto(0.55, 0.22, 0.26, 0.035));
  const aguaGrade = agua(aguaCor.bruta.getStyle());
  grade.add(mesh(new THREE.BoxGeometry(0.47, 0.13, 0.18), aguaGrade, { y: 0.1, cast: false }));
  for (let i = 0; i < 9; i += 1) grade.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), metal, { x: 0.05, y: 0.2, z: -0.08 + i * 0.02, rz: 0.35 }));
  for (let i = 0; i < 7; i += 1) grade.add(mesh(new THREE.IcosahedronGeometry(0.018 + rnd() * 0.015, 0), mat(["#6b5a3a", "#3a4a3a", "#8a7a5a"][i % 3], { rough: 0.9, flat: true }), { x: 0.0 + rnd() * 0.04, y: 0.19, z: -0.06 + rnd() * 0.12 }));
  grupo.add(grade);

  // 2) Tanque de aeração (reator biológico).
  const reator = new THREE.Group();
  reator.position.set(-0.3, y0, 0.0);
  reator.add(tanqueAberto(0.8, 0.36, 0.8, 0.045));
  const aguaReator = agua(aguaCor.lodo.getStyle());
  aguaReator.opacity = 0.55;
  const superficieReator = mesh(new THREE.BoxGeometry(0.7, 0.26, 0.7), aguaReator, { y: 0.175, cast: false });
  reator.add(superficieReator);
  // Difusores de ar no fundo (visíveis através da água).
  for (let i = 0; i < 9; i += 1) reator.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 16), concretoEscuro, { x: -0.24 + (i % 3) * 0.24, y: 0.05, z: -0.24 + Math.floor(i / 3) * 0.24 }));
  reator.add(mesh(tube([[-0.42, 0.42, -0.42], [-0.42, 0.55, -0.42], [0.3, 0.55, -0.42], [0.3, 0.42, -0.42]], 0.015, { segments: 20 }), metal));
  grupo.add(reator);
  const nB = 120;
  const bolhas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), mat("#f4f8f6", { rough: 0.1, opacity: 0.75, clearcoat: 1 }), nB);
  const bDados = Array.from({ length: nB }, () => ({ x: (rnd() - 0.5) * 0.66, z: (rnd() - 0.5) * 0.66, y: rnd(), v: 0.3 + rnd() * 0.4 }));
  bolhas.castShadow = false;
  reator.add(bolhas);
  // Flocos de lodo ativado (comunidade microbiana).
  const nF = 45;
  const flocos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.022, 1), mat("#4d4228", { rough: 0.8, flat: true }), nF);
  const fDados = Array.from({ length: nF }, () => ({ x: (rnd() - 0.5) * 0.6, z: (rnd() - 0.5) * 0.6, y: 0.1 + rnd() * 0.2, f: rnd() * 6, s: 0.6 + rnd() }));
  reator.add(flocos);

  // 3) Decantador circular com ponte raspadora giratória.
  const decantador = new THREE.Group();
  decantador.position.set(0.62, y0, -0.1);
  decantador.add(mesh(lathe([[0, 0], [0.46, 0], [0.48, 0.02], [0.48, 0.3], [0.44, 0.3], [0.44, 0.04], [0, 0.04]], 64), concreto));
  const aguaDecantador = agua(aguaCor.clara.getStyle());
  decantador.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.02, 64), aguaDecantador, { y: 0.27, cast: false }));
  decantador.add(mesh(new THREE.TorusGeometry(0.4, 0.008, 6, 64), metal, { y: 0.29, rx: Math.PI / 2 }));
  decantador.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 20), concretoEscuro, { y: 0.18 }));
  const ponte = new THREE.Group();
  ponte.position.y = 0.36;
  ponte.add(mesh(rbox(0.94, 0.03, 0.06, 0.01), amarelo));
  ponte.add(mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), metal, { x: 0.4, y: -0.06 }));
  [-1, 1].forEach((s) => ponte.add(mesh(new THREE.BoxGeometry(0.9, 0.012, 0.012), metal, { y: 0.04, z: s * 0.025 })));
  decantador.add(ponte);
  grupo.add(decantador);

  // 4) Saída de água tratada para um lago com plantas e biossensor.
  const saida = new THREE.Group();
  saida.position.set(1.0, y0, 0.45);
  const lago = mesh(new THREE.CircleGeometry(0.32, 48), agua(aguaCor.limpa.getStyle()), { y: 0.01, rx: -Math.PI / 2, cast: false });
  saida.add(lago);
  const aguaLago = lago.material;
  for (let i = 0; i < 18; i += 1) {
    const a = rnd() * Math.PI * 2, r = 0.28 + rnd() * 0.08;
    saida.add(mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.18 + rnd() * 0.12, 5), grama, { x: Math.cos(a) * r, y: 0.1, z: Math.sin(a) * r, rz: (rnd() - 0.5) * 0.3 }));
  }
  const sensor = new THREE.Group();
  sensor.position.set(0.0, 0.02, 0.0);
  sensor.add(mesh(new THREE.SphereGeometry(0.06, 24, 16), mat("#e46a35", { rough: 0.45 })));
  sensor.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), metal, { y: 0.1 }));
  const led = mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: "#d9473a", toneMapped: false }), { y: 0.19 });
  sensor.add(led);
  saida.add(sensor);
  grupo.add(saida);

  // Tubulações e canais entre as etapas.
  const canos = new THREE.Group();
  canos.add(mesh(tube([[-0.78, 0.29, 0.25], [-0.72, 0.29, 0.25], [-0.72, 0.3, 0.15]], 0.03, { segments: 10 }), concretoEscuro));
  canos.add(mesh(tube([[0.1, 0.38, 0.0], [0.2, 0.42, -0.05], [0.3, 0.42, -0.08], [0.2, 0.42, -0.1]], 0.025, { segments: 14 }), metal));
  canos.add(mesh(tube([[0.95, 0.36, 0.08], [1.05, 0.3, 0.2], [1.02, 0.18, 0.38]], 0.025, { segments: 14 }), metal));
  grupo.add(canos);

  // Partículas de fluxo ao longo do percurso.
  const caminho = new THREE.CatmullRomCurve3([[-1.3, 0.3, 0.25], [-0.8, 0.3, 0.25], [-0.5, 0.46, 0.05], [-0.1, 0.46, -0.05], [0.25, 0.5, -0.08], [0.62, 0.44, -0.1], [0.95, 0.42, 0.1], [1.02, 0.2, 0.42]].map((p) => new THREE.Vector3(...p)));
  const nP = 40;
  const fluxo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, toneMapped: false }), nP);
  fluxo.castShadow = false;
  const pDados = Array.from({ length: nP }, (_, i) => ({ u: i / nP }));
  fluxo.userData.semOclusao = true;
  grupo.add(fluxo);
  const corP = new THREE.Color();

  const estado = { ligado: false, semMicrobios: false, k: 0, q: 0 };
  const o = new THREE.Object3D();
  const statusTexto = () => {
    if (!estado.ligado) return "Estação parada: o esgoto bruto espera no canal de entrada.";
    if (estado.semMicrobios) return "Sem a comunidade microbiana, a matéria orgânica não é degradada: a água sai turva e o biossensor acusa contaminação.";
    return "Tratamento ativo: microrganismos consomem a matéria orgânica, os flocos decantam e a água sai clara — o biossensor fica verde.";
  };

  const pontos = [
    { id: "grade", titulo: "Gradeamento", posicao: [-1.05, 0.42, 0.25], destaque: [grade],
      texto: "A primeira etapa é física: grades retêm plásticos, folhas e outros sólidos grandes que danificariam bombas e atrapalhariam o tratamento biológico." },
    { id: "reator", titulo: "Tanque de aeração", posicao: [-0.3, 0.58, 0.3], destaque: [reator],
      texto: "O coração do tratamento biológico. Ar é soprado pelo fundo para que bactérias aeróbias consumam a matéria orgânica dissolvida, transformando-a em CO₂, água e mais biomassa." },
    { id: "flocos", titulo: "Flocos microbianos", posicao: [-0.12, 0.5, 0.05], destaque: [flocos],
      texto: "Bactérias, protozoários e fungos se agrupam em flocos — o lodo ativado. A composição dessa comunidade é monitorada para manter o processo eficiente." },
    { id: "decantador", titulo: "Decantador", posicao: [0.62, 0.58, -0.1], destaque: [decantador],
      texto: "Em água calma, os flocos pesados afundam. A ponte giratória raspa o lodo do fundo; parte volta ao tanque de aeração para manter os microrganismos ativos." },
    { id: "sensor", titulo: "Biossensor", posicao: [1.0, 0.42, 0.45], destaque: [sensor],
      texto: "Biossensores usam componentes biológicos — enzimas, anticorpos ou células — para detectar poluentes. Aqui, ele indica se a água devolvida ao ambiente está dentro do padrão." },
    { id: "agua", titulo: "Água tratada", posicao: [1.18, 0.2, 0.62], destaque: [lago],
      texto: "Depois do tratamento, a água volta a rios e lagos com muito menos carga orgânica, protegendo a fauna e a saúde de quem vive ao redor." },
  ];

  return {
    grupo,
    titulo: "Estação de tratamento biológico",
    descricao: "Uma estação em miniatura que usa microrganismos para limpar o esgoto. Inicie o tratamento e veja o que acontece quando a comunidade microbiana é removida.",
    camera: { distancia: 4.2, alvo: [0, 0.35, 0.1], angulo: 0.35, elevacao: 0.55, min: 2.2 },
    pontos,
    acoes: [
      { id: "ligar", tipo: "alternar", rotulo: "Iniciar tratamento", valor: false, descricao: "Liga o fluxo de água e a aeração." },
      { id: "semMicrobios", tipo: "alternar", rotulo: "Remover microrganismos", valor: false, descricao: "Experimento: o que muda sem o lodo ativado?" },
    ],
    status: statusTexto(),
    acao(id, valor) {
      if (id === "ligar") estado.ligado = valor;
      if (id === "semMicrobios") estado.semMicrobios = valor;
      return statusTexto();
    },
    reiniciar() { estado.ligado = false; estado.semMicrobios = false; this.acoes.forEach((a) => { a.valor = false; }); this.status = statusTexto(); },
    atualizar(dt, t) {
      estado.k = damp(estado.k, estado.ligado ? 1 : 0, 1.5, dt);
      estado.q = damp(estado.q, estado.ligado && !estado.semMicrobios ? 1 : 0, 0.8, dt);
      const k = estado.k, q = estado.q;
      ponte.rotation.y += dt * 0.35 * k;
      aguaReator.color.copy(aguaCor.lodo).lerp(aguaCor.bruta, 1 - q * 0.6);
      aguaDecantador.color.copy(aguaCor.bruta).lerp(aguaCor.clara, q);
      aguaLago.color.copy(aguaCor.bruta).lerp(aguaCor.limpa, q);
      aguaLago.opacity = 0.88 + (1 - q) * 0.1;
      led.material.color.set(q > 0.6 ? "#46d17a" : "#d9473a");
      bDados.forEach((b, i) => {
        b.y = (b.y + dt * b.v * k) % 1;
        o.position.set(b.x + Math.sin(t * 3 + i) * 0.01, 0.06 + b.y * 0.29, b.z);
        o.scale.setScalar(k > 0.05 ? 0.7 + b.y : 0.0001);
        o.updateMatrix();
        bolhas.setMatrixAt(i, o.matrix);
      });
      bolhas.instanceMatrix.needsUpdate = true;
      const vivos = estado.semMicrobios ? 0 : 1;
      fDados.forEach((f, i) => {
        o.position.set(f.x + Math.sin(t * 0.8 + f.f) * 0.03 * k, f.y - 0.02 + Math.sin(t * 1.3 + f.f) * 0.01, f.z + Math.cos(t * 0.7 + f.f) * 0.03 * k);
        o.rotation.set(t * 0.5 + f.f, f.f, 0);
        o.scale.setScalar(vivos ? f.s : 0.0001);
        o.updateMatrix();
        flocos.setMatrixAt(i, o.matrix);
      });
      flocos.instanceMatrix.needsUpdate = true;
      pDados.forEach((p, i) => {
        p.u = (p.u + dt * 0.06 * k) % 1;
        caminho.getPointAt(p.u, o.position);
        o.scale.setScalar(k > 0.05 ? 1 : 0.0001);
        o.updateMatrix();
        fluxo.setMatrixAt(i, o.matrix);
        // A cor da água muda ao longo do tratamento.
        corP.copy(aguaCor.bruta).lerp(aguaCor.limpa, p.u > 0.35 ? Math.min(1, (p.u - 0.35) * 2) * q : 0);
        fluxo.setColorAt(i, corP);
      });
      fluxo.instanceMatrix.needsUpdate = true;
      if (fluxo.instanceColor) fluxo.instanceColor.needsUpdate = true;
    },
  };
}
