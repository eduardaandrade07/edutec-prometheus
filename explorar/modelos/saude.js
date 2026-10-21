// Biotecnologia Vermelha — anticorpo monoclonal (IgG) reconhecendo um vírus.
import { THREE, mat, mesh, deform, noise3, tube, glowSprite, damp, fibonacciSphere, seeded } from "./_comum.js";

function dominio(seed) {
  // Domínio de imunoglobulina: volume globular com superfície irregular de proteína.
  const g = new THREE.IcosahedronGeometry(1, 4);
  return deform(g, (v) => {
    const n = noise3(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed) * 0.09 + noise3(v.x * 6 + seed, v.y * 6, v.z * 6) * 0.025;
    v.multiplyScalar(1 + n);
  });
}

export function criar({ cor }) {
  const grupo = new THREE.Group();
  const anticorpo = new THREE.Group();
  anticorpo.position.y = 0.18;
  grupo.add(anticorpo);

  const cores = { pesada: "#3f6fb3", leve: "#7cc1d6", variavel: cor, neutra: "#b9b3ac" };
  const mPesada = mat(cores.pesada, { rough: 0.42, clearcoat: 0.4 });
  const mLeve = mat(cores.leve, { rough: 0.42, clearcoat: 0.4 });
  const mVariavel = mat(cores.variavel, { rough: 0.35, clearcoat: 0.5, emissive: cores.variavel, emissiveIntensity: 0.15 });
  const mGlicano = mat("#e9d9a6", { rough: 0.5 });

  const pesada = [], leve = [], variavel = [], fc = [], dobradica = [];
  const add = (lista, material, x, y, z, s, seed, rz = 0) => {
    const m = mesh(dominio(seed), material, { x, y, z, sx: s[0], sy: s[1], sz: s[2], rz });
    anticorpo.add(m);
    lista.push(m);
    return m;
  };

  // Região Fc: duas cadeias pesadas (CH2 e CH3) lado a lado.
  [-1, 1].forEach((lado, k) => {
    add(pesada, mPesada, lado * 0.135, 0.3, 0, [0.15, 0.2, 0.15], k * 3 + 1);
    add(pesada, mPesada, lado * 0.15, 0.68, 0.01, [0.155, 0.21, 0.15], k * 3 + 2);
  });
  fc.push(...pesada.slice());
  // Glicanos entre os domínios CH2.
  [-1, 1].forEach((lado) => {
    const gl = mesh(tube([[lado * 0.05, 0.62, 0.06], [lado * 0.02, 0.7, 0.13], [lado * 0.06, 0.78, 0.16]], 0.018, { segments: 16, radial: 6 }), mGlicano);
    anticorpo.add(gl);
    [0.7, 0.78].forEach((y, i) => anticorpo.add(mesh(new THREE.SphereGeometry(0.03, 12, 8), mGlicano, { x: lado * (0.02 + i * 0.04), y, z: 0.13 + i * 0.03 })));
  });

  // Dobradiça flexível.
  [-1, 1].forEach((lado) => {
    const h = mesh(tube([[lado * 0.13, 0.86, 0], [lado * 0.07, 0.98, 0.02], [lado * 0.15, 1.08, 0]], 0.03, { segments: 20, radial: 8 }), mPesada);
    anticorpo.add(h);
    dobradica.push(h);
  });
  const ponte = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), mat("#f2d36b", { rough: 0.3, metal: 0.4 }), { y: 0.98, rz: Math.PI / 2 });
  anticorpo.add(ponte);
  dobradica.push(ponte);

  // Braços Fab: cadeia pesada (VH, CH1) por dentro, cadeia leve (VL, CL) por fora.
  const pontas = [];
  [-1, 1].forEach((lado, k) => {
    const ang = lado * 0.86;
    const dir = new THREE.Vector2(Math.sin(ang), Math.cos(ang));
    const perp = new THREE.Vector2(dir.y, -dir.x).multiplyScalar(lado);
    const base = new THREE.Vector2(lado * 0.17, 1.12);
    const pos = (t, off) => base.clone().add(dir.clone().multiplyScalar(t)).add(perp.clone().multiplyScalar(off));
    const rz = -ang;
    let p = pos(0.16, -0.075); add(pesada, mPesada, p.x, p.y, 0.0, [0.14, 0.19, 0.14], 10 + k, rz);
    p = pos(0.16, 0.115); add(leve, mLeve, p.x, p.y, 0.02, [0.13, 0.18, 0.13], 20 + k, rz);
    p = pos(0.48, -0.075); add(variavel, mPesada, p.x, p.y, 0.0, [0.135, 0.19, 0.14], 30 + k, rz);
    p = pos(0.48, 0.115); add(variavel, mLeve, p.x, p.y, 0.02, [0.125, 0.18, 0.13], 40 + k, rz);
    // Alças CDR: o "paratopo" que reconhece o antígeno.
    const rnd = seeded(77 + k);
    for (let i = 0; i < 6; i += 1) {
      const t = 0.64 + rnd() * 0.04;
      p = pos(t, -0.12 + i * 0.05);
      const cdr = mesh(new THREE.SphereGeometry(0.035 + rnd() * 0.012, 14, 10), mVariavel, { x: p.x, y: p.y, z: 0.02 + (rnd() - 0.5) * 0.08 });
      anticorpo.add(cdr);
      variavel.push(cdr);
    }
    pontas.push(pos(0.7, 0.02));
  });

  // Vírus com espículas (antígeno).
  const virus = new THREE.Group();
  const membrana = mesh(deform(new THREE.IcosahedronGeometry(0.36, 5), (v) => v.multiplyScalar(1 + noise3(v.x * 8, v.y * 8, v.z * 8) * 0.025)), mat("#8a7a8f", { rough: 0.6, clearcoat: 0.2 }));
  virus.add(membrana);
  const mEspicula = mat("#d99a52", { rough: 0.45 });
  const espiculas = [];
  const hasteGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.12, 8);
  const cabecaGeo = deform(new THREE.IcosahedronGeometry(0.045, 2), (v) => v.multiplyScalar(1 + noise3(v.x * 40, v.y * 40, v.z * 40) * 0.08));
  fibonacciSphere(42, 0.36).forEach((pt) => {
    const n = pt.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const haste = new THREE.Mesh(hasteGeo, mEspicula);
    haste.position.copy(n.clone().multiplyScalar(0.41));
    haste.quaternion.copy(q);
    const cabeca = new THREE.Mesh(cabecaGeo, mEspicula);
    cabeca.position.copy(n.clone().multiplyScalar(0.48));
    cabeca.scale.set(1, 1.25, 1);
    cabeca.quaternion.copy(q);
    haste.castShadow = cabeca.castShadow = true;
    virus.add(haste, cabeca);
    espiculas.push(cabeca);
  });
  grupo.add(virus);

  const brilho = glowSprite(cor, 0.5, 0);
  grupo.add(brilho);

  // Posições: livre (afastado) e ligado (espícula encostada na ponta do braço direito).
  const ponta = new THREE.Vector3(pontas[1].x, pontas[1].y + 0.18, 0.02);
  const dirPonta = new THREE.Vector3(Math.sin(0.86), Math.cos(0.86), 0).normalize();
  const ligado = ponta.clone().add(dirPonta.clone().multiplyScalar(0.5));
  const livre = new THREE.Vector3(1.05, 2.05, -0.25);
  virus.position.copy(livre);
  brilho.position.copy(ponta.clone().add(dirPonta.clone().multiplyScalar(0.03)));

  const estado = { ligar: false, cadeias: true, k: 0 };
  const aplicarCores = () => {
    mPesada.color.set(estado.cadeias ? cores.pesada : cores.neutra);
    mLeve.color.set(estado.cadeias ? cores.leve : cores.neutra);
  };

  const pontos = [
    { id: "variavel", titulo: "Região variável", posicao: [pontas[0].x, pontas[0].y + 0.12, 0.1], destaque: variavel,
      texto: "Nas pontas dos braços ficam as alças CDR, que formam o paratopo: um encaixe químico específico para um único trecho do antígeno (o epítopo). Em um anticorpo monoclonal, todas as cópias têm exatamente essa mesma ponta — por isso ele reconhece um único alvo." },
    { id: "pesada", titulo: "Cadeia pesada", posicao: [0.16, 0.7, 0.18], destaque: pesada,
      texto: "Duas cadeias pesadas (em azul) formam a haste e metade de cada braço. A IgG tem cerca de 150 kDa e quatro cadeias unidas por pontes dissulfeto." },
    { id: "leve", titulo: "Cadeia leve", posicao: [-0.62, 1.45, 0.16], destaque: leve,
      texto: "As cadeias leves (em azul-claro) completam os braços. Juntas, cadeia pesada e leve formam o fragmento Fab, a parte que se liga ao antígeno." },
    { id: "dobradica", titulo: "Dobradiça", posicao: [0, 1.02, 0.12], destaque: dobradica,
      texto: "Uma região flexível que permite aos braços abrir e fechar, alcançando dois epítopos ao mesmo tempo, mesmo que estejam a distâncias diferentes." },
    { id: "fc", titulo: "Região Fc", posicao: [0.0, 0.32, 0.2], destaque: fc,
      texto: "A base do anticorpo conversa com o sistema imune: aciona células de defesa e define quanto tempo a molécula permanece no sangue. Engenheiros modificam essa região para ajustar a eficácia e a duração dos medicamentos." },
    { id: "antigeno", titulo: "Antígeno viral", posicao: [0, 0.5, 0], destaque: espiculas, local: virus,
      texto: "As espículas na superfície do vírus são proteínas que ele usa para entrar nas células. Um anticorpo que se liga a elas pode neutralizar o vírus — é o princípio de vários tratamentos com anticorpos monoclonais." },
  ];
  // Ponto do antígeno acompanha o vírus.
  const pAntigeno = pontos[5];
  Object.defineProperty(pAntigeno, "posicao", { get: () => [virus.position.x, virus.position.y + 0.5, virus.position.z] });

  const tmp = new THREE.Vector3();
  const qLivre = new THREE.Quaternion(), qLigado = new THREE.Quaternion(), eLivre = new THREE.Euler();
  return {
    grupo,
    titulo: "Anticorpo monoclonal",
    descricao: "Uma imunoglobulina G (IgG) em formato de Y, a mesma estrutura usada em medicamentos biológicos contra câncer, doenças autoimunes e infecções. Toque nos pontos para conhecer cada parte e ligue o anticorpo ao vírus.",
    camera: { distancia: 6.4, alvo: [0.3, 1.2, 0], angulo: 0.35, elevacao: 0.16 },
    pontos,
    acoes: [
      { id: "ligar", tipo: "alternar", rotulo: "Ligar ao antígeno", valor: false, descricao: "Aproxima o vírus até a região variável reconhecer a espícula." },
      { id: "cadeias", tipo: "alternar", rotulo: "Cores por cadeia", valor: true, descricao: "Diferencia cadeias pesadas e leves." },
    ],
    status: "Anticorpo livre, aguardando o antígeno.",
    acao(id, valor) {
      if (id === "ligar") {
        estado.ligar = valor;
        return valor ? "Ligação estabelecida: a região variável encaixou na espícula viral, bloqueando o ponto que o vírus usaria para entrar na célula." : "Anticorpo livre, aguardando o antígeno.";
      }
      if (id === "cadeias") { estado.cadeias = valor; aplicarCores(); }
      return undefined;
    },
    reiniciar() { estado.ligar = false; estado.cadeias = true; aplicarCores(); this.acoes[0].valor = false; this.acoes[1].valor = true; },
    atualizar(dt, t) {
      estado.k = damp(estado.k, estado.ligar ? 1 : 0, 2.2, dt);
      const k = estado.k;
      tmp.lerpVectors(livre, ligado, k);
      tmp.y += Math.sin(t * 0.9) * 0.04 * (1 - k);
      virus.position.copy(tmp);
      // Livre, o vírus gira devagar; ligado, gira até uma espícula apontar para a ponta do braço.
      qLivre.setFromEuler(eLivre.set(Math.sin(t * 0.5) * 0.1, t * 0.15 + 0.4, 0));
      const alvoDir = ponta.clone().sub(virus.position).normalize();
      qLigado.setFromUnitVectors(espiculas[0].position.clone().normalize(), alvoDir);
      virus.quaternion.slerpQuaternions(qLivre, qLigado, k);
      anticorpo.position.y = 0.18 + Math.sin(t * 1.1) * 0.025;
      anticorpo.rotation.z = Math.sin(t * 0.6) * 0.02;
      brilho.material.opacity = Math.max(0, k - 0.7) / 0.3 * (0.65 + 0.2 * Math.sin(t * 5));
    },
  };
}
