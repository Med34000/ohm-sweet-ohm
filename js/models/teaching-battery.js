import * as THREE from 'three';

// Original reconstruction inspired by the four-module cylindrical-cell pack.
// Cell proportions follow the 2170 format; the 3,072-cell arrangement is a
// deliberately simplified teaching layout, not Tesla's production cell count.
// 2026-09-22 — Codex / OpenAI, GPT-6.
const clamp = value => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const ease = value => value * value * (3 - 2 * value);
const metal = (color, roughness = 0.38, metalness = 0.82, name = 'Aluminium moulé') => {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  material.name = name;
  return material;
};
const CELL = Object.freeze({ diameter: 0.042, height: 0.14, columns: 64, rows: 12, pitchX: 0.046, pitchZ: 0.045 });
const MODULE_X = -0.525;
const MODULE_Z = [-0.975, -0.325, 0.325, 0.975];

function tagged(object, label, part = 'battery') {
  object.name = label;
  object.userData.component = ['bms', 'contactors'].includes(part) ? 'bms' : 'battery';
  object.userData.label = label;
  object.userData.batteryPart = part;
  return object;
}

function plateGeometry(width, height, depth, radius = 0.035) {
  const shape = new THREE.Shape();
  const x = -width / 2, z = -depth / 2, r = Math.min(radius, width / 3, depth / 3);
  shape.moveTo(x + r, z);
  shape.lineTo(x + width - r, z);
  shape.quadraticCurveTo(x + width, z, x + width, z + r);
  shape.lineTo(x + width, z + depth - r);
  shape.quadraticCurveTo(x + width, z + depth, x + width - r, z + depth);
  shape.lineTo(x + r, z + depth);
  shape.quadraticCurveTo(x, z + depth, x, z + depth - r);
  shape.lineTo(x, z + r);
  shape.quadraticCurveTo(x, z, x + r, z);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelSize: Math.min(height * 0.14, 0.006),
    bevelThickness: Math.min(height * 0.14, 0.006), bevelSegments: 2, curveSegments: 5, steps: 1,
  });
  geometry.translate(0, 0, -height / 2);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// Thin, corrugated cooling ribbons between cylindrical-cell rows. Unlike a
