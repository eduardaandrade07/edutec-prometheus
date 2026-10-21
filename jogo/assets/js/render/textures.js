// Texturas procedurais PBR (cor, rugosidade e normal) geradas em canvas.
// Tudo é criado localmente, sem arquivos externos, e reaproveitado por vários materiais.
import * as THREE from "../../vendor/three/three.module.min.js";

// ---------------------------------------------------------------------------
// Ruído determinístico
// ---------------------------------------------------------------------------
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = period;
  const a = hash2(((xi % p) + p) % p, ((yi % p) + p) % p, seed);
  const b = hash2((((xi + 1) % p) + p) % p, ((yi % p) + p) % p, seed);
  const c = hash2(((xi % p) + p) % p, (((yi + 1) % p) + p) % p, seed);
  const d = hash2((((xi + 1) % p) + p) % p, (((yi + 1) % p) + p) % p, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// fbm periódico: as texturas repetem sem costura.
function fbm(x, y, seed, baseFreq, octaves = 4) {
  let sum = 0, amp = 0.5, freq = baseFreq, norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(x * freq, y * freq, seed + o * 17, freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function makeField(size, fn) {
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) field[y * size + x] = fn(x / size, y / size, x, y);
  }
  return field;
}

function canvasOf(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function fieldToCanvas(size, fn) {
  const canvas = canvasOf(size);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = fn(x, y);
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Mapa de normal a partir de um campo de altura (Sobel, com repetição nas bordas).
function normalFromHeight(size, height, strength) {
  return fieldToCanvas(size, (x, y) => {
    const s = (ix, iy) => height[((iy + size) % size) * size + ((ix + size) % size)];
    const dx = (s(x + 1, y - 1) + 2 * s(x + 1, y) + s(x + 1, y + 1)) - (s(x - 1, y - 1) + 2 * s(x - 1, y) + s(x - 1, y + 1));
    const dy = (s(x - 1, y + 1) + 2 * s(x, y + 1) + s(x + 1, y + 1)) - (s(x - 1, y - 1) + 2 * s(x, y - 1) + s(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255];
  });
}

function toTexture(canvas, { srgb = false, repeat = [1, 1], anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

const hex = (value) => {
  const c = new THREE.Color(value);
  return [c.r * 255, c.g * 255, c.b * 255];
};
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------------------
// Conjuntos de textura
// ---------------------------------------------------------------------------

// Piso de resina epóxi em placas de 1,2 m (a textura cobre 2 × 2 placas).
function floorSet(size) {
  const tiles = 2;
  const seam = size * 0.0045;
  const height = makeField(size, (u, v, x, y) => {
    const tx = (x % (size / tiles)), ty = (y % (size / tiles));
    const edge = Math.min(tx, ty, size / tiles - tx, size / tiles - ty);
    const groove = clamp01((edge - seam) / (seam * 1.6));
    const dimples = fbm(u, v, 3, 64, 2) * 0.012;
    return groove * 0.9 + dimples;
  });
  const mottling = makeField(size, (u, v) => fbm(u, v, 11, 6, 5));
  const scuffs = makeField(size, (u, v) => {
    const streak = fbm(u * 0.35, v * 3.2, 29, 8, 3);
    return clamp01((streak - 0.62) * 4);
  });
  const base = hex("#2a3438"), alt = hex("#222c30"), seamCol = hex("#0c1113");
  const tileTint = (x, y) => {
    const tx = Math.floor(x / (size / tiles)), ty = Math.floor(y / (size / tiles));
    return (hash2(tx, ty, 5) - 0.5) * 0.08;
  };
  const color = fieldToCanvas(size, (x, y) => {
    const i = y * size + x;
    let c = mixRGB(alt, base, mottling[i]);
    const tint = 1 + tileTint(x, y);
    c = c.map((ch) => ch * tint);
    c = mixRGB(c, hex("#3a4549"), scuffs[i] * 0.35);
    return mixRGB(seamCol, c, clamp01(height[i] * 1.2));
  });
  const rough = fieldToCanvas(size, (x, y) => {
    const i = y * size + x;
    const r = 0.34 + mottling[i] * 0.16 + scuffs[i] * 0.22 + (1 - height[i]) * 0.3;
    const g = clamp01(r) * 255;
    return [g, g, g];
  });
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(size, height, 2.2) };
}

// Painéis de parede: módulo 2,4 m × 2,3 m com 2 × 2 placas, frisos e parafusos.
function wallSet(size) {
  const cols = 2, rows = 2;
  const cw = size / cols, ch = size / rows;
  const seam = size * 0.006;
  const height = makeField(size, (u, v, x, y) => {
    const px = x % cw, py = y % ch;
    const edge = Math.min(px, py, cw - px, ch - py);
    const groove = clamp01((edge - seam) / (seam * 2.2));
    const bevel = clamp01((edge - seam * 3) / (seam * 5)) * 0.1;
    let screw = 0;
    [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]].forEach(([sx, sy]) => {
      const d = Math.hypot(px - sx * cw, py - sy * ch) / (size * 0.008);
      if (d < 1) screw = Math.max(screw, 1 - d * d);
    });
    return groove * 0.8 + bevel - screw * 0.25 + fbm(u, v, 41, 48, 2) * 0.025;
  });
  const grime = makeField(size, (u, v) => fbm(u, v, 53, 4, 5));
  const panelTone = (x, y) => (hash2(Math.floor(x / cw), Math.floor(y / ch), 9) - 0.5) * 0.06;
  const color = fieldToCanvas(size, (x, y) => {
    const i = y * size + x;
    const t = 1 + panelTone(x, y) + (grime[i] - 0.5) * 0.12;
    const c = hex("#56676c").map((value) => value * t);
    return mixRGB(hex("#141b1d"), c, clamp01(0.25 + height[i]));
  });
  const rough = fieldToCanvas(size, (x, y) => {
    const i = y * size + x;
    const g = clamp01(0.58 + grime[i] * 0.2 + (1 - height[i]) * 0.2) * 255;
    return [g, g, g];
  });
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(size, height, 2.6) };
}

// Aço escovado: riscos horizontais longos.
function brushedSet(size) {
  const streaks = makeField(size, (u, v) => fbm(u * 0.06, v * 9, 71, 16, 4) * 0.7 + fbm(u, v, 77, 4, 3) * 0.3);
  const color = fieldToCanvas(size, (x, y) => {
    const g = 170 + (streaks[y * size + x] - 0.5) * 60;
    return [g * 0.97, g, g * 1.02];
  });
  const rough = fieldToCanvas(size, (x, y) => {
    const g = clamp01(0.26 + streaks[y * size + x] * 0.26) * 255;
    return [g, g, g];
  });
  const height = makeField(size, (u, v, x, y) => streaks[y * size + x] * 0.3);
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(size, height, 0.9) };
}

// Pintura eletrostática/plástico de equipamento: textura fina e manchas suaves.
function paintSet(size) {
  const orange = makeField(size, (u, v) => fbm(u, v, 91, 160, 2));
  const smudge = makeField(size, (u, v) => fbm(u, v, 97, 3, 4));
  const rough = fieldToCanvas(size, (x, y) => {
    const i = y * size + x;
    const g = clamp01(0.36 + orange[i] * 0.12 + smudge[i] * 0.18) * 255;
    return [g, g, g];
  });
  const color = fieldToCanvas(size, (x, y) => {
    const i = y * size + x;
    const g = 238 + (smudge[i] - 0.5) * 12 + (orange[i] - 0.5) * 3;
    return [g, g, g];
  });
  const height = makeField(size, (u, v, x, y) => orange[y * size + x] * 0.35);
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(size, height, 0.25) };
}

// Tecido técnico (bancos e cadeiras).
function fabricSet(size) {
  const threads = 96;
  const height = makeField(size, (u, v) => {
    const a = Math.sin(u * threads * Math.PI * 2) * 0.5 + 0.5;
    const b = Math.sin(v * threads * Math.PI * 2) * 0.5 + 0.5;
    const over = (Math.floor(u * threads) + Math.floor(v * threads)) % 2;
    return (over ? a : b) * 0.7 + fbm(u, v, 101, 32, 2) * 0.3;
  });
  const color = fieldToCanvas(size, (x, y) => {
    const g = 0.75 + height[y * size + x] * 0.25;
    return [255 * g, 255 * g, 255 * g];
  });
  const rough = fieldToCanvas(size, () => [235, 235, 235]);
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(size, height, 1.6) };
}

