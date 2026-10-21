// Biotecnologia Branca — biorreator industrial (fermentador de tanque agitado).
import { THREE, mat, mesh, lathe, tube, rbox, damp, seeded } from "./_comum.js";

function telaPainel() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 300;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const desenhar = ({ ph, o2, temp, rpm }) => {
    const g = c.getContext("2d");
    g.fillStyle = "#07120f"; g.fillRect(0, 0, 512, 300);
    g.fillStyle = "#5fe3b0"; g.font = "600 28px Inter, Arial"; g.fillText("BIORREATOR 01", 26, 46);
    g.fillStyle = "rgba(95,227,176,.25)"; g.fillRect(26, 62, 460, 2);
    const linhas = [["pH", ph.toFixed(2)], ["O₂ dissolvido", `${Math.round(o2)} %`], ["Temperatura", `${temp.toFixed(1)} °C`], ["Agitação", `${Math.round(rpm)} rpm`]];
    linhas.forEach(([k, v], i) => {
      g.fillStyle = "#9fc9bd"; g.font = "24px Inter, Arial"; g.fillText(k, 26, 110 + i * 48);
      g.fillStyle = "#eafff6"; g.font = "600 30px Inter, Arial"; g.textAlign = "right"; g.fillText(v, 486, 110 + i * 48); g.textAlign = "left";
    });
    tex.needsUpdate = true;
  };
  return { tex, desenhar };
}