// decorative pipe on the floor, their vertical walls touch the cell flanks.
function ribbonGeometry() {
  const positions = [], indices = [];
  for (let row = 0; row < CELL.rows - 1; row++) {
    const centerZ = (row - (CELL.rows - 2) / 2) * CELL.pitchZ;
    const first = positions.length / 3;
    for (let i = 0; i <= CELL.columns * 2; i++) {
      const x = -1.4835 + i * CELL.pitchX / 2;
      const lowerRowOffset = row % 2 ? 0.0115 : -0.0115;
      const z = centerZ + Math.cos((x + 1.449 - lowerRowOffset) * Math.PI * 2 / CELL.pitchX) * 0.0024;
      positions.push(x, -0.063, z - 0.0013, x, 0.045, z - 0.0013,
        x, -0.063, z + 0.0013, x, 0.045, z + 0.0013);
      if (i === 0) continue;
      const a = first + (i - 1) * 4, b = a + 4;
      indices.push(a, b, a + 1, b, b + 1, a + 1,
        a + 2, a + 3, b + 2, b + 2, a + 3, b + 3,
        a + 1, b + 1, a + 3, b + 1, b + 3, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** X is length, Y is vertical, Z is width; two scene units represent one metre.
 * All four HV terminals stay fixed when opening the teaching model.
 * focusGroups.bms contains the monitoring board and the real switching area.
 */
export function createTeachingBattery() {
  const group = tagged(new THREE.Group(), 'Batterie cylindrique — quatre modules et baie électronique');
  const shell = tagged(new THREE.Group(), 'Plateau embouti et protection périphérique', 'case');
  const modules = tagged(new THREE.Group(), 'Quatre longs modules à cellules 2170', 'modules');
  const cooling = tagged(new THREE.Group(), 'Rubans de refroidissement entre les cellules', 'cooling');
  const protection = tagged(new THREE.Group(), 'BMS, contacteurs et fusible dans la baie arrière', 'bms');
  const lid = tagged(new THREE.Group(), 'Couvercle embouti et capot de baie électronique', 'lid');
  group.add(shell, cooling, modules, protection, lid);
  const m = {
    aluminium: metal(0xa9b2b4, 0.43, 0.86, 'Aluminium embouti'),
    satin: metal(0x839395, 0.40, 0.82, 'Aluminium extrudé'),
    dark: metal(0x35444a, 0.51, 0.55, 'Tôle de support anodisée'),
    nickel: metal(0xd3d9d8, 0.29, 0.94, 'Nickel et acier des contacts'),
    cell: metal(0xadb8b6, 0.32, 0.9, 'Acier des cellules 2170'),
    copper: metal(0xbf7b42, 0.32, 0.94, 'Barres de cuivre'),
    insulation: metal(0x202d30, 0.7, 0.05, 'Isolant polymère'),
    cellSeal: metal(0x4d6b67, 0.62, 0.1, 'Joint isolant de cellule'),
    orange: metal(0xe36b22, 0.55, 0.03, 'Polymère orange haute tension'),
    coolant: metal(0x829fa4, 0.43, 0.82, 'Ruban aluminium de refroidissement'),
    pcb: metal(0x164c3f, 0.63, 0.16, 'Carte électronique BMS'),
    ceramic: metal(0xe1dfce, 0.61, 0.04, 'Céramique et connecteurs isolants'),
    silk: metal(0xb9c8b4, 0.7, 0.04, 'Sérigraphie PCB'),
    led: metal(0x80b64e, 0.45, 0.05, 'Jauge pédagogique'),
  };
  m.led.emissive.set(0x61983a); m.led.emissiveIntensity = 0.12;
  const box = new THREE.BoxGeometry(1, 1, 1);
  function mesh(parent, geometry, material, label, position, part, scale) {
    const item = tagged(new THREE.Mesh(geometry, material), label, part);
    if (position) item.position.set(...position);
    if (scale) item.scale.set(...scale);
    item.castShadow = true; item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function instances(parent, geometry, material, items, label, part) {
    const item = tagged(new THREE.InstancedMesh(geometry, material, items.length), label, part);
    const transform = new THREE.Object3D();
    items.forEach((entry, index) => {
      transform.position.set(...entry.position);
      transform.scale.set(...(entry.scale || [1, 1, 1]));
      transform.rotation.set(...(entry.rotation || [0, 0, 0]));
      transform.updateMatrix(); item.setMatrixAt(index, transform.matrix);
    });
    item.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    item.instanceMatrix.needsUpdate = true;
    item.castShadow = true; item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  const horizontalDisc = segments => new THREE.CircleGeometry(1, segments).rotateX(-Math.PI / 2);
  const cyl = (r, h, segments = 16) => new THREE.CylinderGeometry(r, r, h, segments);

  mesh(shell, plateGeometry(4.3, 0.026, 2.76, 0.105), m.satin, 'Plateau inférieur embouti en aluminium', [0, -0.124, 0], 'case');
  instances(shell, plateGeometry(4.14, 0.192, 0.059, 0.016), m.aluminium,
    [-1.336, 1.336].map(z => ({ position: [0, -0.018, z] })), 'Longerons de protection extrudés', 'case');
  instances(shell, plateGeometry(0.061, 0.192, 2.63, 0.018), m.aluminium,
    [-2.097, 2.097].map(x => ({ position: [x, -0.018, 0] })), 'Traverses de fermeture du plateau', 'case');
  instances(shell, plateGeometry(4.22, 0.012, 0.062, 0.015), m.aluminium,
    [-1.351, 1.351].map(z => ({ position: [0, 0.085, z] })), 'Bride horizontale de fermeture', 'case');
  instances(shell, box, m.insulation, [
    { position: [0, 0.095, -1.327], scale: [4.12, 0.009, 0.016] },
    { position: [0, 0.095, 1.327], scale: [4.12, 0.009, 0.016] },
    { position: [-2.072, 0.095, 0], scale: [0.016, 0.009, 2.66] },
    { position: [2.072, 0.095, 0], scale: [0.016, 0.009, 2.66] },
  ], 'Joint périphérique continu', 'case');
  const bolts = [], tabs = [], stampings = [];
  for (let i = 0; i < 17; i++) {
    const x = -1.98 + i * 3.96 / 16;
    for (const z of [-1.354, 1.354]) bolts.push({ position: [x, 0.105, z] });
  }
  for (let i = 1; i < 10; i++) {
    const z = -1.3 + i * 2.6 / 10;
    bolts.push({ position: [-2.098, 0.105, z] }, { position: [2.098, 0.105, z] });
  }
  for (const x of [-1.83, -0.68, 0.48, 1.74]) for (const z of [-1.367, 1.367]) tabs.push({ position: [x, -0.054, z] });
  for (let i = 0; i < 9; i++) stampings.push({ position: [-1.8 + i * 0.44, -0.103, 0] });
  instances(shell, plateGeometry(0.048, 0.014, 2.48, 0.012), m.aluminium, stampings, 'Emboutissages de rigidité du fond', 'case');
  instances(shell, plateGeometry(0.16, 0.034, 0.083, 0.024), m.satin, tabs, 'Pattes de fixation de la batterie au châssis', 'case');
  instances(shell, cyl(0.013, 0.012, 6), m.nickel, bolts, 'Vis hexagonales de fermeture', 'case');
  // Rear penthouse: PCS occupies its negative-Z half in the power model.
  mesh(shell, plateGeometry(0.93, 0.049, 2.46, 0.053), m.dark, 'Plancher surélevé de la baie électronique arrière', [1.575, 0.083, 0], 'case');

  instances(cooling, plateGeometry(3.025, 0.017, 0.581, 0.031), m.satin,
    MODULE_Z.map(z => ({ position: [MODULE_X, -0.092, z] })), 'Plaques thermiques des quatre modules', 'cooling');
  instances(cooling, ribbonGeometry(), m.coolant,
    MODULE_Z.map(z => ({ position: [MODULE_X, 0, z] })), 'Rubans ondulés entre les rangées de cellules', 'cooling');
  const coolantLinks = [];
  for (const z of MODULE_Z) {
    for (let i = 0; i < 10; i++) coolantLinks.push({ position: [MODULE_X + (i % 2 ? -1.49 : 1.49), -0.009, z - 0.203 + i * 0.045], scale: [0.018, 0.086, 0.055] });
  }
  instances(cooling, box, m.coolant, coolantLinks, 'Retours du serpentin de chaque module', 'cooling');
  instances(cooling, cyl(0.019, 0.25, 12), m.dark, [
    { position: [1.108, -0.047, -1.20], rotation: [0, 0, Math.PI / 2] },
    { position: [1.108, -0.047, 1.20], rotation: [0, 0, Math.PI / 2] },
  ], 'Raccords du liquide de refroidissement', 'cooling');

  instances(modules, plateGeometry(3.02, 0.018, 0.581, 0.032), m.insulation,
    MODULE_Z.map(z => ({ position: [MODULE_X, -0.084, z] })), 'Quatre supports isolants de modules', 'modules');
  const rails = [], endFrames = [], cells = [], seals = [], caps = [], buttons = [], collectors = [], bridges = [];
  for (const z of MODULE_Z) {
    rails.push({ position: [MODULE_X, -0.002, z - 0.29] }, { position: [MODULE_X, -0.002, z + 0.29] });
    endFrames.push({ position: [-2.028, -0.002, z] }, { position: [0.978, -0.002, z] });
    for (let row = 0; row < CELL.rows; row++) {
      for (let col = 0; col < CELL.columns; col++) {
        const x = MODULE_X + (col - 31.5) * CELL.pitchX + (row % 2 ? 0.0115 : -0.0115);
        const cz = z + (row - 5.5) * CELL.pitchZ;
        cells.push({ position: [x, 0, cz] });
        seals.push({ position: [x, 0.0685, cz], scale: [0.0201, 1, 0.0201] });
        caps.push({ position: [x, 0.0695, cz], scale: [0.0176, 1, 0.0176] });
        buttons.push({ position: [x, 0.0705, cz], scale: [0.0064, 1, 0.0064] });
      }
      collectors.push({ position: [MODULE_X, 0.075, z + (row - 5.5) * CELL.pitchZ], scale: [2.934, 0.002, 0.0028] });
    }
    for (let i = 0; i < 8; i++) bridges.push({ position: [-1.825 + i * 0.365, 0.079, z], scale: [0.009, 0.004, 0.526] });
  }
  instances(modules, plateGeometry(3.00, 0.153, 0.020, 0.008), m.satin, rails, 'Rails fins des modules longitudinaux', 'modules');
  instances(modules, plateGeometry(0.024, 0.153, 0.594, 0.01), m.dark, endFrames, 'Flasques de maintien des modules', 'modules');
  const barrels = instances(modules, new THREE.CylinderGeometry(CELL.diameter / 2, CELL.diameter / 2, CELL.height, 12, 1, true), m.cell, cells,
    '3 072 cellules 2170 — nombre illustratif, proportions 21 × 70 mm', 'cells');
  barrels.userData.cellDimensionsMM = { diameter: 21, height: 70 };
  barrels.userData.cellArrangement = { modules: 4, rowsPerModule: CELL.rows, columnsPerModule: CELL.columns };
  instances(modules, horizontalDisc(12), m.cellSeal, seals, 'Joints isolants des cellules', 'cells');
  instances(modules, horizontalDisc(12), m.nickel, caps, 'Capsules nickel des cellules cylindriques', 'cells');
  instances(modules, horizontalDisc(8), m.nickel, buttons, 'Bornes positives des cellules', 'cells');
  instances(modules, box, m.nickel, collectors, 'Fils de liaison fusibles au-dessus des cellules — schématisés', 'cells');
  instances(modules, box, m.copper, bridges, 'Bandes collectrices et prises de mesure — schématisées', 'cells');

  // BMS is a thin PCB with varied surface-mount parts, connectors and real
  // mechanical supports, rather than a row of identical oversized blocks.
  mesh(protection, plateGeometry(0.82, 0.016, 0.59, 0.031), m.aluminium, 'Support de carte dans la baie arrière', [1.57, 0.195, 0.57], 'bms');
  mesh(protection, plateGeometry(0.754, 0.008, 0.534, 0.016), m.pcb, 'BMS : carte de mesure et de surveillance', [1.57, 0.23, 0.57], 'bms');
  const standoffs = [];
  for (const x of [1.23, 1.91]) for (const z of [0.339, 0.801]) standoffs.push({ position: [x, 0.213, z] });
  instances(protection, cyl(0.015, 0.030, 6), m.nickel, standoffs, 'Entretoises métalliques de la carte BMS', 'bms');
  const chips = [
    { position: [1.535, 0.249, 0.537], scale: [0.142, 0.025, 0.142] },
    { position: [1.319, 0.247, 0.482], scale: [0.074, 0.021, 0.134] },
    { position: [1.762, 0.247, 0.485], scale: [0.067, 0.021, 0.155] },
    { position: [1.461, 0.246, 0.721], scale: [0.096, 0.02, 0.048] },
    { position: [1.735, 0.246, 0.732], scale: [0.104, 0.018, 0.056] },
  ];
  instances(protection, box, m.insulation, chips, 'Microcontrôleur, interfaces de mesure et circuits isolés', 'bms');
  const pins = [], resistors = [], resistorEnds = [], traces = [], silk = [];
  for (const chip of chips) {
    const [x, y, z] = chip.position, [sx, , sz] = chip.scale;
    const count = Math.max(4, Math.round(sz / 0.012));
    for (let i = 0; i < count; i++) for (const side of [-1, 1]) pins.push({ position: [x + side * (sx / 2 + 0.008), y - 0.004, z - sz * 0.42 + i * sz * 0.84 / (count - 1)], scale: [0.017, 0.005, 0.0045] });
    silk.push({ position: [x, 0.236, z - sz / 2 - 0.02], scale: [sx + 0.03, 0.001, 0.002] });
    traces.push({ position: [x + sx / 2 + 0.045, 0.235, z], scale: [0.06, 0.001, 0.002] });
  }
  for (let i = 0; i < 36; i++) {
    const x = 1.265 + (i % 9) * 0.072, z = 0.345 + Math.floor(i / 9) * 0.14;
    resistors.push({ position: [x, 0.241, z], scale: [0.022, 0.01, 0.009] });
    resistorEnds.push({ position: [x - 0.011, 0.241, z], scale: [0.005, 0.011, 0.01] }, { position: [x + 0.011, 0.241, z], scale: [0.005, 0.011, 0.01] });
    traces.push({ position: [x + 0.025, 0.235, z + 0.018], scale: [0.002, 0.001, 0.041] });
  }
  instances(protection, box, m.nickel, [...pins, ...resistorEnds], 'Pattes soudées et terminaisons des composants', 'bms');
  instances(protection, box, m.insulation, resistors, 'Réseaux de résistances et composants de mesure', 'bms');
  instances(protection, box, m.copper, traces, 'Pistes fines du circuit imprimé', 'bms');
  instances(protection, box, m.silk, silk, 'Repérage sérigraphié du circuit imprimé', 'bms');
  instances(protection, cyl(0.019, 0.046, 16), m.dark, [
    { position: [1.831, 0.259, 0.649] }, { position: [1.88, 0.259, 0.649] }, { position: [1.311, 0.259, 0.684] },
  ], 'Condensateurs de filtrage du BMS', 'bms');
  const connectorBodies = [
    { position: [1.365, 0.255, 0.83], scale: [0.21, 0.044, 0.062] },
    { position: [1.675, 0.255, 0.83], scale: [0.20, 0.044, 0.062] },
  ];
  instances(protection, box, m.ceramic, connectorBodies, 'Connecteurs de mesures basse tension', 'bms');
  const sockets = [];
  for (const x of [1.365, 1.675]) for (let i = 0; i < 10; i++) sockets.push({ position: [x - 0.0765 + i * 0.017, 0.259, 0.863], scale: [0.007, 0.017, 0.004] });
  instances(protection, box, m.insulation, sockets, 'Alvéoles des connecteurs de mesure', 'bms');
  const harness = [];
  for (const z of MODULE_Z) {
    const end = new THREE.Vector3(1.24, 0.272, 0.83);
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0.97, 0.06, z), new THREE.Vector3(1.064, 0.13, z), new THREE.Vector3(1.07, 0.24, 0.83), end]);
    harness.push({ geometry: new THREE.TubeGeometry(path, 24, 0.007, 6, false) });
  }
  // The measurement leads flex with the opening; their BMS ends stay seated.
  // They are outside focusGroups.bms so the isolated board keeps tight bounds.
  const harnessMeshes = harness.map(({ geometry }, i) => {
    const item = mesh(shell, geometry, m.insulation, `Faisceau basse tension du module ${i + 1} — trajet illustratif`, null, 'modules');
    item.userData.originalPositions = geometry.attributes.position.array.slice();
    return item;
  });

  mesh(protection, plateGeometry(0.82, 0.021, 0.344, 0.035), m.dark, 'Support isolant des protections de puissance', [1.58, 0.141, 1.06], 'contactors');
  const contactorCenters = [1.367, 1.775];
  instances(protection, cyl(0.081, 0.115, 24), m.nickel,
    contactorCenters.map(x => ({ position: [x, 0.207, 1.024] })), 'Deux contacteurs : enveloppes métalliques de coupure HT', 'contactors');
  instances(protection, cyl(0.085, 0.026, 24), m.insulation,
    contactorCenters.map(x => ({ position: [x, 0.154, 1.024] })), 'Socles isolants des contacteurs', 'contactors');
  instances(protection, cyl(0.07, 0.023, 20), m.ceramic,
    contactorCenters.map(x => ({ position: [x, 0.271, 1.024] })), 'Traversées céramiques des contacteurs', 'contactors');
  const studs = [];
  for (const x of contactorCenters) for (const side of [-1, 1]) studs.push({ position: [x + side * 0.038, 0.301, 1.024] });
  instances(protection, cyl(0.013, 0.042, 10), m.copper, studs, 'Bornes filetées de puissance des contacteurs', 'contactors');
  instances(protection, cyl(0.022, 0.012, 6), m.nickel,
    studs.map(stud => ({ position: [stud.position[0], 0.313, stud.position[2]] })), 'Écrous de fixation des barres de puissance', 'contactors');
  mesh(protection, cyl(0.042, 0.23, 20), m.ceramic, 'Fusible haute tension : corps céramique de protection', [1.576, 0.2, 1.218], 'contactors').rotation.z = Math.PI / 2;
  instances(protection, cyl(0.044, 0.049, 20), m.nickel, [
    { position: [1.449, 0.2, 1.218], rotation: [0, 0, Math.PI / 2] },
    { position: [1.703, 0.2, 1.218], rotation: [0, 0, Math.PI / 2] },
  ], 'Embouts métalliques du fusible', 'contactors');
  mesh(protection, plateGeometry(0.030, 0.011, 0.205, 0.005), m.copper,
    'Barre positive : du contacteur au fusible', [1.405, 0.304, 1.1215], 'contactors');
  instances(protection, box, m.copper, [
    { position: [1.405, 0.262, 1.218], scale: [0.030, 0.087, 0.036] },
    { position: [1.430, 0.22, 1.218], scale: [0.057, 0.011, 0.036] },
    { position: [1.853, 0.22, 1.218], scale: [0.30, 0.011, 0.029] },
    { position: [2.000, 0.22, 1.084], scale: [0.030, 0.011, 0.269] },
    { position: [2.000, 0.19, 0.95], scale: [0.030, 0.067, 0.030] },
    { position: [1.813, 0.304, 1.062], scale: [0.030, 0.011, 0.089] },
    { position: [1.925, 0.304, 1.1], scale: [0.239, 0.011, 0.030] },
    { position: [2.04, 0.232, 1.1], scale: [0.030, 0.153, 0.030] },
  ], 'Lames de cuivre pliées : positif protégé et retour négatif distinct', 'contactors');

  const terminalZ = [0.95, 1.10];
  instances(shell, cyl(0.046, 0.105, 16), m.orange,
    terminalZ.map(z => ({ position: [2.095, 0.16, z], rotation: [0, 0, Math.PI / 2] })), 'Sorties haute tension orange vers l’onduleur', 'terminals');
  instances(shell, cyl(0.027, 0.012, 12), m.copper,
    terminalZ.map(z => ({ position: [2.151, 0.16, z], rotation: [0, 0, Math.PI / 2] })), 'Contacts haute tension protégés', 'terminals');
  instances(shell, box, m.copper, [
    { position: [2.048, 0.16, 0.95], scale: [0.101, 0.013, 0.030] },
    { position: [2.067, 0.16, 1.10], scale: [0.064, 0.013, 0.030] },
  ], 'Raccordements intérieurs séparés des deux sorties HT', 'terminals');
  instances(shell, cyl(0.044, 0.076, 16), m.orange,
    [1.06, 1.21].map(z => ({ position: [0.70, 0.132, z] })), 'Entrées de courant continu depuis le chargeur embarqué', 'terminals');
  instances(shell, cyl(0.025, 0.008, 12), m.copper,
    [1.06, 1.21].map(z => ({ position: [0.70, 0.172, z] })), 'Contacts du circuit de recharge', 'terminals');

  mesh(lid, plateGeometry(3.135, 0.019, 2.62, 0.067), m.aluminium, 'Couvercle embouti des modules', [-0.51, 0.114, 0], 'lid');
  const lidRibs = [];
  for (let i = 0; i < 6; i++) lidRibs.push({ position: [-1.83 + i * 0.505, 0.127, 0] });
  instances(lid, plateGeometry(0.032, 0.018, 2.37, 0.014), m.satin, lidRibs, 'Nervures embouties du couvercle', 'lid');
  mesh(lid, plateGeometry(0.996, 0.023, 2.59, 0.10), m.aluminium, 'Capot surélevé de baie électronique', [1.579, 0.649, 0], 'lid');
  instances(lid, plateGeometry(0.964, 0.518, 0.028, 0.01), m.satin,
    [-1.281, 1.281].map(z => ({ position: [1.58, 0.381, z] })), 'Flancs du capot de baie arrière', 'lid');
  instances(lid, plateGeometry(0.028, 0.518, 2.56, 0.01), m.satin,
    [1.097, 2.062].map(x => ({ position: [x, 0.381, 0] })), 'Faces du capot de baie arrière', 'lid');
  mesh(lid, plateGeometry(0.34, 0.003, 0.20, 0.009), m.insulation, 'Étiquette haute tension de la maquette', [-1.22, 0.129, 0.49], 'lid');
  const boltMark = new THREE.Shape();
  boltMark.moveTo(-0.012, 0.061); boltMark.lineTo(0.030, 0.061); boltMark.lineTo(0.004, 0.011);
  boltMark.lineTo(0.033, 0.011); boltMark.lineTo(-0.026, -0.064); boltMark.lineTo(-0.011, -0.008);
  boltMark.lineTo(-0.036, -0.008); boltMark.closePath();
  mesh(lid, new THREE.ShapeGeometry(boltMark).rotateX(-Math.PI / 2), m.orange, 'Symbole haute tension', [-1.30, 0.132, 0.49], 'lid');
  const leds = instances(lid, box, m.led, Array.from({ length: 12 }, (_, i) => ({ position: [-1.249 + i * 0.013, 0.133, 0.49], scale: [0.008, 0.002, 0.057] })), 'Jauge pédagogique ajoutée — niveau de charge', 'soc');
  leds.userData.illustrativeAnnotation = true;
  const ledOn = new THREE.Color(0x80b64e), ledOff = new THREE.Color(0x243a32);

  const anchors = {
    battery: new THREE.Vector3(-0.3, 0.1, 0), modules: new THREE.Vector3(-0.525, 0.085, 0.325),
    cells: new THREE.Vector3(-1.48, 0.075, 0.975), cooling: new THREE.Vector3(-0.72, 0.04, 0.975),
    bms: new THREE.Vector3(1.535, 0.265, 0.537), sensing: new THREE.Vector3(1.365, 0.267, 0.835),
    contactors: new THREE.Vector3(1.367, 0.302, 1.024), fuse: new THREE.Vector3(1.576, 0.238, 1.218),
    positive: new THREE.Vector3(2.15, 0.16, 0.95), negative: new THREE.Vector3(2.15, 0.16, 1.10),
    chargingPositive: new THREE.Vector3(0.70, 0.17, 1.06), chargingNegative: new THREE.Vector3(0.70, 0.17, 1.21),
  };
  let triangles = 0, drawCalls = 0;
  const geometries = new Set();
  group.traverse(item => {
    if (!item.isMesh) return;
    triangles += (item.geometry.index?.count || item.geometry.attributes.position.count) / 3 * (item.isInstancedMesh ? item.count : 1);
    drawCalls++; geometries.add(item.geometry);
  });
  const metrics = Object.freeze({
    modules: 4, cells: CELL.columns * CELL.rows * 4, triangles, drawCalls, geometries: geometries.size,
    caseSize: Object.freeze([4.3, 0.28, 2.76]), penthouseHeight: 0.675,
    cellDimensionsMM: Object.freeze({ diameter: 21, height: 70 }), cellAspectRatio: 70 / 21,
    cooling: 'inter-row serpentine aluminium ribbons', illustrative: true,
    note: 'Quatre modules longitudinaux et cellules de format 2170 ; 3 072 cellules représentées, nombre et implantation simplifiés, sans reproduction de la nomenclature constructeur.',
  });
  let lastSoc = -1, lastFocus = '', currentOpening = 0, isolatedFocus = null, previousHarnessY = NaN, previousHarnessZ = NaN;
  const focusGroups = Object.freeze({ bms: protection });
  function applyFocusVisibility() {
    const bmsOnly = isolatedFocus === 'bms';
    shell.visible = lid.visible = !bmsOnly;
    modules.visible = cooling.visible = !bmsOnly && currentOpening > 0.005;
    protection.visible = bmsOnly || currentOpening > 0.005;
    for (const item of harnessMeshes) item.visible = currentOpening > 0.005;
  }
  function setFocusVisibility(focus = null) {
    isolatedFocus = focus === 'bms' ? focus : null;
    applyFocusVisibility();
  }
  function setFrame({ soc = 0.62, opened = false, progress, focus = 'overview' } = {}) {
    const opening = ease(clamp(typeof opened === 'number' ? opened : opened ? (progress ?? 1) : 0));
    currentOpening = opening;
    const coolingFocus = focus === 'cooling';
    applyFocusVisibility();
    modules.position.y = opening * (coolingFocus ? 0.60 : 0.30);
    modules.position.z = coolingFocus ? opening * -0.22 : 0;
    if (modules.position.y !== previousHarnessY || modules.position.z !== previousHarnessZ) {
      for (const item of harnessMeshes) {
        const position = item.geometry.attributes.position;
        const original = item.userData.originalPositions;
        for (let i = 0; i < position.count; i++) {
          // Seven vertices per ring (six tube sides plus the closing vertex).
          const moduleWeight = 1 - Math.floor(i / 7) / 24;
          position.array[i * 3 + 1] = original[i * 3 + 1] + modules.position.y * moduleWeight;
          position.array[i * 3 + 2] = original[i * 3 + 2] + modules.position.z * moduleWeight;
        }
        position.needsUpdate = true;
        item.geometry.computeVertexNormals();
        item.geometry.computeBoundingSphere();
      }
      previousHarnessY = modules.position.y; previousHarnessZ = modules.position.z;
    }
    lid.position.set(-0.12 * opening, 0.84 * opening, -1.73 * opening);
    lid.rotation.x = -0.84 * opening;
    anchors.modules.set(-0.525, 0.085 + modules.position.y, 0.325 + modules.position.z);
    anchors.cells.set(-1.48, 0.075 + modules.position.y, 0.975 + modules.position.z);
    const filled = Math.round(clamp(soc) * 12);
    if (filled !== lastSoc) {
      for (let i = 0; i < 12; i++) leds.setColorAt(i, i < filled ? ledOn : ledOff);
      leds.instanceColor.needsUpdate = true; lastSoc = filled;
    }
    if (focus !== lastFocus) {
      m.cell.emissive.set(0x294746); m.cell.emissiveIntensity = focus === 'cells' ? 0.055 : 0;
      m.coolant.emissive.set(0x237885); m.coolant.emissiveIntensity = coolingFocus ? 0.26 : 0;
      m.coolant.color.set(coolingFocus ? 0x568c97 : 0x829fa4);
      m.pcb.emissive.set(0x1b6343); m.pcb.emissiveIntensity = focus === 'bms' ? 0.075 : 0;
      lastFocus = focus;
    }
  }
  setFrame();
  return { group, setFrame, setFocusVisibility, focusGroups, anchors, metrics };
}
