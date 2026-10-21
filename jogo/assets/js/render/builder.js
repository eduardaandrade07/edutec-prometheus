// Construtor de cena: acumula geometria estática por material, aplica UVs em
// coordenadas do mundo (densidade de texel constante, sem esticamento) e mescla
// tudo em poucos draw calls. Também registra colisores e sombras de contato.
import * as THREE from "../../vendor/three/three.module.min.js";
import { RoundedBoxGeometry } from "../../vendor/three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "../../vendor/three/addons/utils/BufferGeometryUtils.js";

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function matrixFrom(x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  tmpEuler.set(rx, ry, rz, "YXZ");
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(x, y, z);
  tmpScale.set(sx, sy, sz);
  return new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale);
}

// Perfil de revolução a partir de pares [raio, altura].
export function latheGeometry(points, segments = 24, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments, phiStart, phiLength);
}

function normalizeGeometry(source) {
  let geometry = source.index ? source.toNonIndexed() : source.clone();
  Object.keys(geometry.attributes).forEach((name) => {
    if (!["position", "normal", "uv"].includes(name)) geometry.deleteAttribute(name);
  });
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) {
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  }
  geometry.morphAttributes = {};
  return geometry;
}

// UV por projeção de caixa em coordenadas de mundo.
function applyWorldUV(geometry, scale) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const [su, sv] = scale;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, x / su, z / su);
    else if (nx >= nz) uv.setXY(i, z / su, y / sv);
    else uv.setXY(i, x / su, y / sv);
  }
  uv.needsUpdate = true;
}

export class SceneBuilder {
  constructor(scene, materials, { contactShadowTexture } = {}) {
    this.scene = scene;
    this.materials = materials;
    this.batches = new Map();
    this.colliders = [];
    this.shadowDecals = [];
    this.contactShadowTexture = contactShadowTexture;
    this.geometryCache = new Map();
  }

  // Adiciona qualquer geometria já posicionada por uma matriz.
  add(material, geometry, matrix, { cast = true, receive = true } = {}) {
    const key = `${material.uuid}|${cast}|${receive}`;
    if (!this.batches.has(key)) this.batches.set(key, { material, cast, receive, parts: [] });
    const g = normalizeGeometry(geometry);
    g.applyMatrix4(matrix);
    this.batches.get(key).parts.push(g);
    return g;
  }

  box(material, w, h, d, x, y, z, opts = {}) {
    const radius = opts.r ?? Math.min(0.012, w * 0.2, h * 0.2, d * 0.2);
    const cacheKey = `box|${w}|${h}|${d}|${radius}`;
    let geometry = this.geometryCache.get(cacheKey);
    if (!geometry) {
      geometry = radius > 0.0005
        ? new RoundedBoxGeometry(w, h, d, opts.bevelSegments ?? 2, radius)
        : new THREE.BoxGeometry(w, h, d);
      this.geometryCache.set(cacheKey, geometry);
    }
    return this.add(material, geometry, matrixFrom(x, y, z, opts), opts);
  }

  cylinder(material, rTop, rBottom, h, x, y, z, opts = {}) {
    const seg = opts.seg ?? 24;
    const geometry = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, opts.open ?? false);
    return this.add(material, geometry, matrixFrom(x, y, z, opts), opts);
  }

  sphere(material, r, x, y, z, opts = {}) {
    const geometry = new THREE.SphereGeometry(r, opts.seg ?? 20, opts.rings ?? 14);
    return this.add(material, geometry, matrixFrom(x, y, z, opts), opts);
  }

  torus(material, r, tube, x, y, z, opts = {}) {
    const geometry = new THREE.TorusGeometry(r, tube, opts.radial ?? 10, opts.tubular ?? 36, opts.arc ?? Math.PI * 2);
    return this.add(material, geometry, matrixFrom(x, y, z, opts), opts);
  }

  lathe(material, points, x, y, z, opts = {}) {
    const geometry = latheGeometry(points, opts.seg ?? 28, opts.phiStart, opts.phiLength);
    return this.add(material, geometry, matrixFrom(x, y, z, opts), opts);
  }

  // Tubo ao longo de uma curva (cabos, mangueiras e tubulações).
  tube(material, points, radius, opts = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const geometry = new THREE.TubeGeometry(curve, opts.segments ?? 48, radius, opts.radial ?? 8, false);
    return this.add(material, geometry, new THREE.Matrix4(), opts);
  }

  // Colisor retangular alinhado aos eixos (centro, largura em x, profundidade em z).
  collider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  circleCollider(x, z, r) {
    this.colliders.push({ circle: true, x, z, r });
  }

  // Sombra de contato: um decalque difuso sob móveis e equipamentos.
  contactShadow(x, z, w, d, opacity = 0.55, ry = 0) {
    this.shadowDecals.push({ x, z, w, d, opacity, ry });
  }

  finalize() {
    const meshes = [];
    this.batches.forEach(({ material, cast, receive, parts }) => {
      if (material.userData.uvScale) parts.forEach((g) => applyWorldUV(g, material.userData.uvScale));
      const merged = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (!merged) return;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      meshes.push(mesh);
    });
    this.geometryCache.forEach((g) => g.dispose());

    if (this.shadowDecals.length && this.contactShadowTexture) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshBasicMaterial({
        map: this.contactShadowTexture, transparent: true, depthWrite: false, opacity: 1,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
      });
      const decals = new THREE.InstancedMesh(geometry, material, this.shadowDecals.length);
      const color = new THREE.Color();
      this.shadowDecals.forEach((d, i) => {
        decals.setMatrixAt(i, matrixFrom(d.x, 0.004, d.z, { ry: d.ry, sx: d.w, sz: d.d }));
        // A opacidade de cada decalque vai no canal vermelho da cor da instância.
        color.setRGB(d.opacity, d.opacity, d.opacity);
        decals.setColorAt(i, color);
      });
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\n#ifdef USE_COLOR\n diffuseColor.a *= vColor.r;\n#endif\n diffuseColor.rgb = vec3(0.0);",
        );
      };
      decals.renderOrder = -1;
      decals.instanceMatrix.needsUpdate = true;
      this.scene.add(decals);
      meshes.push(decals);
    }
    this.batches.clear();
    return meshes;
  }
}
