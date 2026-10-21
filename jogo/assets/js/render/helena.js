// Dra. Helena: diretora científica projetada como holograma.
// O corpo é construído com perfis de revolução (silhueta orgânica) e uma
// hierarquia de articulações (quadril → tronco → ombros → cotovelos, pescoço → cabeça)
// animada proceduralmente: respiração, troca de apoio, olhar que acompanha o
// jogador, gesto ao conversar e pequenas falhas de projeção.
import * as THREE from "../../vendor/three/three.module.min.js";
import { latheGeometry } from "./builder.js";
import { addDepthPrepass, createBeamMaterial, createHologramMaterial } from "./effects.js";

const P = (r, y) => [r, y];

function ellipticLathe(points, sx = 1, sz = 0.7, seg = 32, phiStart, phiLength) {
  const g = latheGeometry(points, seg, phiStart, phiLength);
  g.scale(sx, 1, sz);
  g.computeVertexNormals();
  return g;
}

function headGeometry() {
  const g = new THREE.SphereGeometry(0.1, 40, 30);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const y = v.y / 0.1;
    // Crânio levemente alongado, mandíbula afinando até o queixo.
    let sx = 0.86, sz = 1.0, sy = 1.18;
    if (y < 0) {
      const t = -y;
      sx *= 1 - t * t * 0.42;
      sz *= 1 - t * 0.12;
    }
    // Leve achatamento lateral na altura das têmporas e face mais plana.
    if (v.z > 0) sz *= 0.94;
    if (y > -0.2 && y < 0.35) sx *= 0.97;
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return g;
}

