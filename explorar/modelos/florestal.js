// Biotecnologia Marrom — árvore, anéis de crescimento e propagação clonal.
import { THREE, mat, mesh, tube, rbox, deform, noise3, seeded, damp } from "./_comum.js";

function texturaAneis(idade, seed = 3) {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d");
  const rnd = seeded(seed);
  const R = 500, cx = 512, cy = 512;
  // Casca, floema e câmbio.
  const casca = R, floema = R * 0.93, cambio = R * 0.905, lenho = R * 0.895;
  const irregular = (r, amp, k = 9) => { g.beginPath(); for (let i = 0; i <= 120; i += 1) { const a = (i / 120) * Math.PI * 2; const rr = r * (1 + Math.sin(a * k + seed) * amp + Math.sin(a * 3.1) * amp * 0.6); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); };
  irregular(casca, 0.012, 23); g.fillStyle = "#4a3222"; g.fill();
  for (let i = 0; i < 70; i += 1) { const a = rnd() * Math.PI * 2; g.strokeStyle = "rgba(25,15,8,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * floema, cy + Math.sin(a) * floema); g.lineTo(cx + Math.cos(a) * casca * 0.995, cy + Math.sin(a) * casca * 0.995); g.stroke(); }
  irregular(floema, 0.006); g.fillStyle = "#9a6a42"; g.fill();
  irregular(cambio, 0.005); g.fillStyle = "#cfe0a8"; g.fill();
  irregular(lenho, 0.005); g.fillStyle = "#e9cf9e"; g.fill();
  // Anéis anuais: largura varia com o clima de cada ano.
  const larguras = Array.from({ length: idade }, () => 0.6 + rnd() * 0.8);
  const soma = larguras.reduce((s, w) => s + w, 0);
  const anosCerne = Math.max(0, idade - 9);
  let r = 0;
  const raios = larguras.map((w) => { r += (w / soma) * lenho; return r; });
  for (let i = idade - 1; i >= 0; i -= 1) {
    const cerne = i < anosCerne;
    const claro = cerne ? "#a8613a" : "#ecd3a2";
    const escuro = cerne ? "#7e4528" : "#c79a62";
    irregular(raios[i], 0.004, 7);
    const grad = g.createRadialGradient(cx, cy, i ? raios[i - 1] : 0, cx, cy, raios[i]);
    grad.addColorStop(0, claro);
    grad.addColorStop(0.82, claro);
    grad.addColorStop(1, escuro);
    g.fillStyle = grad;
    g.fill();
  }
  // Raios medulares e medula.
  g.globalAlpha = 0.18;
  for (let i = 0; i < 40; i += 1) { const a = rnd() * Math.PI * 2; g.strokeStyle = "#7a5030"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * lenho, cy + Math.sin(a) * lenho); g.stroke(); }
  g.globalAlpha = 1;
  g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fillStyle = "#5a3520"; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { textura: t, cerne: anosCerne ? raios[anosCerne - 1] / R : 0, lenho: lenho / R };
}

