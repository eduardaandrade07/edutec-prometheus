// Renderizador do laboratório (three.js r180, servido localmente).
// Mantém a mesma API pública do renderizador anterior (interactables,
// setActiveTarget, setChapter, syncCampaign, markComplete, collectSample,
// completeAnalysis, applySettings, render), de modo que missões, interface,
// controles e colisões continuam funcionando sem alterações de lógica.
import * as THREE from "../vendor/three/three.module.min.js";
import { EffectComposer } from "../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "../vendor/three/addons/postprocessing/ShaderPass.js";
import { GTAOPass } from "../vendor/three/addons/postprocessing/GTAOPass.js";
import { RoomEnvironment } from "../vendor/three/addons/environments/RoomEnvironment.js";
import { contactShadowTexture, createTextureLibrary, radialTexture } from "./render/textures.js";
import { createMaterials } from "./render/materials.js";
import { SceneBuilder } from "./render/builder.js";
import { buildLab, ROOM } from "./render/lab.js";
import { createHelena } from "./render/helena.js";
import { createDust, createLightShaft, createObjectiveMarker } from "./render/effects.js";

export function supportsModernRenderer() {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    const ok = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

const PALETTE = {
  1: { fog: "#071417", accent: "#58f4c2", a: "#70ffd8", b: "#66aef5" },
  2: { fog: "#07171b", accent: "#72c9ff", a: "#65d8ff", b: "#55f0c5" },
  3: { fog: "#100d1a", accent: "#ad82ff", a: "#b793ff", b: "#56d8d1" },
  4: { fog: "#07131b", accent: "#68c5ff", a: "#78d7ff", b: "#65f0c4" },
  5: { fog: "#180f0b", accent: "#ffb84d", a: "#ffca72", b: "#ff746d" },
  6: { fog: "#071813", accent: "#5af0ad", a: "#7affbf", b: "#6aaeff" },
  7: { fog: "#120d19", accent: "#bd7dff", a: "#ca91ff", b: "#ff6f78" },
  8: { fog: "#17110b", accent: "#ffc25a", a: "#ffd078", b: "#6fe4d0" },
};

const QUALITY = {
  low: { ratio: 0.8, shadows: 0, shadowSize: 0, post: false, ao: false, dust: 0, shafts: false, moon: false },
  medium: { ratio: 1.25, shadows: 2, shadowSize: 1024, post: true, ao: false, dust: 260, shafts: true, moon: true },
  high: { ratio: 1.75, shadows: 4, shadowSize: 2048, post: true, ao: true, dust: 520, shafts: true, moon: true },
};

// Correção de cor final: tonalização sutil (sombras frias, luzes quentes),
// saturação e vinheta. Opera antes do mapeamento de tons.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uShadowTint: { value: new THREE.Color(0.93, 1.0, 1.04) },
    uHighlightTint: { value: new THREE.Color(1.03, 1.0, 0.96) },
    uSaturation: { value: 1.06 },
    uVignette: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uSaturation;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(uShadowTint, uHighlightTint, smoothstep(0.02, 0.7, luma));
      col = max(mix(vec3(luma), col, uSaturation), 0.0);
      vec2 d = vUv - 0.5;
      col *= clamp(1.0 - dot(d, d) * uVignette, 0.0, 1.0);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export class WorldRenderer extends EventTarget {
  constructor(canvas, settings) {
    super();
    this.canvas = canvas;
    this.settings = settings;
    this.quality = settings.quality || "medium";
    this.chapter = 1;
    this.activeTarget = "helena";

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality !== "low",
      powerPreference: "high-performance",
      stencil: false,
    });
    if (!renderer.capabilities.isWebGL2) throw new Error("WebGL2 indisponível.");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    this.fogColor = new THREE.Color(PALETTE[1].fog);
    scene.background = this.fogColor.clone();
    scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.024);

    // Iluminação baseada em imagem: dá reflexos plausíveis aos metais e vidros.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environmentIntensity = 0.32;
    roomEnv.dispose?.();
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.05, 70);
    this.camera.rotation.order = "YXZ";
    this.baseFov = 68;

    // Materiais e cena.
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.textures = createTextureLibrary(this.quality, anisotropy);
    this.materials = createMaterials(this.textures);
    const builder = new SceneBuilder(scene, this.materials, { contactShadowTexture: contactShadowTexture() });
    this.lab = buildLab({ b: builder, m: this.materials, scene, quality: this.quality });
    this.interactables = this.lab.interactables;

    this.glowSprite = radialTexture();
    this.helena = createHelena({ position: [-3.8, 0, -4.8], sprite: this.glowSprite });
    scene.add(this.helena.root);

    builder.finalize();
    this.colliders = builder.colliders;

    // Brilhos de cada alvo recebem material próprio para pulsar isoladamente.
    this.targetGlows = [];
    this.lab.targets.forEach((entry, id) => {
      entry.glows.forEach((mesh) => {
        if (mesh.material === this.materials.accent) {
          mesh.material = mesh.material.clone();
          mesh.userData.followsAccent = true;
        }
        mesh.userData.baseIntensity = mesh.material.emissiveIntensity;
        this.targetGlows.push({ id, mesh });
      });
    });

    this.createLights();
    this.createAtmosphere();

    this.marker = createObjectiveMarker(this.glowSprite);
    scene.add(this.marker.group);

    this.allScreens = [...this.lab.screens.values(), ...this.lab.decorScreens];

    this.setChapter(1);
    this.setActiveTarget("helena");
    this.configureQuality();
    this.resize();
    renderer.shadowMap.needsUpdate = true;
    // Pré-compila os shaders em paralelo (quando o navegador permite) para
    // evitar travadas no primeiro quadro.
    renderer.compileAsync?.(scene, this.camera).catch(() => {});

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.dispatchEvent(new Event("contextlost"));
    });
    window.addEventListener("resize", () => this.resize(), { passive: true });
  }

  // ---------------------------------------------------------------------
  createLights() {
    const scene = this.scene;
    this.hemi = new THREE.HemisphereLight(0xa9c8cc, 0x1a1512, 0.5);
    scene.add(this.hemi);

    // Luminárias principais (as quatro primeiras podem projetar sombras).
    const spotPositions = [
      [-5.5, -6.3], [3.0, -6.2], [-3.2, 5.6], [4.4, 5.9], [0, -1.5], [-6.2, -1.6],
    ];
    this.spots = spotPositions.map(([x, z], index) => {
      const spot = new THREE.SpotLight(0xe8f5f2, index < 4 ? 30 : 16, 11, 1.05, 0.9, 1.6);
      spot.position.set(x, ROOM.height - 0.08, z);
      spot.target.position.set(x + (index % 2 ? 0.4 : -0.4), 0, z + 0.3);
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.025;
      spot.shadow.radius = 3;
      spot.shadow.camera.near = 0.3;
      spot.shadow.camera.far = 9;
      scene.add(spot, spot.target);
      return spot;
    });

    // Acentos do capítulo (cor muda a cada capítulo).
    this.accentA = new THREE.PointLight(0x70ffd8, 8, 9, 1.7);
    this.accentA.position.set(-5.4, 3.0, -5.3);
    this.accentB = new THREE.PointLight(0x66aef5, 7, 9, 1.7);
    this.accentB.position.set(4.8, 2.9, 5.7);
    scene.add(this.accentA, this.accentB);

    // Luar entrando pela janela da triagem: as sombras das esquadrias e da
    // persiana desenham o recorte no piso.
    this.moon = new THREE.DirectionalLight(0x8fb4e6, 1.6);
    this.moon.position.set(26, 11, 1.5);
    this.moon.target.position.set(6.5, 0, 4.2);
    const cam = this.moon.shadow.camera;
    cam.left = -5; cam.right = 5; cam.top = 5; cam.bottom = -5; cam.near = 8; cam.far = 40;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.03;
    this.moon.shadow.radius = 2;
    scene.add(this.moon, this.moon.target);
  }

  createAtmosphere() {
    this.dust = createDust(520, { minX: ROOM.minX + 0.5, maxX: ROOM.maxX - 0.5, minZ: ROOM.minZ + 0.5, maxZ: ROOM.maxZ - 0.5 }, this.glowSprite);
    this.scene.add(this.dust);
    this.shafts = new THREE.Group();
    this.lab.panels.forEach(([x, z], index) => {
      if (index % 2) return;
      const shaft = createLightShaft(1.7, 0.5, ROOM.height - 0.1, "#dff4f1", 0.045);
      shaft.position.set(x, ROOM.height - 0.06, z);
      this.shafts.add(shaft);
    });
    this.scene.add(this.shafts);
  }

  // ---------------------------------------------------------------------
  configureQuality() {
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.quality = this.settings.quality || "medium";
    this.q = q;
    this.spots.forEach((spot, index) => {
      const cast = index < q.shadows;
      spot.castShadow = cast;
      if (cast && spot.shadow.mapSize.x !== q.shadowSize) {
        spot.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        spot.shadow.map?.dispose();
        spot.shadow.map = null;
      }
      // Na qualidade baixa as luzes extras são desligadas para economizar.
      spot.visible = q.shadows > 0 || index < 4;
    });
    this.moon.visible = q.moon;
    this.moon.castShadow = q.moon;
    if (q.moon) this.moon.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    this.dust.visible = q.dust > 0;
    this.dust.geometry.setDrawRange(0, q.dust);
    this.shafts.visible = q.shafts;
    this.renderer.shadowMap.enabled = q.shadows > 0 || q.moon;
    this.renderer.shadowMap.needsUpdate = true;
    this.buildPostProcessing();
  }

  buildPostProcessing() {
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer.passes.forEach((pass) => pass.dispose?.());
      this.composer = null;
    }
    if (!this.q.post) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x * ratio), Math.max(1, size.y * ratio), {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(ratio);
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.q.ao) {
      const ao = new GTAOPass(this.scene, this.camera, size.x * ratio, size.y * ratio);
      ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      ao.blendIntensity = 0.9;
      // Hologramas e efeitos aditivos não participam do cálculo de oclusão.
      const render = ao.render.bind(ao);
      ao.render = (...args) => {
        const hidden = this.hideForAO();
        render(...args);
        hidden.forEach((object) => { object.visible = true; });
      };
      composer.addPass(ao);
      this.aoPass = ao;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * ratio * 0.5, size.y * ratio * 0.5), 0.55, 0.6, 0.92);
    composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.updateGrade();
  }

  hideForAO() {
    const hidden = [];
    this.scene.traverse((object) => {
      if (!object.visible) return;
      const material = object.material;
      if (object.isPoints || object.isSprite || (material && (material.isShaderMaterial || material === undefined || (material.transparent && material.depthWrite === false) || material.colorWrite === false))) {
        object.visible = false;
        hidden.push(object);
      }
    });
    return hidden;
  }

  updateGrade() {
    if (!this.grade) return;
    const accent = new THREE.Color(PALETTE[this.chapter]?.accent || PALETTE[1].accent);
    const tint = new THREE.Color(0.93, 1.0, 1.04).lerp(accent, 0.08);
    this.grade.uniforms.uShadowTint.value.copy(tint);
    this.bloom.strength = this.settings.reducedEffects ? 0.3 : 0.55;
  }

  // ---------------------------------------------------------------------
  setActiveTarget(id) {
    this.activeTarget = id;
    const target = this.interactables.find((item) => item.id === id);
    this.marker.group.visible = Boolean(target);
    if (target) {
      this.marker.group.position.set(target.position[0], Math.min(3.75, target.position[1] + 1.22), target.position[2]);
      this.markerBaseY = this.marker.group.position.y;
    }
    this.lab.targets.forEach((entry, targetId) => {
      entry.screens.forEach((display) => display.setActive(targetId === id));
    });
  }

  setChapter(chapter) {
    this.chapter = chapter;
    const colors = PALETTE[chapter] || PALETTE[1];
    this.fogColor.set(colors.fog);
    this.scene.background.set(colors.fog);
    this.scene.fog.color.set(colors.fog);
    const accent = new THREE.Color(colors.accent);
    this.materials.accent.emissive.copy(accent);
    this.materials.accentSoft.emissive.copy(accent);
    this.targetGlows.forEach(({ mesh }) => { if (mesh.userData.followsAccent) mesh.material.emissive.copy(accent); });
    this.accentA.color.set(colors.a);
    this.accentB.color.set(colors.b);
    this.marker.setColor(colors.accent);
    this.helena.setColor(colors.accent);
    this.dust.material.uniforms.uColor.value.set("#cdeee8").lerp(accent, 0.25);
    const shell = this.canvas.closest("#game-shell");
    if (shell) shell.dataset.chapter = String(chapter);
    this.updateGrade();
  }

  syncCampaign(state) {
    const completed = [
      ["analyzer-screen", state.sampleValidated],
      ["pcr-screen", state.pcrComplete],
      ["sequencer-screen", state.sequenceComplete],
      ["outbreak-map-screen", state.outbreakMapped],
      ["response-screen", state.responseComplete],
      ["vaccine-screen", state.vaccineComplete],
      ["variant-screen", state.mutationComplete],
      ["case-screen-main", state.casesCompared],
      ["caio-screen", state.caioConsulted],
    ];
    completed.forEach(([id, done]) => this.lab.screens.get(id)?.setComplete(Boolean(done)));
    this.lab.sampleVial.visible = !state.hasSample;
    this.setLockerLed(!state.hasSample);
  }

  setLockerLed(available) {
    const led = this.lab.lockerLed.material;
    led.emissive.set(available ? 0x5ab8ff : 0x3a4446);
    led.emissiveIntensity = available ? 3 : 0.6;
    this.lab.lockerLed.userData.baseIntensity = led.emissiveIntensity;
  }

  markComplete(id) {
    this.lab.screens.get(id)?.setComplete(true);
  }

  // Compatibilidade com a API anterior; a cena atual não usa estados genéricos.
  setObjectState(id, patch) {
    if (patch && "visible" in patch) {
      this.lab.targets.get(id)?.glows.forEach((mesh) => { mesh.visible = patch.visible; });
    }
  }

  collectSample() {
    this.lab.sampleVial.visible = false;
    this.setLockerLed(false);
  }

  completeAnalysis() {
    this.markComplete("analyzer-screen");
  }

  // ---------------------------------------------------------------------
  resize() {
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    const ratio = Math.min(window.devicePixelRatio || 1, q.ratio);
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(ratio);
      this.composer.setSize(width, height);
    }
    this.dust.material.uniforms.uPixelRatio.value = ratio * (height / 900) * 1.2;
  }

  applySettings(settings) {
    const qualityChanged = settings.quality !== this.settings.quality;
    this.settings = settings;
    if (qualityChanged) this.configureQuality();
    this.resize();
    this.updateGrade();
  }

  render(cameraState, time) {
    const reduced = this.settings.reducedEffects;
    const camera = this.camera;
    camera.position.set(cameraState.position[0], cameraState.position[1], cameraState.position[2]);
    camera.rotation.set(cameraState.pitch, -cameraState.yaw, cameraState.roll || 0, "YXZ");
    const fov = this.baseFov + (cameraState.fovKick || 0);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const t = time * 0.001;
    const camPos = cameraState.position;
    this.allScreens.forEach((display) => {
      const mesh = display.mesh;
      if (mesh) {
        const dx = mesh.position.x - camPos[0], dz = mesh.position.z - camPos[2];
        if (dx * dx + dz * dz > 150 && !display.active) return;
      }
      display.update(time, reduced);
    });
    this.lab.holograms.forEach((material) => { material.uniforms.uTime.value = t; });
    this.lab.animated.forEach((fn) => fn(time, reduced));
    this.helena.update(time, camPos, reduced, false);
    this.marker.update(time, reduced);
    if (this.marker.group.visible) {
      this.marker.group.position.y = this.markerBaseY + (reduced ? 0 : Math.sin(t * 2.2) * 0.05);
    }
    this.dust.material.uniforms.uTime.value = reduced ? 0 : t;
    this.shafts.children.forEach((shaft) => { shaft.material.uniforms.uTime.value = t; });

    // Pulso do alvo atual (brilhos do equipamento).
    const pulse = reduced ? 0 : (Math.sin(time * 0.004) + 1) * 0.5;
    this.targetGlows.forEach(({ id, mesh }) => {
      mesh.material.emissiveIntensity = mesh.userData.baseIntensity * (id === this.activeTarget ? 1 + pulse * 0.8 : 1);
    });
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, camera);
  }
}
