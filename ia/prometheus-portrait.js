// Retrato em tempo real de Prometheus: busto de mármore em estilo clássico grego.
//
// Técnica: o busto é esculpido como um campo de distâncias (SDF), com uniões
// suaves que geram formas orgânicas (crânio, rosto, barba e cabelos em cachos
// "caracol", himácio drapeado, faixa dourada e pedestal de bronze).
// 1) Passe de escultura (caro, feito só ao abrir e ao redimensionar): marcha
//    de raios grava normal, profundidade, material, oclusão, sombra e veios
//    do mármore em duas texturas (G-buffer).
// 2) Passe de luz (barato, a cada quadro): ilumina o G-buffer com a luz
//    principal, contraluz dourada e a chama tremulante, desenha a chama e as
//    brasas e aplica a respiração. Estados: repouso, refletindo e falando.
"use strict";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const COMMON = `
uniform vec2 uRes;
uniform vec3 uCam;
uniform vec3 uTarget;
uniform float uFov;
vec3 rayDir(vec2 uv) {
  vec3 f = normalize(uTarget - uCam);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  vec2 p = (uv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0) * tan(uFov * 0.5);
  return normalize(f + p.x * r + p.y * u);
}
// smoothstep seguro: aceita bordas invertidas (no GLSL isso é indefinido).
float ss(float a, float b, float x) { if (a == b) return step(a, x); return a < b ? smoothstep(a, b, x) : 1.0 - smoothstep(b, a, x); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const SCULPT = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 oGeo;
layout(location = 1) out vec4 oMat;
${COMMON}

float sdE(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdCone(vec3 p, vec3 a, vec3 b, float r1, float r2) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(r1, r2, h); }
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
vec3 mx(vec3 p) { return vec3(abs(p.x), p.yz); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Cachos em espiral (cabelo e barba no estilo das esculturas gregas).
float curls(vec2 g, float t) {
  vec2 f = fract(g) - 0.5;
  float r = length(f);
  float ang = atan(f.y, f.x);
  float dome = 1.0 - ss(0.06, 0.47, r);
  return dome * (0.85 + 0.15 * sin(ang + r * t));
}

// Mechas onduladas (cabelo) e fios da barba.
float locks(float th, float ph) {
  float wave = 0.5 + 0.5 * sin(th * 15.0 + 2.6 * sin(ph * 9.0));
  float ridge = 0.5 + 0.5 * sin(ph * 22.0 + th * 4.0 + 1.5 * sin(th * 9.0));
  return wave * (0.55 + 0.45 * ridge);
}
float strands(float th, float y) {
  float s1 = 0.5 + 0.5 * sin(th * 30.0 + 2.2 * sin(y * 16.0));
  float s2 = 0.5 + 0.5 * sin(th * 13.0 - 1.4 * sin(y * 9.0 + th * 3.0));
  return s1 * 0.6 + s2 * 0.4;
}

vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

// Retorna (distância, material): 1 mármore (pele), 2 cabelo/barba, 3 manto,
// 4 olhos, 5 bronze, 6 faixa dourada.
vec2 map(vec3 p) {
  p.xz = rot(0.32) * p.xz; // leve rotação de três-quartos
  vec3 hp = p - vec3(0.0, 0.12, 0.0);
  hp.yz = rot(-0.06) * hp.yz; // cabeça levemente inclinada para baixo

  // ---- Cabeça ----
  float skull = sdE(hp - vec3(0.0, 0.06, -0.04), vec3(0.325, 0.40, 0.385));
  float face = sdE(hp - vec3(0.0, -0.13, 0.075), vec3(0.262, 0.33, 0.30));
  float head = smin(skull, face, 0.13);
  float brow = sdCap(mx(hp), vec3(0.02, 0.058, 0.315), vec3(0.17, 0.05, 0.29), 0.05);
  head = smin(head, brow, 0.06);
  float cheek = sdE(mx(hp) - vec3(0.155, -0.075, 0.245), vec3(0.085, 0.07, 0.08));
  head = smin(head, cheek, 0.09);
  float socket = sdE(mx(hp) - vec3(0.112, -0.006, 0.352), vec3(0.074, 0.048, 0.075));
  head = smax(head, -socket, 0.045);
  float nose = sdCone(hp, vec3(0.0, 0.05, 0.352), vec3(0.0, -0.118, 0.438), 0.034, 0.047);
  float ala = sdE(mx(hp) - vec3(0.036, -0.122, 0.402), vec3(0.03, 0.024, 0.03));
  nose = smin(nose, ala, 0.03);
  head = smin(head, nose, 0.03);
  float lowerLip = sdE(hp - vec3(0.0, -0.243, 0.375), vec3(0.058, 0.021, 0.03));
  head = smin(head, lowerLip, 0.02);
  float ear = sdE(mx(hp) - vec3(0.31, -0.03, 0.0), vec3(0.035, 0.09, 0.06));
  head = smin(head, ear, 0.03);

  // Olhos de mármore lisos (como nas esculturas clássicas) e pálpebras.
  float eye = length(mx(hp) - vec3(0.11, -0.012, 0.294)) - 0.057;
  // Pupila entalhada (recurso da escultura helenística que dá vida ao olhar).
  float pupil = length(mx(hp) - vec3(0.103, -0.016, 0.353)) - 0.017;
  eye = smax(eye, -pupil, 0.008);
  float lid = sdCap(mx(hp), vec3(0.06, 0.02, 0.336), vec3(0.16, 0.016, 0.314), 0.011);
  head = smin(head, lid, 0.025);

  // ---- Cabelo ----
  float hairShell = sdE(hp - vec3(0.0, 0.095, -0.06), vec3(0.365, 0.435, 0.43));
  float faceRegion = sdE(hp - vec3(0.0, -0.17, 0.33), vec3(0.33, 0.44, 0.33));
  float hair = smax(hairShell, -faceRegion, 0.06);
  float len = length(hp);
  float th = atan(hp.x, hp.z);
  float ph = acos(clamp(hp.y / max(len, 1e-4), -1.0, 1.0));
  hair -= 0.022 * locks(th, ph);
  // Mechas sobre a testa.
  float fringe = sdE(hp - vec3(0.0, 0.29, 0.25), vec3(0.27, 0.075, 0.11));
  fringe -= 0.03 * curls(vec2(hp.x * 10.5, hp.y * 8.0), 20.0);
  hair = smin(hair, fringe, 0.05);
  // Costeletas ligando cabelo e barba.
  float burns = sdCap(mx(hp), vec3(0.262, 0.0, 0.07), vec3(0.235, -0.27, 0.13), 0.055);

  // ---- Barba e bigode ----
  float beardBody = sdE(hp - vec3(0.0, -0.385, 0.13), vec3(0.275, 0.28, 0.245));
  float beard = smax(beardBody, hp.y - (-0.272 + 0.95 * abs(hp.x)), 0.05);
  beard = smin(beard, burns, 0.06);
  float stache = sdCap(mx(hp), vec3(0.0, -0.198, 0.425), vec3(0.13, -0.262, 0.355), 0.028);
  beard = smin(beard, stache, 0.03);
  float bth = atan(hp.x, hp.z);
  beard -= 0.022 * strands(bth, hp.y);
  // Cachos nas pontas da barba.
  beard -= 0.016 * curls(vec2(bth * 6.5, hp.y * 11.0), 20.0) * (1.0 - ss(-0.5, -0.38, hp.y));
  hair = smin(hair, beard, 0.04);

  // Faixa dourada (tênia) ao redor dos cabelos.
  vec3 bq = hp - vec3(0.0, 0.3, -0.05);
  bq.yz = rot(0.22) * bq.yz;
  bq.z *= 0.86;
  float band = length(vec2(length(bq.xz) - 0.338, bq.y)) - 0.016;

  // ---- Pescoço, tronco e manto ----
  float neck = sdCap(p, vec3(0.0, -0.22, -0.045), vec3(0.0, -0.76, -0.07), 0.148);
  float chest = sdE(p - vec3(0.0, -1.02, -0.07), vec3(0.79, 0.43, 0.32));
  float body = smin(neck, chest, 0.2);
  float pec = sdE(mx(p) - vec3(0.21, -0.95, 0.15), vec3(0.22, 0.15, 0.12));
  body = smin(body, pec, 0.12);
  float delt = sdE(mx(p) - vec3(0.66, -0.88, -0.06), vec3(0.2, 0.19, 0.22));
  body = smin(body, delt, 0.16);
  float clav = sdCap(mx(p), vec3(0.06, -0.72, 0.08), vec3(0.48, -0.74, 0.02), 0.03);
  body = smin(body, clav, 0.05);
  body = smax(body, -p.y - 1.33, 0.03);
  body = smax(body, abs(p.x) - 0.8, 0.12);

  // Himácio: faixa de tecido do quadril até o ombro, com dobras.
  vec3 da = vec3(0.56, -1.45, 0.22), db = vec3(-0.6, -0.7, -0.16);
  float bandRegion = sdCap(p, da, db, 0.26);
  float shell = abs(body - 0.03) - 0.022;
  float drape = smax(shell, bandRegion, 0.05);
  vec3 dir = normalize(db - da);
  float along = dot(p - da, dir);
  float across = dot(p - da, normalize(cross(dir, vec3(0.0, 0.0, 1.0))));
  drape -= 0.024 * pow(0.5 + 0.5 * sin(across * 15.0 + along * 2.5 + 1.6 * sin(along * 6.0)), 1.6);
  float fall = sdCap(p, vec3(-0.66, -0.8, -0.1), vec3(-0.74, -1.28, -0.14), 0.07);
  fall -= 0.012 * sin(p.x * 30.0 + p.y * 6.0);
  drape = smin(drape, smax(fall, -p.y - 1.33, 0.02), 0.03 + step(1.0, 0.0));
  drape = smax(drape, -p.y - 1.33, 0.02);
  drape = smax(drape, abs(p.x) - 0.85, 0.03);

  // ---- Pedestal de bronze ----
  float plinth = sdBox(p - vec3(0.0, -1.47, -0.06), vec3(0.4, 0.135, 0.29), 0.025);
  float base = sdBox(p - vec3(0.0, -1.63, -0.06), vec3(0.5, 0.04, 0.36), 0.015);
  float collar = sdBox(p - vec3(0.0, -1.335, -0.06), vec3(0.44, 0.02, 0.32), 0.01);
  float bronze = min(min(plinth, base), collar);

  vec2 res = vec2(smin(smin(head, body, 0.08), 1e3, 1.0), 1.0);
  res = opU(res, vec2(hair, 2.0));
  res = opU(res, vec2(drape, 3.0));
  res = opU(res, vec2(eye, 4.0));
  res = opU(res, vec2(bronze, 5.0));
  res = opU(res, vec2(band, 6.0));
  return res;
}

vec3 calcNormal(vec3 p, float t) {
  float e = 0.0006 * max(t, 1.0);
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x + k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 6; i++) {
    float h = 0.012 + 0.07 * float(i);
    float d = map(p + n * h).x;
    occ += (h - d) * sca;
    sca *= 0.82;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.02;
  for (int i = 0; i < 48; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 9.0 * h / t);
    t += clamp(h * 0.8, 0.012, 0.12);
    if (res < 0.002 || t > 3.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float marbleVeins(vec3 p) {
  float n = noise3(p * 2.6) * 0.55 + noise3(p * 5.3) * 0.3 + noise3(p * 11.0) * 0.15;
  float v = abs(sin(p.x * 3.1 + p.y * 1.7 - p.z * 1.2 + n * 6.0));
  return pow(1.0 - v, 9.0);
}

void main() {
  vec3 ro = uCam;
  vec3 rd = rayDir(vUv);
  // Volume que envolve o busto: começa a marchar já perto da superfície.
  vec3 c = vec3(0.0, -0.55, 0.0);
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - 1.42 * 1.42;
  float disc = b * b - cc;
  oGeo = vec4(0.5, 0.5, 1.0, 1.0);
  oMat = vec4(0.0);
  if (disc < 0.0) return;
  float t = max(-b - sqrt(disc), 0.0);
  float tMax = -b + sqrt(disc);
  vec2 h = vec2(0.0);
  bool hit = false;
  for (int i = 0; i < 200; i++) {
    h = map(ro + rd * t);
    if (abs(h.x) < 0.0005 * t) { hit = true; break; }
    t += h.x * 0.6;
    if (t > tMax) break;
  }
  if (!hit) return;
  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p, t);
  float ao = calcAO(p, n);
  vec3 L = normalize(vec3(-0.62, 0.62, 0.55));
  float sh = softShadow(p + n * 0.004, L);
  float vein = (h.y < 1.5 || h.y > 2.5 && h.y < 3.5) ? marbleVeins(p) : 0.0;
  oGeo = vec4(n * 0.5 + 0.5, clamp((t - 2.0) / 4.0, 0.0, 1.0));
  oMat = vec4(h.y / 8.0, ao, sh, vein);
}`;

