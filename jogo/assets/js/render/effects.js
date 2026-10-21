// Efeitos de atmosfera: material holográfico, feixes de projeção, poeira em
// suspensão, fachos de luz e marcador de objetivo.
import * as THREE from "../../vendor/three/three.module.min.js";

// ---------------------------------------------------------------------------
// Holograma: fresnel, linhas de varredura, faixa de leitura e falhas sutis.
// ---------------------------------------------------------------------------
export function createHologramMaterial(color = "#6ff2cf", { opacity = 1, scan = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uFlicker: { value: 1 },
      uGlitch: { value: 0 },
      uScan: { value: scan },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlitch;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float band = step(0.93, fract(sin(floor(world.y * 22.0 + uTime * 9.0) * 43758.5453)));
        world.x += band * uGlitch * 0.035;
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uFlicker;
      uniform float uScan;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      vec3 safeNormalize(vec3 v) { float l = length(v); return l > 1e-5 ? v / l : vec3(0.0, 1.0, 0.0); }
      void main() {
        vec3 n = safeNormalize(vNormalW);
        vec3 v = safeNormalize(cameraPosition - vWorld);
        float facing = clamp(abs(dot(n, v)), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.0);
        float lines = 0.72 + 0.28 * sin(vWorld.y * 260.0 - uTime * 3.0);
        float sweep = smoothstep(0.0, 0.03, fract(vWorld.y * 0.42 - uTime * 0.18)) * (1.0 - smoothstep(0.03, 0.09, fract(vWorld.y * 0.42 - uTime * 0.18)));
        float light = 0.35 + 0.65 * clamp(dot(n, normalize(vec3(-0.3, 0.8, 0.5))) * 0.5 + 0.5, 0.0, 1.0);
        float alpha = (0.3 + fresnel * 0.85) * mix(1.0, lines, uScan) * uFlicker * uOpacity;
        vec3 col = uColor * (light * 1.05 + fresnel * 1.9) + uColor * sweep * 1.4 * uScan;
        gl_FragColor = vec4(clamp(col, 0.0, 8.0), clamp(alpha + sweep * 0.25 * uScan, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

// Pré-passe de profundidade: faz o holograma esconder as próprias faces traseiras
// sem ocultar o cenário atrás dele.
export const hologramDepthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });

export function addDepthPrepass(root, order = 10) {
  const meshes = [];
  root.traverse((child) => { if (child.isMesh && child.material?.isShaderMaterial) meshes.push(child); });
  meshes.forEach((mesh) => {
    const depth = new THREE.Mesh(mesh.geometry, hologramDepthMaterial);
    depth.position.copy(mesh.position);
    depth.quaternion.copy(mesh.quaternion);
    depth.scale.copy(mesh.scale);
    depth.renderOrder = order;
    mesh.renderOrder = order + 1;
    mesh.parent.add(depth);
  });
}

// Feixe cônico de projeção com gradiente vertical (aditivo, sem iluminação).
export function createBeamMaterial(color = "#6ff2cf", strength = 0.35) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uStrength;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      vec3 safeNormalize(vec3 v) { float l = length(v); return l > 1e-5 ? v / l : vec3(0.0, 1.0, 0.0); }
      void main() {
        vec3 v = safeNormalize(cameraPosition - vWorld);
        float edge = pow(clamp(abs(dot(safeNormalize(vNormalW), v)), 0.0, 1.0), 1.4);
        float fade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.08, vUv.y);
        float shimmer = 0.85 + 0.15 * sin(vUv.x * 40.0 + uTime * 1.5) * sin(vUv.y * 18.0 - uTime * 2.0);
        float a = fade * edge * shimmer * uStrength;
        gl_FragColor = vec4(uColor * clamp(a, 0.0, 1.0), clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Poeira em suspensão: partículas suaves que cintilam e derivam devagar.
// ---------------------------------------------------------------------------
export function createDust(count, bounds, sprite) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    positions[i * 3 + 1] = 0.3 + Math.random() * 3.8;
    positions[i * 3 + 2] = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    seeds[i] = Math.random();
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: sprite },
      uColor: { value: new THREE.Color("#bfeee4") },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * 0.05;
        p.x += sin(t * (0.6 + aSeed) + aSeed * 40.0) * 0.35;
        p.y += sin(t * (0.4 + aSeed * 0.5) + aSeed * 13.0) * 0.25;
        p.z += cos(t * (0.5 + aSeed) + aSeed * 21.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_PointSize = (6.0 + aSeed * 8.0) * uPixelRatio * (1.0 / max(dist, 0.5));
        vAlpha = (0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0))) * smoothstep(0.3, 1.5, dist) * (1.0 - smoothstep(7.0, 13.0, dist));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha * 0.55;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 20;
  return points;
}

// ---------------------------------------------------------------------------
// Fachos de luz sob as luminárias (volumetria simulada, muito sutil).
// ---------------------------------------------------------------------------
export function createLightShaft(width, depth, height, color = "#dff4f1", strength = 0.05) {
  const geometry = new THREE.CylinderGeometry(0.5, 0.82, 1, 4, 1, true);
  geometry.rotateY(Math.PI / 4);
  geometry.translate(0, -0.5, 0);
  // UV.y vai de 1 (topo) a 0 (base) no CylinderGeometry; invertemos para o shader.
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setY(i, 1 - uv.getY(i));
  const material = createBeamMaterial(color, strength);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(width * 1.41, height, depth * 1.41);
  mesh.renderOrder = 19;
  return mesh;
}

// ---------------------------------------------------------------------------
// Marcador de objetivo: losango holográfico com anéis orbitais.
// ---------------------------------------------------------------------------
export function createObjectiveMarker(sprite) {
  const group = new THREE.Group();
  const holo = createHologramMaterial("#7ff4d3", { opacity: 1.2, scan: 0.3 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), holo);
  gem.scale.set(1, 1.5, 1);
  group.add(gem);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7ff4d3, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.006, 6, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.004, 6, 48, Math.PI * 1.3), ringMat);
  ring2.rotation.x = Math.PI / 2;
  group.add(ring2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0x7ff4d3, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(0.7, 0.7, 0.7);
  group.add(glow);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x7ff4d3, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  stem.position.y = -0.36;
  group.add(stem);
  group.renderOrder = 30;
  group.traverse((child) => { child.renderOrder = 30; });
  return {
    group,
    setColor(color) {
      holo.uniforms.uColor.value.set(color);
      ringMat.color.set(color);
      glow.material.color.set(color);
      stem.material.color.set(color);
    },
    update(time, reduced) {
      const t = time * 0.001;
      holo.uniforms.uTime.value = t;
      gem.rotation.y = reduced ? 0 : t * 1.4;
      ring.rotation.z = reduced ? 0 : t * 0.8;
      ring2.rotation.z = reduced ? 0 : -t * 1.2;
      const s = reduced ? 1 : 0.92 + Math.sin(t * 3.2) * 0.08;
      ring.scale.setScalar(s);
      glow.material.opacity = reduced ? 0.4 : 0.35 + Math.sin(t * 3.2) * 0.15;
    },
  };
}
