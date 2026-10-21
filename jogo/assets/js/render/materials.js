// Biblioteca de materiais PBR. A direção de arte é um laboratório de biossegurança
// noturno: arquitetura em grafite azulado, equipamentos claros e acentos luminosos
// que mudam de cor a cada capítulo.
import * as THREE from "../../vendor/three/three.module.min.js";

// userData.uvScale define quantos metros uma repetição da textura cobre;
// o SceneBuilder projeta as UVs em coordenadas do mundo (sem esticamento).
function std(params, uvScale) {
  const material = new THREE.MeshStandardMaterial(params);
  if (uvScale) material.userData.uvScale = Array.isArray(uvScale) ? uvScale : [uvScale, uvScale];
  return material;
}

export function createMaterials(tex) {
  const m = {};

  m.floor = std({ color: 0xffffff, ...tex.floor, roughness: 1, metalness: 0, envMapIntensity: 0.9, normalScale: new THREE.Vector2(0.8, 0.8) }, 2.4);
  m.wall = std({ color: 0xffffff, ...tex.wall, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.9, 0.9) }, [2.4, 2.3]);
  m.wallBase = std({ color: 0x1b2326, ...tex.paint, roughness: 0.9, metalness: 0.25 }, 1.2);
  m.ceiling = std({ color: 0xffffff, ...tex.ceiling, roughness: 0.92, metalness: 0 }, 2.4);
  m.trim = std({ color: 0x0f1416, roughness: 0.55, metalness: 0.6 });

  // Equipamentos: pintura eletrostática clara, cinza e grafite.
  m.casing = std({ color: 0xd6dcde, ...tex.paint, roughness: 1, metalness: 0, envMapIntensity: 0.8, normalScale: new THREE.Vector2(0.35, 0.35) }, 1.2);
  m.casingWarm = std({ color: 0xc9c5bc, ...tex.paint, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.35, 0.35) }, 1.2);
  m.casingGrey = std({ color: 0x7d888d, ...tex.paint, roughness: 1, metalness: 0.1 }, 1.2);
  m.casingDark = std({ color: 0x2a3236, ...tex.paint, roughness: 0.85, metalness: 0.2 }, 1.2);
  m.panelBlack = std({ color: 0x0b0e10, roughness: 0.28, metalness: 0.1, envMapIntensity: 1.2 });

  // Metais.
  m.steel = std({ color: 0xd8dde0, ...tex.brushed, roughness: 1, metalness: 1, envMapIntensity: 1.0 }, 0.9);
  m.steelDark = std({ color: 0x5b6569, ...tex.brushed, roughness: 1, metalness: 0.9 }, 0.9);
  m.chrome = std({ color: 0xe8eef0, roughness: 0.12, metalness: 1, envMapIntensity: 1.3 });
  m.aluminium = std({ color: 0x9aa4a8, ...tex.brushed, roughness: 0.9, metalness: 0.85 }, 0.6);

  // Superfícies de trabalho, borracha e tecido.
  m.resin = std({ color: 0xffffff, ...tex.resin, roughness: 1, metalness: 0 }, 1.0);
  m.rubber = std({ color: 0x111416, roughness: 0.88, metalness: 0 });
  m.fabric = std({ color: 0x2c4a52, ...tex.fabric, roughness: 1, metalness: 0 }, 0.45);
  m.cushion = std({ color: 0x1d2a2e, ...tex.fabric, roughness: 1, metalness: 0 }, 0.45);
  m.plasticBlue = std({ color: 0x2c6f9b, roughness: 0.4, metalness: 0 });
  m.plasticYellow = std({ color: 0xe0b43a, roughness: 0.45, metalness: 0 });
  m.plasticRed = std({ color: 0xb43a32, roughness: 0.45, metalness: 0 });
  m.plasticGreen = std({ color: 0x2f8a5c, roughness: 0.45, metalness: 0 });
  m.plant = std({ color: 0x2f5b34, roughness: 0.65, metalness: 0, side: THREE.DoubleSide });
  m.soil = std({ color: 0x2a1f18, roughness: 1 });
  m.paper = std({ color: 0xe8e4da, roughness: 0.9 });
  m.cork = std({ color: 0x7a5a3a, roughness: 0.95 });

  // Vidros (transparência com reflexos do ambiente).
  m.glass = new THREE.MeshPhysicalMaterial({
    color: 0xc8e6ea, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14,
    envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, ior: 1.5, specularIntensity: 1,
  });
  m.glassFrosted = new THREE.MeshPhysicalMaterial({
    color: 0xd9ecef, roughness: 0.55, metalness: 0, transparent: true, opacity: 0.5,
    envMapIntensity: 0.8, depthWrite: false, side: THREE.DoubleSide,
  });
  m.glassTinted = new THREE.MeshPhysicalMaterial({
    color: 0x7fb7c4, roughness: 0.08, transparent: true, opacity: 0.28, envMapIntensity: 1.4, depthWrite: false,
  });
  m.bottleAmber = new THREE.MeshPhysicalMaterial({ color: 0x9a5a1c, roughness: 0.12, transparent: true, opacity: 0.78, envMapIntensity: 1.2 });
  m.bottleClear = new THREE.MeshPhysicalMaterial({ color: 0xdfeff2, roughness: 0.06, transparent: true, opacity: 0.32, envMapIntensity: 1.4, depthWrite: false });
  m.liquidBlue = std({ color: 0x2a7fb0, roughness: 0.2, emissive: 0x0b3a5a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
  m.liquidGreen = std({ color: 0x2fae86, roughness: 0.2, emissive: 0x0f5a42, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 });
  m.liquidAmber = std({ color: 0xd08a2a, roughness: 0.2, emissive: 0x5a3008, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });

  // Fontes luminosas (luminárias, LEDs, faixas de sinalização).
  m.lightPanel = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xe6f6f4, emissiveIntensity: 3.2, roughness: 1 });
  m.lightWarm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2b8, emissiveIntensity: 2.6, roughness: 1 });
  m.amberStrip = new THREE.MeshStandardMaterial({ color: 0x2a1a06, emissive: 0xffa53a, emissiveIntensity: 2.4, roughness: 0.6 });
  m.hazard = new THREE.MeshStandardMaterial({ color: 0xd8a62c, roughness: 0.6 });
  m.ledGreen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x47ff9a, emissiveIntensity: 3 });
  m.ledRed = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff4a45, emissiveIntensity: 3 });
  m.ledBlue = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x5ab8ff, emissiveIntensity: 3 });
  m.ledAmber = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb340, emissiveIntensity: 3 });

  // Acentos do capítulo: um único material compartilhado, recolorido em setChapter().
  m.accent = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x58f4c2, emissiveIntensity: 2.4, roughness: 0.5 });
  m.accentSoft = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x58f4c2, emissiveIntensity: 0.9, roughness: 0.5 });

  return m;
}
