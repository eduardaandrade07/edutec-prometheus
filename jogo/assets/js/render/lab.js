// Laboratório Prometheus: arquitetura, equipamentos e cenografia.
// Mantém a planta original (ala de análise ao fundo, divisória com porta de
// descontaminação, ala de triagem à frente) e os mesmos pontos de interação.
import * as THREE from "../../vendor/three/three.module.min.js";
import { matrixFrom } from "./builder.js";
import { ScreenDisplay } from "./screens.js";
import { addDepthPrepass, createBeamMaterial, createHologramMaterial } from "./effects.js";
import { signTexture, skylineTexture } from "./textures.js";

export const ROOM = { minX: -9.6, maxX: 9.6, minZ: -10.6, maxZ: 10.6, height: 4.5, dividerZ: 0.9, doorMinX: 1.86, doorMaxX: 5.19 };

export function buildLab({ b, m, scene, quality }) {
  const screens = new Map();
  const targets = new Map();
  const animated = [];
  const holograms = [];
  const decorScreens = [];

  const target = (id) => {
    if (!targets.has(id)) targets.set(id, { screens: [], glows: [] });
    return targets.get(id);
  };

  // Tela: plano emissivo com conteúdo animado (sempre dinâmica).
  const screen = (id, kind, title, w, h, x, y, z, { ry = 0, rx = 0, res = 512, targetId = null, accent = "#58f4c2", intensity = 1.5 } = {}) => {
    const aspect = w / h;
    const width = res;
    const height = Math.max(128, Math.round(res / aspect));
    const display = new ScreenDisplay(kind, { width, height, title, accent, intensity });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), display.material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0, "YXZ");
    scene.add(mesh);
    display.mesh = mesh;
    if (id) screens.set(id, display);
    else decorScreens.push(display);
    if (targetId) target(targetId).screens.push(display);
    return display;
  };

  // Monitor com moldura, haste e base; a tela fica na face frontal (+z local).
  const monitor = (x, y, z, w, h, ry, display, { tilt = -0.08, stand = true, standHeight = 0.32 } = {}) => {
    const M = matrixFrom(x, y, z, { ry, rx: tilt });
    const local = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(M);
    const bezel = 0.025;
    const p = local(0, 0, -0.03);
    b.box(m.panelBlack, w + bezel * 2, h + bezel * 2, 0.045, p.x, p.y, p.z, { ry, rx: tilt, r: 0.008 });
    const back = local(0, 0, -0.07);
    b.box(m.casingDark, w * 0.55, h * 0.5, 0.05, back.x, back.y, back.z, { ry, rx: tilt, r: 0.01 });
    if (stand) {
      const s = local(0, -h / 2 - standHeight / 2 + 0.02, -0.1);
      b.box(m.aluminium, 0.05, standHeight, 0.03, s.x, s.y, s.z, { ry });
      const f = local(0, -h / 2 - standHeight + 0.02, -0.06);
      b.box(m.aluminium, 0.3, 0.015, 0.2, f.x, f.y, f.z, { ry, r: 0.006 });
    }
    const s = local(0, 0, -0.005);
    screen(display.id, display.kind, display.title, w, h, s.x, s.y, s.z, { ry, rx: tilt, res: display.res, targetId: display.targetId, accent: display.accent, intensity: display.intensity });
  };

  const glowTarget = (targetId, mesh) => {
    target(targetId).glows.push(mesh);
  };

  // =======================================================================
  // ARQUITETURA
  // =======================================================================
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ, H = ROOM.height;
  b.box(m.floor, W + 0.3, 0.1, D + 0.3, 0, -0.05, 0, { r: 0, cast: false });
  b.box(m.ceiling, W + 0.3, 0.1, D + 0.3, 0, H + 0.05, 0, { r: 0 });

  // Paredes (a da direita é recortada para a janela da triagem).
  const wallT = 0.15;
  b.box(m.wall, W + 0.3, H, wallT, 0, H / 2, ROOM.minZ - wallT / 2, { r: 0 });
  b.box(m.wall, W + 0.3, H, wallT, 0, H / 2, ROOM.maxZ + wallT / 2, { r: 0 });
  b.box(m.wall, wallT, H, D, ROOM.minX - wallT / 2, H / 2, 0, { r: 0 });
  const win = { z0: 2.2, z1: 5.2, y0: 1.0, y1: 3.1 };
  const rx = ROOM.maxX + wallT / 2;
  b.box(m.wall, wallT, H, win.z0 - ROOM.minZ, rx, H / 2, (ROOM.minZ + win.z0) / 2, { r: 0 });
  b.box(m.wall, wallT, H, ROOM.maxZ - win.z1, rx, H / 2, (win.z1 + ROOM.maxZ) / 2, { r: 0 });
  b.box(m.wall, wallT, win.y0, win.z1 - win.z0, rx, win.y0 / 2, (win.z0 + win.z1) / 2, { r: 0 });
  b.box(m.wall, wallT, H - win.y1, win.z1 - win.z0, rx, (win.y1 + H) / 2, (win.z0 + win.z1) / 2, { r: 0 });

  // Rodapé, barra de proteção e sanca escura em todo o perímetro.
  const perimeter = [
    [0, ROOM.minZ + 0.02, W, 0.04, 0], [0, ROOM.maxZ - 0.02, W, 0.04, 0],
    [ROOM.minX + 0.02, 0, 0.04, D, 1], [ROOM.maxX - 0.02, (ROOM.minZ + win.z0) / 2, 0.04, win.z0 - ROOM.minZ, 1],
    [ROOM.maxX - 0.02, (win.z1 + ROOM.maxZ) / 2, 0.04, ROOM.maxZ - win.z1, 1],
  ];
  perimeter.forEach(([x, z, w, d]) => {
    b.box(m.wallBase, w, 0.14, d, x, 0.07, z, { r: 0.004 });
    b.box(m.trim, w, 0.22, d, x, H - 0.11, z, { r: 0.004 });
  });
  [[0, ROOM.minZ + 0.03, W, 0.06], [0, ROOM.maxZ - 0.03, W, 0.06], [ROOM.minX + 0.03, 0, 0.06, D]].forEach(([x, z, w, d]) => {
    b.box(m.aluminium, w, 0.07, d, x, 1.05, z, { r: 0.012 });
  });

  // Pilares estruturais com friso luminoso do capítulo.
  const pilasters = [
    [ROOM.minX, -7.6], [ROOM.minX, -2.0], [ROOM.minX, 4.55], [ROOM.minX, 8.0],
    [ROOM.maxX, -7.6], [ROOM.maxX, -2.0], [ROOM.maxX, 6.0], [ROOM.maxX, 8.9],
  ];
  pilasters.forEach(([x, z]) => {
    const side = Math.sign(x);
    const px = x - side * 0.17;
    b.box(m.wall, 0.34, H, 0.56, px, H / 2, z, { r: 0.02 });
    b.box(m.trim, 0.36, 0.16, 0.6, px, 0.08, z, { r: 0.01 });
    b.box(m.accentSoft, 0.012, 2.9, 0.05, px - side * 0.175, 2.15, z, { r: 0, cast: false });
  });

  // Forro: vigas, luminárias embutidas e um duto de ventilação.
  [-9.3, -6.2, -3.1, 2.6, 5.6, 9.0].forEach((z) => {
    b.box(m.trim, W, 0.16, 0.22, 0, H - 0.08, z, { r: 0.01 });
  });
  const panels = [];
  [-8.0, -4.6, -1.5, 3.8, 7.4].forEach((z) => {
    [-5.5, 0, 5.5].forEach((x) => {
      panels.push([x, z]);
      b.box(m.trim, 1.9, 0.05, 0.62, x, H - 0.025, z, { r: 0.006 });
      b.box(m.lightPanel, 1.78, 0.02, 0.5, x, H - 0.05, z, { r: 0, cast: false });
    });
  });
  b.cylinder(m.aluminium, 0.26, 0.26, 11.2, 7.9, 4.05, -5.0, { rx: Math.PI / 2, seg: 28, cast: true });
  for (let z = -10; z <= 0.2; z += 1.4) {
    b.torus(m.steelDark, 0.27, 0.018, 7.9, 4.05, z, { radial: 6, tubular: 28 });
    b.box(m.steelDark, 0.03, 0.2, 0.03, 7.9, 4.38, z, { r: 0 });
  }
  // Bandeja de cabos na parede esquerda.
  b.box(m.steelDark, 0.3, 0.06, 20.5, ROOM.minX + 0.3, 3.75, 0, { r: 0.005 });
  for (let z = -10; z <= 10; z += 0.9) b.box(m.steelDark, 0.3, 0.05, 0.03, ROOM.minX + 0.3, 3.8, z, { r: 0 });
  [[0.02, 0x2f8a5c], [0.06, 0x2c6f9b], [-0.04, 0xb43a32]].forEach(([dx]) => {
    b.cylinder(m.rubber, 0.015, 0.015, 20.4, ROOM.minX + 0.3 + dx, 3.8, 0, { rx: Math.PI / 2, seg: 8, cast: false });
  });

  // -----------------------------------------------------------------------
  // Divisória envidraçada com porta de descontaminação.
  // -----------------------------------------------------------------------
  const dz = ROOM.dividerZ;
  const segments = [[ROOM.minX, ROOM.doorMinX - 0.12], [ROOM.doorMaxX + 0.12, ROOM.maxX]];
  segments.forEach(([x0, x1]) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    b.box(m.casingDark, w, 1.0, 0.22, cx, 0.5, dz, { r: 0.01 });
    b.box(m.aluminium, w, 0.05, 0.26, cx, 1.02, dz, { r: 0.01 });
    b.box(m.wall, w, H - 3.1, 0.22, cx, (3.1 + H) / 2, dz, { r: 0.01 });
    b.box(m.aluminium, w, 0.06, 0.24, cx, 3.1, dz, { r: 0.01 });
    b.box(m.glass, w, 2.06, 0.02, cx, 2.06, dz, { r: 0, cast: false, receive: false });
    b.box(m.glassFrosted, w, 0.16, 0.024, cx, 1.62, dz, { r: 0, cast: false, receive: false });
    const count = Math.max(1, Math.round(w / 1.2));
    for (let i = 0; i <= count; i += 1) {
      const x = x0 + (w * i) / count;
      b.box(m.aluminium, 0.06, 2.1, 0.12, x, 2.06, dz, { r: 0.01 });
    }
  });
  // Pórtico âmbar com cortina de ar.
  const doorCx = (ROOM.doorMinX + ROOM.doorMaxX) / 2;
  [ROOM.doorMinX - 0.09, ROOM.doorMaxX + 0.09].forEach((x) => {
    b.box(m.casingGrey, 0.22, 3.2, 0.42, x, 1.6, dz, { r: 0.02 });
    b.box(m.amberStrip, 0.03, 2.8, 0.04, x + (x < doorCx ? 0.12 : -0.12), 1.55, dz - 0.15, { r: 0, cast: false });
    b.box(m.amberStrip, 0.03, 2.8, 0.04, x + (x < doorCx ? 0.12 : -0.12), 1.55, dz + 0.15, { r: 0, cast: false });
  });
  b.box(m.casingGrey, ROOM.doorMaxX - ROOM.doorMinX + 0.4, 0.34, 0.5, doorCx, 3.33, dz, { r: 0.02 });
  b.box(m.amberStrip, ROOM.doorMaxX - ROOM.doorMinX - 0.1, 0.03, 0.04, doorCx, 3.15, dz - 0.2, { r: 0, cast: false });
  b.box(m.amberStrip, ROOM.doorMaxX - ROOM.doorMinX - 0.1, 0.03, 0.04, doorCx, 3.15, dz + 0.2, { r: 0, cast: false });
  for (let i = 0; i < 18; i += 1) {
    b.box(m.panelBlack, 0.1, 0.02, 0.3, ROOM.doorMinX + 0.15 + i * 0.17, 3.15, dz, { r: 0 });
  }
  // Portas de correr abertas, recolhidas sobre a divisória.
  [[ROOM.doorMinX - 0.75, -0.17], [ROOM.doorMaxX + 0.75, -0.17]].forEach(([x, off]) => {
    b.box(m.aluminium, 1.3, 2.9, 0.05, x, 1.47, dz + off, { r: 0.01 });
    b.box(m.glass, 1.16, 2.7, 0.02, x, 1.5, dz + off - 0.03, { r: 0, cast: false, receive: false });
  });
  b.box(m.aluminium, ROOM.doorMaxX - ROOM.doorMinX + 3.2, 0.08, 0.1, doorCx, 2.98, dz - 0.17, { r: 0.01 });
  // Soleira com faixas de alerta.
  b.box(m.steel, ROOM.doorMaxX - ROOM.doorMinX, 0.012, 0.5, doorCx, 0.006, dz, { r: 0, cast: false });
  for (let i = 0; i < 7; i += 1) {
    b.box(m.hazard, 0.18, 0.008, 0.06, ROOM.doorMinX + 0.3 + i * 0.45, 0.014, dz - 0.38, { r: 0, cast: false, ry: 0.6 });
    b.box(m.hazard, 0.18, 0.008, 0.06, ROOM.doorMinX + 0.3 + i * 0.45, 0.014, dz + 0.38, { r: 0, cast: false, ry: 0.6 });
  }

  // Sinalização (planos texturizados).
  const sign = (kind, w, h, x, y, z, ry = 0, emissive = 0.4) => {
    const tex = signTexture(kind);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    return mesh;
  };
  sign("annex", 1.1, 0.55, doorCx, 3.33, dz - 0.26, Math.PI, 0.5);
  sign("bsl", 1.1, 0.55, doorCx, 3.33, dz + 0.26, 0, 0.35);
  sign("biohazard", 0.42, 0.42, ROOM.doorMaxX + 0.75, 1.9, dz - 0.215, Math.PI, 0.25);
  sign("biohazard", 0.42, 0.42, ROOM.doorMinX - 0.75, 1.9, dz + 0.215, 0, 0.25);

  // -----------------------------------------------------------------------
  // Janela da triagem com persiana e cidade ao fundo.
  // -----------------------------------------------------------------------
  const wz = (win.z0 + win.z1) / 2, wl = win.z1 - win.z0, wh = win.y1 - win.y0, wy = (win.y0 + win.y1) / 2;
  b.box(m.aluminium, 0.2, 0.06, wl + 0.1, ROOM.maxX - 0.02, win.y0 - 0.03, wz, { r: 0.01 });
  b.box(m.aluminium, 0.12, 0.06, wl + 0.1, ROOM.maxX + 0.02, win.y1 + 0.03, wz, { r: 0.01 });
  [win.z0, wz, win.z1].forEach((z) => b.box(m.aluminium, 0.12, wh, 0.06, ROOM.maxX + 0.02, wy, z, { r: 0.01 }));
  b.box(m.glassTinted, 0.02, wh, wl, ROOM.maxX + 0.05, wy, wz, { r: 0, cast: false, receive: false });
  for (let i = 0; i < 13; i += 1) {
    b.box(m.aluminium, 0.07, 0.006, wl - 0.04, ROOM.maxX - 0.12, win.y1 - 0.05 - i * 0.05, wz, { r: 0, rz: 0.55 });
  }
  b.box(m.casingGrey, 0.1, 0.08, wl + 0.06, ROOM.maxX - 0.12, win.y1 - 0.01, wz, { r: 0.01 });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(90, 22.5), new THREE.MeshBasicMaterial({ map: skylineTexture(0), fog: false, toneMapped: false }));
  far.position.set(42, 1.2, wz);
  far.rotation.y = -Math.PI / 2;
  scene.add(far);
  const near = new THREE.Mesh(new THREE.PlaneGeometry(46, 11.5), new THREE.MeshBasicMaterial({ map: skylineTexture(1), transparent: true, fog: false, toneMapped: false }));
  near.position.set(24, -1.4, wz + 3);
  near.rotation.y = -Math.PI / 2;
  scene.add(near);

  // =======================================================================
  // ALA DE ANÁLISE
  // =======================================================================

  // --- Painel de casos (parede do fundo) ----------------------------------
  const zb = ROOM.minZ;
  b.box(m.casingDark, 5.0, 2.42, 0.1, 0, 2.08, zb + 0.06, { r: 0.02 });
  screen("case-screen-main", "cases", "REGISTROS CLÍNICOS · SETOR AURORA", 4.72, 2.16, 0, 2.08, zb + 0.115, { res: 1024, targetId: "case-board", intensity: 1.35 });
  b.box(m.accent, 5.0, 0.02, 0.02, 0, 0.86, zb + 0.11, { r: 0, cast: false });
  // Mesa de controle.
  b.box(m.casingWarm, 3.1, 0.86, 0.62, 0, 0.43, zb + 0.75, { r: 0.02 });
  b.box(m.resin, 3.3, 0.05, 0.84, 0, 0.885, zb + 0.78, { r: 0.012 });
  b.box(m.panelBlack, 3.04, 0.02, 0.6, 0, 0.46, zb + 1.075, { r: 0 });
  [-1.0, 0, 1.0].forEach((x) => b.box(m.steel, 0.4, 0.015, 0.015, x, 0.62, zb + 1.07, { r: 0.006 }));
  b.box(m.panelBlack, 0.9, 0.02, 0.3, 0, 0.92, zb + 0.95, { r: 0.01 });
  for (let i = 0; i < 24; i += 1) b.box(m.casingDark, 0.03, 0.01, 0.03, -0.4 + (i % 12) * 0.07, 0.935, zb + 0.9 + Math.floor(i / 12) * 0.08, { r: 0.004 });
  monitor(-1.15, 1.2, zb + 0.75, 0.55, 0.34, 0.35, { kind: "vitals", title: "PACIENTE 02", accent: "#58f4c2", res: 384, intensity: 1.3 });
  monitor(1.15, 1.2, zb + 0.75, 0.55, 0.34, -0.35, { kind: "analyzer", title: "LAUDOS", accent: "#5ab8ff", res: 384, intensity: 1.3 });
  b.collider(0, zb + 0.78, 3.3, 0.9);
  b.contactShadow(0, zb + 0.8, 3.6, 1.2, 0.7);

  // --- Quadro de referência ------------------------------------------------
  b.box(m.casingDark, 3.2, 1.95, 0.08, -6.8, 2.6, zb + 0.05, { r: 0.02 });
  screen(null, "board", "ESTRUTURA DO AGENTE · REFERÊNCIA", 3.04, 1.8, -6.8, 2.6, zb + 0.095, { res: 768, intensity: 1.0 });

  // --- Bancadas -------------------------------------------------------------
  const bottleGeo = { amber: m.bottleAmber, clear: m.bottleClear };
  const bottle = (x, y, z, h, r, mat, capMat) => {
    b.lathe(mat, [[0, 0], [r, 0], [r, h * 0.7], [r * 0.45, h * 0.85], [r * 0.4, h], [0, h]], x, y, z, { seg: 14, cast: false });
    b.cylinder(capMat, r * 0.46, r * 0.46, h * 0.14, x, y + h + h * 0.06, z, { seg: 12 });
  };
  const bench = (cx, cz, w = 2.5, d = 1.2) => {
    const top = 0.92;
    b.box(m.resin, w, 0.04, d, cx, top - 0.02, cz, { r: 0.008 });
    b.box(m.rubber, w - 0.1, 0.1, d - 0.15, cx, 0.05, cz, { r: 0.01 });
    // Gaveteiros com puxadores.
    const cabW = w / 2 - 0.08;
    [-1, 1].forEach((side) => {
      const x = cx + side * (cabW / 2 + 0.04);
      b.box(m.casingWarm, cabW, 0.78, d - 0.12, x, 0.49, cz, { r: 0.012 });
      [0.74, 0.54, 0.3].forEach((y, k) => {
        const hh = k === 2 ? 0.3 : 0.17;
        b.box(m.casing, cabW - 0.04, hh - 0.02, 0.02, x, y - (k === 2 ? 0.07 : 0), cz + (d - 0.12) / 2 + 0.005, { r: 0.006 });
        b.box(m.steel, cabW * 0.45, 0.018, 0.025, x, y + (k === 2 ? 0.03 : 0.04), cz + (d - 0.12) / 2 + 0.03, { r: 0.008 });
      });
    });
    // Estante de reagentes.
    const back = cz - d / 2 + 0.1;
    [-1, 1].forEach((side) => b.box(m.steel, 0.04, 1.1, 0.04, cx + side * (w / 2 - 0.05), top + 0.55, back, { r: 0.008 }));
    [1.45, 1.85].forEach((y) => b.box(m.steelDark, w - 0.02, 0.025, 0.3, cx, y, back + 0.08, { r: 0.006 }));
    b.box(m.casingDark, w - 0.2, 0.06, 0.06, cx, top + 0.08, back - 0.02, { r: 0.008 });
    for (let i = 0; i < 6; i += 1) b.box(m.ledGreen, 0.012, 0.012, 0.004, cx - w / 2 + 0.3 + i * 0.4, top + 0.08, back + 0.012, { r: 0, cast: false });
    // Frascos nas prateleiras (variação controlada por semente).
    [1.465, 1.865].forEach((y, row) => {
      let x = cx - w / 2 + 0.16;
      let k = row * 31 + Math.round(cx * 7);
      while (x < cx + w / 2 - 0.14) {
        const rnd = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
        const tall = 0.14 + rnd * 0.12, r = 0.035 + rnd * 0.025;
        const caps = [m.plasticBlue, m.plasticRed, m.casing, m.plasticYellow, m.rubber];
        bottle(x, y + 0.012, back + 0.08 + (rnd - 0.5) * 0.08, tall, r, rnd > 0.45 ? bottleGeo.amber : bottleGeo.clear, caps[((k % caps.length) + caps.length) % caps.length]);
        x += r * 2 + 0.03 + rnd * 0.05;
        k += 1;
      }
    });
    b.collider(cx, cz, w + 0.04, d + 0.04);
    b.contactShadow(cx, cz, w + 0.4, d + 0.4, 0.65);
    return top;
  };
  const top0 = bench(-6.9, -8.0);
  const top1 = bench(-2.2, -8.0);

  // Microscópio (bancada 0).
  const mx = -7.9, mz = -7.7;
  b.box(m.casing, 0.32, 0.05, 0.36, mx, top0 + 0.025, mz, { r: 0.015 });
  b.lathe(m.casing, [[0, 0], [0.06, 0], [0.055, 0.3], [0.045, 0.36], [0, 0.36]], mx, top0 + 0.05, mz - 0.12, { sx: 1.2, sz: 0.8, seg: 18 });
  b.box(m.casingDark, 0.18, 0.025, 0.16, mx, top0 + 0.15, mz + 0.02, { r: 0.008 });
  b.cylinder(m.casing, 0.05, 0.055, 0.22, mx, top0 + 0.4, mz - 0.03, { rx: -0.6, seg: 16 });
  [-0.04, 0.04].forEach((dx) => b.cylinder(m.panelBlack, 0.017, 0.02, 0.12, mx + dx, top0 + 0.53, mz + 0.05, { rx: -0.75, seg: 12 }));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    b.cylinder(m.chrome, 0.012, 0.014, 0.07, mx + Math.cos(a) * 0.04, top0 + 0.21, mz - 0.01 + Math.sin(a) * 0.04, { seg: 10 });
  }
  b.cylinder(m.casingDark, 0.04, 0.04, 0.03, mx + 0.07, top0 + 0.12, mz - 0.1, { rz: Math.PI / 2, seg: 16 });
  b.cylinder(m.casingDark, 0.04, 0.04, 0.03, mx - 0.07, top0 + 0.12, mz - 0.1, { rz: Math.PI / 2, seg: 16 });
  const scopeLight = b.box(m.ledBlue, 0.06, 0.004, 0.06, mx, top0 + 0.165, mz + 0.02, { r: 0, cast: false });
  void scopeLight;

  // Frascos de Erlenmeyer e béquer (bancada 0).
  const erlenmeyer = (x, z, liquid, scale = 1) => {
    const h = 0.2 * scale;
    b.lathe(m.bottleClear, [[0, 0], [0.075 * scale, 0], [0.078 * scale, 0.01], [0.03 * scale, h * 0.78], [0.022 * scale, h], [0, h]], x, top0, z, { seg: 20, cast: false });
    b.lathe(liquid, [[0, 0.004], [0.07 * scale, 0.004], [0.05 * scale, h * 0.38], [0, h * 0.38]], x, top0, z, { seg: 18, cast: false });
  };
  erlenmeyer(-6.6, -7.75, m.liquidBlue);
  erlenmeyer(-6.3, -7.6, m.liquidAmber, 0.8);
  b.lathe(m.bottleClear, [[0, 0], [0.06, 0], [0.06, 0.14], [0.064, 0.15], [0, 0.15]], -6.0, top0, -7.7, { seg: 18, cast: false });
  b.cylinder(m.liquidGreen, 0.056, 0.056, 0.06, -6.0, top0 + 0.032, -7.7, { seg: 18, cast: false });
  // Placa de agitação magnética.
  b.box(m.casing, 0.22, 0.07, 0.26, -6.3, top0 + 0.035, -7.6, { r: 0.015 });

  // Estante de tubos, pipetas e centrífuga (bancada 1).
  b.box(m.plasticBlue, 0.42, 0.06, 0.18, -2.9, top1 + 0.06, -7.85, { r: 0.01 });
  for (let i = 0; i < 12; i += 1) {
    const x = -3.06 + (i % 6) * 0.065, z = -7.89 + Math.floor(i / 6) * 0.08;
    const mat = i % 3 === 0 ? m.liquidGreen : i % 3 === 1 ? m.liquidBlue : m.liquidAmber;
    b.cylinder(m.bottleClear, 0.013, 0.011, 0.13, x, top1 + 0.12, z, { seg: 10, cast: false });
    b.cylinder(mat, 0.011, 0.009, 0.06, x, top1 + 0.085, z, { seg: 10, cast: false });
    b.cylinder(i % 2 ? m.plasticRed : m.casing, 0.015, 0.015, 0.015, x, top1 + 0.19, z, { seg: 10 });
  }
  // Suporte de pipetas.
  b.box(m.casingGrey, 0.08, 0.04, 0.2, -2.35, top1 + 0.02, -7.9, { r: 0.01 });
  b.box(m.casingGrey, 0.03, 0.32, 0.03, -2.35, top1 + 0.18, -7.95, { r: 0.008 });
  [-0.06, 0, 0.06].forEach((dx, i) => {
    b.cylinder(i === 1 ? m.plasticBlue : m.casing, 0.012, 0.008, 0.24, -2.35 + dx, top1 + 0.2, -7.86, { seg: 10, rz: 0.05 * (i - 1) });
  });
  // Centrífuga de bancada.
  b.lathe(m.casing, [[0, 0], [0.2, 0], [0.22, 0.03], [0.22, 0.2], [0.2, 0.24], [0, 0.24]], -1.45, top1, -7.8, { seg: 28 });
  b.lathe(m.casingGrey, [[0, 0], [0.17, 0], [0.16, 0.04], [0.06, 0.07], [0, 0.07]], -1.45, top1 + 0.24, -7.8, { seg: 28 });
  b.box(m.panelBlack, 0.14, 0.06, 0.01, -1.45, top1 + 0.12, -7.585, { r: 0.004 });
  b.box(m.ledGreen, 0.06, 0.02, 0.004, -1.45, top1 + 0.12, -7.578, { r: 0, cast: false });
  // Caixas de ponteiras.
  [[-1.0, m.plasticYellow], [-0.85, m.plasticBlue]].forEach(([x, mat]) => b.box(mat, 0.12, 0.08, 0.09, x, top1 + 0.04, -8.15, { r: 0.008 }));

  // Banqueta de laboratório.
  const stool = (x, z, seat = 0.68) => {
    b.lathe(m.steelDark, [[0, 0.06], [0.28, 0.05], [0.3, 0.07], [0.06, 0.12], [0.04, 0.14], [0, 0.14]], x, 0, z, { seg: 5 });
    b.cylinder(m.chrome, 0.028, 0.028, seat - 0.2, x, 0.12 + (seat - 0.2) / 2, z, { seg: 14 });
    b.torus(m.chrome, 0.2, 0.012, x, 0.36, z, { rx: Math.PI / 2 });
    b.cylinder(m.cushion, 0.22, 0.21, 0.07, x, seat, z, { seg: 24 });
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      b.sphere(m.rubber, 0.025, x + Math.cos(a) * 0.27, 0.025, z + Math.sin(a) * 0.27, { seg: 8, rings: 6 });
    }
    b.circleCollider(x, z, 0.28);
    b.contactShadow(x, z, 0.75, 0.75, 0.55);
  };
  stool(-6.0, -6.25);
  stool(-2.9, -6.9);

  // --- Holograma de DNA (marco visual) --------------------------------------
  const dnaX = 3.8, dnaZ = -9.65;
  b.lathe(m.casingDark, [[0, 0], [0.66, 0], [0.68, 0.03], [0.64, 0.3], [0.56, 0.34], [0.54, 0.38], [0, 0.38]], dnaX, 0, dnaZ, { seg: 48 });
  b.torus(m.accent, 0.6, 0.012, dnaX, 0.33, dnaZ, { rx: Math.PI / 2, radial: 6, tubular: 64, cast: false });
  b.cylinder(m.panelBlack, 0.5, 0.5, 0.012, dnaX, 0.385, dnaZ, { seg: 48 });
  b.circleCollider(dnaX, dnaZ, 0.68);
  b.contactShadow(dnaX, dnaZ, 1.7, 1.7, 0.6);
  const dna = new THREE.Group();
  dna.position.set(dnaX, 0.45, dnaZ);
  scene.add(dna);
  const dnaMatA = createHologramMaterial("#5ab8ff", { opacity: 1.1, scan: 0.5 });
  const dnaMatB = createHologramMaterial("#6ff2cf", { opacity: 1.1, scan: 0.5 });
  const turns = 2.6, helixH = 2.7, radius = 0.32;
  const strand = (phase, mat) => {
    const pts = [];
    for (let i = 0; i <= 120; i += 1) {
      const t = i / 120, a = t * turns * Math.PI * 2 + phase;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, t * helixH, Math.sin(a) * radius));
    }
    dna.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.03, 10, false), mat));
  };
  strand(0, dnaMatA);
  strand(Math.PI, dnaMatB);
  const rungs = 26;
  for (let i = 0; i < rungs; i += 1) {
    const t = (i + 0.5) / rungs, a = t * turns * Math.PI * 2;
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, radius * 2, 8), i % 2 ? dnaMatA : dnaMatB);
    rung.position.y = t * helixH;
    rung.rotation.set(0, -a, Math.PI / 2);
    dna.add(rung);
    [-1, 1].forEach((s) => {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), s > 0 ? dnaMatA : dnaMatB);
      node.position.set(Math.cos(a) * radius * s, t * helixH, Math.sin(a) * radius * s);
      dna.add(node);
    });
  }
  addDepthPrepass(dna);
  const dnaBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.9, 40, 1, true), createBeamMaterial("#5ab8ff", 0.16));
  dnaBeam.position.set(dnaX, 0.39 + 1.45, dnaZ);
  dnaBeam.renderOrder = 9;
  scene.add(dnaBeam);
  holograms.push(dnaMatA, dnaMatB, dnaBeam.material);
  animated.push((time, reduced) => { if (!reduced) dna.rotation.y = time * 0.00025; });

  // --- Terminal de variantes -------------------------------------------------
  {
    const x = 1.35, z = -5.25;
    b.lathe(m.casingDark, [[0, 0], [0.42, 0], [0.44, 0.03], [0.4, 0.08], [0, 0.08]], x, 0, z - 0.1, { sx: 1.4, sz: 1, seg: 32 });
    b.box(m.casingGrey, 0.22, 1.0, 0.18, x, 0.58, z - 0.12, { r: 0.03 });
    b.box(m.casing, 1.2, 0.08, 0.55, x, 1.1, z + 0.02, { r: 0.02, rx: 0.22 });
    b.box(m.panelBlack, 0.9, 0.012, 0.3, x, 1.15, z + 0.06, { r: 0.006, rx: 0.22 });
    b.box(m.accent, 1.2, 0.012, 0.012, x, 1.07, z + 0.3, { r: 0, cast: false });
    monitor(x, 1.62, z + 0.1 - 0.12, 1.02, 0.6, 0, { id: "variant-screen", kind: "variant", title: "COMPARADOR DE VARIANTES", res: 768, targetId: "variant-terminal", accent: "#b793ff", intensity: 1.45 }, { stand: false, tilt: -0.1 });
    b.box(m.casingGrey, 0.08, 0.42, 0.06, x, 1.28, z - 0.18, { r: 0.01 });
    b.collider(x, z - 0.05, 1.3, 0.85);
    b.contactShadow(x, z - 0.05, 1.6, 1.1, 0.6);
  }

  // --- Analisador molecular ------------------------------------------------
  {
    const x = 5.1, z = -6.4;
    b.box(m.casingWarm, 2.4, 0.86, 0.95, x, 0.45, z, { r: 0.02 });
    b.box(m.resin, 2.5, 0.05, 1.05, x, 0.905, z, { r: 0.01 });
    [-0.6, 0.6].forEach((dx) => {
      b.box(m.casing, 1.12, 0.78, 0.02, x + dx, 0.45, z + 0.48, { r: 0.006 });
      b.box(m.steel, 0.02, 0.2, 0.025, x + dx + (dx < 0 ? 0.5 : -0.5), 0.6, z + 0.5, { r: 0.008 });
    });
    // Corpo do analisador.
    b.box(m.casing, 1.5, 0.62, 0.72, x, 1.24, z - 0.06, { r: 0.06, bevelSegments: 3 });
    b.box(m.casingGrey, 1.52, 0.1, 0.74, x, 0.98, z - 0.06, { r: 0.03 });
    b.box(m.panelBlack, 1.1, 0.34, 0.02, x, 1.32, z + 0.3, { r: 0.02, rx: -0.12 });
    b.cylinder(m.steel, 0.13, 0.14, 0.06, x - 0.45, 1.06, z + 0.36, { rx: Math.PI / 2, seg: 24 });
    b.torus(m.accent, 0.11, 0.01, x - 0.45, 1.06, z + 0.395, { radial: 6, tubular: 32, cast: false });
    for (let i = 0; i < 9; i += 1) b.box(m.casingDark, 0.02, 0.18, 0.01, x + 0.55 + (i % 3) * 0.04, 1.32, z - 0.43 + 0.0, { r: 0 });
    // Cartuchos de reagente ao lado.
    [0, 1, 2, 3].forEach((i) => b.box([m.plasticBlue, m.plasticGreen, m.plasticYellow, m.plasticRed][i], 0.08, 0.14, 0.16, x + 0.85 + i * 0.1, 1.0, z + 0.2, { r: 0.01 }));
    screen("analyzer-screen", "analyzer", "ANALISADOR MOLECULAR", 1.04, 0.3, x, 1.325, z + 0.312, { rx: -0.12, res: 640, targetId: "analyzer", accent: "#5ab8ff" });
    b.collider(x, z, 2.5, 1.05);
    b.contactShadow(x, z, 2.8, 1.4, 0.7);
  }

  // --- Sequenciador -----------------------------------------------------------
  {
    const x = 7.05, z = -8.7;
    b.box(m.casing, 1.7, 1.2, 0.95, x, 0.62, z, { r: 0.05, bevelSegments: 3 });
    b.box(m.rubber, 1.6, 0.04, 0.85, x, 0.02, z, { r: 0.01 });
    b.box(m.casing, 1.7, 0.42, 0.75, x, 1.43, z - 0.1, { r: 0.08, bevelSegments: 3 });
    b.box(m.panelBlack, 1.5, 0.7, 0.02, x, 0.72, z + 0.47, { r: 0.03 });
    // Baia de célula de fluxo iluminada.
    b.box(m.casingDark, 0.9, 0.16, 0.06, x - 0.2, 0.86, z + 0.47, { r: 0.02 });
    const flow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.02), m.accent);
    flow.position.set(x - 0.2, 0.86, z + 0.505);
    scene.add(flow);
    glowTarget("sequencer", flow);
    for (let i = 0; i < 5; i += 1) b.box(i % 2 ? m.ledAmber : m.ledGreen, 0.05, 0.012, 0.004, x + 0.45 + i * 0.07, 1.0, z + 0.482, { r: 0, cast: false });
    b.box(m.accent, 1.7, 0.012, 0.012, x, 1.23, z + 0.475, { r: 0, cast: false });
    // Torre de leitura e tela.
    b.box(m.casingGrey, 0.5, 0.75, 0.5, x - 0.55, 1.98, z - 0.15, { r: 0.04 });
    b.box(m.casingGrey, 0.5, 0.75, 0.5, x + 0.55, 1.98, z - 0.15, { r: 0.04 });
    [-0.55, 0.55].forEach((dx) => {
      for (let i = 0; i < 6; i += 1) b.box(m.panelBlack, 0.36, 0.015, 0.01, x + dx, 1.75 + i * 0.08, z + 0.105, { r: 0 });
    });
    screen("sequencer-screen", "sequencer", "SEQUENCIADOR · LEITURAS", 0.68, 0.44, x, 1.66, z + 0.3, { rx: -0.25, res: 640, targetId: "sequencer", accent: "#5ab8ff" });
    b.box(m.panelBlack, 0.74, 0.5, 0.03, x, 1.66, z + 0.27, { r: 0.02, rx: -0.25 });
    b.collider(x, z, 1.8, 1.05);
    b.contactShadow(x, z, 2.1, 1.3, 0.7);
  }

  // Cilindros de gás presos à parede do fundo.
  [8.55, 9.0].forEach((x, i) => {
    b.lathe(i ? m.plasticGreen : m.casingGrey, [[0, 0], [0.15, 0], [0.16, 0.05], [0.16, 1.3], [0.12, 1.42], [0.05, 1.48], [0, 1.48]], x, 0, zb + 0.32, { seg: 20 });
    b.cylinder(m.chrome, 0.03, 0.03, 0.12, x, 1.54, zb + 0.32, { seg: 10 });
    b.box(m.steelDark, 0.04, 0.04, 0.04, x, 1.62, zb + 0.32, { r: 0.008 });
  });
  b.box(m.steelDark, 0.9, 0.03, 0.03, 8.78, 1.2, zb + 0.15, { r: 0.008 });
  b.collider(8.78, zb + 0.35, 0.9, 0.5);
  b.contactShadow(8.78, zb + 0.35, 1.1, 0.7, 0.6);

  // --- Estação de PCR ------------------------------------------------------
  {
    const x = -7.15, z = -3.1;
    // Carrinho inox.
    b.box(m.steel, 1.6, 0.04, 0.8, x, 0.86, z, { r: 0.01 });
    b.box(m.steel, 1.56, 0.03, 0.76, x, 0.3, z, { r: 0.01 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      b.cylinder(m.steel, 0.018, 0.018, 0.78, x + sx * 0.76, 0.48, z + sz * 0.36, { seg: 10 });
      b.sphere(m.rubber, 0.04, x + sx * 0.74, 0.04, z + sz * 0.34, { seg: 10, rings: 8 });
    });
    // Termociclador.
    b.box(m.casing, 0.72, 0.3, 0.6, x - 0.3, 1.03, z - 0.05, { r: 0.04, bevelSegments: 3 });
    b.box(m.casingGrey, 0.66, 0.08, 0.56, x - 0.3, 1.25, z - 0.12, { r: 0.03, rx: -0.45 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.28), m.accent);
    block.position.set(x - 0.3, 1.185, z + 0.06);
    scene.add(block);
    glowTarget("pcr-machine", block);
    for (let i = 0; i < 24; i += 1) b.cylinder(m.bottleClear, 0.012, 0.01, 0.03, x - 0.47 + (i % 8) * 0.048, 1.2, z - 0.02 + Math.floor(i / 8) * 0.07, { seg: 8, cast: false });
    b.box(m.panelBlack, 0.3, 0.2, 0.02, x - 0.3, 1.02, z + 0.255, { r: 0.01, rx: -0.15 });
    // Segundo equipamento: mini-centrífuga e vortex.
    b.lathe(m.casing, [[0, 0], [0.09, 0], [0.1, 0.06], [0.08, 0.1], [0, 0.1]], x + 0.4, 0.88, z - 0.15, { seg: 20 });
    b.box(m.casingDark, 0.14, 0.09, 0.16, x + 0.62, 0.925, z - 0.12, { r: 0.02 });
    screen("pcr-screen", "pcr", "TERMOCICLADOR · PCR", 0.46, 0.3, x + 0.55, 1.2, z + 0.32, { ry: -0.3, rx: -0.12, res: 512, targetId: "pcr-machine", accent: "#b793ff" });
    b.box(m.panelBlack, 0.5, 0.34, 0.03, x + 0.545, 1.2, z + 0.3, { r: 0.012, ry: -0.3, rx: -0.12 });
    b.box(m.aluminium, 0.04, 0.32, 0.04, x + 0.53, 1.0, z + 0.26, { r: 0.008 });
    b.collider(x, z, 1.7, 0.9);
    b.contactShadow(x, z, 1.9, 1.1, 0.55);
  }

  // --- Capela de exaustão (parede esquerda) ----------------------------------
  {
    const x = ROOM.minX + 0.48, z = -5.6, w = 2.0;
    b.box(m.casingWarm, 0.9, 0.88, w, x, 0.44, z, { r: 0.02 });
    b.box(m.resin, 0.95, 0.04, w + 0.04, x, 0.9, z, { r: 0.008 });
    b.box(m.casing, 0.9, 0.2, w, x, 2.32, z, { r: 0.02 });
    [-1, 1].forEach((s) => b.box(m.casing, 0.9, 1.25, 0.08, x, 1.55, z + s * (w / 2 - 0.04), { r: 0.015 }));
    b.box(m.casingGrey, 0.06, 1.3, w - 0.16, x - 0.42, 1.55, z, { r: 0 });
    b.box(m.lightPanel, 0.3, 0.015, w - 0.3, x, 2.2, z, { r: 0, cast: false });
    b.box(m.glassTinted, 0.02, 0.8, w - 0.2, x + 0.4, 1.66, z, { r: 0, cast: false, receive: false, rz: 0.12 });
    b.box(m.aluminium, 0.05, 0.04, w - 0.16, x + 0.44, 1.26, z, { r: 0.01 });
    b.box(m.aluminium, 0.3, 0.3, 0.3, x, 2.6, z, { r: 0.01 });
    b.cylinder(m.aluminium, 0.15, 0.15, 1.8, x, 3.55, z, { seg: 20 });
    erlenmeyer(x + 0.1, z - 0.3, m.liquidGreen, 0.9);
    bottle(x - 0.1, 0.92, z + 0.4, 0.22, 0.05, m.bottleAmber, m.plasticRed);
    const fumeLight = new THREE.PointLight(0xdff4f1, 1.2, 2.4, 2);
    fumeLight.position.set(x, 1.9, z);
    scene.add(fumeLight);
    b.collider(x, z, 0.96, w + 0.04);
    b.contactShadow(x, z, 1.2, w + 0.3, 0.6);
  }

  // --- Armário de vidro com reagentes (parede direita) ----------------------
  {
    const x = ROOM.maxX - 0.3, z = -5.0, w = 1.6;
    b.box(m.casingGrey, 0.56, 2.2, w, x, 1.1, z, { r: 0.02 });
    b.box(m.panelBlack, 0.5, 2.0, w - 0.1, x + 0.02, 1.12, z, { r: 0 });
    [0.5, 0.95, 1.4, 1.85].forEach((y) => {
      b.box(m.glassFrosted, 0.46, 0.015, w - 0.12, x, y, z, { r: 0, cast: false });
      let k = Math.round(y * 10);
      for (let zz = z - w / 2 + 0.14; zz < z + w / 2 - 0.12;) {
        const rnd = Math.abs(Math.sin(k * 78.233) * 43758.5453) % 1;
        const r = 0.035 + rnd * 0.03;
        bottle(x - 0.05 + (rnd - 0.5) * 0.1, y + 0.008, zz, 0.12 + rnd * 0.16, r, rnd > 0.5 ? m.bottleAmber : m.bottleClear, [m.plasticBlue, m.rubber, m.plasticRed, m.casing][k % 4]);
        zz += r * 2 + 0.04;
        k += 1;
      }
    });
    b.box(m.glass, 0.02, 1.95, w / 2 - 0.03, x - 0.29, 1.12, z - w / 4, { r: 0, cast: false, receive: false });
    b.box(m.glass, 0.02, 1.95, w / 2 - 0.03, x - 0.29, 1.12, z + w / 4, { r: 0, cast: false, receive: false });
    [-1, 1].forEach((s) => b.box(m.aluminium, 0.03, 0.3, 0.02, x - 0.31, 1.2, z + s * 0.06, { r: 0.006 }));
    b.collider(x, z, 0.6, w + 0.04);
    b.contactShadow(x, z, 0.9, w + 0.3, 0.6);
  }

  // --- Console de vacinas (biorreator) --------------------------------------
  let vaccineLiquid;
  {
    const x = 7.25, z = -2.3;
    b.box(m.steel, 2.2, 0.88, 0.9, x, 0.44, z, { r: 0.02 });
    b.box(m.resin, 2.3, 0.05, 1.0, x, 0.905, z, { r: 0.01 });
    [-0.55, 0.55].forEach((dx) => b.box(m.steelDark, 1.0, 0.75, 0.02, x + dx, 0.45, z + 0.455, { r: 0.004 }));
    // Vaso do biorreator.
    const vx = x + 0.45, vy = 0.93;
    b.lathe(m.steel, [[0, 0], [0.34, 0], [0.36, 0.06], [0.34, 0.1], [0, 0.1]], vx, vy, z - 0.05, { seg: 36 });
    b.lathe(m.glass, [[0.28, 0.1], [0.3, 0.12], [0.3, 0.78], [0.28, 0.8]], vx, vy, z - 0.05, { seg: 36, cast: false, receive: false });
    b.lathe(m.steel, [[0, 0.8], [0.32, 0.8], [0.33, 0.84], [0.3, 0.88], [0.08, 0.9], [0, 0.9]], vx, vy, z - 0.05, { seg: 36 });
    b.cylinder(m.casingDark, 0.07, 0.08, 0.16, vx, vy + 0.98, z - 0.05, { seg: 20 });
    b.cylinder(m.chrome, 0.012, 0.012, 0.7, vx, vy + 0.48, z - 0.05, { seg: 8 });
    [[-0.14, 0.1], [0.12, -0.12], [0.05, 0.16]].forEach(([ox, oz]) => {
      b.cylinder(m.chrome, 0.015, 0.015, 0.2, vx + ox, vy + 0.95, z - 0.05 + oz, { seg: 8 });
    });
    b.tube(m.rubber, [[vx - 0.14, vy + 1.05, z + 0.05], [vx - 0.3, vy + 1.25, z], [vx - 0.7, vy + 1.05, z - 0.2], [vx - 0.9, vy + 0.2, z - 0.3]], 0.012, { radial: 6 });
    b.tube(m.plasticBlue, [[vx + 0.12, vy + 1.05, z - 0.17], [vx + 0.3, vy + 1.2, z - 0.2], [vx + 0.55, vy + 0.6, z - 0.35], [vx + 0.6, vy + 0.06, z - 0.35]], 0.01, { radial: 6 });
    vaccineLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.5, 36), new THREE.MeshStandardMaterial({
      color: 0x0f3a30, roughness: 0.15, emissive: new THREE.Color("#2fe0a8"), emissiveIntensity: 1.1, transparent: true, opacity: 0.82,
    }));
    vaccineLiquid.position.set(vx, vy + 0.37, z - 0.05);
    vaccineLiquid.renderOrder = 2;
    scene.add(vaccineLiquid);
    glowTarget("vaccine-console", vaccineLiquid);
    // Bolhas subindo no meio de cultura.
    const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8fff2, emissive: 0x6fffd0, emissiveIntensity: 0.8, transparent: true, opacity: 0.7, roughness: 0.1 }), 40);
    const seeds = Array.from({ length: 40 }, (_, i) => [Math.random(), Math.random(), Math.random(), i]);
    const bm = new THREE.Matrix4();
    bubbles.renderOrder = 3;
    scene.add(bubbles);
    animated.push((time, reduced) => {
      seeds.forEach(([a, r, s, i]) => {
        const t = reduced ? s : (time * 0.00025 * (0.6 + s) + s) % 1;
        const ang = a * Math.PI * 2 + t * 2;
        const rr = 0.04 + r * 0.22;
        bm.makeTranslation(vx + Math.cos(ang) * rr, vy + 0.13 + t * 0.48, z - 0.05 + Math.sin(ang) * rr);
        bubbles.setMatrixAt(i, bm);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    });
    // Braço com monitor de controle.
    b.box(m.aluminium, 0.05, 0.5, 0.05, x - 0.55, 1.18, z - 0.3, { r: 0.01 });
    screen("vaccine-screen", "vaccine", "PROGRAMA DE VACINA · CANDIDATA P-08", 0.82, 0.48, x - 0.55, 1.6, z + 0.32, { rx: -0.12, res: 640, targetId: "vaccine-console", accent: "#5af0ad" });
    b.box(m.panelBlack, 0.88, 0.54, 0.03, x - 0.55, 1.6, z + 0.295, { r: 0.012, rx: -0.12 });
    b.box(m.casingDark, 0.4, 0.3, 0.05, x - 0.55, 1.6, z + 0.25, { r: 0.012, rx: -0.12 });
    b.collider(x, z, 2.3, 1.0);
    b.contactShadow(x, z, 2.6, 1.3, 0.7);
  }

  // Lixeiras de risco biológico e lava-olhos.
  const bin = (x, z, mat, h = 0.6) => {
    b.lathe(mat, [[0, 0], [0.18, 0], [0.21, h], [0, h]], x, 0, z, { seg: 20 });
    b.lathe(mat, [[0, h], [0.23, h], [0.22, h + 0.04], [0, h + 0.05]], x, 0, z, { seg: 20 });
    b.circleCollider(x, z, 0.22);
    b.contactShadow(x, z, 0.6, 0.6, 0.5);
  };
  bin(-4.6, -9.95, m.plasticYellow);
  bin(-4.15, -10.0, m.plasticRed, 0.5);
  bin(9.05, -1.0, m.plasticYellow);
  b.box(m.casingDark, 0.5, 0.06, 0.3, 6.2, 1.0, dz - 0.25, { r: 0.01 });
  b.lathe(m.plasticGreen, [[0, 0], [0.16, 0], [0.18, 0.08], [0, 0.08]], 6.2, 1.03, dz - 0.3, { seg: 20 });
  b.cylinder(m.chrome, 0.012, 0.012, 1.0, 6.2, 0.5, dz - 0.2, { seg: 8 });

  // Guias luminosas no piso (rota até a porta).
  b.box(m.accentSoft, 0.04, 0.006, 4.3, doorCx, 0.008, -1.45, { r: 0, cast: false });
  b.box(m.accentSoft, 0.04, 0.006, 2.2, doorCx, 0.008, 2.2, { r: 0, cast: false });
  // Faixa de segurança pintada ao redor da área de trabalho.
  [[-4.6, -9.3, 9.6, 0.05], [-4.6, -6.7, 9.6, 0.05]].forEach(([x, z, w, d]) => b.box(m.hazard, w, 0.004, d, x, 0.004, z, { r: 0, cast: false }));

  // =======================================================================
  // ALA DE TRIAGEM
  // =======================================================================

  // --- Terminal do Dr. Caio ----------------------------------------------
  {
    const x = 4.4, z = 5.55;
    b.box(m.resin, 2.4, 0.05, 0.95, x, 0.75, z, { r: 0.012 });
    b.box(m.casingDark, 2.3, 0.5, 0.03, x, 0.48, z + 0.42, { r: 0.006 });
    [[-1.12, 1], [1.12, 1]].forEach(([dx]) => b.box(m.steelDark, 0.05, 0.73, 0.85, x + dx, 0.365, z, { r: 0.01 }));
    b.box(m.casingWarm, 0.5, 0.65, 0.8, x + 0.8, 0.33, z, { r: 0.02 });
    monitor(x, 1.42, z + 0.25, 1.22, 0.72, Math.PI, { id: "caio-screen", kind: "caio", title: "CHAMADA REMOTA · EPIDEMIOLOGIA", res: 768, targetId: "caio-terminal", accent: "#72c9ff", intensity: 1.4 }, { tilt: -0.05, standHeight: 0.32 });
    monitor(x - 1.0, 1.15, z + 0.2, 0.5, 0.32, Math.PI + 0.45, { kind: "map", title: "NOTIFICAÇÕES", res: 384, accent: "#72c9ff", intensity: 1.2 }, { standHeight: 0.24 });
    b.box(m.casingDark, 0.5, 0.02, 0.17, x, 0.785, z - 0.15, { r: 0.006 });
    b.box(m.casingDark, 0.07, 0.025, 0.11, x + 0.38, 0.785, z - 0.15, { r: 0.012 });
    b.lathe(m.casing, [[0, 0], [0.04, 0], [0.042, 0.1], [0, 0.1]], x - 0.6, 0.775, z - 0.2, { seg: 16 });
    b.box(m.paper, 0.21, 0.004, 0.3, x + 0.7, 0.777, z - 0.05, { r: 0, ry: 0.2 });
    // Cadeira de escritório.
    const cx = x - 0.1, cz = z - 0.95;
    b.lathe(m.steelDark, [[0, 0.06], [0.3, 0.05], [0.32, 0.07], [0.05, 0.12], [0, 0.12]], cx, 0, cz, { seg: 5 });
    b.cylinder(m.chrome, 0.03, 0.03, 0.32, cx, 0.28, cz, { seg: 12 });
    b.box(m.cushion, 0.5, 0.08, 0.48, cx, 0.48, cz, { r: 0.04 });
    b.box(m.cushion, 0.46, 0.55, 0.07, cx, 0.85, cz - 0.24, { r: 0.04, rx: -0.1 });
    b.box(m.steelDark, 0.05, 0.3, 0.04, cx, 0.6, cz - 0.24, { r: 0.01 });
    b.circleCollider(cx, cz, 0.3);
    b.collider(x, z, 2.4, 0.98);
    b.contactShadow(x, z, 2.7, 1.3, 0.65);
    b.contactShadow(cx, cz, 0.8, 0.8, 0.5);
  }

  // --- Armário de amostras (refrigerador de biossegurança) ---------------
  let sampleVial, lockerLed;
  {
    const x = -5.9, z = 10.2;
    // Gabinete oco (laterais, fundo, teto e base) para que o interior apareça pelo vidro.
    [-0.62, 0.62].forEach((dx) => b.box(m.casing, 0.06, 2.1, 0.76, x + dx, 1.05, z, { r: 0.02 }));
    b.box(m.casing, 1.3, 0.3, 0.76, x, 1.95, z, { r: 0.03 });
    b.box(m.casing, 1.3, 0.2, 0.76, x, 0.1, z, { r: 0.02 });
    b.box(m.casingGrey, 1.3, 0.06, 0.78, x, 0.03, z, { r: 0.01 });
    b.box(m.casingDark, 1.2, 1.7, 0.04, x, 1.05, z + 0.35, { r: 0 });
    b.box(m.steelDark, 1.18, 1.6, 0.6, x, 1.0, z + 0.36, { r: 0, sz: 0.01 });
    b.box(m.lightPanel, 1.0, 0.015, 0.05, x, 1.78, z - 0.2, { r: 0, cast: false });
    [0.45, 0.85, 1.25, 1.62].forEach((y) => {
      b.box(m.steel, 1.08, 0.012, 0.5, x, y, z, { r: 0, cast: false });
      for (let i = 0; i < 7; i += 1) {
        if (y === 1.25 && i === 3) continue;
        b.box(i % 2 ? m.plasticBlue : m.casing, 0.11, 0.07, 0.14, x - 0.42 + i * 0.14, y + 0.04, z + 0.05, { r: 0.006 });
      }
    });
    // Moldura da porta de vidro (quatro perfis, sem cobrir o vidro).
    [[0, 1.86, 1.22, 0.06], [0, 0.18, 1.22, 0.06]].forEach(([dx, y, w, h]) => b.box(m.aluminium, w, h, 0.05, x + dx, y, z - 0.37, { r: 0.01 }));
    [-0.59, 0.59].forEach((dx) => b.box(m.aluminium, 0.05, 1.72, 0.05, x + dx, 1.02, z - 0.37, { r: 0.01 }));
    b.box(m.glass, 1.12, 1.6, 0.02, x, 1.02, z - 0.395, { r: 0, cast: false, receive: false });
    b.box(m.steel, 0.03, 0.6, 0.04, x + 0.52, 1.1, z - 0.43, { r: 0.012 });
    b.box(m.panelBlack, 0.5, 0.14, 0.02, x, 1.95, z - 0.385, { r: 0.008 });
    lockerLed = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.006), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x5ab8ff, emissiveIntensity: 3 }));
    lockerLed.position.set(x, 1.95, z - 0.399);
    scene.add(lockerLed);
    // Amostra #001: frasco luminoso no suporte central.
    sampleVial = new THREE.Group();
    sampleVial.position.set(x, 1.27, z - 0.05);
    const vialGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.16, 16), m.bottleClear);
    const vialLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.09, 16), new THREE.MeshStandardMaterial({ color: 0x0b2a3a, emissive: 0x80cfff, emissiveIntensity: 2.6 }));
    vialLiquid.position.y = -0.03;
    const vialCap = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.035, 16), m.plasticRed);
    vialCap.position.y = 0.095;
    vialGlass.position.y = 0;
    sampleVial.add(vialLiquid, vialGlass, vialCap);
    sampleVial.position.y += 0.08;
    const vialLight = new THREE.PointLight(0x80cfff, 0.8, 1.4, 2);
    sampleVial.add(vialLight);
    scene.add(sampleVial);
    glowTarget("sample-locker", lockerLed);
    b.collider(x, z, 1.4, 0.86);
    b.contactShadow(x, z - 0.1, 1.6, 1.1, 0.7);
    // Ultrafreezer ao lado.
    b.box(m.casing, 0.9, 1.0, 0.8, x - 1.4, 0.5, z, { r: 0.04 });
    b.box(m.casingGrey, 0.92, 0.06, 0.82, x - 1.4, 1.03, z, { r: 0.02 });
    b.box(m.panelBlack, 0.24, 0.1, 0.01, x - 1.4, 0.82, z - 0.405, { r: 0.004 });
    b.box(m.ledGreen, 0.05, 0.015, 0.004, x - 1.45, 0.82, z - 0.412, { r: 0, cast: false });
    b.collider(x - 1.4, z, 0.95, 0.86);
    b.contactShadow(x - 1.4, z, 1.2, 1.1, 0.6);
  }

  // --- Leitos de observação (isolamento) ---------------------------------
  [3.2, 5.95].forEach((z, i) => {
    const x = -7.85;
    b.box(m.casingWarm, 2.1, 0.5, 0.85, x, 0.3, z, { r: 0.04 });
    b.box(m.rubber, 1.9, 0.05, 0.7, x, 0.03, z, { r: 0.01 });
    b.box(m.fabric, 1.96, 0.12, 0.75, x, 0.6, z, { r: 0.05, bevelSegments: 3 });
    b.box(m.paper, 0.4, 0.08, 0.5, x - 0.75, 0.7, z, { r: 0.04 });
    b.cylinder(m.glass, 0.45, 0.45, 2.0, x, 0.66, z, { rz: Math.PI / 2, seg: 32, open: true, cast: false, receive: false, sx: 1, sz: 0.9 });
    b.box(m.aluminium, 2.08, 0.04, 0.04, x, 1.1, z, { r: 0.01 });
    [-1, 1].forEach((s) => b.torus(m.aluminium, 0.45, 0.012, x + s * 1.0, 0.66, z, { ry: Math.PI / 2, arc: Math.PI, radial: 6, tubular: 24 }));
    // Monitor de sinais vitais em pedestal.
    const mx2 = x + 1.35;
    b.lathe(m.steelDark, [[0, 0.04], [0.25, 0.03], [0.26, 0.05], [0.04, 0.08], [0, 0.08]], mx2, 0, z - 0.3, { seg: 5 });
    b.cylinder(m.chrome, 0.02, 0.02, 1.2, mx2, 0.66, z - 0.3, { seg: 10 });
    monitor(mx2, 1.42, z - 0.3, 0.42, 0.3, Math.PI / 2 + 0.35, { kind: "vitals", title: `LEITO 0${i + 1}`, res: 384, accent: i ? "#ffb84d" : "#58f4c2", intensity: 1.3 }, { stand: false });
    b.collider(x, z, 2.2, 0.95);
    b.circleCollider(mx2, z - 0.3, 0.28);
    b.contactShadow(x, z, 2.5, 1.2, 0.7);
  });

  // --- Mesa do mapa epidemiológico ---------------------------------------
  {
    const x = -2.0, z = 7.1;
    b.box(m.casingDark, 2.3, 0.85, 1.3, x, 0.43, z, { r: 0.04 });
    b.box(m.casingGrey, 2.8, 0.08, 1.9, x, 0.9, z, { r: 0.03 });
    b.box(m.accent, 2.82, 0.012, 1.92, x, 0.862, z, { r: 0, cast: false });
    screen("outbreak-map-screen", "map", "MAPA EPIDEMIOLÓGICO · SETOR AURORA", 2.6, 1.7, x, 0.945, z, { rx: -Math.PI / 2, res: 1024, targetId: "outbreak-map", accent: "#ffb84d", intensity: 1.2 });
    // Pinos holográficos de casos sobre o mapa.
    const pinMat = createHologramMaterial("#ff655f", { opacity: 1.4, scan: 0.4 });
    const pinMat2 = createHologramMaterial("#ffb84d", { opacity: 1.4, scan: 0.4 });
    holograms.push(pinMat, pinMat2);
    const pins = new THREE.Group();
    [[0.22, 0.4], [0.38, 0.62], [0.55, 0.36], [0.7, 0.58], [0.82, 0.3], [0.3, 0.8]].forEach(([u, v], i) => {
      const px = x - 1.3 + u * 2.6, pz = z - 0.85 + v * 1.7;
      const h = 0.12 + (i < 2 ? 0.2 : 0.08);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, h, 10), i < 2 ? pinMat : pinMat2);
      pin.position.set(px, 0.95 + h / 2, pz);
      pins.add(pin);
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), i < 2 ? pinMat : pinMat2);
      cap.position.set(px, 0.95 + h + 0.03, pz);
      pins.add(cap);
    });
    scene.add(pins);
    animated.push((time, reduced) => {
      pins.children.forEach((child, k) => { if (k % 2 && !reduced) child.rotation.y = time * 0.002 + k; });
    });
    b.collider(x, z, 2.84, 1.94);
    b.contactShadow(x, z, 3.0, 2.1, 0.7);
  }

  // --- Console de resposta ------------------------------------------------
  {
    const x = 7.0, z = 7.0;
    b.box(m.resin, 2.7, 0.05, 0.95, x, 0.76, z, { r: 0.012 });
    b.box(m.casingDark, 2.6, 0.72, 0.85, x, 0.37, z + 0.02, { r: 0.02 });
    b.box(m.accent, 2.7, 0.012, 0.012, x, 0.73, z - 0.48, { r: 0, cast: false });
    monitor(x, 1.45, z + 0.22, 1.1, 0.6, Math.PI, { id: "response-screen", kind: "response", title: "PLANO DE RESPOSTA · 72 H", res: 768, targetId: "response-console", accent: "#ffb84d", intensity: 1.45 }, { standHeight: 0.38 });
    monitor(x - 1.05, 1.35, z + 0.1, 0.62, 0.38, Math.PI + 0.5, { kind: "vitals", title: "LEITOS DISPONÍVEIS", res: 384, accent: "#ffb84d", intensity: 1.2 }, { standHeight: 0.28 });
    monitor(x + 1.05, 1.35, z + 0.1, 0.62, 0.38, Math.PI - 0.5, { kind: "map", title: "EQUIPES EM CAMPO", res: 384, accent: "#ffb84d", intensity: 1.2 }, { standHeight: 0.28 });
    b.box(m.casingDark, 0.5, 0.02, 0.17, x, 0.795, z - 0.2, { r: 0.006 });
    b.collider(x, z, 2.7, 0.98);
    b.contactShadow(x, z, 3.0, 1.3, 0.65);
  }

  // --- Mesa de decisão final (projeção holográfica da cidade) ------------
  let cityGroup, cityMat;
  {
    const x = 0.9, z = 5.7, r = 1.05;
    b.lathe(m.casingDark, [[0, 0], [0.55, 0], [0.5, 0.06], [0.22, 0.12], [0.2, 0.8], [0.6, 0.86], [r, 0.88], [r, 0.94], [0.95, 0.97], [0, 0.97]], x, 0, z, { seg: 64 });
    b.torus(m.accent, r - 0.01, 0.012, x, 0.94, z, { rx: Math.PI / 2, radial: 6, tubular: 96, cast: false });
    b.cylinder(m.panelBlack, 0.9, 0.9, 0.01, x, 0.975, z, { seg: 64 });
    cityMat = createHologramMaterial("#ffc25a", { opacity: 1.0, scan: 0.6 });
    holograms.push(cityMat);
    cityGroup = new THREE.Group();
    cityGroup.position.set(x, 1.0, z);
    const bm = new THREE.Matrix4();
    const geos = [];
    for (let i = 0; i < 70; i += 1) {
      const a = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      const c = Math.abs(Math.sin(i * 78.233) * 12345.678) % 1;
      const ang = a * Math.PI * 2, rad = Math.sqrt(c) * 0.72;
      const hgt = 0.04 + Math.pow(1 - rad / 0.75, 2) * 0.3 * (0.4 + (i % 5) / 5);
      const g = new THREE.BoxGeometry(0.06 + (i % 3) * 0.015, hgt, 0.06 + (i % 4) * 0.012);
      bm.makeTranslation(Math.cos(ang) * rad, hgt / 2, Math.sin(ang) * rad);
      g.applyMatrix4(bm);
      geos.push(g);
    }
    const merged = mergeBoxes(geos);
    cityGroup.add(new THREE.Mesh(merged, cityMat));
    const ringM = createHologramMaterial("#ffc25a", { opacity: 1.3, scan: 0.2 });
    holograms.push(ringM);
    [0.78, 0.86].forEach((rr, k) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.004, 6, 96, k ? Math.PI * 1.5 : Math.PI * 2), ringM);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02 + k * 0.03;
      cityGroup.add(ring);
    });
    addDepthPrepass(cityGroup);
    scene.add(cityGroup);
    const cityBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.88, 0.6, 48, 1, true), createBeamMaterial("#ffc25a", 0.12));
    cityBeam.position.set(x, 0.98 + 0.3, z);
    cityBeam.renderOrder = 9;
    scene.add(cityBeam);
    holograms.push(cityBeam.material);
    animated.push((time, reduced) => { if (!reduced) cityGroup.rotation.y = time * 0.00012; });
    b.box(m.casingDark, 0.62, 0.05, 0.4, x, 0.985, z - 0.84, { r: 0.012, rx: -0.35 });
    screen("final-screen", "final", "MESA DE DECISÃO", 0.54, 0.32, x, 1.015, z - 0.85, { ry: Math.PI, rx: -1.22, res: 384, targetId: "final-console", accent: "#ffc25a", intensity: 1.3 });
    b.circleCollider(x, z, r + 0.02);
    b.contactShadow(x, z, 2.4, 2.4, 0.65);
  }

  // --- Porta de saída e sinalização --------------------------------------
  {
    const x = 3.4, z = ROOM.maxZ;
    b.box(m.casingGrey, 2.0, 2.4, 0.08, x, 1.2, z - 0.04, { r: 0.01 });
    [-0.49, 0.49].forEach((dx) => {
      b.box(m.casingWarm, 0.92, 2.2, 0.05, x + dx, 1.12, z - 0.09, { r: 0.01 });
      b.box(m.glassTinted, 0.3, 0.6, 0.02, x + dx, 1.65, z - 0.12, { r: 0 });
      b.box(m.steel, 0.7, 0.05, 0.06, x + dx, 1.02, z - 0.15, { r: 0.02 });
    });
    const exit = signTexture("exit");
    const mat = new THREE.MeshStandardMaterial({ map: exit, emissive: 0xffffff, emissiveMap: exit, emissiveIntensity: 1.4 });
    const sgn = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.06), [m.casing, m.casing, m.casing, m.casing, m.casing, mat]);
    sgn.position.set(x, 2.62, z - 0.05);
    sgn.rotation.y = Math.PI;
    scene.add(sgn);
  }

  // Quadro de avisos de cortiça.
  b.box(m.aluminium, 1.6, 1.0, 0.04, -1.6, 1.65, ROOM.maxZ - 0.02, { r: 0.01 });
  b.box(m.cork, 1.52, 0.92, 0.03, -1.6, 1.65, ROOM.maxZ - 0.05, { r: 0 });
  [[-2.1, 1.85, 0.05], [-1.7, 1.5, -0.08], [-1.25, 1.8, 0.12], [-1.0, 1.45, -0.04], [-1.9, 1.4, 0.1]].forEach(([x, y, rz], i) => {
    b.box(i === 2 ? m.plasticYellow : m.paper, 0.24, 0.32, 0.004, x, y, ROOM.maxZ - 0.07, { r: 0, rz });
  });

  // Banco de espera sob a janela, planta e bebedouro.
  b.box(m.steelDark, 0.5, 0.06, 2.4, ROOM.maxX - 0.4, 0.45, 3.7, { r: 0.02 });
  b.box(m.cushion, 0.48, 0.08, 2.36, ROOM.maxX - 0.4, 0.51, 3.7, { r: 0.03 });
  [2.7, 4.7].forEach((z) => b.box(m.steelDark, 0.4, 0.42, 0.05, ROOM.maxX - 0.4, 0.21, z, { r: 0.01 }));
  b.collider(ROOM.maxX - 0.4, 3.7, 0.55, 2.45);
  b.contactShadow(ROOM.maxX - 0.4, 3.7, 0.8, 2.7, 0.5);
  const plant = (x, z, s = 1) => {
    b.lathe(m.casingDark, [[0, 0], [0.2 * s, 0], [0.26 * s, 0.5 * s], [0.27 * s, 0.52 * s], [0, 0.52 * s]], x, 0, z, { seg: 24 });
    b.cylinder(m.soil, 0.25 * s, 0.25 * s, 0.02, x, 0.5 * s, z, { seg: 20 });
    for (let i = 0; i < 14; i += 1) {
      const a = i * 2.4, tilt = 0.35 + (i % 4) * 0.15, len = (0.5 + (i % 3) * 0.2) * s;
      const leaf = new THREE.PlaneGeometry(0.09 * s, len);
      leaf.translate(0, len / 2, 0);
      b.add(m.plant, leaf, matrixFrom(x, 0.5 * s, z, { ry: a, rx: tilt }), { cast: true });
    }
    b.circleCollider(x, z, 0.3 * s);
    b.contactShadow(x, z, 0.8 * s, 0.8 * s, 0.5);
  };
  plant(ROOM.maxX - 0.45, 9.9, 1.1);
  plant(ROOM.minX + 0.45, 1.6, 0.9);
  b.box(m.casing, 0.4, 1.05, 0.4, 0.6, 0.525, ROOM.maxZ - 0.3, { r: 0.04 });
  b.lathe(m.glassTinted, [[0, 0], [0.15, 0], [0.16, 0.35], [0.06, 0.42], [0, 0.42]], 0.6, 1.05, ROOM.maxZ - 0.3, { seg: 20, cast: false });
  b.collider(0.6, ROOM.maxZ - 0.3, 0.45, 0.45);
  bin(-3.4, ROOM.maxZ - 0.35, m.plasticYellow, 0.55);
  bin(8.9, 7.9, m.casingGrey, 0.55);

  // =======================================================================
  // PONTOS DE INTERAÇÃO (mesmos identificadores usados pelas missões)
  // =======================================================================
  const interactables = [
    { id: "helena", position: [-3.8, 1.55, -4.3], label: "FALAR COM HELENA", range: 3.1 },
    { id: "case-board", position: [0, 1.8, -9.85], label: "ABRIR REGISTROS", range: 3.0 },
    { id: "caio-terminal", position: [4.4, 1.55, 4.82], label: "ATENDER CHAMADA", range: 3.1 },
    { id: "sample-locker", position: [-5.9, 1.35, 8.95], label: "RETIRAR AMOSTRA", range: 3.0 },
    { id: "analyzer", position: [5.1, 1.25, -5.05], label: "USAR ANALISADOR", range: 3.2 },
    { id: "pcr-machine", position: [-7.15, 1.15, -2.35], label: "ABRIR ESTAÇÃO PCR", range: 3.1 },
    { id: "sequencer", position: [7.05, 1.55, -7.45], label: "USAR SEQUENCIADOR", range: 3.2 },
    { id: "outbreak-map", position: [-2.0, 1.25, 6.05], label: "ABRIR MAPA DO SURTO", range: 3.3 },
    { id: "response-console", position: [7.0, 1.55, 6.05], label: "PLANEJAR RESPOSTA", range: 3.2 },
    { id: "vaccine-console", position: [7.25, 1.45, -1.35], label: "ABRIR PROGRAMA DE VACINA", range: 3.2 },
    { id: "variant-terminal", position: [1.35, 1.5, -4.45], label: "COMPARAR SEQUÊNCIAS", range: 3.0 },
    { id: "final-console", position: [0.9, 1.45, 4.55], label: "INICIAR DECISÃO FINAL", range: 3.4 },
  ];

  // Colisor da projeção de Helena.
  b.circleCollider(-3.8, -4.8, 0.66);
  b.contactShadow(-3.8, -4.8, 1.7, 1.7, 0.55);

  return { screens, decorScreens, targets, animated, holograms, interactables, sampleVial, lockerLed, panels, vaccineLiquid, cityMat };
}

function mergeBoxes(geometries) {
  const positions = [], normals = [];
  geometries.forEach((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    positions.push(...ng.attributes.position.array);
    normals.push(...ng.attributes.normal.array);
    g.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}