const SHADE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 oColor;
${COMMON}
uniform sampler2D uGeo;
uniform sampler2D uMat;
uniform float uTime;
uniform float uThink;
uniform float uSpeak;
uniform vec3 uFlame;
uniform vec2 uFlameUv;
uniform float uFlameScale;
uniform float uMotion;

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float flameNoise(vec2 p) { return noise3(vec3(p, uTime * 0.0)); }

void main() {
  // Respiração e leve balanço: deforma a imagem a partir da base do busto.
  vec2 uv = vUv;
  float breath = sin(uTime * 1.35) * uMotion;
  vec2 pivot = vec2(0.5, 0.06);
  vec2 d = uv - pivot;
  float sway = sin(uTime * 0.37) * 0.0035 * uMotion;
  d = mat2(cos(sway), -sin(sway), sin(sway), cos(sway)) * d;
  d.y /= 1.0 + 0.0045 * breath * ss(0.0, 0.6, d.y);
  uv = pivot + d;

  vec4 g = texture(uGeo, uv);
  vec4 m = texture(uMat, uv);
  float mat = floor(m.x * 8.0 + 0.5);
  vec3 rd = rayDir(uv);

  // Chama: tremulação comum à luz e ao desenho.
  float flick = 0.82 + 0.1 * sin(uTime * 9.1) + 0.06 * sin(uTime * 15.7 + 1.3) + 0.05 * noise3(vec3(uTime * 3.0, 0.0, 0.0));
  float flameGain = 1.0 + uThink * 0.9 + uSpeak * 0.3 * (0.5 + 0.5 * sin(uTime * 6.0));
  vec3 flameCol = vec3(1.0, 0.6, 0.24);

  vec3 col;
  if (mat < 0.5) {
    // Fundo: nicho escuro com brilho quente da chama.
    vec2 q = (vUv - vec2(0.5, 0.55)) * vec2(uRes.x / uRes.y, 1.0);
    col = mix(vec3(0.075, 0.068, 0.06), vec3(0.028, 0.026, 0.024), ss(0.0, 0.85, length(q)));
    vec2 fq = (vUv - uFlameUv) * vec2(uRes.x / uRes.y, 1.0);
    col += flameCol * 0.09 * flameGain * flick * exp(-dot(fq, fq) * 9.0);
  } else {
    vec3 n = normalize(g.xyz * 2.0 - 1.0);
    float t = g.w * 4.0 + 2.0;
    vec3 p = uCam + rd * t;
    float ao = m.y, sh = m.z, vein = m.w;
    vec3 V = -rd;

    vec3 albedo = vec3(0.93, 0.9, 0.85);
    float metal = 0.0, gloss = 28.0, specK = 0.12, wrap = 0.38;
    if (mat == 2.0) { albedo = vec3(0.86, 0.83, 0.78); gloss = 14.0; specK = 0.07; }
    else if (mat == 3.0) { albedo = vec3(0.89, 0.85, 0.78); gloss = 10.0; specK = 0.05; }
    else if (mat == 4.0) { albedo = vec3(0.95, 0.93, 0.9); }
    else if (mat == 5.0) { albedo = vec3(0.52, 0.34, 0.17); metal = 1.0; gloss = 40.0; specK = 0.9; wrap = 0.0; }
    else if (mat == 6.0) { albedo = vec3(0.98, 0.76, 0.36); metal = 1.0; gloss = 70.0; specK = 1.2; wrap = 0.0; }
    // Veios acinzentados do mármore e leve variação de tom.
    albedo = mix(albedo, albedo * vec3(0.72, 0.74, 0.78), vein * 0.55 * (1.0 - metal));
    albedo *= 0.96 + 0.06 * noise3(p * 7.0);

    // Luz principal (sombra pré-calculada), com espalhamento suave do mármore.
    vec3 L = normalize(vec3(-0.62, 0.62, 0.55));
    float ndl = dot(n, L);
    float diffKey = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0) * mix(0.25, 1.0, sh);
    vec3 keyCol = vec3(1.0, 0.95, 0.88) * 1.25;
    // Preenchimento frio e contraluz dourada (tons da identidade do site).
    float hemi = 0.5 + 0.5 * n.y;
    vec3 fill = mix(vec3(0.06, 0.06, 0.065), vec3(0.16, 0.165, 0.18), hemi) * ao;
    vec3 Lr = normalize(vec3(0.75, 0.35, -0.55));
    float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * clamp(dot(n, Lr) + 0.35, 0.0, 1.0);
    vec3 rimCol = vec3(0.85, 0.68, 0.42) * 1.1;
    // Luz da chama (atenuação física, tremulante).
    vec3 Lf = uFlame - p;
    float df = length(Lf);
    Lf /= df;
    float att = 1.0 / (1.0 + df * df * 2.2);
    float diffF = clamp((dot(n, Lf) + wrap * 0.6) / (1.0 + wrap * 0.6), 0.0, 1.0) * att;
    vec3 flameLight = flameCol * 3.4 * flick * flameGain * diffF * mix(0.6, 1.0, ao);

    vec3 H = normalize(L + V);
    float spec = pow(clamp(dot(n, H), 0.0, 1.0), gloss) * specK * mix(0.2, 1.0, sh);
    vec3 Hf = normalize(Lf + V);
    float specF = pow(clamp(dot(n, Hf), 0.0, 1.0), gloss) * specK * att * 2.0 * flick * flameGain;
    vec3 specCol = mix(vec3(1.0), albedo, metal);

    vec3 diffuse = albedo * (keyCol * diffKey + fill + flameLight) * (1.0 - metal * 0.85);
    // Reflexo aproximado do ambiente para os metais.
    vec3 R = reflect(rd, n);
    vec3 env = mix(vec3(0.07, 0.06, 0.05), vec3(0.85, 0.66, 0.42), ss(-0.3, 0.7, R.y)) + flameCol * 0.4 * clamp(dot(R, Lf), 0.0, 1.0) * flick;
    vec3 refl = env * albedo * metal * ao;
    col = diffuse * mix(0.55, 1.0, ao) + specCol * (keyCol * spec + flameCol * specF) + rimCol * rim * (0.35 + 0.65 * ao) + refl;
    // Olhos: brilho quente e discreto enquanto reflete.
    if (mat == 4.0) col += vec3(1.0, 0.68, 0.32) * 0.3 * uThink * (0.8 + 0.2 * sin(uTime * 4.0));
    // Faixa dourada acende levemente enquanto reflete.
    if (mat == 6.0) col += vec3(1.0, 0.7, 0.3) * 0.25 * uThink * flick;
  }

  // ---- Chama dourada ----
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 fq = (vUv - uFlameUv) * asp / (uFlameScale * (0.9 + 0.42 * uThink + 0.08 * uSpeak));
  float yy = fq.y;
  float turb = (noise3(vec3(fq.x * 3.0, yy * 2.5 - uTime * 2.6, uTime * 0.7)) - 0.5) * 0.55 * ss(-0.1, 0.8, yy);
  float width = 0.42 * pow(clamp(1.0 - yy, 0.0, 1.0), 0.85) * ss(-0.32, 0.05, yy);
  float fx = abs(fq.x + turb * 0.5);
  float body = ss(width, width * 0.15, fx) * ss(1.05, 0.35, yy + turb * 0.3) * step(-0.35, yy) * step(1e-4, width);
  float core = ss(width * 0.55, 0.0, fx) * ss(0.55, 0.0, yy) * step(-0.25, yy) * step(1e-4, width);
  vec3 flame = mix(vec3(0.92, 0.3, 0.05), vec3(1.0, 0.62, 0.18), body) * (0.55 + body * 0.85) + vec3(1.0, 0.82, 0.46) * core * 1.15;
  float halo = exp(-dot(fq * vec2(1.0, 0.75), fq * vec2(1.0, 0.75)) * 2.4) * 0.34;
  // A chama é composta por cima (não some sobre o mármore claro).
  float fa = clamp(body * 0.9 + core, 0.0, 1.0);
  col = mix(col, flame * flick * flameGain, fa * 0.92) + flameCol * halo * flick * flameGain;

  // Brasas subindo.
  float rate = 0.18 + uThink * 0.25;
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float hsh = fract(sin(fi * 91.7) * 43758.5);
    float life = fract(uTime * rate * (0.7 + hsh * 0.6) + hsh);
    vec2 ep = uFlameUv + vec2((hsh - 0.5) * 0.06 + sin(life * 6.0 + fi) * 0.02, life * (0.22 + hsh * 0.12)) / asp * uFlameScale * 4.0;
    vec2 dd = (vUv - ep) * asp;
    float s = (0.0035 + hsh * 0.003) * uFlameScale * 4.0;
    col += vec3(1.0, 0.68, 0.3) * exp(-dot(dd, dd) / (s * s)) * (1.0 - life) * (0.6 + uThink * 0.6);
  }

  col = aces(col * 1.05);
  col = pow(col, vec3(1.0 / 2.2));
  // Vinheta suave.
  vec2 vq = vUv - 0.5;
  col *= 1.0 - dot(vq, vq) * 0.55;
  oColor = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader: ${log}`);
  }
  return shader;
}

function program(gl, fragment) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(prog, i);
    uniforms[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, uniforms };
}

export class PrometheusPortrait {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL2 indisponível");
    this.gl = gl;
    this.sculpt = program(gl, SCULPT);
    this.shade = program(gl, SHADE);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;
    this.cam = [0.16, -0.36, 4.35];
    this.target = [0.2, -0.48, 0.0];
    this.fov = (34 * Math.PI) / 180;
    this.flame = [0.86, -0.6, 0.58];
    this.think = 0;
    this.speak = 0;
    this.state = "idle";
    this.start = performance.now();
    this.running = false;
    this.visible = true;
    this.dirty = true;
    this.resize();
    this.resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.scheduleResize()) : null;
    this.resizeObserver?.observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.loop(); });
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; });
  }

  setState(state) {
    this.state = state;
  }

  scheduleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.resize(), 120);
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(64, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(64, Math.round(this.canvas.clientHeight * dpr));
    if (this.width === w && this.height === h && !this.dirty) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    // G-buffer em RGBA8 (compatível com praticamente todos os aparelhos).
    this.targets?.forEach((tex) => gl.deleteTexture(tex));
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    const make = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    this.targets = [make(), make()];
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.targets[0], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.targets[1], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Framebuffer incompleto");
    this.renderSculpture();
    this.dirty = false;
    this.computeFlameUv();
  }

  setCommonUniforms(u) {
    const gl = this.gl;
    gl.uniform2f(u.uRes, this.width, this.height);
    gl.uniform3fv(u.uCam, this.cam);
    gl.uniform3fv(u.uTarget, this.target);
    gl.uniform1f(u.uFov, this.fov);
  }

  renderSculpture() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.sculpt.prog);
    this.setCommonUniforms(this.sculpt.uniforms);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Posição da chama na tela (mesma câmera do shader).
  computeFlameUv() {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const f = norm(sub(this.target, this.cam));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    const v = sub(this.flame, this.cam);
    const z = dot(v, f);
    const k = Math.tan(this.fov / 2);
    const aspect = this.width / this.height;
    const x = dot(v, r) / z / k / aspect;
    const y = dot(v, u) / z / k;
    this.flameUv = [x * 0.5 + 0.5, y * 0.5 + 0.5];
    this.flameScale = 0.16 / z / k;
  }

  frame(now) {
    const gl = this.gl;
    const time = (now - this.start) / 1000;
    const targetThink = this.state === "thinking" ? 1 : this.state === "speaking" ? 0.35 : 0;
    const targetSpeak = this.state === "speaking" ? 1 : 0;
    this.think += (targetThink - this.think) * 0.06;
    this.speak += (targetSpeak - this.speak) * 0.08;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.shade.prog);
    const u = this.shade.uniforms;
    this.setCommonUniforms(u);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[0]);
    gl.uniform1i(u.uGeo, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[1]);
    gl.uniform1i(u.uMat, 1);
    gl.uniform1f(u.uTime, this.reducedMotion ? time * 0.35 : time);
    gl.uniform1f(u.uThink, this.think);
    gl.uniform1f(u.uSpeak, this.speak);
    gl.uniform3fv(u.uFlame, this.flame);
    gl.uniform2fv(u.uFlameUv, this.flameUv);
    gl.uniform1f(u.uFlameScale, this.flameScale);
    gl.uniform1f(u.uMotion, this.reducedMotion ? 0 : 1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  loop() {
    if (this.running || this.lost) return;
    this.running = true;
    const tick = (now) => {
      if (document.hidden || this.lost) { this.running = false; return; }
      // 30 quadros por segundo bastam para chama e respiração.
      if (!this.last || now - this.last > 32) {
        this.last = now;
        this.frame(now);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
