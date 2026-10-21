// Utilitários compartilhados pelos modelos 3D das dez áreas.
import * as THREE from "../../jogo/assets/vendor/three/three.module.min.js";
import { RoundedBoxGeometry } from "../../jogo/assets/vendor/three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "../../jogo/assets/vendor/three/addons/utils/BufferGeometryUtils.js";

export { THREE, RoundedBoxGeometry };

// Material PBR com parâmetros legíveis.
export function mat(color, { rough = 0.5, metal = 0, emissive = null, emissiveIntensity = 1, opacity = 1, clearcoat = 0, side = THREE.FrontSide, flat = false, transmission = 0, ior = 1.45, thickness = 0.2, depthWrite } = {}) {
  const physical = clearcoat > 0 || transmission > 0;
  const Material = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Material({ color, roughness: rough, metalness: metal, side, flatShading: flat });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = depthWrite ?? false; }
  if (physical) { m.clearcoat = clearcoat; m.clearcoatRoughness = 0.25; m.transmission = transmission; m.ior = ior; m.thickness = thickness; }
  return m;
}

export function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx, sy, sz, cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx ?? s, sy ?? s, sz ?? s);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

export const lathe = (points, segments = 48) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

export function tube(points, radius, { segments = 64, radial = 10, closed = false, tension = 0.5 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, "catmullrom", tension);
  return new THREE.TubeGeometry(curve, segments, radius, radial, closed);
}

export function rbox(w, h, d, r = 0.02, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
}

// Deforma vértices com uma função (para formas orgânicas).
export function deform(source, fn, { smooth = true } = {}) {
  // Une vértices coincidentes para que a superfície deformada fique lisa (sem facetas).
  let geometry = source;
  if (smooth) {
    geometry = source.clone();
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry = mergeVertices(geometry, 1e-4);
    source.dispose();
  }
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    fn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Ruído suave determinístico (para variações orgânicas).
export function noise3(x, y, z) {
  const s = Math.sin(x * 1.7 + y * 3.1 + z * 2.3) * 0.5 + Math.sin(x * 4.3 - z * 2.7 + y * 1.1) * 0.3 + Math.sin(y * 5.9 + z * 4.1 - x * 3.3) * 0.2;
  return s;
}

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Brilho em sprite (partículas, pontos de luz).
let glowTexture;
export function glowSprite(color, size = 0.2, opacity = 0.8) {
  if (!glowTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTexture = new THREE.CanvasTexture(c);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(size);
  return sprite;
}

// Texto em plano (rótulos dentro da cena).
export function textPlane(text, { width = 0.6, color = "#f4efe6", background = "rgba(10,10,9,0.72)", font = "600 44px Inter, Arial, sans-serif", height } = {}) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  c.width = w;
  c.height = 80;
  ctx.font = font;
  if (background) {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 80, 18);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 24, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const h = height ?? (width * 80) / w;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  return m;
}

// Interpolação suave independente da taxa de quadros.
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Instâncias distribuídas sobre uma esfera (Fibonacci).
export function fibonacciSphere(count, radius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return pts;
}

// Destaque de partes: aumenta o brilho emissivo de um conjunto de malhas.
export function highlightable(objects, color) {
  const list = [];
  objects.forEach((root) => root.traverse?.((o) => { if (o.isMesh && o.material && "emissive" in o.material) list.push(o); }));
  list.forEach((o) => {
    o.material = o.material.clone();
    o.userData.baseEmissive = o.material.emissive.clone();
    o.userData.baseEmissiveIntensity = o.material.emissiveIntensity;
  });
  const c = new THREE.Color(color);
  return (amount) => {
    list.forEach((o) => {
      o.material.emissive.copy(o.userData.baseEmissive).lerp(c, Math.min(1, amount));
      o.material.emissiveIntensity = o.userData.baseEmissiveIntensity + amount * 0.8;
    });
  };
}