export function criar({ cor }) {
  const grupo = new THREE.Group();
  const corte = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.02);
  const inox = mat("#c9ced1", { rough: 0.22, metal: 1 });
  const inoxEscuro = mat("#7e878b", { rough: 0.35, metal: 1 });
  const casco = mat("#d6dadc", { rough: 0.2, metal: 1, side: THREE.DoubleSide });
  const isolamento = mat("#e9e4da", { rough: 0.8, side: THREE.DoubleSide });
  const borracha = mat("#1b1d1f", { rough: 0.7 });
  const azul = mat("#2f6fa3", { rough: 0.45 });
  const verde = mat("#3f9c6a", { rough: 0.45 });
  const vermelho = mat("#c24b3a", { rough: 0.45 });
  const amarelo = mat("#e2b13a", { rough: 0.45 });

  const cortaveis = [casco, isolamento];
  const tanque = new THREE.Group();
  tanque.position.y = 0.42;
  grupo.add(tanque);

  // Casco com tampos abaulados e camisa térmica externa.
  const perfil = [[0.0, -0.02], [0.24, 0.0], [0.42, 0.05], [0.52, 0.14], [0.55, 0.26], [0.55, 1.36], [0.52, 1.48], [0.42, 1.57], [0.24, 1.62], [0.0, 1.64]];
  const cascoMesh = mesh(lathe(perfil, 96), casco);
  tanque.add(cascoMesh);
  const camisa = mesh(lathe([[0.585, 0.24], [0.6, 0.27], [0.6, 1.2], [0.585, 1.23]], 96), isolamento);
  tanque.add(camisa);
  [0.3, 0.72, 1.14].forEach((y) => tanque.add(mesh(new THREE.TorusGeometry(0.602, 0.012, 8, 96), inoxEscuro, { y, rx: Math.PI / 2 })));
  tanque.add(mesh(new THREE.TorusGeometry(0.555, 0.02, 8, 96), inox, { y: 1.42, rx: Math.PI / 2 }));

  // Pernas e base.
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 0.46, z = Math.sin(a) * 0.46;
    grupo.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.5, 16), inoxEscuro, { x, y: 0.25, z }));
    grupo.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 20), borracha, { x, y: 0.015, z }));
  }

  // Visor de vidro.
  const visor = new THREE.Group();
  visor.position.set(0, 0.95, 0.6);
  visor.add(mesh(new THREE.TorusGeometry(0.11, 0.022, 12, 40), inox));
  visor.add(mesh(new THREE.CircleGeometry(0.105, 40), mat("#a9d3cf", { rough: 0.05, opacity: 0.35 }), { z: 0.005, cast: false }));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    visor.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), inoxEscuro, { x: Math.cos(a) * 0.125, y: Math.sin(a) * 0.125, z: 0.015 }));
  }
  tanque.add(visor);

  // Meio de cultivo (visível no corte).
  const meio = mat("#c9a14a", { rough: 0.15, opacity: 0.5, clearcoat: 0.6 });
  meio.clippingPlanes = [corte];
  cortaveis.push(meio);
  const liquido = mesh(new THREE.CylinderGeometry(0.535, 0.5, 1.12, 64, 1), meio, { y: 0.72, cast: false });
  tanque.add(liquido);
  const superficie = mesh(new THREE.CircleGeometry(0.535, 64), mat("#e0c07a", { rough: 0.1, opacity: 0.55, clearcoat: 1 }), { y: 1.28, rx: -Math.PI / 2, cast: false });
  superficie.material.clippingPlanes = [corte];
  cortaveis.push(superficie.material);
  tanque.add(superficie);

  // Eixo, impelidores Rushton e chicanas.
  const rotor = new THREE.Group();
  tanque.add(rotor);
  rotor.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.75, 16), inox, { y: 0.95 }));
  const impelidores = [];
  [0.42, 0.92].forEach((y) => {
    const imp = new THREE.Group();
    imp.position.y = y;
    imp.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 40), inox));
    imp.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 20), inoxEscuro));
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      imp.add(mesh(rbox(0.09, 0.08, 0.008, 0.003), inox, { x: Math.cos(a) * 0.16, z: Math.sin(a) * 0.16, ry: -a + Math.PI / 2 }));
    }
    rotor.add(imp);
    impelidores.push(imp);
  });
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    tanque.add(mesh(rbox(0.012, 1.0, 0.06, 0.004), inoxEscuro, { x: Math.cos(a) * 0.49, y: 0.8, z: Math.sin(a) * 0.49, ry: -a }));
  }
  // Aspersor de ar (anel perfurado).
  const aspersor = new THREE.Group();
  aspersor.position.y = 0.26;
  aspersor.add(mesh(new THREE.TorusGeometry(0.2, 0.018, 10, 48), inoxEscuro, { rx: Math.PI / 2 }));
  aspersor.add(mesh(tube([[0.2, 0, 0], [0.38, 0, 0], [0.5, 0.05, 0], [0.62, 0.05, 0]], 0.016, { segments: 12 }), inoxEscuro));
  tanque.add(aspersor);

  // Bolhas e microrganismos (instâncias).
  const rnd = seeded(7);
  const nBolhas = 110;
  const bolhas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 10, 8), mat("#ffffff", { rough: 0.05, opacity: 0.6, clearcoat: 1 }), nBolhas);
  bolhas.material.clippingPlanes = [corte];
  cortaveis.push(bolhas.material);
  const bolhaDados = Array.from({ length: nBolhas }, () => ({ a: rnd() * Math.PI * 2, r: 0.05 + rnd() * 0.42, y: rnd(), v: 0.2 + rnd() * 0.25, s: 0.6 + rnd() * 1.2 }));
  bolhas.castShadow = false;
  tanque.add(bolhas);
  const nCel = 70;
  const celulas = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.012, 0.035, 4, 8), mat(cor === "#b9b1a2" ? "#7fbf6a" : "#7fbf6a", { rough: 0.5, emissive: "#3c7a2c", emissiveIntensity: 0.3 }), nCel);
  celulas.material.clippingPlanes = [corte];
  cortaveis.push(celulas.material);
  const celDados = Array.from({ length: nCel }, () => ({ a: rnd() * Math.PI * 2, r: 0.08 + rnd() * 0.4, y: 0.25 + rnd() * 0.95, w: 0.4 + rnd(), rx: rnd() * 6, ry: rnd() * 6 }));
  celulas.castShadow = false;
  tanque.add(celulas);

  // Tampo superior: motor, redutor, entradas e sondas.
  const motor = new THREE.Group();
  motor.position.y = 1.64;
  motor.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 40), inoxEscuro));
  motor.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 32), inox, { y: 0.13 }));
  motor.add(mesh(rbox(0.2, 0.26, 0.2, 0.03), azul, { y: 0.35 }));
  for (let i = 0; i < 7; i += 1) motor.add(mesh(rbox(0.205, 0.012, 0.205, 0.004), inoxEscuro, { y: 0.26 + i * 0.03 }));
  motor.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 24), inoxEscuro, { y: 0.5 }));
  tanque.add(motor);
  // Entrada de nutrientes com válvula.
  const entrada = mesh(tube([[0.25, 1.6, 0.1], [0.3, 1.82, 0.12], [0.55, 1.9, 0.15], [0.85, 1.9, 0.15]], 0.025, { segments: 30 }), inox);
  tanque.add(entrada);
  tanque.add(mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 24), vermelho, { x: 0.6, y: 1.96, z: 0.15, rx: Math.PI / 2 }));
  // Sondas inclinadas.
  const sondas = new THREE.Group();
  [[azul, 0.5, "pH"], [verde, 0.0, "O2"], [amarelo, -0.5, "T"]].forEach(([m, a]) => {
    const s = new THREE.Group();
    const ang = -0.9 + a;
    s.position.set(Math.sin(ang) * 0.5, 0.85 + a * 0.3, Math.cos(ang) * 0.5);
    s.lookAt(0, 0.7 + a * 0.3, 0);
    s.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 14), inox, { rx: Math.PI / 2 }));
    s.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), m, { rx: Math.PI / 2, z: -0.21 }));
    s.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), inoxEscuro, { rx: Math.PI / 2, z: -0.06 }));
    sondas.add(s);
  });
  tanque.add(sondas);
  // Saída inferior com válvula de colheita.
  const saida = new THREE.Group();
  saida.add(mesh(tube([[0, -0.0, 0], [0, -0.12, 0], [0.12, -0.2, 0.12], [0.42, -0.22, 0.42]], 0.03, { segments: 24 }), inox));
  saida.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 20), inoxEscuro, { x: 0.33, y: -0.215, z: 0.33, rz: Math.PI / 2, ry: -Math.PI / 4 }));
  const volante = mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 28), vermelho, { x: 0.33, y: -0.13, z: 0.33, rx: Math.PI / 2 });
  saida.add(volante);
  tanque.add(saida);

  // Painel de controle em pedestal.
  const painel = new THREE.Group();
  painel.position.set(-0.95, 0, 0.35);
  painel.rotation.y = 0.6;
  painel.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 12), inoxEscuro, { y: 0.45 }));
  painel.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24), inoxEscuro, { y: 0.015 }));
  painel.add(mesh(rbox(0.46, 0.3, 0.05, 0.02), mat("#2b3033", { rough: 0.5 }), { y: 0.98, rx: -0.35 }));
  const tela = telaPainel();
  const telaMesh = mesh(new THREE.PlaneGeometry(0.42, 0.25), new THREE.MeshBasicMaterial({ map: tela.tex, toneMapped: false }), { y: 0.985, z: 0.027, rx: -0.35, cast: false });
  painel.add(telaMesh);
  grupo.add(painel);
  painel.add(mesh(tube([[0, 0.05, 0], [0.3, 0.02, -0.15], [0.7, 0.04, -0.3], [0.95, 0.5, -0.35]], 0.008, { segments: 30, radial: 6 }), borracha));

  const estado = { agitar: false, cortar: false, k: 0, rpm: 0, o2: 18, ph: 6.9, temp: 30.5, ultimo: -1 };
  const aplicarCorte = () => cortaveis.forEach((m) => { m.clippingPlanes = estado.cortar ? [corte] : []; m.needsUpdate = true; });
  aplicarCorte();
  meio.clippingPlanes = [corte]; // o meio só aparece no corte
  const mObj = new THREE.Object3D();

  const pontos = [
    { id: "motor", titulo: "Motor e eixo", posicao: [0, 2.2, 0], destaque: [motor],
      texto: "O motor no topo gira o eixo central. A agitação mantém as células suspensas e mistura nutrientes, ar e calor de forma homogênea — sem ela, o cultivo ficaria estratificado." },
    { id: "impelidores", titulo: "Impelidores", posicao: [0.16, 1.34, 0.1], destaque: impelidores, visivel: () => estado.cortar,
      texto: "Turbinas do tipo Rushton quebram as bolhas de ar em bolhas menores, aumentando a área de contato e a transferência de oxigênio para o meio." },
    { id: "aspersor", titulo: "Aspersor de ar", posicao: [0.2, 0.68, 0.05], destaque: [aspersor], visivel: () => estado.cortar,
      texto: "Um anel perfurado injeta ar estéril pelo fundo. Os microrganismos aeróbios consomem esse oxigênio para crescer e produzir enzimas, ácidos ou biocombustíveis." },
    { id: "sondas", titulo: "Sondas de controle", posicao: [-0.2, 1.3, 0.52], destaque: [sondas],
      texto: "Sensores medem pH, oxigênio dissolvido e temperatura em tempo real. O sistema de controle corrige cada variável para manter a linhagem nas condições ideais." },
    { id: "camisa", titulo: "Camisa térmica", posicao: [0.45, 1.0, 0.42], destaque: [camisa],
      texto: "Uma camada externa por onde circula água quente ou fria. A fermentação libera calor, e manter a temperatura estável é essencial para a produtividade." },
    { id: "colheita", titulo: "Válvula de colheita", posicao: [0.75, 0.22, 0.75], destaque: [saida],
      texto: "Ao final, o caldo sai por baixo para as etapas de separação e purificação, onde o produto (enzima, etanol, bioplástico…) é isolado das células." },
    { id: "celulas", titulo: "Microrganismos", posicao: [-0.25, 1.05, 0.05], destaque: [celulas], visivel: () => estado.cortar,
      texto: "Leveduras ou bactérias selecionadas — às vezes melhoradas geneticamente — funcionam como pequenas fábricas, convertendo açúcares em produtos de interesse." },
  ];

  return {
    grupo,
    titulo: "Biorreator industrial",
    descricao: "Um tanque de aço inoxidável onde microrganismos transformam matérias-primas em enzimas, biocombustíveis e biomateriais. Ligue a agitação e abra o corte para ver o que acontece lá dentro.",
    camera: { distancia: 5.6, alvo: [-0.1, 1.15, 0], angulo: 0.42, elevacao: 0.2 },
    pontos,
    acoes: [
      { id: "agitar", tipo: "alternar", rotulo: "Ligar agitação e aeração", valor: false, descricao: "Gira os impelidores e injeta ar pelo aspersor." },
      { id: "cortar", tipo: "alternar", rotulo: "Corte do tanque", valor: false, descricao: "Remove a metade frontal do casco para mostrar o interior." },
    ],
    status: "Biorreator em espera: oxigênio dissolvido baixo, células em repouso.",
    acao(id, valor) {
      if (id === "cortar") { estado.cortar = valor; aplicarCorte(); return undefined; }
      if (id === "agitar") {
        estado.agitar = valor;
        return valor ? "Agitação e aeração ligadas: o oxigênio dissolvido sobe e as células passam a crescer e produzir." : "Biorreator em espera: oxigênio dissolvido baixo, células em repouso.";
      }
      return undefined;
    },
    reiniciar() { estado.agitar = false; estado.cortar = false; aplicarCorte(); this.acoes.forEach((a) => { a.valor = false; }); },
    aoMostrar() { tela.desenhar(estado); },
    atualizar(dt, t) {
      estado.k = damp(estado.k, estado.agitar ? 1 : 0, 1.5, dt);
      const k = estado.k;
      estado.rpm = 180 * k;
      estado.o2 = damp(estado.o2, estado.agitar ? 42 : 18, 0.6, dt);
      estado.temp = damp(estado.temp, estado.agitar ? 32 : 30.5, 0.3, dt);
      estado.ph = 6.9 - 0.15 * k + Math.sin(t * 0.4) * 0.01;
      rotor.rotation.y += dt * k * 9;
      if (Math.floor(t * 4) !== estado.ultimo) { estado.ultimo = Math.floor(t * 4); tela.desenhar(estado); }
      bolhaDados.forEach((b, i) => {
        b.y = (b.y + dt * b.v * k) % 1;
        const r = b.r * (0.5 + b.y * 0.6);
        const a = b.a + b.y * 3 * k + t * 0.3 * k;
        mObj.position.set(Math.cos(a) * Math.min(r, 0.5), 0.28 + b.y * 0.98, Math.sin(a) * Math.min(r, 0.5));
        mObj.scale.setScalar(k > 0.05 ? b.s * (0.6 + b.y) : 0.0001);
        mObj.updateMatrix();
        bolhas.setMatrixAt(i, mObj.matrix);
      });
      bolhas.instanceMatrix.needsUpdate = true;
      celDados.forEach((c, i) => {
        const a = c.a + t * c.w * (0.1 + k * 0.9);
        mObj.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * c.w + c.rx) * 0.03, Math.sin(a) * c.r);
        mObj.rotation.set(c.rx + t * k, c.ry + t * 0.5 * k, 0);
        mObj.scale.setScalar(1);
        mObj.updateMatrix();
        celulas.setMatrixAt(i, mObj.matrix);
      });
      celulas.instanceMatrix.needsUpdate = true;
      superficie.position.y = 1.28 + Math.sin(t * 6) * 0.004 * k;
      liquido.visible = superficie.visible = bolhas.visible = celulas.visible = estado.cortar;
    },
  };
}