// Bancada de resina fenólica com pontilhado mineral.
function resinSet(size) {
  const speck = makeField(size, (u, v, x, y) => (hash2(x, y, 113) > 0.985 ? 1 : 0) * 0.6 + fbm(u, v, 117, 12, 3) * 0.4);
  const color = fieldToCanvas(size, (x, y) => {
    const g = 34 + speck[y * size + x] * 30;
    return [g * 0.95, g, g * 1.04];
  });
  const rough = fieldToCanvas(size, (x, y) => {
    const g = clamp01(0.48 + speck[y * size + x] * 0.25) * 255;
    return [g, g, g];
  });
  return { map: color, roughnessMap: rough };
}

// Forro técnico com placas de 0,6 m.
function ceilingSet(size) {
  const n = 4;
  const height = makeField(size, (u, v, x, y) => {
    const c = size / n;
    const px = x % c, py = y % c;
    const edge = Math.min(px, py, c - px, c - py);
    return clamp01((edge - size * 0.004) / (size * 0.006)) * 0.8 + fbm(u, v, 131, 64, 2) * 0.2;
  });
  const color = fieldToCanvas(size, (x, y) => {
    const h = height[y * size + x];
    const g = 22 + h * 22;
    return [g * 0.92, g, g * 1.02];
  });
  return { map: color, normalMap: normalFromHeight(size, height, 2.0) };
}

