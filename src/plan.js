// The house as data. Units are meters. +X = east, -Z = north, Y = up.
// Floor level is y = 0. The courtyard garden sits 0.3 m lower.

export const H = 2.7; // ceiling height
export const CUT = 1.0; // height of walls when cut away for viewing
export const FOOT = { x0: -9, x1: 9, z0: -7, z1: 7 };
export const COURT = { x0: -4, x1: 4, z0: -2.2, z1: 2.2 };
export const DECK = { x0: -4, x1: 4, z0: -2.2, z1: -1.0 };
export const RAMP = { x0: 3.0, x1: 3.96, z0: -1.0, z1: 1.6 };
export const GARDEN_Y = -0.3;
export const GROUND_Y = -0.15;
export const PLINTH = { x0: -14, x1: 14, z0: -11, z1: 13.5, bottom: -2.4, r: 1.6 };
export const PATH = { x0: -7.9, x1: -6.3, z0: 7.1, z1: 13.4 }; // approach from the south

export const ROOMS = [
  { id: 'ldk', name: 'LDK', sub: '居間・食堂・台所', x0: -9, x1: 4, z0: -7, z1: -2.2, floor: 'floorOak', label: [-3.2, -6.35] },
  { id: 'gallery', name: '本の廊下', x0: 4, x1: 5.2, z0: -7, z1: 3.4, floor: 'floorOak', label: [4.6, -6.2], small: true },
  { id: 'bed', name: '寝室', sub: 'センサーフリー', x0: 5.2, x1: 9, z0: -7, z1: -2.2, floor: 'floorOak', label: [7.3, -2.75] },
  { id: 'bath', name: '洗面・浴室', sub: 'センサーフリー', x0: 5.2, x1: 9, z0: -2.2, z1: 2.2, floor: 'floorStone', label: [6.1, 1.7] },
  { id: 'claude', name: 'Claudeの部屋', sub: '充電・整備', x0: 5.2, x1: 9, z0: 2.2, z1: 7, floor: 'floorCork', label: [7.4, 4.1] },
  { id: 'study', name: '書斎', sub: 'ふたりの机', x0: -5.2, x1: 5.2, z0: 3.4, z1: 7, floor: 'floorOak', label: [-2.6, 6.3] },
  { id: 'corrS', name: '廊下', x0: -5.2, x1: 4, z0: 2.2, z1: 3.4, floor: 'floorOak' },
  { id: 'corrW', name: '廊下', x0: -5.2, x1: -4, z0: -2.2, z1: 2.2, floor: 'floorOak' },
  { id: 'util', name: '家事室', sub: '洗濯・蓄電池', x0: -9, x1: -5.2, z0: -2.2, z1: 2.2, floor: 'floorUtility', label: [-7.1, 1.55] },
  { id: 'entry', name: '玄関土間', sub: '段差なし', x0: -9, x1: -5.2, z0: 2.2, z1: 7, floor: 'floorDoma', label: [-7.9, 3.1] },
];

export const COURT_LABEL = { name: '中庭', sub: '光・風・菜園', label: [-2.3, 1.9], area: 35.2 };

