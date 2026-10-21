// Biotecnologia Dourada — nanopartícula lipídica (LNP) carregando mRNA projetado por bioinformática.
import { THREE, mat, mesh, tube, fibonacciSphere, seeded, damp } from "./_comum.js";

function texturaSequencia() {
  const c = document.createElement("canvas");
  c.width = 2048; c.height = 96;
  const g = c.getContext("2d");
  const cores = { A: "#5ee08f", U: "#ff7a6b", G: "#ffc25a", C: "#6fb8ff" };
  const rnd = seeded(99);
  g.font = "700 56px 'JetBrains Mono', 'Courier New', monospace";
  g.textBaseline = "middle";
  let x = 10;
  const inicio = "AUGGCCUCCAAGGUGCUA";
  let i = 0;
  while (x < 2040) {
    const b = i < inicio.length ? inicio[i] : "AUGC"[Math.floor(rnd() * 4)];
    g.fillStyle = cores[b];
    g.fillText(b, x, 50);
    x += 40;
    i += 1;
    if (i % 3 === 0) x += 14;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

export function criar({ cor }) {
  const grupo = new THREE.Group();
  const lnp = new THREE.Group();
  const centroBase = new THREE.Vector3(-0.2, 1.05, 0);
  lnp.position.copy(centroBase);
  grupo.add(lnp);
  const rnd = seeded(13);
  const corte = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const cortaveis = [];
  const R = 0.62;
  const o = new THREE.Object3D();

  // Camada externa de lipídios: cabeças polares voltadas para fora e caudas para dentro.
  const pts = fibonacciSphere(820, R);
  const cabecaMat = mat("#e9c36a", { rough: 0.35, clearcoat: 0.4 });
  const cabecasPEG = mat("#7fc6d9", { rough: 0.35 });
  const caudaMat = mat("#c98f4a", { rough: 0.6 });
  cortaveis.push(cabecaMat, caudaMat, cabecasPEG);
  const cabecas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.032, 1), cabecaMat, pts.length);
  const caudas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.006, 0.11, 5), caudaMat, pts.length * 2);
  const up = new THREE.Vector3(0, 1, 0);
  const pegIdx = new Set();
  pts.forEach((p, i) => {
    if (i % 22 === 0) pegIdx.add(i);
    o.position.copy(p);
    o.quaternion.identity();
    o.scale.setScalar(1);
    o.updateMatrix();
    cabecas.setMatrixAt(i, o.matrix);
    const n = p.clone().normalize();
    const lado = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0)).normalize();
    [-1, 1].forEach((s, k) => {
      o.position.copy(n.clone().multiplyScalar(R - 0.07)).addScaledVector(lado, s * 0.011);
      o.quaternion.setFromUnitVectors(up, n);
      o.updateMatrix();
      caudas.setMatrixAt(i * 2 + k, o.matrix);
    });
  });
  lnp.add(cabecas, caudas);

  // PEG-lipídios: cadeias flexíveis que deixam a superfície "escorregadia".
  const peg = new THREE.Group();
  const pegMat = mat("#a8dbe8", { rough: 0.5 });
  [...pegIdx].forEach((i) => {
    const n = pts[i].clone().normalize();
    const lado = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(n).normalize();
    const cadeia = [];
    for (let k = 0; k <= 5; k += 1) cadeia.push(n.clone().multiplyScalar(R + k * 0.035).addScaledVector(lado, Math.sin(k * 1.4 + i) * 0.03));
    peg.add(mesh(tube(cadeia, 0.009, { segments: 16, radial: 5 }), pegMat));
    const cab = mesh(new THREE.SphereGeometry(0.036, 10, 8), cabecasPEG);
    cab.position.copy(pts[i]);
    peg.add(cab);
  });
  lnp.add(peg);

  // Núcleo: lipídios ionizáveis em fase densa com fitas de mRNA.
  const ionMat = mat("#d97a9a", { rough: 0.4 });
  cortaveis.push(ionMat);
  const nIon = 380;
  const ion = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.026, 1), ionMat, nIon);
  for (let i = 0; i < nIon; i += 1) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(Math.cbrt(rnd()) * (R - 0.13));
    o.position.copy(v);
    o.quaternion.identity();
    o.scale.setScalar(0.7 + rnd() * 0.6);
    o.updateMatrix();
    ion.setMatrixAt(i, o.matrix);
  }
  lnp.add(ion);
  const colMat = mat("#f2efe6", { rough: 0.5 });
  cortaveis.push(colMat);
  const colesterol = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.01, 0.05, 3, 6), colMat, 160);
  pts.slice(0, 160).forEach((p, i) => {
    const n = p.clone().normalize();
    o.position.copy(n.clone().multiplyScalar(R - 0.08));
    o.quaternion.setFromUnitVectors(up, n);
    o.updateMatrix();
    colesterol.setMatrixAt(i, o.matrix);
  });
  lnp.add(colesterol);

  const mrnaMat = mat("#5fd4c4", { rough: 0.3, clearcoat: 0.6, emissive: "#0f5a50", emissiveIntensity: 0.5 });
  cortaveis.push(mrnaMat);
  const mrna = new THREE.Group();
  const basesCores = ["#5ee08f", "#ff7a6b", "#ffc25a", "#6fb8ff"].map((c) => mat(c, { rough: 0.4 }));
  basesCores.forEach((m) => cortaveis.push(m));
  const basesPos = [[], [], [], []];
  for (let f = 0; f < 3; f += 1) {
    const caminho = [];
    let p = new THREE.Vector3((rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3);
    for (let k = 0; k < 14; k += 1) {
      caminho.push(p.clone());
      p.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.22));
      if (p.length() > R - 0.18) p.multiplyScalar((R - 0.2) / p.length());
    }
    const curva = new THREE.CatmullRomCurve3(caminho);
    mrna.add(mesh(new THREE.TubeGeometry(curva, 160, 0.014, 6), mrnaMat));
    for (let k = 0; k < 60; k += 1) basesPos[Math.floor(rnd() * 4)].push(curva.getPointAt(k / 60));
  }
  // Bases nitrogenadas ao longo das fitas (uma instância por base, por cor).
  basesPos.forEach((lista, b) => {
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 4), basesCores[b], lista.length);
    lista.forEach((pt, i) => { o.position.set(pt.x, pt.y + 0.012, pt.z); o.quaternion.identity(); o.scale.setScalar(1); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
    inst.castShadow = false;
    mrna.add(inst);
  });
  lnp.add(mrna);
  cortaveis.forEach((m) => { m.clippingPlanes = [corte]; });

  // Anel com a sequência de mRNA (projeto computacional).
  const texSeq = texturaSequencia();
  const anel = mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.13, 96, 1, true), new THREE.MeshBasicMaterial({ map: texSeq, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), { cast: false });
  anel.rotation.x = 0.18;
  anel.userData.semOclusao = true;
  lnp.add(anel);
  const anelAro = [-1, 1].map((s) => mesh(new THREE.TorusGeometry(0.98, 0.003, 4, 128), new THREE.MeshBasicMaterial({ color: cor, toneMapped: false }), { y: s * 0.07, rx: Math.PI / 2, cast: false }));
  const anelGrupo = new THREE.Group();
  anelGrupo.rotation.x = 0.18;
  anelAro.forEach((a) => anelGrupo.add(a));
  lnp.add(anelGrupo);

  // Trecho de membrana celular (destino da entrega).
  const membrana = new THREE.Group();
  membrana.position.set(1.35, 1.0, -0.2);
  membrana.rotation.y = -0.5;
  const memCab = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 1), mat("#d8b46a", { rough: 0.4 }), 2 * 14 * 18);
  const memCaud = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 4), mat("#b98a4a", { rough: 0.6 }), 2 * 14 * 18);
  let mi = 0;
  for (let a = 0; a < 14; a += 1) {
    for (let b = 0; b < 18; b += 1) {
      const y = (b - 9) * 0.065, z = (a - 7) * 0.065;
      const curv = -(z * z) * 0.35;
      [-1, 1].forEach((s) => {
        o.position.set(curv + s * 0.12, y, z);
        o.quaternion.identity();
        o.updateMatrix();
        memCab.setMatrixAt(mi, o.matrix);
        o.position.set(curv + s * 0.06, y, z);
        o.quaternion.setFromUnitVectors(up, new THREE.Vector3(1, 0, 0));
        o.updateMatrix();
        memCaud.setMatrixAt(mi, o.matrix);
        mi += 1;
      });
    }
  }
  membrana.add(memCab, memCaud);
  grupo.add(membrana);

  const estado = { cortar: true, sequencia: true, entregar: false, k: 0 };

  const pontos = [
    { id: "peg", titulo: "PEG-lipídios", posicao: [0.1, 0.62, 0.42], local: lnp, destaque: [peg],
      texto: "Cadeias de polietilenoglicol (PEG) formam uma camada que dá estabilidade à partícula e reduz a chance de ela ser rapidamente removida pelo sistema imune." },
    { id: "camada", titulo: "Camada lipídica", posicao: [-0.45, 0.25, -0.3], local: lnp, destaque: [cabecas, colesterol],
      texto: "Fosfolipídios e colesterol formam a casca da nanopartícula, como uma pequena bolha de gordura com cerca de 100 nanômetros — mil vezes mais fina que um fio de cabelo." },
    { id: "ionizavel", titulo: "Lipídio ionizável", posicao: [0.22, -0.2, -0.05], local: lnp, destaque: [ion], visivel: () => estado.cortar,
      texto: "No sangue ele é quase neutro; dentro do ambiente ácido da célula, ganha carga positiva e ajuda a liberar o mRNA no citoplasma. É a peça-chave da entrega." },
    { id: "mrna", titulo: "mRNA", posicao: [0.0, 0.05, -0.05], local: lnp, destaque: [mrna], visivel: () => estado.cortar,
      texto: "A molécula de mRNA carrega as instruções para a célula produzir uma proteína — por exemplo, um antígeno de vacina. Ela é frágil, por isso precisa ser protegida." },
    { id: "sequencia", titulo: "Sequência projetada", posicao: [0.95, 0.12, 0.25], local: lnp, destaque: anelAro, visivel: () => estado.sequencia,
      texto: "A bioinformática escolhe e otimiza a sequência (códons, regiões de estabilidade, ausência de trechos indesejados) antes de o mRNA ser produzido em laboratório." },
    { id: "membrana", titulo: "Membrana celular", posicao: [0.0, 0.4, 0.0], local: membrana, destaque: [memCab],
      texto: "A célula engloba a nanopartícula por endocitose. Lá dentro, o mRNA é liberado e traduzido pelos ribossomos em proteína." },
  ];
  pontos.forEach((p) => {
    if (!p.local) return;
    const base = new THREE.Vector3(...p.posicao);
    const local = p.local;
    Object.defineProperty(p, "posicao", { get: () => { const v = base.clone(); local.updateWorldMatrix(true, false); v.applyMatrix4(local.matrixWorld); grupo.worldToLocal(v); return [v.x, v.y, v.z]; } });
  });

  const destino = new THREE.Vector3(0.95, 1.0, -0.05);
  return {
    grupo,
    titulo: "Nanopartícula lipídica com mRNA",
    descricao: "A tecnologia por trás das vacinas de mRNA: uma nanopartícula de lipídios protege e entrega instruções genéticas projetadas por bioinformática. Abra o corte e acompanhe a entrega à célula.",
    camera: { distancia: 4.8, alvo: [0.25, 1.05, 0], angulo: 0.25, elevacao: 0.12 },
    pontos,
    acoes: [
      { id: "cortar", tipo: "alternar", rotulo: "Corte da nanopartícula", valor: true },
      { id: "sequencia", tipo: "alternar", rotulo: "Mostrar sequência do mRNA", valor: true },
      { id: "entregar", tipo: "alternar", rotulo: "Entregar à célula", valor: false, descricao: "Leva a partícula até a membrana." },
    ],
    status: "Partícula montada: cerca de 100 nm, com o mRNA protegido no núcleo lipídico.",
    acao(id, valor) {
      if (id === "cortar") { estado.cortar = valor; cortaveis.forEach((m) => { m.clippingPlanes = valor ? [corte] : []; m.needsUpdate = true; }); }
      if (id === "sequencia") { estado.sequencia = valor; anel.visible = anelGrupo.visible = valor; }
      if (id === "entregar") {
        estado.entregar = valor;
        return valor ? "Entrega: a célula engloba a partícula; no endossomo ácido o lipídio ionizável se carrega e libera o mRNA no citoplasma." : "Partícula montada: cerca de 100 nm, com o mRNA protegido no núcleo lipídico.";
      }
      return undefined;
    },
    reiniciar() {
      Object.assign(estado, { cortar: true, sequencia: true, entregar: false });
      cortaveis.forEach((m) => { m.clippingPlanes = [corte]; m.needsUpdate = true; });
      anel.visible = anelGrupo.visible = true;
      this.acoes[0].valor = true; this.acoes[1].valor = true; this.acoes[2].valor = false;
    },
    atualizar(dt, t) {
      estado.k = damp(estado.k, estado.entregar ? 1 : 0, 1.4, dt);
      const k = estado.k;
      lnp.position.lerpVectors(centroBase, destino, k);
      lnp.position.y += Math.sin(t * 0.9) * 0.03 * (1 - k);
      lnp.scale.setScalar(1 - k * 0.35);
      lnp.rotation.y = t * 0.12;
      texSeq.offset.x = (t * 0.03) % 1;
      membrana.position.x = 1.35 - k * 0.05;
    },
  };
}