export function criar() {
  const grupo = new THREE.Group();
  const rnd = seeded(41);
  const casca = mat("#5a3f2c", { rough: 0.95 });
  const folhaCores = ["#3f6b2e", "#4d7b34", "#36602a", "#5a8a3c"];

  // Solo ao redor da árvore.
  grupo.add(mesh(deform(new THREE.CircleGeometry(0.85, 48), (v) => { v.z += noise3(v.x * 4, v.y * 4, 0) * 0.015; }), mat("#3a2a1d", { rough: 1 }), { y: 0.012, rx: -Math.PI / 2 }));

  // Árvore (escala com a idade).
  const arvore = new THREE.Group();
  arvore.position.set(-0.35, 0.01, -0.15);
  grupo.add(arvore);
  const tronco = mesh(deform(new THREE.CylinderGeometry(0.07, 0.13, 1.35, 24, 24), (v) => {
    const t = (v.y + 0.675) / 1.35;
    v.x += Math.sin(t * 2.2) * 0.04;
    const n = 1 + noise3(v.x * 18, v.y * 6, v.z * 18) * 0.05;
    v.x *= n; v.z *= n;
    if (t < 0.08) { v.x *= 1 + (0.08 - t) * 4; v.z *= 1 + (0.08 - t) * 4; }
  }), casca, { y: 0.675 });
  arvore.add(tronco);
  const galhos = new THREE.Group();
  [[0.85, 0.4, 0.5], [1.0, 2.6, 0.45], [1.1, 4.6, 0.4], [1.2, 1.4, 0.35], [0.95, 5.6, 0.4]].forEach(([h, a, len]) => {
    const d = new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)).normalize();
    galhos.add(mesh(tube([[0, h, 0], d.clone().multiplyScalar(len * 0.5).add(new THREE.Vector3(0, h, 0)), d.clone().multiplyScalar(len).add(new THREE.Vector3(0, h + 0.05, 0))], 0.03, { segments: 12, radial: 8 }), casca));
  });
  arvore.add(galhos);
  // Raízes superficiais.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.3;
    const len = 0.35 + rnd() * 0.25;
    arvore.add(mesh(tube([[0, 0.08, 0], [Math.cos(a) * len * 0.4, 0.03, Math.sin(a) * len * 0.4], [Math.cos(a) * len, 0.0, Math.sin(a) * len]], 0.025, { segments: 12, radial: 8 }), casca));
  }
  // Copa: volumes de folhagem com folhas individuais na superfície.
  const copa = new THREE.Group();
  copa.position.y = 1.45;
  arvore.add(copa);
  const blobs = [[0, 0.12, 0, 0.5], [0.32, -0.05, 0.12, 0.38], [-0.3, -0.02, 0.15, 0.36], [0.1, -0.08, -0.32, 0.38], [-0.15, 0.32, -0.1, 0.34], [0.2, 0.3, 0.2, 0.3], [-0.38, 0.12, -0.2, 0.3]];
  const folhaGeo = new THREE.PlaneGeometry(0.07, 0.11);
  const folhasPos = [];
  blobs.forEach(([x, y, z, r], i) => {
    const m = mat(folhaCores[i % folhaCores.length], { rough: 0.8 });
    const b = mesh(deform(new THREE.IcosahedronGeometry(r, 3), (v) => v.multiplyScalar(1 + noise3(v.x * 5 + i, v.y * 5, v.z * 5) * 0.12)), m, { x, y, z });
    copa.add(b);
    for (let k = 0; k < 60; k += 1) {
      const n = new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).normalize();
      folhasPos.push({ p: n.clone().multiplyScalar(r * 1.03).add(new THREE.Vector3(x, y, z)), n, c: i % folhaCores.length });
    }
  });
  const folhas = folhaCores.map((c) => new THREE.InstancedMesh(folhaGeo, mat(c, { rough: 0.7, side: THREE.DoubleSide }), folhasPos.filter((f) => f.c === folhaCores.indexOf(c)).length));
  const contagem = [0, 0, 0, 0];
  const o = new THREE.Object3D();
  folhasPos.forEach((f) => {
    o.position.copy(f.p);
    o.lookAt(f.p.clone().add(f.n));
    o.rotateZ(rnd() * Math.PI);
    o.updateMatrix();
    folhas[f.c].setMatrixAt(contagem[f.c], o.matrix);
    contagem[f.c] += 1;
  });
  folhas.forEach((f) => copa.add(f));

  // Seção transversal do tronco ("bolacha") em um suporte.
  const secao = new THREE.Group();
  secao.position.set(0.72, 0.5, 0.45);
  secao.rotation.set(-0.25, -0.55, 0);
  grupo.add(secao);
  let aneis = texturaAneis(18);
  const faceMat = new THREE.MeshStandardMaterial({ map: aneis.textura, roughness: 0.7 });
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 64), [casca, faceMat, faceMat]);
  disco.rotation.x = Math.PI / 2;
  disco.castShadow = true;
  secao.add(disco);
  const suporte = new THREE.Group();
  suporte.position.set(0.72, 0, 0.45);
  suporte.rotation.y = -0.55;
  suporte.add(mesh(rbox(0.5, 0.04, 0.22, 0.01), mat("#8a6a48", { rough: 0.7 }), { y: 0.02 }));
  [-0.12, 0.12].forEach((x) => suporte.add(mesh(rbox(0.04, 0.16, 0.04, 0.01), mat("#8a6a48", { rough: 0.7 }), { x, y: 0.1, z: 0.04 })));
  grupo.add(suporte);

  // Bandeja de mudas clonais.
  const bandeja = new THREE.Group();
  bandeja.position.set(0.55, 0, -0.55);
  bandeja.rotation.y = 0.3;
  bandeja.add(mesh(rbox(0.66, 0.06, 0.42, 0.015), mat("#2d3a2c", { rough: 0.8 }), { y: 0.03 }));
  const mudas = [];
  for (let i = 0; i < 6; i += 1) {
    const x = -0.22 + (i % 3) * 0.22, z = -0.1 + Math.floor(i / 3) * 0.2;
    bandeja.add(mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.02, 16), mat("#3a2a1d", { rough: 1 }), { x, y: 0.065, z }));
    const muda = new THREE.Group();
    muda.position.set(x, 0.07, z);
    muda.add(mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.18, 6), mat("#6f8f3a", { rough: 0.6 }), { y: 0.09 }));
    [0, 1, 2, 3].forEach((k) => muda.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(folhaCores[k % 4], { rough: 0.7 }), { x: Math.cos(k * 1.6) * 0.03, y: 0.15 + k * 0.025, z: Math.sin(k * 1.6) * 0.03, sx: 1.2, sy: 0.35, sz: 0.8 })));
    muda.scale.setScalar(0.0001);
    muda.userData.alvo = 0;
    bandeja.add(muda);
    mudas.push(muda);
  }
  grupo.add(bandeja);

  const estado = { idade: 18, escala: 1, clones: 0 };
  const pontoSecao = (rel) => () => {
    const v = new THREE.Vector3(rel * 0.4 * 0.7, rel * 0.4 * 0.7, 0.056);
    secao.updateWorldMatrix(true, false);
    v.applyMatrix4(secao.matrixWorld);
    grupo.worldToLocal(v);
    return [v.x, v.y, v.z];
  };
  const statusIdade = () => `${estado.idade} anos: ${estado.idade} anéis de crescimento${aneis.cerne ? `, com cerne formado nos anéis mais antigos` : ", ainda sem cerne (árvore jovem)"}. Anéis largos indicam anos de chuva abundante.`;

  const pontos = [
    { id: "cerne", titulo: "Cerne", posicaoFn: pontoSecao(0.12), destaque: [disco],
      texto: "A parte central e mais escura da madeira, formada por células que já não transportam seiva. Acumula substâncias que a tornam mais resistente a fungos e insetos." },
    { id: "alburno", titulo: "Alburno", posicaoFn: pontoSecao(0.62), destaque: [disco],
      texto: "A madeira mais clara e jovem, que ainda conduz água e sais minerais das raízes até as folhas pelo xilema. Cada ano adiciona um novo anel." },
    { id: "cambio", titulo: "Câmbio vascular", posicaoFn: pontoSecao(0.9), destaque: [disco],
      texto: "Uma camada fina de células que se dividem: para dentro formam madeira, para fora formam floema. É ela que faz o tronco engrossar." },
    { id: "casca", titulo: "Casca e floema", posicaoFn: pontoSecao(0.98), destaque: [disco],
      texto: "O floema leva os açúcares produzidos nas folhas para o resto da árvore; a casca protege contra calor, fogo e pragas. Muitos compostos de interesse (resinas, taninos) vêm daqui." },
    { id: "copa", titulo: "Copa", posicao: [-0.35, 1.9, 0.1], destaque: [copa],
      texto: "Na copa, a fotossíntese transforma CO₂ em madeira e oxigênio. Florestas manejadas e restauradas retiram carbono da atmosfera e protegem a biodiversidade." },
    { id: "clones", titulo: "Mudas clonais", posicao: [0.55, 0.32, -0.55], destaque: [bandeja],
      texto: "Pela propagação clonal (estacas ou cultura de tecidos), uma árvore-matriz selecionada gera milhares de mudas geneticamente idênticas. Bancos de germoplasma também guardam a diversidade genética para o futuro." },
  ];
  pontos.forEach((p) => { if (p.posicaoFn) Object.defineProperty(p, "posicao", { get: p.posicaoFn }); });

  return {
    grupo,
    titulo: "Árvore e anéis de crescimento",
    descricao: "Uma árvore e a seção do seu tronco, com os tecidos que a fazem crescer. Mude a idade para ver os anéis se formarem e propague mudas clonais a partir da árvore-matriz.",
    camera: { distancia: 5.0, alvo: [0.1, 0.95, 0], angulo: 0.5, elevacao: 0.18 },
    pontos,
    acoes: [
      { id: "idade", tipo: "faixa", rotulo: "Idade da árvore", valor: 18, min: 4, max: 40, passo: 1, formatar: (v) => `${v} anos` },
      { id: "clonar", tipo: "botao", rotulo: "Propagar um clone", descricao: "Cria uma muda idêntica à árvore-matriz." },
    ],
    status: statusIdade(),
    acao(id, valor) {
      if (id === "idade") {
        estado.idade = valor;
        aneis.textura.dispose();
        aneis = texturaAneis(valor);
        faceMat.map = aneis.textura;
        faceMat.needsUpdate = true;
        return statusIdade();
      }
      if (id === "clonar") {
        if (estado.clones >= mudas.length) return "Bandeja completa: seis clones com a mesma genética da árvore-matriz. Use Reiniciar para começar de novo.";
        mudas[estado.clones].userData.alvo = 1;
        estado.clones += 1;
        return `${estado.clones} ${estado.clones === 1 ? "clone propagado" : "clones propagados"}: todos geneticamente idênticos à árvore-matriz.`;
      }
      return undefined;
    },
    reiniciar() {
      estado.idade = 18; estado.clones = 0;
      mudas.forEach((m) => { m.userData.alvo = 0; });
      aneis.textura.dispose(); aneis = texturaAneis(18); faceMat.map = aneis.textura; faceMat.needsUpdate = true;
      this.acoes[0].valor = 18;
      this.status = statusIdade();
    },
    atualizar(dt, t) {
      estado.escala = damp(estado.escala, 0.62 + (estado.idade / 40) * 0.5, 2, dt);
      arvore.scale.setScalar(estado.escala);
      copa.rotation.z = Math.sin(t * 0.8) * 0.015;
      copa.rotation.x = Math.cos(t * 0.6) * 0.01;
      mudas.forEach((m, i) => {
        const s = damp(m.scale.x, m.userData.alvo ? 1 : 0.0001, 4, dt);
        m.scale.setScalar(s);
        m.rotation.z = Math.sin(t * 1.5 + i) * 0.04;
      });
    },
  };
}