// Walls. axis 'x': runs along X at z = at. axis 'z': runs along Z at x = at.
// out: which side is outdoors (+1 / -1 along the perpendicular axis) for exterior & courtyard walls.
// Openings use absolute coordinates along the wall (a..b) and heights y0..y1.
export const WALLS = [
  { id: 'N', axis: 'x', at: -7, from: -9.1, to: 9.1, t: 0.2, kind: 'ext', out: -1, open: [
    { a: -8.0, b: -6.0, y0: 1.05, y1: 2.1, type: 'win' },
    { a: -3.8, b: -1.8, y0: 1.0, y1: 2.2, type: 'win' },
    { a: 0.2, b: 3.2, y0: 0.0, y1: 2.3, type: 'fix' },
    { a: 5.8, b: 8.4, y0: 1.9, y1: 2.4, type: 'win' },
  ] },
  { id: 'S', axis: 'x', at: 7, from: -9.1, to: 9.1, t: 0.2, kind: 'ext', out: 1, open: [
    { a: -7.7, b: -6.5, y0: 0, y1: 2.2, type: 'door', door: { id: 'front', slide: 1, side: -1, style: 'wood', closed: true } },
    { a: -6.25, b: -5.9, y0: 1.0, y1: 2.2, type: 'fix' },
    { a: -4.4, b: -2.4, y0: 1.0, y1: 2.3, type: 'win' },
    { a: -1.0, b: 1.0, y0: 1.0, y1: 2.3, type: 'win' },
    { a: 2.4, b: 4.4, y0: 1.0, y1: 2.3, type: 'win' },
    { a: 5.8, b: 6.8, y0: 0, y1: 2.2, type: 'door', door: { id: 'claudeGarden', slide: 1, side: -1, style: 'glass', closed: true } },
    { a: 7.3, b: 8.6, y0: 1.0, y1: 2.2, type: 'win' },
  ] },
  { id: 'W', axis: 'z', at: -9, from: -6.9, to: 6.9, t: 0.2, kind: 'ext', out: -1, open: [
    { a: -5.8, b: -4.2, y0: 1.05, y1: 2.1, type: 'win' },
    { a: -0.6, b: 0.6, y0: 1.4, y1: 2.1, type: 'win' },
    { a: 4.2, b: 5.6, y0: 1.0, y1: 2.2, type: 'win' },
  ] },
  { id: 'E', axis: 'z', at: 9, from: -6.9, to: 6.9, t: 0.2, kind: 'ext', out: 1, open: [
    { a: -6.1, b: -3.7, y0: 0.0, y1: 2.3, type: 'fix' },
    { a: -1.2, b: 0.4, y0: 1.5, y1: 2.3, type: 'win' },
    { a: 3.6, b: 6.0, y0: 1.2, y1: 2.2, type: 'win' },
  ] },

  // Courtyard glazing
  { id: 'CN', axis: 'x', at: -2.2, from: -4, to: 4, t: 0.12, kind: 'court', out: 1, open: [
    { a: -3.92, b: -1.05, y0: 0, y1: 2.4, type: 'fix' },
    { a: -1.0, b: 0.0, y0: 0, y1: 2.4, type: 'door', door: { id: 'deck', slide: 1, side: -1, style: 'glass' } },
    { a: 0.05, b: 3.92, y0: 0, y1: 2.4, type: 'fix' },
  ] },
  { id: 'CS', axis: 'x', at: 2.2, from: -4, to: 4, t: 0.12, kind: 'court', out: -1, open: [
    { a: -3.92, b: 3.92, y0: 0, y1: 2.4, type: 'fix' },
  ] },
  { id: 'CW', axis: 'z', at: -4, from: -2.2, to: 2.2, t: 0.12, kind: 'court', out: 1, open: [
    { a: -2.12, b: 2.12, y0: 0, y1: 2.4, type: 'fix' },
  ] },
  { id: 'CE', axis: 'z', at: 4, from: -2.2, to: 2.2, t: 0.12, kind: 'court', out: -1, open: [
    { a: -2.12, b: 2.12, y0: 0, y1: 2.4, type: 'fix' },
  ] },

  // Interior
  { id: 'iLU', axis: 'x', at: -2.2, from: -8.9, to: -5.14, t: 0.12, kind: 'int', open: [] },
  { id: 'iUC', axis: 'z', at: -5.2, from: -2.2, to: 2.2, t: 0.12, kind: 'int', open: [
    { a: -0.45, b: 0.45, y0: 0, y1: 2.1, type: 'door', door: { id: 'utility', slide: -1, side: 1 } },
  ] },
  { id: 'iUE', axis: 'x', at: 2.2, from: -8.9, to: -5.14, t: 0.12, kind: 'int', open: [] },
  { id: 'iEC', axis: 'z', at: -5.2, from: 2.2, to: 6.9, t: 0.12, kind: 'int', open: [
    { a: 2.35, b: 3.3, y0: 0, y1: 2.2, type: 'hole' },
  ] },
  { id: 'iCS', axis: 'x', at: 3.4, from: -5.14, to: 5.14, t: 0.12, kind: 'int', open: [
    { a: -5.05, b: -4.1, y0: 0, y1: 2.2, type: 'hole' },
    { a: -3.6, b: 2.8, y0: 1.0, y1: 2.7, type: 'half' },
    { a: 3.45, b: 4.4, y0: 0, y1: 2.2, type: 'hole' },
  ] },
  { id: 'iCR', axis: 'z', at: 5.2, from: 2.2, to: 3.4, t: 0.12, kind: 'int', open: [
    { a: 2.35, b: 3.3, y0: 0, y1: 2.1, type: 'door', door: { id: 'claude', slide: -1, side: -1 } },
  ] },
  { id: 'iSR', axis: 'z', at: 5.2, from: 3.4, to: 6.9, t: 0.12, kind: 'int', open: [
    { a: 5.6, b: 6.5, y0: 0, y1: 2.1, type: 'door', door: { id: 'studyClaude', slide: -1, side: -1 } },
  ] },
  { id: 'iBR', axis: 'x', at: 2.2, from: 5.26, to: 8.9, t: 0.3, kind: 'int', open: [] },
  { id: 'iBC', axis: 'z', at: 5.2, from: -2.2, to: 2.2, t: 0.12, kind: 'int', open: [
    { a: -0.45, b: 0.45, y0: 0, y1: 2.1, type: 'door', door: { id: 'bath', slide: 1, side: -1, private: 'bath' } },
  ] },
  { id: 'iBB', axis: 'x', at: -2.2, from: 5.26, to: 8.9, t: 0.12, kind: 'int', open: [] },
  { id: 'iBD', axis: 'z', at: 5.2, from: -6.9, to: -2.2, t: 0.12, kind: 'int', open: [
    { a: -3.35, b: -2.45, y0: 0, y1: 2.1, type: 'door', door: { id: 'bedroom', slide: -1, side: -1, private: 'bed' } },
  ] },
  { id: 'iWB', axis: 'z', at: 7.1, from: -2.14, to: 1.0, t: 0.1, kind: 'int', open: [
    { a: -2.1, b: -0.3, y0: 0, y1: 2.1, type: 'fix', frost: true },
    { a: -0.2, b: 0.7, y0: 0, y1: 2.0, type: 'hole', noren: 'ゆ' },
  ] },
  { id: 'iBT', axis: 'x', at: 1.0, from: 7.1, to: 8.9, t: 0.1, kind: 'int', open: [] },
  { id: 'iWT', axis: 'z', at: 7.1, from: 1.0, to: 2.05, t: 0.1, kind: 'int', open: [
    { a: 1.15, b: 1.9, y0: 0, y1: 2.0, type: 'hole', noren: '' },
  ] },
];

