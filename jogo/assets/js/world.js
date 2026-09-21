import { composeMatrix, hexToRgb, lookAt, perspective } from "./math.js?v=3.0.1";

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform mat4 uModel;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vWorldPosition = world.xyz;
    vNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uProjection * uView * world;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uEmissive;
  uniform float uAlpha;
  uniform vec3 uFogColor;
  uniform vec3 uCamera;
  uniform vec3 uAccentColor;
  uniform vec3 uLightAColor;
  uniform vec3 uLightBColor;
  uniform vec3 uLightAPosition;
  uniform vec3 uLightBPosition;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(uCamera - vWorldPosition);
    vec3 keyDirection = normalize(vec3(-0.35, 0.82, 0.28));
    float key = max(dot(normal, keyDirection), 0.0);
    float specular = pow(max(dot(reflect(-keyDirection, normal), viewDirection), 0.0), 32.0);
    float hemisphere = normal.y * 0.5 + 0.5;

    vec3 toLightA = uLightAPosition - vWorldPosition;
    vec3 toLightB = uLightBPosition - vWorldPosition;
    float distanceA = length(toLightA);
    float distanceB = length(toLightB);
    float pointA = max(dot(normal, normalize(toLightA)), 0.0) / (1.0 + distanceA * distanceA * 0.045);
    float pointB = max(dot(normal, normalize(toLightB)), 0.0) / (1.0 + distanceB * distanceB * 0.055);

    vec3 lit = uColor * (0.18 + hemisphere * 0.15 + key * 0.42);
    lit += uColor * uLightAColor * pointA * 2.4;
    lit += uColor * uLightBColor * pointB * 2.0;
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4);
    lit += uAccentColor * rim * 0.18;
    lit += vec3(1.0) * specular * 0.11;
    float energy = 0.97 + sin(uTime * 0.0015 + vWorldPosition.x * 0.7 + vWorldPosition.z * 0.4) * 0.03;
    float panelGrain = sin(vWorldPosition.x * 17.0 + vWorldPosition.z * 13.0) * 0.012;
    float fineLines = sin(vWorldPosition.y * 38.0 + vWorldPosition.x * 5.0) * 0.006;
    vec3 materialColor = max(uColor + panelGrain + fineLines, vec3(0.0));
    lit = max(lit + materialColor * 0.025, vec3(0.0));
    vec3 emissiveColor = materialColor * 1.48 * energy + uAccentColor * 0.11;
    vec3 finalColor = mix(lit, emissiveColor, uEmissive);
    float distanceFromCamera = distance(vWorldPosition, uCamera);
    float fog = smoothstep(13.5, 31.0, distanceFromCamera);
    float depthFade = smoothstep(0.0, 1.0, normal.y * 0.5 + 0.5);
    finalColor = mix(finalColor, uFogColor, fog * (0.62 + depthFade * 0.12));
    finalColor = finalColor / (finalColor + vec3(0.82));
    finalColor = pow(max(finalColor, vec3(0.0)), vec3(0.92));
    gl_FragColor = vec4(min(finalColor, vec3(1.0)), uAlpha);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Falha ao preparar o ambiente 3D: ${message}`);
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Falha ao conectar o ambiente 3D: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function cubeGeometry() {
  const faces = [
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]],
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -1]],
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1], [0, 1, 0]],
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, -1, 0]],
    [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1], [1, 0, 0]],
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, 0, 0]],
  ];
  const positions = [];
  const normals = [];
  const indices = [0, 1, 2, 0, 2, 3];
  faces.forEach((face) => {
    indices.forEach((index) => {
      positions.push(...face[index]);
      normals.push(...face[4]);
    });
  });
  return { positions, normals };
}

function cylinderGeometry(segments = 16) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const ax = Math.cos(a);
    const az = Math.sin(a);
    const bx = Math.cos(b);
    const bz = Math.sin(b);
    positions.push(ax, -1, az, bx, 1, bz, bx, -1, bz, ax, -1, az, ax, 1, az, bx, 1, bz);
    normals.push(ax, 0, az, bx, 0, bz, bx, 0, bz, ax, 0, az, ax, 0, az, bx, 0, bz);
    positions.push(0, 1, 0, bx, 1, bz, ax, 1, az);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    positions.push(0, -1, 0, ax, -1, az, bx, -1, bz);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  }
  return { positions, normals };
}

function sphereGeometry(segments = 18, rings = 12) {
  const positions = [];
  const normals = [];
  const point = (ring, segment) => {
    const phi = (ring / rings) * Math.PI;
    const theta = (segment / segments) * Math.PI * 2;
    const radius = Math.sin(phi);
    return [radius * Math.cos(theta), Math.cos(phi), radius * Math.sin(theta)];
  };
  const push = (...vertices) => {
    vertices.forEach((vertex) => {
      positions.push(...vertex);
      normals.push(...vertex);
    });
  };
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = point(ring, segment);
      const b = point(ring + 1, segment);
      const c = point(ring + 1, segment + 1);
      const d = point(ring, segment + 1);
      push(a, c, b, a, d, c);
    }
  }
  return { positions, normals };
}

function torusGeometry(major = 1, minor = 0.22, segments = 24, sides = 10) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    for (let j = 0; j < sides; j += 1) {
      const b0 = (j / sides) * Math.PI * 2;
      const b1 = ((j + 1) / sides) * Math.PI * 2;
      const v = (a, b) => {
        const r = major + minor * Math.cos(b);
        return [r * Math.cos(a), minor * Math.sin(b), r * Math.sin(a)];
      };
      const n = (a, b) => [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)];
      const p00 = v(a0, b0), p10 = v(a1, b0), p11 = v(a1, b1), p01 = v(a0, b1);
      const n00 = n(a0, b0), n10 = n(a1, b0), n11 = n(a1, b1), n01 = n(a0, b1);
      positions.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      normals.push(...n00, ...n10, ...n11, ...n00, ...n11, ...n01);
    }
  }
  return { positions, normals };
}

function coneGeometry(segments = 20) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const ax = Math.cos(a), az = Math.sin(a), bx = Math.cos(b), bz = Math.sin(b);
    positions.push(0, 1, 0, bx, -1, bz, ax, -1, az);
    const side = [ax + bx, 1, az + bz];
    const len = Math.hypot(side[0], side[1], side[2]) || 1;
    const sn = side.map((v) => v / len);
    normals.push(...sn, ...sn, ...sn);
    positions.push(0, -1, 0, ax, -1, az, bx, -1, bz);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  }
  return { positions, normals };
}

function createMesh(gl, geometry) {
  const position = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);
  const normal = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normal);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);
  return { position, normal, count: geometry.positions.length / 3 };
}

const QUALITY_INDEX = { low: 0, medium: 1, high: 2 };

export class WorldRenderer extends EventTarget {
  constructor(canvas, settings) {
    super();
    this.canvas = canvas;
    this.settings = settings;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: settings.quality !== "low",
      depth: true,
      powerPreference: "default",
      preserveDrawingBuffer: false,
    });
    if (!this.gl) throw new Error("Este navegador não conseguiu iniciar o WebGL.");

    const gl = this.gl;
    this.program = createProgram(gl);
    this.meshes = {
      cube: createMesh(gl, cubeGeometry()),
      cylinder: createMesh(gl, cylinderGeometry(20)),
      sphere: createMesh(gl, sphereGeometry(20, 14)),
      torus: createMesh(gl, torusGeometry(1, 0.18, 28, 12)),
      cone: createMesh(gl, coneGeometry(24)),
    };
    this.locations = {
      position: gl.getAttribLocation(this.program, "aPosition"),
      normal: gl.getAttribLocation(this.program, "aNormal"),
      projection: gl.getUniformLocation(this.program, "uProjection"),
      view: gl.getUniformLocation(this.program, "uView"),
      model: gl.getUniformLocation(this.program, "uModel"),
      color: gl.getUniformLocation(this.program, "uColor"),
      emissive: gl.getUniformLocation(this.program, "uEmissive"),
      alpha: gl.getUniformLocation(this.program, "uAlpha"),
      fogColor: gl.getUniformLocation(this.program, "uFogColor"),
      camera: gl.getUniformLocation(this.program, "uCamera"),
      accentColor: gl.getUniformLocation(this.program, "uAccentColor"),
      lightAColor: gl.getUniformLocation(this.program, "uLightAColor"),
      lightBColor: gl.getUniformLocation(this.program, "uLightBColor"),
      lightAPosition: gl.getUniformLocation(this.program, "uLightAPosition"),
      lightBPosition: gl.getUniformLocation(this.program, "uLightBPosition"),
      time: gl.getUniformLocation(this.program, "uTime"),
    };
    this.objects = [];
    this.interactables = [];
    this.activeTarget = "helena";
    this.chapter = 1;
    this.fogColor = hexToRgb("#071417");
    this.accentColor = hexToRgb("#58f4c2");
    this.lightAColor = hexToRgb("#67f4d0");
    this.lightBColor = hexToRgb("#5d9dd7");
    this.lightAPosition = [-5.4, 3.6, -5.3];
    this.lightBPosition = [4.8, 3.2, 5.7];
    this.buildLaboratory();
    this.resize();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.dispatchEvent(new Event("contextlost"));
    });
    window.addEventListener("resize", () => this.resize(), { passive: true });
  }

  add(shape, id, position, scale, color, options = {}) {
    const parsedColor = hexToRgb(color);
    const object = {
      shape,
      id,
      position: [...position],
      basePosition: [...position],
      scale: [...scale],
      rotationY: options.rotationY || 0,
      rotationX: options.rotationX || 0,
      rotationZ: options.rotationZ || 0,
      color: [...parsedColor],
      baseColor: [...parsedColor],
      initialColor: [...parsedColor],
      emissive: options.emissive || 0,
      baseEmissive: options.emissive || 0,
      initialEmissive: options.emissive || 0,
      alpha: options.alpha ?? 1,
      minQuality: options.minQuality ?? 0,
      animation: options.animation || null,
      initialAnimation: options.animation || null,
      targetId: options.targetId || null,
      visible: options.visible ?? true,
      initialVisible: options.visible ?? true,
      rotationSpeed: options.rotationSpeed || 0,
      bobAmount: options.bobAmount ?? 0.035,
    };
    this.objects.push(object);
    return object;
  }

  cube(id, position, scale, color, options) {
    return this.add("cube", id, position, scale, color, options);
  }

  cylinder(id, position, scale, color, options) {
    return this.add("cylinder", id, position, scale, color, options);
  }

  sphere(id, position, scale, color, options) {
    return this.add("sphere", id, position, scale, color, options);
  }

  torus(id, position, scale, color, options) {
    return this.add("torus", id, position, scale, color, options);
  }

  cone(id, position, scale, color, options) {
    return this.add("cone", id, position, scale, color, options);
  }

  buildLaboratory() {
    const wall = "#193033";
    const wallDark = "#0d2225";
    const metal = "#294348";
    const metalDark = "#142b2f";
    const mint = "#4ad3ad";
    const blue = "#4b98c4";
    const amber = "#d49a45";

    this.cube("floor", [0, -0.14, 0], [9.7, 0.14, 10.8], "#102427");
    this.cube("ceiling", [0, 4.65, 0], [9.7, 0.12, 10.8], "#0a1a1d", { minQuality: 1 });
    this.cube("wall-back", [0, 2.3, -10.75], [9.8, 2.3, 0.15], wall);
    this.cube("wall-front", [0, 2.3, 10.75], [9.8, 2.3, 0.15], wallDark);
    this.cube("wall-left", [-9.75, 2.3, 0], [0.15, 2.3, 10.8], wall);
    this.cube("wall-right", [9.75, 2.3, 0], [0.15, 2.3, 10.8], wall);

    this.cube("divider-left", [-3.8, 2.3, 0.9], [5.8, 2.3, 0.12], wallDark);
    this.cube("divider-right", [7.4, 2.3, 0.9], [2.35, 2.3, 0.12], wallDark);
    this.cube("door-frame-left", [2.02, 2.2, 0.9], [0.17, 2.2, 0.3], amber, { emissive: 0.2 });
    this.cube("door-frame-right", [5.03, 2.2, 0.9], [0.17, 2.2, 0.3], amber, { emissive: 0.2 });
    this.cube("door-frame-top", [3.53, 4.25, 0.9], [1.68, 0.16, 0.3], amber, { emissive: 0.2 });

    for (let x = -8.4; x <= 8.4; x += 2.4) {
      this.cube(`grid-x-${x}`, [x, 0.012, 0], [0.012, 0.013, 10.5], "#31585a", { emissive: 0.12, minQuality: 1 });
    }
    for (let z = -9.6; z <= 9.6; z += 2.4) {
      this.cube(`grid-z-${z}`, [0, 0.013, z], [9.4, 0.012, 0.012], "#31585a", { emissive: 0.12, minQuality: 1 });
    }

    [-7.2, -2.4, 2.4, 7.2].forEach((z, index) => {
      this.cube(`ceiling-light-${index}`, [0, 4.49, z], [4.6, 0.035, 0.09], "#8ef2d6", { emissive: 0.85 });
    });

    // Layered wall panels and structural ribs make the small room feel authored,
    // while remaining simple reusable geometry.
    [-7.2, -3.6, 0, 3.6, 7.2].forEach((z, index) => {
      this.cube(`left-panel-${index}`, [-9.53, 2.15, z], [0.045, 1.72, 1.42], index % 2 ? "#17363a" : "#1b3d40", { minQuality: 1 });
      this.cube(`right-panel-${index}`, [9.53, 2.15, z], [0.045, 1.72, 1.42], index % 2 ? "#142f35" : "#18383d", { minQuality: 1 });
    });
    [-7.2, -2.4, 2.4, 7.2].forEach((z, index) => {
      this.cube(`ceiling-rib-${index}`, [0, 4.35, z], [9.35, 0.10, 0.18], "#27454a", { minQuality: 1 });
    });
    this.cube("lab-floor-spine", [-3.15, 0.018, -4.8], [0.045, 0.012, 5.55], mint, { emissive: 0.46 });
    this.cube("annex-floor-spine", [3.55, 0.018, 5.75], [0.045, 0.012, 4.8], amber, { emissive: 0.42 });

    // Helena: personagem holográfica com uma silhueta feminina mais natural.
    // Os volumes são distribuídos para formar cabeça, pescoço, ombros, cintura,
    // quadril, braços articulados e pernas, evitando o aspecto de boneco geométrico.
    const helenaTarget = { targetId: "helena", animation: "float" };
    const skin = "#a9f2dc";
    const skinLight = "#d8fff5";
    const coat = "#63cdb2";
    const coatLight = "#9af0d5";
    const hair = "#123337";
    const hairGlow = "#245b5c";
    const suit = "#17383b";

    this.cylinder("helena-pedestal", [-3.8, 0.2, -4.8], [0.74, 0.2, 0.74], metal, { targetId: "helena" });
    this.torus("helena-ring", [-3.8, 0.48, -4.8], [0.84, 0.035, 0.84], mint, { emissive: 0.9, targetId: "helena", animation: "pulse" });

    // Pernas: coxas mais largas, joelhos suaves e panturrilhas mais estreitas.
    this.cylinder("helena-thigh-left", [-4.00, 0.86, -4.8], [0.16, 0.34, 0.16], suit, { ...helenaTarget, alpha: 0.9, emissive: 0.18, rotationZ: -0.025 });
    this.cylinder("helena-thigh-right", [-3.60, 0.86, -4.8], [0.16, 0.34, 0.16], suit, { ...helenaTarget, alpha: 0.9, emissive: 0.18, rotationZ: 0.025 });
    this.sphere("helena-knee-left", [-4.00, 1.18, -4.8], [0.155, 0.15, 0.155], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.25 });
    this.sphere("helena-knee-right", [-3.60, 1.18, -4.8], [0.155, 0.15, 0.155], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.25 });
    this.cylinder("helena-shin-left", [-4.00, 0.75, -4.8], [0.125, 0.31, 0.125], suit, { ...helenaTarget, alpha: 0.9, emissive: 0.2, rotationZ: -0.018 });
    this.cylinder("helena-shin-right", [-3.60, 0.75, -4.8], [0.125, 0.31, 0.125], suit, { ...helenaTarget, alpha: 0.9, emissive: 0.2, rotationZ: 0.018 });
    this.sphere("helena-shoe-left", [-4.03, 0.46, -4.68], [0.22, 0.105, 0.31], suit, { ...helenaTarget, alpha: 0.96, emissive: 0.2 });
    this.sphere("helena-shoe-right", [-3.57, 0.46, -4.68], [0.22, 0.105, 0.31], suit, { ...helenaTarget, alpha: 0.96, emissive: 0.2 });

    // Quadril, cintura e jaleco. A cintura é mais estreita e o quadril dá uma leitura feminina.
    this.sphere("helena-hips", [-3.8, 1.33, -4.8], [0.52, 0.30, 0.34], coat, { ...helenaTarget, alpha: 0.91, emissive: 0.3 });
    this.sphere("helena-waist", [-3.8, 1.56, -4.8], [0.39, 0.28, 0.30], coatLight, { ...helenaTarget, alpha: 0.9, emissive: 0.32 });
    this.sphere("helena-torso", [-3.8, 1.76, -4.8], [0.54, 0.50, 0.34], coat, { ...helenaTarget, alpha: 0.91, emissive: 0.32 });
    this.sphere("helena-chest", [-3.8, 1.84, -4.50], [0.39, 0.31, 0.08], coatLight, { ...helenaTarget, alpha: 0.48, emissive: 0.5 });
    this.cube("helena-coat-panel", [-3.8, 1.68, -4.45], [0.055, 0.39, 0.025], "#e4fff7", { ...helenaTarget, alpha: 0.7, emissive: 0.75 });
    this.cube("helena-badge", [-3.58, 1.82, -4.43], [0.10, 0.13, 0.025], "#effff9", { ...helenaTarget, alpha: 0.95, emissive: 1.0 });

    // Ombros, braços superiores, cotovelos, antebraços e mãos.
    this.sphere("helena-shoulder-left", [-4.27, 1.98, -4.8], [0.20, 0.20, 0.20], coat, { ...helenaTarget, alpha: 0.92, emissive: 0.3 });
    this.sphere("helena-shoulder-right", [-3.33, 1.98, -4.8], [0.20, 0.20, 0.20], coat, { ...helenaTarget, alpha: 0.92, emissive: 0.3 });
    this.cylinder("helena-upper-arm-left", [-4.43, 1.70, -4.8], [0.125, 0.28, 0.125], coat, { ...helenaTarget, alpha: 0.91, emissive: 0.27, rotationZ: -0.17 });
    this.cylinder("helena-upper-arm-right", [-3.17, 1.70, -4.8], [0.125, 0.28, 0.125], coat, { ...helenaTarget, alpha: 0.91, emissive: 0.27, rotationZ: 0.17 });
    this.sphere("helena-elbow-left", [-4.51, 1.47, -4.8], [0.13, 0.13, 0.13], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.25 });
    this.sphere("helena-elbow-right", [-3.09, 1.47, -4.8], [0.13, 0.13, 0.13], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.25 });
    this.cylinder("helena-forearm-left", [-4.56, 1.25, -4.79], [0.105, 0.27, 0.105], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.28, rotationZ: -0.08 });
    this.cylinder("helena-forearm-right", [-3.04, 1.25, -4.79], [0.105, 0.27, 0.105], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.28, rotationZ: 0.08 });
    this.sphere("helena-hand-left", [-4.58, 1.02, -4.78], [0.135, 0.17, 0.115], skinLight, { ...helenaTarget, alpha: 0.9, emissive: 0.35 });
    this.sphere("helena-hand-right", [-3.02, 1.02, -4.78], [0.135, 0.17, 0.115], skinLight, { ...helenaTarget, alpha: 0.9, emissive: 0.35 });

    // Pescoço e cabeça: rosto mais alongado, mandíbula suave e cabelo com volume.
    this.cylinder("helena-neck", [-3.8, 2.16, -4.8], [0.14, 0.16, 0.14], skin, { ...helenaTarget, alpha: 0.92, emissive: 0.3 });
    this.sphere("helena-jaw", [-3.8, 2.40, -4.8], [0.30, 0.31, 0.27], skin, { ...helenaTarget, alpha: 0.94, emissive: 0.38 });
    this.sphere("helena-face", [-3.8, 2.49, -4.77], [0.315, 0.35, 0.285], skinLight, { ...helenaTarget, alpha: 0.9, emissive: 0.35 });
    this.sphere("helena-hair-main", [-3.8, 2.67, -4.86], [0.37, 0.31, 0.33], hair, { ...helenaTarget, alpha: 0.95, emissive: 0.14 });
    this.sphere("helena-hair-back", [-3.8, 2.45, -5.02], [0.38, 0.42, 0.18], hair, { ...helenaTarget, alpha: 0.95, emissive: 0.13 });
    this.sphere("helena-hair-left", [-4.08, 2.48, -4.82], [0.15, 0.34, 0.18], hairGlow, { ...helenaTarget, alpha: 0.94, emissive: 0.16 });
    this.sphere("helena-hair-right", [-3.52, 2.48, -4.82], [0.15, 0.34, 0.18], hairGlow, { ...helenaTarget, alpha: 0.94, emissive: 0.16 });
    this.sphere("helena-bang-left", [-3.94, 2.66, -4.49], [0.14, 0.15, 0.10], hair, { ...helenaTarget, alpha: 0.95, emissive: 0.16 });
    this.sphere("helena-bang-right", [-3.66, 2.67, -4.49], [0.14, 0.15, 0.10], hair, { ...helenaTarget, alpha: 0.95, emissive: 0.16 });

    // Orelhas e pequenos detalhes faciais.
    this.sphere("helena-ear-left", [-4.11, 2.49, -4.78], [0.055, 0.095, 0.065], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.23 });
    this.sphere("helena-ear-right", [-3.49, 2.49, -4.78], [0.055, 0.095, 0.065], skin, { ...helenaTarget, alpha: 0.9, emissive: 0.23 });
    this.sphere("helena-eye-left", [-3.91, 2.56, -4.49], [0.052, 0.061, 0.025], "#f2ffff", { ...helenaTarget, alpha: 0.99, emissive: 1.0 });
    this.sphere("helena-eye-right", [-3.69, 2.56, -4.49], [0.052, 0.061, 0.025], "#f2ffff", { ...helenaTarget, alpha: 0.99, emissive: 1.0 });
    this.sphere("helena-pupil-left", [-3.91, 2.56, -4.465], [0.021, 0.028, 0.013], "#153f47", { ...helenaTarget, alpha: 1, emissive: 0.2 });
    this.sphere("helena-pupil-right", [-3.69, 2.56, -4.465], [0.021, 0.028, 0.013], "#153f47", { ...helenaTarget, alpha: 1, emissive: 0.2 });
    this.sphere("helena-nose", [-3.8, 2.47, -4.47], [0.035, 0.06, 0.035], skin, { ...helenaTarget, alpha: 0.8, emissive: 0.2 });
    this.sphere("helena-mouth", [-3.8, 2.37, -4.485], [0.078, 0.021, 0.016], "#bfffe9", { ...helenaTarget, alpha: 0.82, emissive: 0.28 });
    this.sphere("helena-lip-highlight", [-3.8, 2.375, -4.505], [0.052, 0.009, 0.008], "#effff9", { ...helenaTarget, alpha: 0.8, emissive: 0.6 });
    this.torus("helena-earring-left", [-4.12, 2.40, -4.77], [0.035, 0.009, 0.035], mint, { ...helenaTarget, emissive: 0.9 });
    this.torus("helena-earring-right", [-3.48, 2.40, -4.77], [0.035, 0.009, 0.035], mint, { ...helenaTarget, emissive: 0.9 });

    // Pequeno halo holográfico atrás da personagem para separar a silhueta do laboratório.
    this.torus("helena-halo", [-3.8, 2.15, -5.04], [0.98, 0.018, 0.98], "#69e5c4", { ...helenaTarget, emissive: 0.62, rotationX: Math.PI / 2, animation: "pulse" });

    // Case comparison wall.
    this.cube("case-console-base", [0, 1.72, -10.32], [2.65, 1.45, 0.2], metalDark, { targetId: "case-board" });
    this.cube("case-screen-main", [0, 1.9, -10.08], [2.3, 1.05, 0.035], "#1d6b6c", { emissive: 0.62, targetId: "case-board", animation: "screen" });
    [-1.45, 0, 1.45].forEach((x, index) => {
      this.cube(`case-line-${index}`, [x, 1.88, -10], [0.45, 0.045, 0.02], index === 1 ? amber : mint, { emissive: 0.9, targetId: "case-board" });
      this.cube(`case-column-${index}`, [x, 1.38, -10], [0.45, 0.23 + index * 0.11, 0.02], "#66b8ad", { emissive: 0.48, targetId: "case-board" });
    });

    // Molecular analyzer.
    this.cube("analyzer-base", [5.1, 0.58, -6.2], [1.4, 0.58, 1.0], metal, { targetId: "analyzer" });
    this.cube("analyzer-neck", [5.1, 1.42, -6.62], [1.18, 0.55, 0.48], metalDark, { targetId: "analyzer" });
    this.cube("analyzer-screen", [5.1, 1.62, -6.08], [0.92, 0.36, 0.04], blue, { emissive: 0.62, targetId: "analyzer", animation: "screen" });
    this.cylinder("analyzer-port", [5.1, 1.17, -5.22], [0.35, 0.06, 0.35], "#78cce9", { rotationY: Math.PI / 2, emissive: 0.5, targetId: "analyzer" });

    // Work benches and reusable lab props.
    [-6.9, -1.6].forEach((x, index) => {
      this.cube(`bench-${index}`, [x, 0.76, -8.0], [1.25, 0.12, 0.74], metal);
      this.cube(`bench-leg-a-${index}`, [x - 0.9, 0.36, -8.0], [0.1, 0.4, 0.6], metalDark);
      this.cube(`bench-leg-b-${index}`, [x + 0.9, 0.36, -8.0], [0.1, 0.4, 0.6], metalDark);
      this.cylinder(`flask-${index}`, [x, 1.04, -8.0], [0.17, 0.28, 0.17], index ? amber : blue, { alpha: 0.8, emissive: 0.25, minQuality: 1 });
    });

    // Detailed laboratory props: microscope, pipette rack, tubes and a stool.
    this.cylinder("microscope-base", [-8.05, 0.94, -7.7], [0.52, 0.08, 0.38], metalDark, { minQuality: 1 });
    this.cylinder("microscope-neck", [-8.05, 1.25, -7.7], [0.09, 0.35, 0.09], metal, { minQuality: 1 });
    this.torus("microscope-focus", [-8.05, 1.62, -7.7], [0.23, 0.035, 0.23], blue, { emissive: 0.45, rotationSpeed: 0.4, minQuality: 1 });
    this.sphere("microscope-lens", [-8.05, 1.58, -7.7], [0.12, 0.08, 0.12], "#9bdfff", { emissive: 0.6, minQuality: 1 });
    for (let index = 0; index < 6; index += 1) {
      const x = -2.3 + (index % 3) * 0.22;
      const z = -8.25 + Math.floor(index / 3) * 0.22;
      this.cylinder(`tube-${index}`, [x, 1.0, z], [0.055, 0.23, 0.055], index % 2 ? mint : blue, { alpha: 0.78, emissive: 0.34, minQuality: 1 });
      this.torus(`tube-ring-${index}`, [x, 1.22, z], [0.06, 0.012, 0.06], "#d8fff4", { alpha: 0.55, emissive: 0.5, minQuality: 1 });
    }
    this.cylinder("stool-seat", [-6.0, 0.72, -6.25], [0.48, 0.10, 0.48], "#294a4d", { minQuality: 1 });
    this.cylinder("stool-column", [-6.0, 0.39, -6.25], [0.08, 0.33, 0.08], metalDark, { minQuality: 1 });
    this.torus("stool-footring", [-6.0, 0.18, -6.25], [0.34, 0.045, 0.34], metal, { minQuality: 1 });

    // Decontamination corridor cues.
    [-0.9, -0.3, 0.3].forEach((z, index) => {
      this.cube(`threshold-${index}`, [3.53, 0.025, z + 0.9], [1.25, 0.018, 0.055], amber, { emissive: 0.45 });
    });

    // Epidemiology call terminal in the triage annex.
    this.cube("caio-desk", [4.4, 0.72, 5.4], [1.5, 0.72, 0.8], metal, { targetId: "caio-terminal" });
    this.cube("caio-screen", [4.4, 1.83, 5.82], [1.1, 0.75, 0.06], "#3b82b8", { rotationY: Math.PI, emissive: 0.72, targetId: "caio-terminal", animation: "screen" });
    this.sphere("caio-avatar", [4.4, 1.84, 5.67], [0.24, 0.32, 0.12], "#8ccfff", { alpha: 0.62, emissive: 0.82, targetId: "caio-terminal", animation: "float" });

    // Patient observation pods (abstract, non-graphic).
    [-5.8, -1.8].forEach((x, index) => {
      this.cube(`pod-base-${index}`, [x, 0.48, 4.8], [1.45, 0.42, 0.84], "#203a3e");
      this.cube(`pod-cover-${index}`, [x, 0.93, 4.8], [1.25, 0.27, 0.68], "#2e6a70", { alpha: 0.62, emissive: 0.14 });
      this.cube(`pod-monitor-${index}`, [x + 1.58, 1.38, 4.8], [0.08, 0.58, 0.48], metalDark);
      this.cube(`pod-screen-${index}`, [x + 1.48, 1.47, 4.8], [0.02, 0.34, 0.32], index ? amber : mint, { emissive: 0.75, animation: "screen" });
    });

    // Sealed sample locker.
    this.cube("locker-body", [-5.9, 1.35, 9.9], [1.28, 1.35, 0.62], metalDark, { targetId: "sample-locker" });
    this.cube("locker-door", [-5.9, 1.35, 9.21], [1.12, 1.16, 0.05], "#23515a", { emissive: 0.17, targetId: "sample-locker" });
    this.cube("locker-status", [-5.9, 2.02, 9.12], [0.42, 0.12, 0.025], blue, { emissive: 0.82, targetId: "sample-locker", animation: "pulse" });
    this.cylinder("sample-vial-world", [-5.9, 1.17, 9.02], [0.11, 0.32, 0.11], "#80cfff", { emissive: 0.8, targetId: "sample-locker", animation: "float" });

    // Compact PCR cycler with a luminous amplification chamber.
    this.cube("pcr-base", [-7.15, 0.55, -3.1], [1.25, 0.55, 0.92], metal, { targetId: "pcr-machine" });
    this.cube("pcr-lid", [-7.15, 1.18, -3.25], [1.02, 0.16, 0.68], metalDark, { targetId: "pcr-machine" });
    this.cylinder("pcr-chamber", [-7.15, 1.13, -2.63], [0.48, 0.08, 0.48], "#8a68d8", { emissive: 0.64, targetId: "pcr-machine", animation: "pulse" });
    this.cube("pcr-screen", [-6.45, 1.18, -2.52], [0.34, 0.28, 0.035], "#9d75f0", { rotationY: -0.3, emissive: 0.62, targetId: "pcr-machine", animation: "screen" });

    // Two reading towers form the low-poly sequencer.
    this.cube("sequencer-base", [7.05, 0.55, -8.55], [1.45, 0.55, 0.82], metal, { targetId: "sequencer" });
    this.cube("sequencer-tower-a", [6.36, 1.48, -8.72], [0.46, 0.92, 0.54], metalDark, { targetId: "sequencer" });
    this.cube("sequencer-tower-b", [7.74, 1.48, -8.72], [0.46, 0.92, 0.54], metalDark, { targetId: "sequencer" });
    this.cube("sequencer-screen", [7.05, 1.62, -7.66], [0.7, 0.5, 0.045], "#3d9ac4", { emissive: 0.75, targetId: "sequencer", animation: "screen" });
    for (let index = 0; index < 5; index += 1) {
      this.cube(`sequencer-read-${index}`, [6.55 + index * 0.25, 1.45 + (index % 2) * 0.2, -7.6], [0.08, 0.025, 0.015], index % 2 ? amber : mint, { emissive: 0.85, targetId: "sequencer", minQuality: 1 });
    }

    // Epidemiology map table and response console in the annex.
    this.cube("outbreak-table", [-1.8, 0.7, 7.0], [1.75, 0.7, 1.15], metalDark, { targetId: "outbreak-map" });
    this.cube("outbreak-map-screen", [-1.8, 1.44, 7.0], [1.55, 0.035, 0.96], "#245f66", { emissive: 0.5, targetId: "outbreak-map", animation: "screen" });
    [[-2.6, 6.55], [-2.0, 7.25], [-1.35, 6.75], [-0.9, 7.55]].forEach(([x, z], index) => {
      this.cylinder(`map-node-${index}`, [x, 1.51, z], [0.08, 0.04, 0.08], index < 2 ? "#ff655f" : amber, { emissive: 0.95, targetId: "outbreak-map", animation: "pulse" });
    });

    this.cube("response-desk", [7.0, 0.72, 6.95], [1.55, 0.72, 0.86], metal, { targetId: "response-console" });
    this.cube("response-screen", [7.0, 1.6, 6.35], [1.2, 0.58, 0.05], amber, { emissive: 0.62, targetId: "response-console", animation: "screen" });
    [6.35, 6.78, 7.21, 7.64].forEach((x, index) => {
      this.cube(`response-bar-${index}`, [x, 1.38 + index * 0.1, 6.29], [0.12, 0.18 + index * 0.07, 0.02], index === 3 ? "#ff655f" : amber, { emissive: 0.82, targetId: "response-console" });
    });

    // Vaccine development console.
    this.cube("vaccine-base", [7.25, 0.65, -2.2], [1.3, 0.65, 0.92], metal, { targetId: "vaccine-console" });
    this.cube("vaccine-screen", [7.25, 1.52, -1.56], [1.05, 0.58, 0.04], "#2d8f75", { emissive: 0.72, targetId: "vaccine-console", animation: "screen" });
    this.sphere("vaccine-core", [7.25, 1.35, -2.22], [0.34, 0.5, 0.34], mint, { alpha: 0.64, emissive: 0.84, targetId: "vaccine-console", animation: "float", bobAmount: 0.055 });

    // Variant comparison terminal.
    this.cube("variant-base", [1.35, 0.62, -5.25], [1.15, 0.62, 0.78], metalDark, { targetId: "variant-terminal" });
    this.cube("variant-screen", [1.35, 1.55, -4.72], [0.95, 0.62, 0.04], "#9d75f0", { emissive: 0.66, targetId: "variant-terminal", animation: "screen" });
    [-0.45, 0, 0.45].forEach((offset, index) => {
      this.cube(`variant-letter-${index}`, [0.9 + index * 0.45, 1.55, -4.66], [0.12, 0.06, 0.02], index === 1 ? "#ff655f" : "#9d75f0", { emissive: 0.9, targetId: "variant-terminal" });
    });

    // Final command table.
    this.cylinder("final-table", [0.6, 0.62, 4.85], [1.65, 0.62, 1.65], "#203b3f", { targetId: "final-console" });
    this.cylinder("final-ring", [0.6, 1.28, 4.85], [1.35, 0.035, 1.35], amber, { emissive: 0.72, targetId: "final-console", animation: "pulse" });
    this.sphere("final-core", [0.6, 1.55, 4.85], [0.5, 0.2, 0.5], "#ffb84d", { alpha: 0.65, emissive: 0.86, targetId: "final-console", animation: "float", bobAmount: 0.06 });

    // Illustrated wall boards: layered molecular diagrams instead of empty panels.
    this.cube("wall-board-frame", [-6.8, 2.65, -10.48], [1.55, 1.05, 0.035], "#112a2e", { minQuality: 1 });
    this.cube("wall-board-inner", [-6.8, 2.65, -10.42], [1.42, 0.92, 0.018], "#183f43", { emissive: 0.08, minQuality: 1 });
    for (let index = 0; index < 7; index += 1) {
      const x = -7.8 + index * 0.34;
      const y = 2.15 + (index % 3) * 0.28;
      this.sphere(`wall-molecule-${index}`, [x, y, -10.34], [0.055, 0.055, 0.055], index % 2 ? mint : blue, { emissive: 0.72, minQuality: 1 });
      if (index > 0) this.cube(`wall-bond-${index}`, [x - 0.17, y - 0.05, -10.34], [0.16, 0.018, 0.018], "#74cfc0", { emissive: 0.38, minQuality: 1 });
    }
    this.cube("wall-board-title", [-6.8, 3.55, -10.34], [0.78, 0.025, 0.018], mint, { emissive: 0.75, minQuality: 1 });

    // A compact DNA hologram gives the laboratory a memorable visual landmark.
    this.cylinder("dna-plinth", [3.8, 0.24, -9.65], [0.62, 0.24, 0.62], metalDark, { minQuality: 0 });
    this.cylinder("dna-plinth-ring", [3.8, 0.52, -9.65], [0.72, 0.025, 0.72], blue, { emissive: 0.82, animation: "pulse", minQuality: 0 });
    for (let index = 0; index < 12; index += 1) {
      const angle = index * 0.72;
      const y = 0.78 + index * 0.27;
      const xA = 3.8 + Math.cos(angle) * 0.38;
      const zA = -9.64 + Math.sin(angle) * 0.22;
      const xB = 3.8 - Math.cos(angle) * 0.38;
      const zB = -9.64 - Math.sin(angle) * 0.22;
      const dx = xB - xA;
      const dz = zB - zA;
      const detail = index % 3 === 0 ? 0 : index % 2 === 0 ? 1 : 2;
      this.sphere(`dna-a-${index}`, [xA, y, zA], [0.075, 0.075, 0.075], index % 2 ? mint : blue, { emissive: 0.78, animation: "pulse", minQuality: detail });
      this.sphere(`dna-b-${index}`, [xB, y, zB], [0.075, 0.075, 0.075], index % 2 ? blue : mint, { emissive: 0.78, animation: "pulse", minQuality: detail });
      this.cube(`dna-rung-${index}`, [(xA + xB) / 2, y, (zA + zB) / 2], [Math.hypot(dx, dz) / 2, 0.022, 0.022], "#7cd9cf", {
        rotationY: Math.atan2(-dz, dx), emissive: 0.45, alpha: 0.72, minQuality: detail,
      });
    }

    // Sparse floating motes are only enabled above low quality.
    [[-7.8, 2.7, -6.4], [-5.4, 3.2, -1.1], [-1.0, 2.9, -8.8], [2.2, 3.35, -3.2], [5.8, 2.65, -5.1], [-6.5, 3.1, 6.6], [-2.8, 2.55, 2.8], [2.7, 3.0, 8.2], [7.7, 2.85, 3.1], [5.0, 3.4, 0.4]].forEach((position, index) => {
      this.sphere(`air-mote-${index}`, position, [0.018, 0.018, 0.018], index % 3 ? "#7cf4d3" : "#73b9ff", {
        alpha: 0.58, emissive: 0.95, animation: "drift", minQuality: index < 5 ? 1 : 2, bobAmount: 0.12,
      });
    });

    // Pipes and wall accents are progressively enabled by quality setting.
    [-8.8, 8.8].forEach((x, side) => {
      this.cylinder(`pipe-${side}`, [x, 3.45, -2.3], [0.12, 6.2, 0.12], "#315056", { rotationY: Math.PI / 2, minQuality: 2 });
    });
    [-7.2, -2.4, 2.4, 7.2].forEach((z, index) => {
      this.cube(`wall-accent-left-${index}`, [-9.48, 2.1, z], [0.04, 1.8, 0.035], mint, { emissive: 0.45, minQuality: 1 });
      this.cube(`wall-accent-right-${index}`, [9.48, 2.1, z], [0.04, 1.8, 0.035], blue, { emissive: 0.35, minQuality: 2 });
    });

    this.interactables = [
      { id: "helena", position: [-3.8, 1.55, -4.3], label: "FALAR COM HELENA", range: 3.1 },
      { id: "case-board", position: [0, 1.8, -9.85], label: "ABRIR REGISTROS", range: 3.0 },
      { id: "caio-terminal", position: [4.4, 1.55, 4.82], label: "ATENDER CHAMADA", range: 3.1 },
      { id: "sample-locker", position: [-5.9, 1.35, 8.95], label: "RETIRAR AMOSTRA", range: 3.0 },
      { id: "analyzer", position: [5.1, 1.25, -5.05], label: "USAR ANALISADOR", range: 3.2 },
      { id: "pcr-machine", position: [-7.15, 1.15, -2.35], label: "ABRIR ESTAÇÃO PCR", range: 3.1 },
      { id: "sequencer", position: [7.05, 1.55, -7.45], label: "USAR SEQUENCIADOR", range: 3.2 },
      { id: "outbreak-map", position: [-1.8, 1.45, 6.2], label: "ABRIR MAPA DO SURTO", range: 3.3 },
      { id: "response-console", position: [7.0, 1.55, 6.05], label: "PLANEJAR RESPOSTA", range: 3.2 },
      { id: "vaccine-console", position: [7.25, 1.45, -1.35], label: "ABRIR PROGRAMA DE VACINA", range: 3.2 },
      { id: "variant-terminal", position: [1.35, 1.5, -4.45], label: "COMPARAR SEQUÊNCIAS", range: 3.0 },
      { id: "final-console", position: [0.6, 1.45, 4.15], label: "INICIAR DECISÃO FINAL", range: 3.4 },
    ];

    this.sphere("objective-beacon", [-3.8, 2.92, -4.3], [0.105, 0.105, 0.105], "#a9ffe6", {
      alpha: 0.78, emissive: 1, animation: "beacon", minQuality: 0,
    });
    this.cylinder("objective-beam", [-3.8, 2.55, -4.3], [0.022, 0.38, 0.022], "#7ff4d3", {
      alpha: 0.24, emissive: 0.9, animation: "pulse", minQuality: 0,
    });
    this.setActiveTarget("helena");
  }

  setActiveTarget(id) {
    this.activeTarget = id;
    const target = this.interactables.find((item) => item.id === id);
    const beacon = this.objects.find((item) => item.id === "objective-beacon");
    const beam = this.objects.find((item) => item.id === "objective-beam");
    if (!beacon || !beam) return;
    beacon.visible = Boolean(target);
    beam.visible = Boolean(target);
    if (!target) return;
    beacon.basePosition = [target.position[0], Math.min(3.75, target.position[1] + 1.22), target.position[2]];
    beam.basePosition = [target.position[0], beacon.basePosition[1] - 0.38, target.position[2]];
    beacon.position = [...beacon.basePosition];
    beam.position = [...beam.basePosition];
    beacon.color = [...this.accentColor];
    beam.color = [...this.accentColor];
  }

  setChapter(chapter) {
    this.chapter = chapter;
    const palette = {
      1: { fog: "#071417", accent: "#58f4c2", a: "#70ffd8", b: "#66aef5" },
      2: { fog: "#07171b", accent: "#72c9ff", a: "#65d8ff", b: "#55f0c5" },
      3: { fog: "#100d1a", accent: "#ad82ff", a: "#b793ff", b: "#56d8d1" },
      4: { fog: "#07131b", accent: "#68c5ff", a: "#78d7ff", b: "#65f0c4" },
      5: { fog: "#180f0b", accent: "#ffb84d", a: "#ffca72", b: "#ff746d" },
      6: { fog: "#071813", accent: "#5af0ad", a: "#7affbf", b: "#6aaeff" },
      7: { fog: "#120d19", accent: "#bd7dff", a: "#ca91ff", b: "#ff6f78" },
      8: { fog: "#17110b", accent: "#ffc25a", a: "#ffd078", b: "#6fe4d0" },
    };
    const colors = palette[chapter] || palette[1];
    this.fogColor = hexToRgb(colors.fog);
    this.accentColor = hexToRgb(colors.accent);
    this.lightAColor = hexToRgb(colors.a);
    this.lightBColor = hexToRgb(colors.b);
    const shell = this.canvas.closest("#game-shell");
    if (shell) shell.dataset.chapter = String(chapter);
    const beacon = this.objects.find((item) => item.id === "objective-beacon");
    const beam = this.objects.find((item) => item.id === "objective-beam");
    if (beacon) beacon.color = [...this.accentColor];
    if (beam) beam.color = [...this.accentColor];
  }

  syncCampaign(state) {
    this.objects.forEach((object) => {
      object.color = [...object.initialColor];
      object.baseColor = [...object.initialColor];
      object.emissive = object.initialEmissive;
      object.animation = object.initialAnimation;
      object.visible = object.initialVisible;
    });
    const sample = this.objects.find((object) => object.id === "sample-vial-world");
    if (sample) sample.visible = !state.hasSample;
    const completedTargets = [
      ["analyzer-screen", state.sampleValidated],
      ["pcr-screen", state.pcrComplete],
      ["sequencer-screen", state.sequenceComplete],
      ["outbreak-map-screen", state.outbreakMapped],
      ["response-screen", state.responseComplete],
      ["vaccine-screen", state.vaccineComplete],
      ["variant-screen", state.mutationComplete],
    ];
    completedTargets.forEach(([id, complete]) => {
      const object = this.objects.find((item) => item.id === id);
      if (!object || !complete) return;
      object.color = hexToRgb("#56e6b5");
      object.baseColor = [...object.color];
      object.emissive = 0.88;
    });
  }

  markComplete(id, color = "#56e6b5") {
    const object = this.objects.find((item) => item.id === id);
    if (!object) return;
    object.color = hexToRgb(color);
    object.baseColor = [...object.color];
    object.emissive = 0.9;
  }

  setObjectState(id, patch) {
    this.objects.filter((object) => object.id === id || object.targetId === id).forEach((object) => Object.assign(object, patch));
  }

  collectSample() {
    this.objects.filter((object) => object.id === "sample-vial-world").forEach((object) => { object.visible = false; });
    const status = this.objects.find((object) => object.id === "locker-status");
    if (status) {
      status.color = hexToRgb("#5f6f70");
      status.emissive = 0.15;
      status.animation = null;
    }
  }

  completeAnalysis() {
    const screen = this.objects.find((object) => object.id === "analyzer-screen");
    if (screen) {
      screen.color = hexToRgb("#56e6b5");
      screen.baseColor = [...screen.color];
      screen.emissive = 0.9;
    }
  }

  resize() {
    const quality = this.settings.quality || "medium";
    const caps = { low: 0.72, medium: 1.15, high: 1.75 };
    const ratio = Math.min(window.devicePixelRatio || 1, caps[quality]);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  applySettings(settings) {
    this.settings = settings;
    this.resize();
  }

  render(camera, time) {
    const gl = this.gl;
    const qualityLevel = QUALITY_INDEX[this.settings.quality] ?? 1;
    const projection = perspective((68 * Math.PI) / 180, this.canvas.width / this.canvas.height, 0.08, 42);
    const direction = [
      Math.sin(camera.yaw) * Math.cos(camera.pitch),
      Math.sin(camera.pitch),
      -Math.cos(camera.yaw) * Math.cos(camera.pitch),
    ];
    const center = [camera.position[0] + direction[0], camera.position[1] + direction[1], camera.position[2] + direction[2]];
    const view = lookAt(camera.position, center);

    gl.clearColor(this.fogColor[0], this.fogColor[1], this.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locations.projection, false, projection);
    gl.uniformMatrix4fv(this.locations.view, false, view);
    gl.uniform3fv(this.locations.fogColor, this.fogColor);
    gl.uniform3fv(this.locations.camera, camera.position);
    gl.uniform3fv(this.locations.accentColor, this.accentColor);
    gl.uniform3fv(this.locations.lightAColor, this.lightAColor);
    gl.uniform3fv(this.locations.lightBColor, this.lightBColor);
    gl.uniform3fv(this.locations.lightAPosition, this.lightAPosition);
    gl.uniform3fv(this.locations.lightBPosition, this.lightBPosition);
    gl.uniform1f(this.locations.time, time);

    const visible = this.objects.filter((object) => object.visible && object.minQuality <= qualityLevel);
    const opaque = visible.filter((object) => object.alpha >= 0.99);
    const transparent = visible
      .filter((object) => object.alpha < 0.99)
      .sort((a, b) => {
        const da = Math.hypot(a.position[0] - camera.position[0], a.position[2] - camera.position[2]);
        const db = Math.hypot(b.position[0] - camera.position[0], b.position[2] - camera.position[2]);
        return db - da;
      });

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    opaque.forEach((object) => this.drawObject(object, time));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    transparent.forEach((object) => this.drawObject(object, time));
    gl.depthMask(true);
  }

  drawObject(object, time) {
    const gl = this.gl;
    const mesh = this.meshes[object.shape];
    const reduced = this.settings.reducedEffects;
    const targetPulse = object.targetId === this.activeTarget && !reduced ? (Math.sin(time * 0.004) + 1) * 0.16 : 0;
    const position = [...object.basePosition];
    const scale = [...object.scale];
    if (!reduced && ["float", "drift", "beacon"].includes(object.animation)) {
      position[1] += Math.sin(time * 0.0022 + object.basePosition[0]) * object.bobAmount;
    }
    if (!reduced && object.animation === "drift") {
      position[0] += Math.sin(time * 0.0007 + object.basePosition[2]) * 0.055;
      position[2] += Math.cos(time * 0.0006 + object.basePosition[0]) * 0.045;
    }
    if (!reduced && object.animation === "beacon") {
      const beaconScale = 0.82 + (Math.sin(time * 0.0045) + 1) * 0.16;
      scale[0] *= beaconScale;
      scale[1] *= beaconScale;
      scale[2] *= beaconScale;
    }
    const animationPulse = !reduced && (object.animation === "pulse" || object.animation === "screen")
      ? (Math.sin(time * 0.003 + object.basePosition[2]) + 1) * 0.08
      : 0;
    const rotation = object.rotationY + (!reduced ? time * 0.001 * object.rotationSpeed : 0);
    const model = composeMatrix(position, scale, rotation, object.rotationX, object.rotationZ);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
    gl.enableVertexAttribArray(this.locations.normal);
    gl.vertexAttribPointer(this.locations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.locations.model, false, model);
    gl.uniform3fv(this.locations.color, object.color);
    gl.uniform1f(this.locations.emissive, Math.min(1, object.emissive + animationPulse + targetPulse));
    gl.uniform1f(this.locations.alpha, object.alpha);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
}
