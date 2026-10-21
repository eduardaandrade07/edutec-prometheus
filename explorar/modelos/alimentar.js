// Biotecnologia Amarela — levedura (Saccharomyces cerevisiae) fermentando açúcar.
import { THREE, mat, mesh, tube, deform, noise3, seeded, damp } from "./_comum.js";

export function criar() {
  const grupo = new THREE.Group();
  const rnd = seeded(5);
  const corte = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
  const celula = new THREE.Group();
  celula.position.set(-0.15, 1.05, 0);
  grupo.add(celula);

  // Parede celular e membrana (cortáveis).
  const parede = mat("#e8d6a0", { rough: 0.6, clearcoat: 0.3, side: THREE.DoubleSide });
  const membrana = mat("#c99a5a", { rough: 0.5, side: THREE.DoubleSide });
  const citoplasma = mat("#f3e6c2", { rough: 0.4, opacity: 0.35, side: THREE.DoubleSide });
  const cortaveis = [parede, membrana, citoplasma];
  const forma = (r, s) => deform(new THREE.SphereGeometry(r, 64, 48), (v) => { v.y *= 1.22; v.multiplyScalar(1 + noise3(v.x * s, v.y * s, v.z * s) * 0.018); });
  const paredeMesh = mesh(forma(0.62, 6), parede);
  celula.add(paredeMesh);
  celula.add(mesh(forma(0.585, 6), membrana));
  celula.add(mesh(forma(0.57, 3), citoplasma, { cast: false }));
  // Cicatrizes de brotamento.
  const cicatrizes = new THREE.Group();
  [[0.3, 0.55, 0.2], [-0.42, 0.25, 0.3], [0.1, -0.62, 0.35]].forEach((p) => {
    const n = new THREE.Vector3(...p).normalize();
    const pos = n.clone().multiplyScalar(0.62); pos.y *= 1.22;
    const c = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 24), mat("#c9b27a", { rough: 0.7 }));
    c.position.copy(pos);
    c.lookAt(pos.clone().add(n));
    cicatrizes.add(c);
  });
  celula.add(cicatrizes);

  // Broto (reprodução por gemulação).
  const broto = new THREE.Group();
  broto.position.set(0.48, 0.66, 0.0);
  broto.add(mesh(forma(0.24, 9), parede));
  broto.add(mesh(new THREE.SphereGeometry(0.08, 20, 14), mat("#8a6bb3", { rough: 0.4 }), { y: -0.02 }));
  celula.add(broto);

  // Organelas.
  const nucleo = new THREE.Group();
  nucleo.position.set(-0.12, 0.18, 0.02);
  nucleo.add(mesh(new THREE.SphereGeometry(0.17, 36, 24), mat("#8a6bb3", { rough: 0.35, clearcoat: 0.5 })));
  nucleo.add(mesh(new THREE.SphereGeometry(0.065, 24, 16), mat("#5a3f86", { rough: 0.4 }), { x: 0.05, y: 0.04, z: 0.08 }));
  celula.add(nucleo);
  const vacuolo = mesh(deform(new THREE.SphereGeometry(0.24, 40, 28), (v) => v.multiplyScalar(1 + noise3(v.x * 5, v.y * 5, v.z * 5) * 0.04)), mat("#9ccbe0", { rough: 0.1, opacity: 0.6, clearcoat: 1 }), { x: 0.12, y: -0.32, z: -0.02 });
  celula.add(vacuolo);
  const mitocondrias = [];
  const mitoMat = mat("#d9733f", { rough: 0.4, clearcoat: 0.3 });
  [[0.25, 0.15, -0.1, 0.4], [-0.3, -0.2, -0.15, -0.7], [0.3, -0.05, -0.25, 1.2], [-0.2, 0.42, -0.2, 0.2]].forEach(([x, y, z, r]) => {
    const m = mesh(new THREE.CapsuleGeometry(0.045, 0.14, 8, 16), mitoMat, { x, y, z, rz: r, rx: r * 0.5 });
    celula.add(m);
    mitocondrias.push(m);
  });
  const re = mesh(tube([[-0.05, 0.02, -0.2], [0.08, 0.1, -0.25], [0.02, 0.28, -0.22], [-0.15, 0.32, -0.28], [-0.28, 0.12, -0.22]], 0.012, { segments: 40, radial: 6 }), mat("#c46a8a", { rough: 0.5 }));
  celula.add(re);
  const granulos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8), mat("#efe2b5", { rough: 0.6 }), 40);
  const o = new THREE.Object3D();
  for (let i = 0; i < 40; i += 1) {
    o.position.set((rnd() - 0.5) * 0.7, (rnd() - 0.5) * 1.0, -rnd() * 0.45);
    o.updateMatrix();
    granulos.setMatrixAt(i, o.matrix);
  }
  celula.add(granulos);
  celula.traverse((m) => { if (m.isMesh && m.material && !cortaveis.includes(m.material)) cortaveis.push(m.material); });
  cortaveis.forEach((m) => { m.clippingPlanes = [corte]; });

  // Moléculas: glicose (anel), CO₂ e etanol.
  const mC = mat("#3b3b3d", { rough: 0.35 }), mO = mat("#d24a3c", { rough: 0.35 }), mH = mat("#f2f2ee", { rough: 0.35 });
  const ligacao = mat("#b9b3a8", { rough: 0.4 });
  const esfera = (m, r) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  const liga = (a, b, r = 0.008) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), ligacao);
    c.position.copy(a).add(b).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return c;
  };
  const glicose = () => {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * 0.055, (i % 2 ? 0.012 : -0.012), Math.sin(a) * 0.055);
      pts.push(p);
      const at = esfera(i === 0 ? mO : mC, i === 0 ? 0.02 : 0.022);
      at.position.copy(p);
      g.add(at);
      const oh = esfera(mO, 0.016);
      oh.position.copy(p.clone().multiplyScalar(1.7)).setY(p.y * 3);
      if (i !== 0) { g.add(oh); g.add(liga(p, oh.position)); }
    }
    pts.forEach((p, i) => g.add(liga(p, pts[(i + 1) % 6])));
    g.scale.setScalar(1.3);
    return g;
  };
  const co2 = () => {
    const g = new THREE.Group();
    const c = esfera(mC, 0.024); g.add(c);
    [-1, 1].forEach((s) => { const oo = esfera(mO, 0.022); oo.position.x = s * 0.055; g.add(oo); g.add(liga(new THREE.Vector3(), oo.position)); });
    return g;
  };
  const etanol = () => {
    const g = new THREE.Group();
    const c1 = esfera(mC, 0.024); c1.position.set(-0.04, 0, 0);
    const c2 = esfera(mC, 0.024); c2.position.set(0.03, 0.025, 0);
    const oo = esfera(mO, 0.021); oo.position.set(0.09, -0.01, 0);
    const h = esfera(mH, 0.013); h.position.set(0.12, 0.02, 0);
    g.add(c1, c2, oo, h, liga(c1.position, c2.position), liga(c2.position, oo.position), liga(oo.position, h.position, 0.006));
    return g;
  };
  const agua = () => {
    const g = new THREE.Group();
    const oo = esfera(mO, 0.022); g.add(oo);
    [-1, 1].forEach((s) => { const h = esfera(mH, 0.013); h.position.set(s * 0.035, 0.025, 0); g.add(h); g.add(liga(new THREE.Vector3(), h.position, 0.006)); });
    return g;
  };

  const moleculas = new THREE.Group();
  grupo.add(moleculas);
  const ativas = [];
  const estado = { oxigenio: false, cortar: true, glicose: 0, co2: 0, etanol: 0, agua: 0 };
  const centro = new THREE.Vector3(-0.15, 1.05, 0);

  // Glicoses "em espera" flutuando ao redor (decorativas até o usuário adicionar açúcar).
  const espera = [];
  for (let i = 0; i < 5; i += 1) {
    const g = glicose();
    const a = (i / 5) * Math.PI * 2;
    g.userData.base = new THREE.Vector3(Math.cos(a) * 1.25 - 0.15, 0.7 + (i % 3) * 0.35, Math.sin(a) * 0.9);
    g.position.copy(g.userData.base);
    moleculas.add(g);
    espera.push(g);
  }

  const lancarProdutos = () => {
    const produtos = estado.oxigenio ? [co2, co2, co2, agua, agua, agua] : [co2, co2, etanol, etanol];
    produtos.forEach((fn, i) => {
      const m = fn();
      const dir = new THREE.Vector3(rnd() - 0.5, rnd() * 0.6 + 0.2, rnd() - 0.5).normalize();
      m.position.copy(centro).add(dir.clone().multiplyScalar(0.3));
      m.userData = { tipo: "saida", dir, vida: 0, atraso: i * 0.25 };
      m.visible = false;
      moleculas.add(m);
      ativas.push(m);
    });
    if (estado.oxigenio) { estado.co2 += 6; estado.agua += 6; } else { estado.co2 += 2; estado.etanol += 2; }
  };

  const status = () => {
    if (!estado.glicose) return estado.oxigenio ? "Com oxigênio: a levedura vai respirar (respiração aeróbica). Adicione açúcar." : "Sem oxigênio: a levedura vai fermentar. Adicione açúcar para começar.";
    return estado.oxigenio
      ? `Respiração aeróbica · glicose consumida: ${estado.glicose} · CO₂: ${estado.co2} · H₂O: ${estado.agua}. Muita energia: a levedura cresce e se multiplica.`
      : `Fermentação · glicose consumida: ${estado.glicose} · CO₂: ${estado.co2} · etanol: ${estado.etanol}. C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂ — é o CO₂ que faz o pão crescer.`;
  };

  const pontos = [
    { id: "parede", titulo: "Parede celular", posicao: [0.45, 1.55, 0.3], destaque: [paredeMesh],
      texto: "Uma camada resistente de polissacarídeos (glucanos e mananas) protege a levedura. Fragmentos dessa parede são estudados como ingredientes funcionais em alimentos." },
    { id: "nucleo", titulo: "Núcleo", posicao: [-0.27, 1.23, 0.1], destaque: [nucleo], visivel: () => estado.cortar,
      texto: "A levedura é um eucarioto: tem núcleo com o genoma organizado em 16 cromossomos. Foi o primeiro eucarioto a ter o genoma sequenciado, em 1996." },
    { id: "mito", titulo: "Mitocôndrias", posicao: [0.1, 1.2, -0.05], destaque: mitocondrias, visivel: () => estado.cortar,
      texto: "Com oxigênio, as mitocôndrias fazem a respiração e obtêm muito mais energia da glicose. Sem oxigênio, a célula recorre à fermentação." },
    { id: "vacuolo", titulo: "Vacúolo", posicao: [-0.03, 0.73, 0.02], destaque: [vacuolo], visivel: () => estado.cortar,
      texto: "Armazena íons, nutrientes e enzimas, e participa da reciclagem de componentes da célula — importante para a levedura tolerar o álcool que ela mesma produz." },
    { id: "broto", titulo: "Broto", posicao: [0.33, 1.95, 0.05], destaque: [broto],
      texto: "A levedura se reproduz por brotamento: uma célula-filha cresce na superfície da mãe. Cada broto deixa uma cicatriz na parede." },
    { id: "moleculas", titulo: "Açúcar e produtos", posicao: [1.05, 1.4, 0.2], destaque: espera,
      texto: "Glicose (anel de seis átomos) entra na célula. Na fermentação ela vira etanol e CO₂; na respiração, CO₂ e água. Fermentos selecionados definem o aroma de pães, cervejas e vinhos." },
  ];

  const tmp = new THREE.Vector3();
  return {
    grupo,
    titulo: "Levedura em fermentação",
    descricao: "Saccharomyces cerevisiae, o fermento do pão, da cerveja e do vinho. Adicione açúcar e compare a fermentação (sem oxigênio) com a respiração (com oxigênio).",
    camera: { distancia: 5.0, alvo: [0.0, 1.1, 0], angulo: 0.45, elevacao: 0.2 },
    pontos,
    acoes: [
      { id: "acucar", tipo: "botao", rotulo: "Adicionar açúcar", descricao: "Lança moléculas de glicose em direção à célula." },
      { id: "oxigenio", tipo: "alternar", rotulo: "Ambiente com oxigênio", valor: false, descricao: "Alterna entre fermentação e respiração." },
      { id: "cortar", tipo: "alternar", rotulo: "Corte da célula", valor: true },
    ],
    status: status(),
    acao(id, valor) {
      if (id === "acucar") {
        for (let i = 0; i < 3; i += 1) {
          const g = glicose();
          const a = rnd() * Math.PI * 2;
          g.position.set(Math.cos(a) * 1.6 - 0.15, 0.6 + rnd() * 1.0, Math.sin(a) * 1.2);
          g.userData = { tipo: "entrada", vida: 0, atraso: i * 0.3, inicio: g.position.clone() };
          moleculas.add(g);
          ativas.push(g);
        }
        return "Glicose a caminho da célula…";
      }
      if (id === "oxigenio") { estado.oxigenio = valor; return status(); }
      if (id === "cortar") { estado.cortar = valor; cortaveis.forEach((m) => { m.clippingPlanes = valor ? [corte] : []; m.needsUpdate = true; }); }
      return undefined;
    },
    reiniciar() {
      ativas.splice(0).forEach((m) => moleculas.remove(m));
      Object.assign(estado, { oxigenio: false, cortar: true, glicose: 0, co2: 0, etanol: 0, agua: 0 });
      cortaveis.forEach((m) => { m.clippingPlanes = [corte]; m.needsUpdate = true; });
      this.acoes[1].valor = false; this.acoes[2].valor = true;
      this.status = status();
    },
    atualizar(dt, t) {
      celula.rotation.y = Math.sin(t * 0.25) * 0.25;
      celula.position.y = 1.05 + Math.sin(t * 0.8) * 0.02;
      espera.forEach((g, i) => {
        g.position.copy(g.userData.base);
        g.position.y += Math.sin(t * 0.9 + i) * 0.06;
        g.rotation.set(t * 0.3 + i, t * 0.4, 0);
      });
      for (let i = ativas.length - 1; i >= 0; i -= 1) {
        const m = ativas[i];
        const d = m.userData;
        d.vida += dt;
        const v = d.vida - d.atraso;
        if (v < 0) continue;
        m.visible = true;
        if (d.tipo === "entrada") {
          const k = Math.min(1, v / 1.6);
          tmp.copy(d.inicio).lerp(centro, k * k * (3 - 2 * k));
          m.position.copy(tmp);
          m.rotation.set(t * 2, t * 1.5, 0);
          m.scale.setScalar(1.3 * (1 - Math.max(0, k - 0.8) * 5));
          if (k >= 1) {
            moleculas.remove(m);
            ativas.splice(i, 1);
            estado.glicose += 1;
            lancarProdutos();
            // Atualiza o texto no painel.
            const el = document.getElementById("infoStatus");
            if (el) { el.hidden = false; el.textContent = status(); }
          }
        } else {
          m.position.addScaledVector(d.dir, dt * 0.45);
          m.position.y += dt * 0.12;
          m.rotation.set(t, t * 0.7, 0);
          if (v > 4.5) { moleculas.remove(m); ativas.splice(i, 1); }
        }
      }
    },
  };
}