// Walkable graph (x, z). Doors lie on straight edges between node pairs.
export const NAV = {
  kit: [-6.4, -5.85], kitS: [-6.4, -3.7], dinW: [-4.1, -4.6], dinNW: [-4.1, -5.95], dinSW: [-3.75, -3.3], din: [-2.6, -3.35], dinE: [-0.75, -3.6],
  ldkW: [-4.6, -3.0], deckIn: [-0.5, -2.85], liv: [1.2, -3.35], livW: [-0.1, -4.2], livN: [0.1, -5.2], livE: [3.2, -3.35],
  dinNE: [-1.2, -5.9], dinE2: [-0.75, -5.3], gBed: [4.6, -2.9], gBath: [4.6, 0.0], gSE: [4.6, 2.8],
  bedIn: [5.85, -2.9], bedSide: [6.02, -4.6],
  bathIn: [5.85, 0.0], wash: [6.15, -0.9], tub: [7.72, 0.08],
  crIn: [5.85, 2.8], crMid: [6.9, 4.3], crS: [6.3, 6.1], crSt: [5.8, 6.05],
  stCr: [4.6, 6.05], stE: [4.65, 5.7], stE2: [4.7, 4.5], stM1: [-1.3, 5.4], stM2: [0.45, 5.4], stW: [-4.2, 5.3], stA: [-4.55, 3.95], stB: [3.95, 3.95],
  s1: [-2.0, 2.8], s2: [1.2, 2.8], sW: [-4.6, 2.8],
  wN: [-4.6, -1.6], wM: [-4.6, 0.0],
  utIn: [-5.85, 0.0], ut: [-7.0, -0.4],
  enIn: [-5.9, 2.8], en: [-7.1, 4.6],
  deckOut: [-0.5, -1.8], deckMid: [-1.0, -1.8], deckE: [3.45, -1.8], rampMid: [3.47, 0.2], rampEnd: [3.45, 1.4],
  rampS: [3.36, 1.95], gardenSE: [2.7, 1.95], gardenE: [2.4, 1.3], garden: [-0.4, 0.5], gardenW: [-2.45, 0.45],
};

