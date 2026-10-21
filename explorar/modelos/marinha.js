// Biotecnologia Azul — diatomácea: microalga com carapaça de sílica (frústula).
import { THREE, mat, mesh, lathe, deform, noise3, seeded, damp, glowSprite } from "./_comum.js";

export function criar({ cor }) {
  const grupo = new THREE.Group();
  const celula = new THREE.Group();
  celula.position.y = 1.0;
  celula.rotation.x = -0.35;
  grupo.add(celula);
  const rnd = seeded(23);

  // Sílica com cor estrutural (iridescência), como nas frústulas reais.
  const silica = new THREE.MeshPhysicalMaterial({
    color: "#dfeef0", roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], transparent: true, opacity: 0.92, side: THREE.DoubleSide,
  });
  const silicaEscura = mat("#2a3c45", { rough: 0.4 });

  // Valva: disco com borda arredondada (forma de "placa de Petri").
  const valvaPerfil = (R, h) => [[0, h], [R * 0.55, h * 0.98], [R * 0.86, h * 0.9], [R * 0.97, h * 0.72], [R, h * 0.45], [R, 0], [R * 0.985, -0.01]];
  const R = 0.8;
  const epiteca = new THREE.Group();
  const hipoteca = new THREE.Group();
  epiteca.add(mesh(lathe(valvaPerfil(R, 0.17), 96), silica));
  hipoteca.add(mesh(lathe(valvaPerfil(R * 0.965, 0.16), 96), silica, { rx: Math.PI }));
  celula.add(epiteca, hipoteca);

  // Aréolas: poros organizados em anéis radiais (nanoestrutura).
  const poroGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const nPoros = [];
  for (let r = 0.08; r < R * 0.92; r += 0.055) nPoros.push([r, Math.max(6, Math.round((Math.PI * 2 * r) / 0.05))]);
  const totalPoros = nPoros.reduce((s, [, n]) => s + n, 0);
  const poros = new THREE.InstancedMesh(poroGeo, silicaEscura, totalPoros);
  const o = new THREE.Object3D();
  let k = 0;
  nPoros.forEach(([r, n], anel) => {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + anel * 0.17;
      const yTopo = 0.17 * (1 - Math.pow(r / R, 4) * 0.55);
      o.position.set(Math.cos(a) * r, yTopo + 0.001, Math.sin(a) * r);
      const s = 0.014 * (1 - r / R * 0.35);
      o.scale.set(s, 0.006, s);
      o.rotation.set(0, a, 0);
      o.updateMatrix();
      poros.setMatrixAt(k, o.matrix);
      k += 1;
    }
  });
  poros.castShadow = false;
  epiteca.add(poros);
  // Costelas radiais e o anel central.
  const costelas = new THREE.Group();
  for (let i = 0; i < 28; i += 1) {
    const a = (i / 28) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.01, 0.006, R * 0.8);
    const c = mesh(g, silica, { x: Math.cos(a) * R * 0.48, y: 0.163, z: Math.sin(a) * R * 0.48, ry: -a + Math.PI / 2, cast: false });
    costelas.add(c);
  }
  costelas.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 32), silica, { y: 0.172, rx: Math.PI / 2 }));
  epiteca.add(costelas);
  // Cintas (bandas de ligação entre as valvas).
  const cintas = new THREE.Group();
  [0.0, -0.03, -0.06].forEach((y, i) => cintas.add(mesh(new THREE.CylinderGeometry(R * 0.975 - i * 0.004, R * 0.975 - i * 0.004, 0.028, 96, 1, true), silica, { y })));
  celula.add(cintas);

  // Interior: cloroplastos, núcleo e gotas de lipídio.
  const interior = new THREE.Group();
  celula.add(interior);
  const cloroMat = mat("#a2792a", { rough: 0.45, clearcoat: 0.3, emissive: "#3d2a08", emissiveIntensity: 0.3 });
  const cloroplastos = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.3;
    const r = 0.38 + rnd() * 0.2;
    const g = deform(new THREE.SphereGeometry(1, 24, 16), (v) => v.multiplyScalar(1 + noise3(v.x * 3 + i, v.y * 3, v.z * 3) * 0.08));
    const c = mesh(g, cloroMat, { x: Math.cos(a) * r, y: -0.02 + rnd() * 0.04, z: Math.sin(a) * r, sx: 0.13, sy: 0.04, sz: 0.08, ry: -a });
    interior.add(c);
    cloroplastos.push(c);
  }
  const nucleo = new THREE.Group();
  nucleo.add(mesh(new THREE.SphereGeometry(0.12, 32, 20), mat("#7d6aa6", { rough: 0.35, opacity: 0.85, clearcoat: 0.6 })));
  nucleo.add(mesh(new THREE.SphereGeometry(0.045, 20, 14), mat("#4b3a77", { rough: 0.4 }), { x: 0.03, y: 0.02 }));
  interior.add(nucleo);
  const lipidios = [];
  const lipMat = mat("#f2d36b", { rough: 0.05, clearcoat: 1, opacity: 0.85, emissive: "#6b5310", emissiveIntensity: 0.25 });
  for (let i = 0; i < 6; i += 1) {
    const a = rnd() * Math.PI * 2, r = 0.18 + rnd() * 0.18;
    const l = mesh(new THREE.SphereGeometry(0.035 + rnd() * 0.03, 20, 14), lipMat, { x: Math.cos(a) * r, y: 0.01, z: Math.sin(a) * r });
    interior.add(l);
    lipidios.push(l);
  }
  // Citoplasma translúcido.
  interior.add(mesh(new THREE.CylinderGeometry(R * 0.93, R * 0.93, 0.18, 64), mat("#8fc6c4", { rough: 0.3, opacity: 0.18 }), { y: 0.0, cast: false }));

  // Bolhas de oxigênio (fotossíntese) e plâncton ao redor.
  const nO2 = 40;
  const o2 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8), mat("#dff6ff", { rough: 0.05, opacity: 0.7, clearcoat: 1 }), nO2);
  const o2Dados = Array.from({ length: nO2 }, () => ({ x: (rnd() - 0.5) * 1.1, z: (rnd() - 0.5) * 1.1, y: rnd(), v: 0.15 + rnd() * 0.2 }));
  o2.castShadow = false;
  grupo.add(o2);
  const plancton = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat("#9fd0d6", { rough: 0.4, opacity: 0.6 }), 60);
  for (let i = 0; i < 60; i += 1) {
    o.position.set((rnd() - 0.5) * 3.4, 0.3 + rnd() * 2.0, (rnd() - 0.5) * 2.6);
    o.scale.setScalar(0.008 + rnd() * 0.02);
    o.updateMatrix();
    plancton.setMatrixAt(i, o.matrix);
  }
  plancton.castShadow = false;
  grupo.add(plancton);
  const luz = glowSprite(cor, 3.2, 0.12);
  luz.position.set(0, 1.0, -0.6);
  luz.userData.semOclusao = true;
  grupo.add(luz);

  const estado = { aberta: false, k: 0, foto: false, f: 0 };

  const pontos = [
    { id: "frustula", titulo: "Frústula de sílica", posicao: [0.55, 0.15, 0.3], local: epiteca, destaque: [epiteca],
      texto: "A diatomácea vive dentro de uma carapaça de sílica (vidro natural) formada por duas metades. Esse material, leve e resistente, inspira biomateriais e é usado em filtros e abrasivos." },
    { id: "areolas", titulo: "Aréolas (nanoporos)", posicao: [0.0, 0.2, 0.25], local: epiteca, destaque: [poros],
      texto: "Milhares de poros organizados em padrões geométricos, com dimensões de nanômetros. Eles interagem com a luz e geram cores — por isso a nanotecnologia estuda esses padrões para sensores e dispositivos ópticos." },
    { id: "cloroplastos", titulo: "Cloroplastos", posicao: [0.5, 0.05, 0.0], local: interior, destaque: cloroplastos, visivel: () => estado.k > 0.5,
      texto: "Os cloroplastos dourados fazem fotossíntese. Somadas, as diatomáceas produzem uma parte importante do oxigênio do planeta e são cultivadas como fonte de pigmentos e nutrientes." },
    { id: "lipidios", titulo: "Gotas de lipídio", posicao: [-0.2, 0.05, 0.25], local: interior, destaque: lipidios, visivel: () => estado.k > 0.5,
      texto: "Reservas de óleo ricas em ácidos graxos como o ômega-3. No cultivo de microalgas, esses lipídios podem virar suplementos alimentares e até biocombustível." },
    { id: "nucleo", titulo: "Núcleo", posicao: [0.0, 0.12, 0.0], local: interior, destaque: [nucleo], visivel: () => estado.k > 0.5,
      texto: "Guarda o genoma da alga. Conhecer os genes ligados à formação da sílica e à produção de óleo permite selecionar linhagens mais produtivas." },
    { id: "cintas", titulo: "Cintas", posicao: [-0.78, -0.02, 0.0], local: cintas, destaque: [cintas],
      texto: "Bandas de sílica unem as duas valvas como a tampa de uma caixa. Na divisão celular, cada filha herda uma valva e produz a outra." },
  ];
  pontos.forEach((p) => {
    if (!p.local) return;
    const base = new THREE.Vector3(...p.posicao);
    const local = p.local;
    Object.defineProperty(p, "posicao", {
      get: () => {
        const v = base.clone();
        local.updateWorldMatrix(true, false);
        v.applyMatrix4(local.matrixWorld);
        grupo.worldToLocal(v);
        return [v.x, v.y, v.z];
      },
    });
  });

  return {
    grupo,
    titulo: "Diatomácea",
    descricao: "Uma microalga marinha protegida por uma carapaça de vidro natural, com nanoporos e cores iridescentes. Abra a frústula para ver a célula por dentro e ligue a fotossíntese.",
    camera: { distancia: 4.6, alvo: [0, 1.0, 0], angulo: 0.3, elevacao: 0.42 },
    pontos,
    acoes: [
      { id: "abrir", tipo: "alternar", rotulo: "Abrir a frústula", valor: false, descricao: "Separa as duas valvas (epiteca e hipoteca)." },
      { id: "foto", tipo: "alternar", rotulo: "Fotossíntese", valor: false, descricao: "Ilumina os cloroplastos e libera oxigênio." },
    ],
    status: "Frústula fechada: as duas valvas se encaixam como uma caixa com tampa.",
    acao(id, valor) {
      if (id === "abrir") { estado.aberta = valor; return valor ? "Frústula aberta: veja os cloroplastos, o núcleo e as reservas de óleo." : "Frústula fechada: as duas valvas se encaixam como uma caixa com tampa."; }
      if (id === "foto") { estado.foto = valor; return valor ? "Fotossíntese ativa: luz + CO₂ viram açúcares e oxigênio, que sobe em bolhas." : undefined; }
      return undefined;
    },
    reiniciar() { estado.aberta = false; estado.foto = false; this.acoes.forEach((a) => { a.valor = false; }); },
    atualizar(dt, t) {
      estado.k = damp(estado.k, estado.aberta ? 1 : 0, 2.4, dt);
      estado.f = damp(estado.f, estado.foto ? 1 : 0, 2, dt);
      const kk = estado.k;
      epiteca.position.y = kk * 0.55;
      epiteca.rotation.z = kk * 0.35;
      epiteca.position.x = -kk * 0.12;
      hipoteca.position.y = -kk * 0.05;
      interior.position.y = kk * 0.05;
      cintas.position.y = -kk * 0.04;
      celula.rotation.y = t * 0.08;
      celula.position.y = 1.0 + Math.sin(t * 0.7) * 0.04;
      cloroMat.emissiveIntensity = 0.3 + estado.f * 1.2;
      o2Dados.forEach((b, i) => {
        b.y = (b.y + dt * b.v) % 1;
        o.position.set(b.x, 1.05 + b.y * 1.2, b.z);
        o.scale.setScalar(estado.f > 0.05 ? estado.f * (0.6 + b.y) : 0.0001);
        o.updateMatrix();
        o2.setMatrixAt(i, o.matrix);
      });
      o2.instanceMatrix.needsUpdate = true;
      plancton.rotation.y = t * 0.02;
    },
  };
}