function textureSet(canvases, options) {
  const set = {};
  if (canvases.map) set.map = toTexture(canvases.map, { ...options, srgb: true });
  if (canvases.roughnessMap) set.roughnessMap = toTexture(canvases.roughnessMap, options);
  if (canvases.normalMap) set.normalMap = toTexture(canvases.normalMap, options);
  return set;
}

export function createTextureLibrary(quality, anisotropy) {
  const size = quality === "low" ? 256 : 512;
  const big = quality === "low" ? 512 : quality === "high" ? 1024 : 768;
  const options = { anisotropy };
  return {
    floor: textureSet(floorSet(big), options),
    wall: textureSet(wallSet(big), options),
    brushed: textureSet(brushedSet(size), options),
    paint: textureSet(paintSet(size), options),
    fabric: textureSet(fabricSet(size), options),
    resin: textureSet(resinSet(size), options),
    ceiling: textureSet(ceilingSet(size), options),
  };
}

// Clona um conjunto de texturas com outra repetição (a imagem é compartilhada na GPU).
export function withRepeat(set, x, y) {
  const out = {};
  Object.entries(set).forEach(([key, texture]) => {
    const clone = texture.clone();
    clone.repeat.set(x, y);
    clone.needsUpdate = true;
    out[key] = clone;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Texturas de sinalização e de fundo
// ---------------------------------------------------------------------------
export function signTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (kind === "biohazard") {
    canvas.height = 512;
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 18;
    ctx.strokeRect(24, 24, 464, 464);
    ctx.fillStyle = "#111";
    const cx = 256, cy = 230;
    for (let k = 0; k < 3; k += 1) {
      const a = -Math.PI / 2 + k * (Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62, 74, 0, Math.PI * 2);
      ctx.arc(cx + Math.cos(a) * 82, cy + Math.sin(a) * 82, 50, 0, Math.PI * 2, true);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.arc(cx, cy, 24, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.font = "bold 54px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RISCO BIOLÓGICO", 256, 430);
  } else if (kind === "exit") {
    ctx.fillStyle = "#0e7a45";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#e8fff0";
    ctx.font = "bold 92px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SAÍDA", 300, 132);
    ctx.beginPath();
    ctx.moveTo(60, 128); ctx.lineTo(120, 78); ctx.lineTo(120, 108); ctx.lineTo(170, 108);
    ctx.lineTo(170, 148); ctx.lineTo(120, 148); ctx.lineTo(120, 178); ctx.closePath();
    ctx.fill();
  } else if (kind === "bsl") {
    ctx.fillStyle = "#e9eef0";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#b3261e";
    ctx.fillRect(0, 0, 512, 70);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NÍVEL DE BIOSSEGURANÇA 3", 256, 50);
    ctx.fillStyle = "#1a2326";
    ctx.font = "30px Arial, sans-serif";
    ctx.fillText("Acesso restrito · uso obrigatório de EPI", 256, 130);
    ctx.fillText("Laboratório Prometheus — Ala de Análise", 256, 185);
  } else if (kind === "annex") {
    ctx.fillStyle = "#1a2326";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#f2b64d";
    ctx.fillRect(0, 210, 512, 14);
    ctx.fillStyle = "#e8f2f0";
    ctx.font = "bold 58px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TRIAGEM", 256, 105);
    ctx.font = "28px Arial, sans-serif";
    ctx.fillStyle = "#9fb4b0";
    ctx.fillText("Epidemiologia · Resposta", 256, 160);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Horizonte noturno da cidade visto pela janela da ala de triagem.
export function skylineTexture(layer) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (layer === 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#03070d");
    sky.addColorStop(0.62, "#0b1a2a");
    sky.addColorStop(0.8, "#1c2c3a");
    sky.addColorStop(1, "#2a2a30");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 2048, 512);
    for (let i = 0; i < 160; i += 1) {
      ctx.fillStyle = `rgba(220,235,255,${0.2 + hash2(i, 1, 7) * 0.5})`;
      ctx.fillRect(hash2(i, 2, 7) * 2048, hash2(i, 3, 7) * 240, 1.5, 1.5);
    }
  }
  const layers = [
    { y: 0.55, h: [60, 170], w: [40, 110], col: "#0a121b", lit: 0.14, seed: 3 },
    { y: 0.68, h: [80, 240], w: [60, 150], col: "#060b11", lit: 0.24, seed: 5 },
  ];
  const draw = layer === 0 ? [layers[0]] : [layers[1]];
  draw.forEach((L) => {
    let x = 0, k = 0;
    while (x < 2048) {
      const w = L.w[0] + hash2(k, 1, L.seed) * (L.w[1] - L.w[0]);
      const h = L.h[0] + hash2(k, 2, L.seed) * (L.h[1] - L.h[0]);
      const top = 512 * L.y - h + 512 * (1 - L.y) * 0.6;
      ctx.fillStyle = L.col;
      ctx.fillRect(x, top, w, 512 - top);
      for (let wy = top + 8; wy < 500; wy += 11) {
        for (let wx = x + 5; wx < x + w - 6; wx += 9) {
          if (hash2(Math.floor(wx), Math.floor(wy), L.seed + 31) < L.lit) {
            const warm = hash2(Math.floor(wx), Math.floor(wy), L.seed + 37) > 0.4;
            ctx.fillStyle = warm ? "rgba(255,196,120,0.85)" : "rgba(160,215,255,0.8)";
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
      if (hash2(k, 4, L.seed) > 0.85) {
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(x + w / 2 - 2, top - 6, 4, 4);
      }
      x += w + hash2(k, 3, L.seed) * 16;
      k += 1;
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Pequeno sprite radial suave (partículas, brilhos e sombras de contato).
export function radialTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)", size = 128) {
  const canvas = canvasOf(size);
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Sombra de contato suave para "assentar" móveis no piso, em todas as qualidades.
export function contactShadowTexture() {
  const size = 128;
  const canvas = canvasOf(size);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.abs(x / size - 0.5) * 2, dy = Math.abs(y / size - 0.5) * 2;
      // Caixa arredondada com borda difusa.
      const d = Math.hypot(Math.max(dx - 0.55, 0), Math.max(dy - 0.55, 0)) / 0.45;
      const a = Math.pow(clamp01(1 - d), 1.8);
      const i = (y * size + x) * 4;
      img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0; img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