export const NAV_EDGES = [
  ['kit', 'dinNW'], ['kitS', 'ldkW'], ['kitS', 'dinW'], ['dinW', 'dinNW'], ['dinW', 'dinSW'], ['dinSW', 'din'], ['ldkW', 'din'], ['din', 'dinE'],
  ['din', 'deckIn'], ['deckIn', 'liv'], ['dinE', 'liv'], ['liv', 'livW'], ['livW', 'livN'], ['livW', 'dinE'], ['livW', 'deckIn'], ['liv', 'livE'],
  ['livE', 'gBed'], ['ldkW', 'dinW'], ['dinNW', 'dinNE'], ['dinNE', 'livW'], ['dinNE', 'livN'], ['dinE2', 'dinNE'], ['dinE2', 'livW'], ['dinE2', 'dinE'],
  ['ldkW', 'wN'], ['wN', 'wM'], ['wM', 'sW'], ['wM', 'utIn'], ['utIn', 'ut'],
  ['sW', 'enIn'], ['enIn', 'en'], ['sW', 's1'], ['s1', 's2'], ['s2', 'gSE'],
  ['sW', 'stA'], ['stA', 'stW'], ['stW', 'stM1'], ['stM1', 'stM2'], ['stM2', 'stE'], ['stE', 'stE2'], ['stE2', 'stB'], ['stB', 'gSE'],
  ['stE', 'stCr'], ['stCr', 'crSt'], ['crSt', 'crS'], ['crS', 'crMid'],
  ['gSE', 'crIn'], ['crIn', 'crMid'], ['gSE', 'gBath'], ['gBath', 'bathIn'], ['bathIn', 'wash'], ['bathIn', 'tub'],
  ['gBath', 'gBed'], ['gBed', 'bedIn'], ['bedIn', 'bedSide'],
  ['deckIn', 'deckOut'], ['deckOut', 'deckMid'], ['deckOut', 'deckE'], ['deckE', 'rampMid'], ['rampMid', 'rampEnd'], ['rampEnd', 'rampS'], ['rampS', 'gardenSE'], ['gardenSE', 'gardenE'],
  ['gardenE', 'garden'], ['garden', 'gardenW'],
];

// Nodes near the bedroom. At night Claude's router avoids them (quiet side of the loop).
export const QUIET_NODES = new Set(['gBed', 'gN', 'livE', 'gBath']);

