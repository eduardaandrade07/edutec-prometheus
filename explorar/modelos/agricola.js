// Biotecnologia Verde — planta leguminosa, solo vivo e biofertilizante (nódulos de Rhizobium).
import { THREE, mat, mesh, tube, rbox, deform, noise3, seeded, damp } from "./_comum.js";

function folhaGeo(comp = 0.26, larg = 0.13) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(larg * 0.9, comp * 0.15, larg, comp * 0.62, 0, comp);
  s.bezierCurveTo(-larg, comp * 0.62, -larg * 0.9, comp * 0.15, 0, 0);
  const g = new THREE.ShapeGeometry(s, 14);
  // Curvatura natural: arqueia ao longo do comprimento e dobra na nervura.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, -Math.pow(y / comp, 2) * 0.06 + Math.abs(x) * 0.25);
  }
  g.computeVertexNormals();
  return g;
}

export function criar() {
  const grupo = new THREE.Group();
  const rnd = seeded(11);

  // ---- Bloco de solo em corte (horizontes) ----
  const solo = new THREE.Group();
  solo.position.y = 0.0;
  grupo.add(solo);
  const largura = 2.1, profundidade = 1.1, frente = 0.42;
  const camadas = [
    { nome: "O", h: 0.08, cor: "#2d2119" },
    { nome: "A", h: 0.34, cor: "#4a3423" },
    { nome: "B", h: 0.36, cor: "#7a4f32" },
    { nome: "C", h: 0.22, cor: "#9a7a55" },
  ];
  let y = 0.95;
  const camadasMesh = [];
  camadas.forEach((c, i) => {
    const g = rbox(largura, c.h, profundidade, 0.015);
    deform(g, (v) => { if (v.y > c.h / 2 - 0.005 && i === 0) v.y += noise3(v.x * 4, 0, v.z * 4) * 0.015; }, { smooth: false });
    const m = mesh(g, mat(c.cor, { rough: 0.95 }), { y: y - c.h / 2, z: -profundidade / 2 + frente });
    solo.add(m);
    camadasMesh.push(m);
    y -= c.h;
  });
  // Pedras e partículas expostas no perfil.
  const pedras = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat("#a59b8c", { rough: 0.9, flat: true }), 70);
  const o = new THREE.Object3D();
  for (let i = 0; i < 70; i += 1) {
    o.position.set((rnd() - 0.5) * (largura - 0.1), 0.06 + rnd() * 0.65, frente + 0.002 - rnd() * 0.01);
    o.scale.set(0.012 + rnd() * 0.03, 0.01 + rnd() * 0.022, 0.012 + rnd() * 0.02);
    o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    o.updateMatrix();
    pedras.setMatrixAt(i, o.matrix);
  }
  solo.add(pedras);
  // Capim baixo na superfície.
  const capim = new THREE.InstancedMesh(new THREE.ConeGeometry(0.008, 0.09, 4), mat("#5b7a32", { rough: 0.7 }), 260);
  for (let i = 0; i < 260; i += 1) {
    o.position.set((rnd() - 0.5) * (largura - 0.06), 0.97, frente - rnd() * (profundidade - 0.04));
    o.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
    o.scale.setScalar(0.6 + rnd() * 0.9);
    o.updateMatrix();
    capim.setMatrixAt(i, o.matrix);
  }
  solo.add(capim);

  // ---- Planta (soja) ----
  const planta = new THREE.Group();
  planta.position.set(0, 0.95, 0.1);
  grupo.add(planta);
  const caule = mat("#6f8f3a", { rough: 0.6 });
  const folhaMat = mat("#4f8a35", { rough: 0.55, side: THREE.DoubleSide });
  const vagemMat = mat("#8fa357", { rough: 0.6 });
  planta.add(mesh(tube([[0, 0, 0], [0.02, 0.35, 0.01], [-0.02, 0.7, 0], [0.01, 1.05, 0.02]], 0.022, { segments: 30 }), caule));
  const folhas = [];
  const fGeo = folhaGeo();
  const trifolio = (h, ang, comp) => {
    const ramo = new THREE.Group();
    ramo.position.y = h;
    ramo.rotation.y = ang;
    const dir = new THREE.Vector3(0.28 * comp, 0.12, 0);
    ramo.add(mesh(tube([[0, 0, 0], [dir.x * 0.5, dir.y * 0.8, 0], [dir.x, dir.y, 0]], 0.008, { segments: 10, radial: 6 }), caule));
    [[0, 0], [0.6, 1], [-0.6, -1]].forEach(([rot, k]) => {
      const f = mesh(fGeo, folhaMat, { x: dir.x, y: dir.y, z: 0, rz: -Math.PI / 2 + rot, rx: 0.4 + k * 0.15, s: comp });
      ramo.add(f);
      folhas.push(f);
    });
    planta.add(ramo);
  };
  [[0.32, 0.2, 0.85], [0.48, 2.3, 0.95], [0.64, 4.4, 1.0], [0.8, 1.1, 0.9], [0.95, 3.4, 0.75], [1.06, 5.6, 0.6]].forEach(([h, a, c]) => trifolio(h, a, c));
  // Vagens.
  const vagens = new THREE.Group();
  [[0.42, 0.6], [0.58, 3.0], [0.72, 5.0]].forEach(([h, a]) => {
    const v = mesh(new THREE.CapsuleGeometry(0.018, 0.09, 6, 10), vagemMat, { y: h, x: Math.cos(a) * 0.05, z: Math.sin(a) * 0.05, rz: 0.9, ry: a });
    vagens.add(v);
  });
  planta.add(vagens);

  // ---- Raízes expostas no perfil ----
  const raizMat = mat("#d9c7a3", { rough: 0.7 });
  const raizes = new THREE.Group();
  const zRaiz = frente + 0.015;
  const raizPrincipal = [[0, 0.95, zRaiz - 0.02], [0.01, 0.75, zRaiz], [-0.03, 0.5, zRaiz], [0.02, 0.28, zRaiz], [0.0, 0.1, zRaiz]];
  raizes.add(mesh(tube(raizPrincipal, 0.016, { segments: 40 }), raizMat));
  const nodulosPos = [];
  for (let i = 0; i < 9; i += 1) {
    const y0 = 0.88 - i * 0.075;
    const lado = i % 2 ? 1 : -1;
    const len = 0.25 + rnd() * 0.35;
    const pts = [];
    for (let k = 0; k <= 5; k += 1) {
      const t = k / 5;
      pts.push(new THREE.Vector3(lado * len * t + Math.sin(t * 5 + i) * 0.02, y0 - t * (0.12 + rnd() * 0.08), zRaiz));
    }
    raizes.add(mesh(tube(pts, 0.008 * (1 - i * 0.05), { segments: 20, radial: 6 }), raizMat));
    pts.slice(1).forEach((p, k) => { if (k % 2 === 0) nodulosPos.push(p.clone().add(new THREE.Vector3(0, 0.008, 0.006))); });
    // Radicelas.
    for (let r = 0; r < 3; r += 1) {
      const base = pts[1 + r];
      raizes.add(mesh(tube([base, base.clone().add(new THREE.Vector3(lado * 0.05, -0.05 - rnd() * 0.04, 0)), base.clone().add(new THREE.Vector3(lado * 0.08, -0.12, 0))], 0.003, { segments: 8, radial: 4 }), raizMat));
    }
  }
  grupo.add(raizes);
  // Nódulos de Rhizobium (crescem com o biofertilizante).
  const nodulos = new THREE.InstancedMesh(deform(new THREE.IcosahedronGeometry(1, 2), (v) => v.multiplyScalar(1 + noise3(v.x * 4, v.y * 4, v.z * 4) * 0.1)), mat("#d2847a", { rough: 0.45, clearcoat: 0.4, emissive: "#6b2a24", emissiveIntensity: 0.2 }), nodulosPos.length);
  grupo.add(nodulos);
  const nodTam = nodulosPos.map(() => 0.016 + rnd() * 0.012);
  // Hifas de micorrizas (rede fina).
  const hifas = new THREE.Group();
  const hifaMat = mat("#f2eee4", { rough: 0.6, opacity: 0.85 });
  for (let i = 0; i < 16; i += 1) {
    const x = (rnd() - 0.5) * 1.6, yy = 0.3 + rnd() * 0.5;
    const pts = [];
    for (let k = 0; k < 5; k += 1) pts.push(new THREE.Vector3(x + (rnd() - 0.5) * 0.3, yy + (rnd() - 0.5) * 0.2, zRaiz + 0.004));
    hifas.add(mesh(tube(pts, 0.0025, { segments: 20, radial: 4 }), hifaMat, { cast: false }));
  }
  grupo.add(hifas);
  // Bactérias do solo (Rhizobium livres) ao redor das raízes.
  const bacterias = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.006, 0.016, 4, 6), mat("#e8d27a", { rough: 0.4, emissive: "#6a5a12", emissiveIntensity: 0.5 }), 90);
  const bacDados = Array.from({ length: 90 }, () => ({ x: (rnd() - 0.5) * 1.2, y: 0.25 + rnd() * 0.65, f: rnd() * 6 }));
  grupo.add(bacterias);

  // Etiquetas dos horizontes.
  const estado = { bio: 0, alvo: 0.15, microbiota: true };
  const verdeFraco = new THREE.Color("#a7a64a"), verdeForte = new THREE.Color("#3f8a32");

  const pontos = [
    { id: "folhas", titulo: "Folhas", posicao: [0.25, 1.85, 0.25], destaque: folhas,
      texto: "Nas folhas acontece a fotossíntese. O nitrogênio é parte da clorofila: quando falta, as folhas amarelam. O melhoramento genético seleciona plantas mais eficientes e resistentes." },
    { id: "nodulos", titulo: "Nódulos", posicao: [0.2, 0.75, zRaiz + 0.03], destaque: [nodulos],
      texto: "Bactérias do gênero Rhizobium vivem dentro destes nódulos e transformam o nitrogênio do ar (N₂) em amônia, que a planta usa. Em troca, recebem açúcares. É a base dos biofertilizantes para leguminosas como a soja." },
    { id: "raizes", titulo: "Raízes", posicao: [-0.05, 0.4, zRaiz + 0.03], destaque: [raizes],
      texto: "As raízes absorvem água e nutrientes e liberam substâncias que atraem microrganismos benéficos — uma conversa química que a biotecnologia estuda para tornar o cultivo mais eficiente." },
    { id: "micorrizas", titulo: "Micorrizas", posicao: [-0.55, 0.55, zRaiz + 0.03], destaque: [hifas], visivel: () => estado.microbiota,
      texto: "Fungos micorrízicos formam uma rede de filamentos (hifas) que amplia o alcance das raízes, principalmente para buscar fósforo. Também podem ser usados como inoculantes." },
    { id: "solo", titulo: "Horizontes do solo", posicao: [0.95, 0.55, frente + 0.02], destaque: camadasMesh,
      texto: "O perfil mostra camadas: matéria orgânica na superfície, o horizonte A (rico em vida), o B (onde se acumulam argilas) e o C (material de origem). Um solo vivo e bem manejado é a base da segurança alimentar." },
    { id: "vagens", titulo: "Vagens", posicao: [0.08, 1.6, 0.12], destaque: [vagens],
      texto: "Os grãos dentro das vagens concentram proteína produzida graças ao nitrogênio fixado. Mais produtividade com menos adubo químico reduz custos e impactos ambientais." },
  ];

  const statusBio = (v) => {
    if (v < 0.2) return "Solo sem inoculação: poucos nódulos, folhas amareladas pela falta de nitrogênio.";
    if (v < 0.65) return "Inoculação parcial: os nódulos começam a fixar nitrogênio e a planta reage.";
    return "Inoculação completa: nódulos ativos fixam N₂ do ar, a planta cresce mais verde e com menos adubo químico.";
  };

  return {
    grupo,
    titulo: "Planta, solo e biofertilizante",
    descricao: "Uma planta de soja sobre um perfil de solo, com as raízes expostas. Ajuste a inoculação com bactérias fixadoras de nitrogênio e veja a planta responder.",
    camera: { distancia: 5.0, alvo: [0, 0.95, 0.1], angulo: 0.25, elevacao: 0.16 },
    pontos,
    acoes: [
      { id: "bio", tipo: "faixa", rotulo: "Biofertilizante (inoculação)", valor: 15, min: 0, max: 100, passo: 1, formatar: (v) => `${v}%` },
      { id: "microbiota", tipo: "alternar", rotulo: "Mostrar microbiota do solo", valor: true, descricao: "Bactérias e fungos que vivem ao redor das raízes." },
    ],
    status: statusBio(0.15),
    acao(id, valor) {
      if (id === "bio") { estado.alvo = valor / 100; return statusBio(estado.alvo); }
      if (id === "microbiota") { estado.microbiota = valor; hifas.visible = bacterias.visible = valor; }
      return undefined;
    },
    reiniciar() { estado.alvo = 0.15; estado.microbiota = true; hifas.visible = bacterias.visible = true; this.acoes[0].valor = 15; this.acoes[1].valor = true; },
    atualizar(dt, t) {
      estado.bio = damp(estado.bio, estado.alvo, 2.0, dt);
      const b = estado.bio;
      planta.scale.setScalar(0.78 + b * 0.27);
      folhaMat.color.copy(verdeFraco).lerp(verdeForte, Math.min(1, b * 1.3));
      planta.rotation.z = Math.sin(t * 0.9) * 0.015;
      nodulosPos.forEach((p, i) => {
        const limiar = i / nodulosPos.length;
        const s = Math.max(0.0001, Math.min(1, (b * 1.15 - limiar * 0.9) * 3)) * nodTam[i];
        o.position.copy(p);
        o.rotation.set(i, i * 2, 0);
        o.scale.setScalar(s);
        o.updateMatrix();
        nodulos.setMatrixAt(i, o.matrix);
      });
      nodulos.instanceMatrix.needsUpdate = true;
      bacDados.forEach((d, i) => {
        o.position.set(d.x + Math.sin(t * 0.6 + d.f) * 0.02, d.y + Math.cos(t * 0.5 + d.f) * 0.015, zRaiz + 0.01);
        o.rotation.set(0, 0, t * 0.8 + d.f);
        o.scale.setScalar(i / 90 < 0.25 + b * 0.75 ? 1 : 0.0001);
        o.updateMatrix();
        bacterias.setMatrixAt(i, o.matrix);
      });
      bacterias.instanceMatrix.needsUpdate = true;
    },
  };
}