function hairGeometry() {
  // Calota que cobre topo, laterais e nuca; abre na região do rosto.
  const g = new THREE.SphereGeometry(0.112, 40, 26, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    let sx = 0.9, sy = 1.12, sz = 1.04;
    // Recorte do rosto: puxa para trás os vértices frontais baixos (linha do cabelo).
    if (v.z > 0.04 && v.y < 0.05) {
      const k = (v.z - 0.04) / 0.07;
      v.z -= k * 0.04;
      v.y += k * 0.02;
    }
    // Volume maior na nuca.
    if (v.z < 0) { sz *= 1.08; sx *= 1.03; }
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return g;
}

function capsule(radius, length, sx = 1, sz = 1) {
  const g = new THREE.CapsuleGeometry(radius, length, 8, 20);
  g.scale(sx, 1, sz);
  return g;
}

export function createHelena({ position, sprite }) {
  const root = new THREE.Group();
  root.position.set(...position);

  const color = "#6ff2cf";
  const skin = createHologramMaterial(color, { opacity: 0.95 });
  const coat = createHologramMaterial("#9dfbe3", { opacity: 1.05 });
  const dark = createHologramMaterial("#3fbfa4", { opacity: 0.85 });
  const bright = createHologramMaterial("#e8fffa", { opacity: 1.6, scan: 0.2 });
  const materials = [skin, coat, dark, bright];

  // ---------------- Projetor ----------------
  const projector = new THREE.Group();
  root.add(projector);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e999d, roughness: 0.32, metalness: 1 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1d2427, roughness: 0.5, metalness: 0.7 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x050708, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.5 });
  const ringGlow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: 3 });
  const baseProfile = [P(0, 0), P(0.6, 0), P(0.62, 0.02), P(0.62, 0.1), P(0.58, 0.14), P(0.54, 0.16), P(0.5, 0.2), P(0, 0.2)];
  const base = new THREE.Mesh(latheGeometry(baseProfile, 48), darkMetal);
  base.castShadow = true;
  base.receiveShadow = true;
  projector.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 10, 64), steel);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  projector.add(rim);
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.012, 8, 64), ringGlow);
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = 0.205;
  projector.add(glowRing);
  const lensMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.012, 48), lens);
  lensMesh.position.y = 0.206;
  projector.add(lensMesh);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.012), steel);
    vent.position.set(Math.cos(a) * 0.615, 0.06, Math.sin(a) * 0.615);
    vent.rotation.y = -a + Math.PI / 2;
    projector.add(vent);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.44, 2.05, 48, 1, true), createBeamMaterial(color, 0.22));
  beam.position.y = 0.21 + 1.025;
  beam.renderOrder = 9;
  projector.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: new THREE.Color(color), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.set(1.4, 0.35, 1);
  halo.position.y = 0.24;
  projector.add(halo);
  const light = new THREE.PointLight(new THREE.Color(color), 2.2, 4.5, 1.6);
  light.position.y = 1.1;
  root.add(light);

  // ---------------- Corpo ----------------
  const figure = new THREE.Group();
  figure.position.y = 0.215;
  root.add(figure);

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  figure.add(hips);

  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Pernas (perfil: tornozelo, panturrilha, joelho, coxa).
  const legProfile = [P(0.0, -0.84), P(0.03, -0.835), P(0.034, -0.8), P(0.042, -0.7), P(0.055, -0.58), P(0.05, -0.5), P(0.046, -0.45), P(0.052, -0.4), P(0.066, -0.28), P(0.078, -0.14), P(0.086, -0.04), P(0.084, 0.0), P(0.0, 0.02)];
  const legGeo = ellipticLathe(legProfile, 1, 0.92, 24);
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.085, 0, 0);
    leg.rotation.z = side * 0.025;
    hips.add(leg);
    mesh(legGeo, dark, leg);
    // Sapato baixo.
    const shoe = mesh(capsule(0.04, 0.12, 0.85, 1), dark, leg, 0, -0.84, 0.045);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.y = 0.55;
    return leg;
  });

  // Quadril e tronco.
  const pelvis = mesh(ellipticLathe([P(0, -0.1), P(0.12, -0.08), P(0.165, -0.02), P(0.17, 0.04), P(0.15, 0.1), P(0, 0.12)], 1, 0.66), dark, hips);
  pelvis.position.y = 0;

  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  const torsoProfile = [P(0, 0), P(0.148, 0.0), P(0.128, 0.1), P(0.124, 0.16), P(0.138, 0.24), P(0.152, 0.32), P(0.156, 0.38), P(0.15, 0.44), P(0.12, 0.49), P(0.06, 0.52), P(0, 0.53)];
  mesh(ellipticLathe(torsoProfile, 1, 0.64), skin, torso);
  // Peito: volumes discretos sob a blusa.
  [-1, 1].forEach((side) => {
    const g = new THREE.SphereGeometry(0.058, 20, 14);
    g.scale(1, 0.85, 0.72);
    mesh(g, skin, torso, side * 0.062, 0.33, 0.07);
  });

  // Jaleco aberto na frente, com gola e lapelas.
  const coatProfile = [P(0.235, -0.5), P(0.215, -0.32), P(0.195, -0.12), P(0.17, 0.02), P(0.15, 0.12), P(0.148, 0.18), P(0.162, 0.28), P(0.172, 0.38), P(0.168, 0.45), P(0.14, 0.5), P(0.09, 0.535), P(0.07, 0.55)];
  const coatGeo = ellipticLathe(coatProfile, 1.02, 0.72, 40, Math.PI * 0.62, Math.PI * 1.76);
  const coatMesh = mesh(coatGeo, coat, torso);
  coatMesh.material.side = THREE.DoubleSide;
  [-1, 1].forEach((side) => {
    const lapel = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.012), coat, torso, side * 0.06, 0.4, 0.105);
    lapel.rotation.set(-0.15, 0, side * 0.35);
    const pocket = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.008), coat, torso, side * 0.13, -0.2, 0.13);
    pocket.rotation.y = side * 0.45;
  });
  // Crachá luminoso.
  mesh(new THREE.BoxGeometry(0.045, 0.06, 0.006), bright, torso, 0.1, 0.33, 0.118).rotation.y = 0.35;

  // Pescoço e cabeça.
  const neck = new THREE.Group();
  neck.position.y = 0.5;
  torso.add(neck);
  mesh(ellipticLathe([P(0.046, 0), P(0.043, 0.06), P(0.044, 0.11), P(0.0, 0.12)], 1, 0.95, 20), skin, neck);
  const head = new THREE.Group();
  head.position.set(0, 0.17, 0.008);
  neck.add(head);
  mesh(headGeometry(), skin, head);
  mesh(hairGeometry(), dark, head, 0, 0.012, -0.006);
  // Coque baixo e mechas laterais.
  mesh(new THREE.SphereGeometry(0.055, 20, 14), dark, head, 0, -0.01, -0.11).scale.set(1.1, 0.9, 0.8);
  [-1, 1].forEach((side) => {
    const lock = mesh(capsule(0.022, 0.08), dark, head, side * 0.083, -0.03, 0.02);
    lock.rotation.z = side * 0.12;
  });
  // Traços faciais muito discretos (olhos luminosos e nariz).
  const eyes = [-1, 1].map((side) => {
    const eye = mesh(new THREE.SphereGeometry(0.011, 12, 8), bright, head, side * 0.034, 0.012, 0.085);
    eye.scale.set(1.3, 0.7, 0.5);
    return eye;
  });
  const nose = mesh(new THREE.ConeGeometry(0.012, 0.04, 10), skin, head, 0, -0.012, 0.096);
  nose.rotation.x = 0.35;
  mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), bright, head, 0, -0.05, 0.088);

  // Braços articulados.
  const upperGeo = ellipticLathe([P(0.0, 0.02), P(0.05, 0.0), P(0.052, -0.06), P(0.046, -0.16), P(0.042, -0.25), P(0.0, -0.27)], 1, 0.95, 20);
  const foreGeo = ellipticLathe([P(0.0, 0.01), P(0.043, 0.0), P(0.045, -0.06), P(0.036, -0.18), P(0.032, -0.23), P(0.0, -0.24)], 1, 0.9, 20);
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.19, 0.44, -0.005);
    torso.add(shoulder);
    mesh(new THREE.SphereGeometry(0.055, 16, 12), coat, shoulder);
    mesh(upperGeo, coat, shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = -0.26;
    shoulder.add(elbow);
    mesh(foreGeo, coat, elbow);
    const wrist = new THREE.Group();
    wrist.position.y = -0.235;
    elbow.add(wrist);
    const hand = mesh(capsule(0.024, 0.05, 1.0, 0.55), skin, wrist, 0, -0.045, 0);
    hand.rotation.z = side * 0.08;
    const thumb = mesh(capsule(0.01, 0.03), skin, wrist, side * -0.022, -0.03, 0.012);
    thumb.rotation.z = side * -0.6;
    return { shoulder, elbow, wrist };
  });

  // Tablet na mão esquerda.
  const tablet = new THREE.Group();
  tablet.position.set(0.01, -0.07, 0.04);
  tablet.rotation.set(-1.1, 0.2, 0);
  arms[0].wrist.add(tablet);
  mesh(new THREE.BoxGeometry(0.16, 0.22, 0.008), coat, tablet);
  mesh(new THREE.PlaneGeometry(0.14, 0.19), bright, tablet, 0, 0, 0.005);

  addDepthPrepass(figure);

  // Pose base.
  arms[0].shoulder.rotation.set(-0.35, 0, 0.12);
  arms[0].elbow.rotation.set(-1.45, 0, 0);
  arms[1].shoulder.rotation.set(0.05, 0, -0.1);
  arms[1].elbow.rotation.set(-0.15, 0, 0);

  // ---------------- Animação ----------------
  const state = { lookYaw: 0, lookPitch: 0, gesture: 0, glitch: 0, nextGlitch: 3000 };
  const tmp = new THREE.Vector3();

  function update(time, cameraPosition, reduced, focused) {
    const t = time * 0.001;
    materials.forEach((mat) => { mat.uniforms.uTime.value = t; });
    beam.material.uniforms.uTime.value = t;

    // Falhas de projeção ocasionais.
    if (!reduced && time > state.nextGlitch) {
      state.glitch = 1;
      state.nextGlitch = time + 3500 + Math.random() * 6000;
    }
    state.glitch = Math.max(0, state.glitch - 0.06);
    const flicker = reduced ? 1 : 0.92 + Math.sin(t * 31) * 0.03 + Math.sin(t * 7.3) * 0.03 - state.glitch * 0.35;
    materials.forEach((mat) => {
      mat.uniforms.uFlicker.value = flicker;
      mat.uniforms.uGlitch.value = state.glitch;
    });

    if (reduced) return;

    // Respiração e troca de apoio.
    const breath = Math.sin(t * 1.6);
    torso.scale.set(1 + breath * 0.008, 1 + breath * 0.004, 1 + breath * 0.012);
    hips.rotation.z = Math.sin(t * 0.45) * 0.025;
    hips.position.x = Math.sin(t * 0.45) * 0.012;
    torso.rotation.z = -hips.rotation.z * 0.7;
    legs[0].rotation.x = Math.sin(t * 0.45) * 0.015;
    legs[1].rotation.x = -Math.sin(t * 0.45) * 0.015;
    figure.position.y = 0.215 + Math.sin(t * 1.1) * 0.012;

    // Olhar acompanha o jogador (com limites naturais e amortecimento).
    head.updateWorldMatrix(true, false);
    tmp.setFromMatrixPosition(head.matrixWorld);
    const dx = cameraPosition[0] - tmp.x, dz = cameraPosition[2] - tmp.z, dy = cameraPosition[1] - tmp.y;
    const dist = Math.hypot(dx, dz);
    const rootYaw = root.rotation.y;
    let targetYaw = Math.atan2(dx, dz) - rootYaw;
    targetYaw = Math.atan2(Math.sin(targetYaw), Math.cos(targetYaw));
    const near = dist < 6.5;
    targetYaw = near ? THREE.MathUtils.clamp(targetYaw, -0.85, 0.85) : Math.sin(t * 0.3) * 0.25;
    const targetPitch = near ? THREE.MathUtils.clamp(-Math.atan2(dy, dist) * 0.6, -0.3, 0.25) : 0;
    state.lookYaw += (targetYaw - state.lookYaw) * 0.06;
    state.lookPitch += (targetPitch - state.lookPitch) * 0.06;
    head.rotation.y = state.lookYaw * 0.65;
    neck.rotation.y = state.lookYaw * 0.35;
    torso.rotation.y = state.lookYaw * 0.12;
    head.rotation.x = state.lookPitch;
    head.rotation.z = Math.sin(t * 0.7) * 0.03;

    // Gesto explicativo quando o jogador está perto e mira nela.
    const wantGesture = focused || dist < 2.6 ? 1 : 0;
    state.gesture += (wantGesture - state.gesture) * 0.04;
    const g = state.gesture;
    const talk = Math.sin(t * 2.3) * 0.12 * g;
    arms[1].shoulder.rotation.set(0.05 - 0.75 * g + talk, 0, -0.1 - 0.15 * g);
    arms[1].elbow.rotation.set(-0.15 - 1.0 * g - talk * 0.8, 0, 0);
    arms[1].wrist.rotation.set(0.2 * g, 0, -0.3 * g + Math.sin(t * 2.9) * 0.1 * g);
    arms[0].shoulder.rotation.x = -0.35 + Math.sin(t * 1.6) * 0.02;

    // Piscar.
    const blink = (time % 4300) < 120 ? 0.1 : 1;
    eyes.forEach((eye) => { eye.scale.y = 0.7 * blink; });

    halo.material.opacity = 0.3 + Math.sin(t * 2) * 0.06;
    ringGlow.emissiveIntensity = 2.6 + Math.sin(t * 2) * 0.5;
  }

  function setColor(hex) {
    // A cor da projeção acompanha o acento do capítulo, mantendo a identidade em ciano.
    const base = new THREE.Color("#6ff2cf").lerp(new THREE.Color(hex), 0.35);
    skin.uniforms.uColor.value.copy(base);
    dark.uniforms.uColor.value.copy(base).multiplyScalar(0.62);
    coat.uniforms.uColor.value.copy(base).lerp(new THREE.Color("#ffffff"), 0.35);
    beam.material.uniforms.uColor.value.copy(base);
    ringGlow.emissive.copy(base);
    light.color.copy(base);
    halo.material.color.copy(base);
  }

  return { root, update, setColor };
}