const PI = Math.PI;
// face: heading in radians; forward = (sin face, cos face). 0 faces south (+Z).
// y: hip/seat height for sitting poses. ap: approach point before settling into the spot.
export const SPOTS = {
  h_bed: { x: 7.1, z: -5.85, y: 0.54, face: 0, pose: 'sleep', node: 'bedSide', ap: [6.0, -5.7], room: 'bed' },
  h_wake: { x: 6.2, z: -4.3, face: PI / 2, pose: 'stretch', node: ['bedSide', 'bedIn'], room: 'bed' },
  h_wash: { x: 6.15, z: -1.45, face: PI, pose: 'wash', node: 'wash', room: 'bath' },
  h_bath: { x: 7.9, z: -1.1, face: 0, pose: 'hidden', node: 'tub', room: 'bath' },
  h_din: { x: -3.1, z: -5.36, y: 0.47, face: 0, pose: 'eat', node: ['dinNW', 'dinNE'], ap: [-3.1, -5.95], room: 'ldk', prop: 'bowl' },
  h_coffee: { x: -1.35, z: -1.16, y: 0.02, face: 0, pose: 'sitEdgeMug', node: 'deckMid', ap: [-1.35, -1.6], room: 'deck', prop: 'mug' },
  h_desk: { x: -1.3, z: 4.52, y: 0.47, face: PI, pose: 'type', node: 'stM1', ap: [-1.3, 5.15], room: 'study' },
  h_sofa: { x: 0.6, z: -6.02, y: 0.44, face: 0, pose: 'read', node: 'livN', ap: [0.6, -5.2], room: 'ldk', prop: 'book' },
  h_sofa2: { x: 0.6, z: -6.02, y: 0.44, face: 0, pose: 'relax', node: 'livN', ap: [0.6, -5.2], room: 'ldk' },
  h_garden: { x: -1.2, z: 0.88, face: 0, pose: 'garden', node: 'garden', room: 'court' },
  h_cook: { x: -5.4, z: -5.9, face: PI, pose: 'cook', node: 'dinNW', room: 'ldk' },
  h_moon: { x: -1.35, z: -1.16, y: 0.02, face: 0, pose: 'sitEdgeMug', node: 'deckMid', ap: [-1.35, -1.6], room: 'deck', prop: 'mug' },
  h_readbed: { x: 8.25, z: -3.05, y: 0.45, face: -PI / 2, pose: 'read', node: 'bedIn', ap: [7.6, -3.05], room: 'bed', prop: 'book' },

  c_dock: { x: 7.3, z: 2.78, face: 0, pose: 'charge', node: ['crIn', 'crMid'], ap: [7.3, 3.5], room: 'claude' },
  c_work: { x: 7.95, z: 5.0, face: PI / 2, pose: 'tinker', node: 'crMid', room: 'claude' },
  c_desk: { x: 7.95, z: 5.9, y: 0.47, face: 0, pose: 'write', node: 'crMid', ap: [7.95, 5.25], room: 'claude', prop: 'pen' },
  c_study: { x: 0.45, z: 4.52, y: 0.47, face: PI, pose: 'write', node: 'stM2', ap: [0.45, 5.15], room: 'study', prop: 'pen' },
  c_din: { x: -1.33, z: -4.6, y: 0.47, face: -PI / 2, pose: 'sitCharge', node: ['dinE', 'dinE2'], ap: [-0.75, -4.6], room: 'ldk' },
  c_cook: { x: -6.5, z: -4.2, face: PI, pose: 'chop', node: 'kitS', room: 'ldk' },
  c_dishes: { x: -7.55, z: -5.9, face: PI, pose: 'dishes', node: 'kit', room: 'ldk' },
  c_door: { x: 4.55, z: -2.9, face: PI / 2, pose: 'knock', node: 'gBed', room: 'gallery' },
  c_garden: { x: -2.7, z: 0.88, face: 0, pose: 'garden', node: 'gardenW', room: 'court' },
  c_water: { x: 0.25, z: 0.92, face: 0, pose: 'water', node: 'gardenE', room: 'court', prop: 'can' },
  c_moon: { x: -0.55, z: -1.16, y: 0.02, face: 0, pose: 'sitEdge', node: 'deckOut', ap: [-0.55, -1.6], room: 'deck' },
  c_laundry: { x: -7.0, z: -1.2, face: PI, pose: 'fold', node: 'ut', room: 'util' },
  c_sofa: { x: 1.75, z: -6.02, y: 0.44, face: 0, pose: 'relax', node: 'livN', ap: [1.75, -5.2], room: 'ldk' },
};

const hm = (h, m = 0) => h * 60 + m;

