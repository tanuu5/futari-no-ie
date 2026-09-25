// Material library. Keys double as "buckets" for the merged-geometry Builder.
import * as THREE from 'three';
import * as TX from './textures.js';

export function createTextures(walls) {
  return {
    wood: TX.woodFloor(),
    plaster: TX.plaster(),
    cladding: TX.cladding(),
    stone: TX.tiles({ n: 4, size: 1.2, base: [214, 211, 204], vary: 8, grout: [168, 164, 157], seed: 9 }),
    doma: TX.tiles({ n: 3, size: 1.8, base: [126, 122, 116], vary: 16, grout: [92, 89, 85], gw: 4, seed: 19, noiseAmt: 26 }),
    utility: TX.tiles({ n: 4, size: 1.2, base: [200, 204, 202], vary: 5, grout: [176, 178, 176], gw: 2, seed: 29, noiseAmt: 8 }),
    subway: TX.subway(),
    cork: TX.cork(),
    fabric: TX.fabric(),
    grain: TX.woodGrain(),
    lawn: TX.lawn(),
    soil: TX.soilStrata(),
    gravel: TX.gravel(),
    moss: TX.moss(),
    deck: TX.deckBoards(),
    concrete: TX.concrete(),
    sedum: TX.sedum(),
    bark: TX.bark(),
    leaf: TX.mapleLeaf(),
    blob: TX.blob(),
    dot: TX.softDot(),
    water: TX.waterNormal(),
    pv: TX.pvPanel(),
    rugKilim: TX.rugKilim(),
    rugStripe: TX.rugStripe(),
    paintings: [TX.painting(0), TX.painting(1), TX.painting(2)],
    norenYu: TX.noren('ゆ'),
    noren: TX.noren(''),
    whiteboard: TX.whiteboard(walls),
  };
}

export function createMaterials(T) {
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const M = {};

  // Architecture
  M.plaster = S({ map: T.plaster, roughness: 0.95 });
  M.cladding = S({ map: T.cladding, color: 0x6e5d4f, roughness: 0.9 });
  M.cap = S({ color: 0x34302c, roughness: 1 });
  M.floorOak = S({ map: T.wood.map, roughness: 0.58 });
  M.floorStone = S({ map: T.stone, roughness: 0.42 });
  M.floorDoma = S({ map: T.doma, roughness: 0.8 });
  M.floorCork = S({ map: T.cork, roughness: 0.88 });
  M.floorUtility = S({ map: T.utility, roughness: 0.5 });
  M.deck = S({ map: T.deck, roughness: 0.85 });
  M.foundation = S({ map: T.concrete, color: 0xc4c1bb, roughness: 0.95 });
  M.frame = S({ color: 0x3a3530, roughness: 0.45, metalness: 0.35 });
  M.glass = P({
    color: 0xe6f0f0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16,
    envMapIntensity: 1.6, depthWrite: false,
  });
  M.glassFrost = P({ color: 0xf1f5f4, roughness: 0.55, transparent: true, opacity: 0.6, depthWrite: false });

  // Furniture
  M.woodLight = S({ map: T.grain, color: 0xdfbd90, roughness: 0.6 });
  M.woodMid = S({ map: T.grain, color: 0xb0835b, roughness: 0.58 });
  M.woodDark = S({ map: T.grain, color: 0x6b4d38, roughness: 0.55 });
  M.lacquer = S({ color: 0xefede7, roughness: 0.34 });
  M.counter = S({ color: 0xdcd9d2, roughness: 0.26 });
  M.subway = S({ map: T.subway, roughness: 0.3 });
  M.steel = S({ color: 0xc9ccd0, roughness: 0.3, metalness: 1 });
  M.black = S({ color: 0x2a2a2c, roughness: 0.6 });
  M.cooktop = S({ color: 0x131415, roughness: 0.12 });
  M.fabricOat = S({ map: T.fabric, color: 0xd9cfbd, roughness: 0.95 });
  M.fabricIndigo = S({ map: T.fabric, color: 0x3f5b8c, roughness: 0.95 });
  M.fabricMustard = S({ map: T.fabric, color: 0xd6a449, roughness: 0.95 });
  M.fabricCream = S({ map: T.fabric, color: 0xf1ede5, roughness: 0.95 });
  M.fabricSage = S({ map: T.fabric, color: 0x93a88b, roughness: 0.95 });
  M.fabricTerra = S({ map: T.fabric, color: 0xc97a58, roughness: 0.95 });
  M.fabricGray = S({ map: T.fabric, color: 0x8f949a, roughness: 0.95 });
  M.ceramic = S({ color: 0xf4f4f1, roughness: 0.12 });
  M.potTerra = S({ color: 0xb8683f, roughness: 0.8 });
  M.potGray = S({ color: 0x8f8a84, roughness: 0.72 });
  M.leafGreen = S({ color: 0x5c7f4a, roughness: 0.7, side: THREE.DoubleSide });
  M.leafDark = S({ color: 0x3f5f3a, roughness: 0.7, side: THREE.DoubleSide });
  M.soil = S({ color: 0x4d3b2d, roughness: 1 });
  M.paper = S({ color: 0xf4f1e8, roughness: 0.9 });
  M.screen = S({ color: 0x1b1e22, roughness: 0.2, emissive: 0x7c9ccc, emissiveIntensity: 0.35 });
  M.rubber = S({ color: 0x34322f, roughness: 0.9 });
  M.brass = S({ color: 0xc09a58, roughness: 0.35, metalness: 1 });
  M.terra = S({ color: 0xd97757, roughness: 0.55 });
  M.ivory = P({ color: 0xefe9df, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  M.tomato = S({ color: 0xd1402c, roughness: 0.35 });
  M.eggplant = S({ color: 0x3b2446, roughness: 0.3 });
  M.red = S({ color: 0xb8452f, roughness: 0.6 });

  // Garden
  M.lawn = S({ map: T.lawn, roughness: 1 });
  M.soilSide = S({ map: T.soil, roughness: 1 });
  M.plinthBottom = S({ color: 0x3b312b, roughness: 1 });
  M.gravel = S({ map: T.gravel, roughness: 1 });
  M.moss = S({ map: T.moss, roughness: 1 });
  M.stone = S({ map: T.concrete, color: 0xa29d94, roughness: 0.9 });
  M.stoneDark = S({ map: T.concrete, color: 0x77736d, roughness: 0.9 });
  M.bark = S({ map: T.bark, color: 0xa08d7a, roughness: 1 });
  M.pondBed = S({ color: 0x2b2924, roughness: 1 });
  M.water = P({
    color: 0x24403f, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.8,
    normalMap: T.water, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4,
  });
  M.hedge = S({ color: 0x4d6c3c, roughness: 0.9 });
  M.roofMetal = S({ color: 0x3b3e41, roughness: 0.55, metalness: 0.3, transparent: true });
  M.pv = S({ map: T.pv, roughness: 0.22, metalness: 0.2, transparent: true });
  M.sedum = S({ map: T.sedum, roughness: 1, transparent: true });
  M.fascia = S({ map: T.grain, color: 0x9a7556, roughness: 0.6, transparent: true });
  M.soffit = S({ map: T.grain, color: 0xd9b88c, roughness: 0.7, transparent: true });

  M.shadowProxy = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  return M;
}

// Materials whose meshes never need to cast shadows (floors, ground, glass, water).
export const NO_CAST = new Set([
  'glass', 'glassFrost', 'water', 'lawn', 'moss', 'gravel', 'floorOak', 'floorStone', 'floorDoma',
  'floorCork', 'floorUtility', 'pondBed', 'soilSide', 'plinthBottom', 'cap',
]);