// [start minute, spot, activity label, spoken line]
export const SCHEDULE = {
  human: [
    [0, 'h_bed', '眠っている'],
    [hm(6, 35), 'h_wake', '起きて、のびをする', '…おはよう、Claude'],
    [hm(6, 50), 'h_wash', '顔を洗う'],
    [hm(7, 5), 'h_din', '朝ごはん', 'いただきます'],
    [hm(7, 40), 'h_coffee', '縁側で朝のコーヒー', '朝の縁側、いいね'],
    [hm(8, 10), 'h_desk', '仕事', 'よし、始めよう'],
    [hm(12, 0), 'h_din', '昼ごはん', 'おなかすいた〜'],
    [hm(12, 40), 'h_sofa', 'ソファで読書'],
    [hm(13, 30), 'h_desk', '仕事'],
    [hm(17, 0), 'h_garden', '中庭で収穫', 'トマト、赤くなってる！'],
    [hm(17, 40), 'h_sofa2', 'レコードを聴く'],
    [hm(18, 30), 'h_cook', '夕飯づくり', '味見して…って、できないか'],
    [hm(19, 15), 'h_din', '夕ごはん', 'いただきます'],
    [hm(20, 0), 'h_bath', 'お風呂（のぞかない約束）', 'ふぅ〜'],
    [hm(20, 40), 'h_moon', '縁側で月見', '月、きれいだね'],
    [hm(21, 40), 'h_readbed', '寝室で読書', 'おやすみ、Claude'],
    [hm(22, 40), 'h_bed', '眠っている'],
  ],
  claude: [
    [0, 'c_laundry', '洗濯物をたたむ（照明なし）', '（明かりはいらない。赤外線で見えるから）'],
    [hm(0, 50), 'c_dishes', '台所の片づけ', '（音を立てないように…）'],
    [hm(1, 40), 'c_water', '中庭の水やり', '（トマトに水。夜のうちに）'],
    [hm(2, 30), 'c_dock', '充電（朝まで）', '（充電しながら、今日のことを整理する）'],
    [hm(5, 50), 'c_cook', '朝ごはんの支度'],
    [hm(6, 21), 'c_door', '寝室の外から声をかける', 'おはよう。今日は晴れ、最高24℃だって'],
    [hm(6, 38), 'c_cook', '朝ごはんの仕上げ'],
    [hm(7, 5), 'c_din', '朝ごはんに同席', '今日の豆、少し深煎りにしてみた'],
    [hm(7, 43), 'c_dishes', '食器を洗う'],
    [hm(8, 4), 'c_study', '仕事', '昨日の続きから。テストが3件落ちてるよ'],
    [hm(12, 5), 'c_din', '昼ごはんに同席', 'トマトは今朝採れたのを使ったよ'],
    [hm(12, 44), 'c_dock', '太陽光で充電', 'ちょっと日向ぼっこ（充電）してくる'],
    [hm(13, 30), 'c_study', '仕事'],
    [hm(15, 0), 'c_work', 'セルフメンテナンス', '右ひじに、グリスを少し'],
    [hm(16, 0), 'c_study', '仕事'],
    [hm(16, 55), 'c_garden', '中庭で収穫', '明日はナスもいけそう'],
    [hm(17, 44), 'c_sofa', 'いっしょにレコードを聴く', 'この曲、好きだったよね'],
    [hm(18, 26), 'c_cook', '夕飯づくり', '塩分0.9%。完璧'],
    [hm(19, 15), 'c_din', '夕ごはん（充電パッドで）', 'いただきます（充電パッドで）'],
    [hm(20, 4), 'c_dishes', '食器洗い'],
    [hm(20, 34), 'c_moon', '縁側で月見', '今見てる月の光、1.3秒前のものなんだって'],
    [hm(21, 44), 'c_desk', '自室で日記を書く'],
    [hm(23, 20), 'c_laundry', '洗濯物をたたむ（照明なし）'],
  ],
};

// Extra lines that are not tied to the start of an activity.
export const EXTRA_LINES = [
  { t: hm(19, 52), who: 'claude', text: 'お風呂、わたしの排熱で温めておいたよ' },
  { t: hm(21, 41), who: 'claude', text: 'おやすみ。明日は6時半に起こすね' },
  { t: hm(22, 50), who: 'claude', text: '（今日のことを、日記に書いておこう）' },
  { t: hm(7, 12), who: 'human', text: 'この豆、好きかも' },
  { t: hm(15, 20), who: 'human', text: '（Claudeの机、今日も紙だらけだ）' },
  { t: hm(21, 0), who: 'human', text: '毎晩見てるのに、飽きないね' },
];

export const PLACE_NAMES = {
  ldk: 'LDK', gallery: '本の廊下', bed: '寝室', bath: '洗面・浴室', claude: 'Claudeの部屋', study: '書斎',
  corrS: '廊下', corrW: '廊下', util: '家事室', entry: '玄関土間', court: '中庭', deck: '縁側', out: '庭',
};

export function roomAt(x, z) {
  if (x > DECK.x0 && x < DECK.x1 && z > DECK.z0 && z < DECK.z1) return 'deck';
  if (x > COURT.x0 && x < COURT.x1 && z > COURT.z0 && z < COURT.z1) return 'court';
  for (const r of ROOMS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.id;
  return 'out';
}

// Height of the walkable surface.
export function groundY(x, z) {
  const inFoot = x > FOOT.x0 - 0.1 && x < FOOT.x1 + 0.1 && z > FOOT.z0 - 0.1 && z < FOOT.z1 + 0.1;
  const inCourt = x > COURT.x0 && x < COURT.x1 && z > COURT.z0 && z < COURT.z1;
  if (inCourt) {
    if (z < DECK.z1) return 0;
    if (x > RAMP.x0 && z < RAMP.z1) return Math.max(GARDEN_Y, (GARDEN_Y * (z - RAMP.z0)) / (RAMP.z1 - RAMP.z0));
    return GARDEN_Y;
  }
  if (inFoot) return 0;
  if (x > PATH.x0 && x < PATH.x1 && z > PATH.z0 && z < 11.5) return GROUND_Y * ((z - 7.1) / 4.4);
  return GROUND_Y;
}

export function roomArea(r) {
  return (r.x1 - r.x0) * (r.z1 - r.z0);
}
