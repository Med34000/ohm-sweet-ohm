import * as THREE from 'three';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { POWER_LAYOUT, ELECTRICAL_CABLES, electricalActivity } from '../data/electrical-topology.js?v=20260930-5';

// 2026-09-22 — Codex / OpenAI. Original pedagogical model; no OEM CAD data.
// 2026-09-30 ≈18:20 (Europe/Zurich) — Codex — OpenAI : flux intégré, cadence liée à la puissance réelle.
// 2026-09-30 ≈19:00 (Europe/Zurich) — Codex — OpenAI : chargeur pédagogique chanfreiné, refroidissement liquide et bornes AC/DC identifiables.
const UP = new THREE.Vector3(0, 1, 0);
const vec = (point) => new THREE.Vector3(...point);
const clamp = THREE.MathUtils.clamp;

function tag(object, component, label) {
  object.name = label;
  object.userData.component = component;
  object.userData.label = label;
  return object;
}

function chargerProfile(width, depth, radius, Path) {
  const shape = new Path(), x = -width / 2, z = -depth / 2, r = Math.min(radius, width / 4, depth / 4);
  const chamfer = width * .17;
  shape.moveTo(x + r, z); shape.lineTo(x + width - r, z);
  shape.quadraticCurveTo(x + width, z, x + width, z + r);
  // L'extrusion tourne de -π/2 : le haut du contour devient l'arrière négatif Z du véhicule.
  shape.lineTo(x + width, z + depth - chamfer); shape.lineTo(x + width - chamfer, z + depth);
  shape.lineTo(x + r, z + depth); shape.quadraticCurveTo(x, z + depth, x, z + depth - r);
  shape.lineTo(x, z + r); shape.quadraticCurveTo(x, z, x + r, z);
  return shape;
}

function roundedBox(width, height, depth, corner = 0.03, profile = null) {
  const x = -width / 2, z = -depth / 2, r = Math.min(corner, width / 4, depth / 4);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, z);
  shape.lineTo(x + width - r, z);
  shape.quadraticCurveTo(x + width, z, x + width, z + r);
  shape.lineTo(x + width, z + depth - r);
  shape.quadraticCurveTo(x + width, z + depth, x + width - r, z + depth);
  shape.lineTo(x + r, z + depth);
  shape.quadraticCurveTo(x, z + depth, x, z + depth - r);
  shape.lineTo(x, z + r);
  shape.quadraticCurveTo(x, z, x + r, z);
  const bevel = Math.min(height * 0.18, 0.008);
  const geometry = new THREE.ExtrudeGeometry(profile ? profile(width, depth, r, THREE.Shape) : shape, {
    depth: height - 2 * bevel, bevelEnabled: true,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 3, steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2 + bevel, 0);
  return geometry;
}

function labelTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 224;
  const context = canvas.getContext('2d');
  context.fillStyle = '#17272e'; context.fillRect(0, 0, 640, 224);
  context.fillStyle = '#ff941f'; context.fillRect(0, 0, 10, 224);
  context.fillStyle = '#ffffff'; context.font = '600 54px sans-serif';
  context.fillText(title, 30, 82);
  context.fillStyle = '#c4d0d3'; context.font = '500 34px sans-serif';
  context.fillText(subtitle, 30, 151);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Absolute vehicle coordinates: add group directly under the drivetrain root. */
export function createTeachingPower() {
  const group = tag(new THREE.Group(), 'hv', 'Électronique et liaisons haute tension');
  const groups = {
    inverter: tag(new THREE.Group(), 'inverter', 'Onduleur · DC ↔ trois phases'),
    charger: tag(new THREE.Group(), 'charger', 'Chargeur embarqué · AC → DC'),
    hv: tag(new THREE.Group(), 'hv', 'Câbles haute tension · isolant orange'),
  };
  group.add(groups.inverter, groups.charger, groups.hv);
  Object.assign(groups.charger.userData, { illustrative: true, cooling: 'liquid',
    description: 'Maquette pédagogique originale du chargeur AC : carter, plaque froide et raccords de liquide ; pas de CAO constructeur.' });

  const materials = {
    aluminium: new THREE.MeshStandardMaterial({ color: 0x949c9e, metalness: 0.74, roughness: 0.47 }),
    lid: new THREE.MeshStandardMaterial({ color: 0xb7c1c5, metalness: 0.78, roughness: 0.29 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1e2d33, metalness: 0.42, roughness: 0.40 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe86d19, metalness: 0.06, roughness: 0.34 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xcb7e46, metalness: 0.81, roughness: 0.30 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x173e2b, metalness: 0.18, roughness: 0.44 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x161918, roughness: 0.88 }),
    trace: new THREE.MeshStandardMaterial({ color: 0x89995d, metalness: 0.55, roughness: 0.5 }),
    ivory: new THREE.MeshStandardMaterial({ color: 0xbbbd9c, roughness: 0.55 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xd6dcd8, metalness: 0.16, roughness: 0.46 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xa4d44d }),
    pulse: new THREE.MeshBasicMaterial({ color: 0xf9d371, depthWrite: false }),
  };
  Object.entries(materials).forEach(([key, material]) => { material.name = 'Power_' + key; });
  const pickables = [], lids = [], ledMaterials = [];

  function mesh(parent, geometry, material, position, component, label) {
    const object = tag(new THREE.Mesh(geometry, material), component, label);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object); pickables.push(object);
    return object;
  }

  function instances(parent, geometry, material, placements, component, label) {
    const object = tag(new THREE.InstancedMesh(geometry, material, placements.length), component, label);
    const temporary = new THREE.Object3D();
    placements.forEach((position, index) => {
      temporary.position.set(...position); temporary.updateMatrix(); object.setMatrixAt(index, temporary.matrix);
    });
    object.instanceMatrix.needsUpdate = true;
    object.castShadow = true;
    parent.add(object); pickables.push(object);
    return object;
  }

  // Molded perimeter: a real hollow shell, not four intersecting cuboids.
  function rimGeometry(width, height, depth, thickness, radius = 0.07, profile = null) {
    function outline(w, d, r, Path) {
      const path = new Path(), x = -w / 2, z = -d / 2;
      path.moveTo(x + r, z); path.lineTo(x + w - r, z);
      path.quadraticCurveTo(x + w, z, x + w, z + r);
      path.lineTo(x + w, z + d - r); path.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
      path.lineTo(x + r, z + d); path.quadraticCurveTo(x, z + d, x, z + d - r);
      path.lineTo(x, z + r); path.quadraticCurveTo(x, z, x + r, z);
      return path;
    }
    const contour = profile || outline;
    const shape = contour(width, depth, radius, THREE.Shape);
    shape.holes.push(contour(width - thickness * 2, depth - thickness * 2,
      Math.max(0.012, radius - thickness), THREE.Path));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height - 0.008,
      bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 5 });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, -height / 2 + 0.004, 0);
    return geometry;
  }

  function caseAssembly(key, title, subtitle) {
    const parent = groups[key], { center, size } = POWER_LAYOUT[key];
    const [cx, cy, cz] = center, [width, height, depth] = size;
    const bottom = cy - height / 2, top = cy + height / 2;
    const profile = key === 'charger' ? chargerProfile : null;
    mesh(parent, roundedBox(width, 0.055, depth, 0.075, profile), materials.aluminium,
      [cx, bottom + 0.025, cz], key, 'Fond du carter et refroidissement liquide');
    mesh(parent, rimGeometry(width, height - 0.05, depth, 0.033, .07, profile), materials.aluminium,
      [cx, cy, cz], key, 'Carter moulé en aluminium · parois arrondies');
    mesh(parent, rimGeometry(width + 0.026, 0.027, depth + 0.026, 0.055, .07, profile), materials.lid,
      [cx, top - 0.025, cz], key, 'Bride usinée du carter');
    mesh(parent, rimGeometry(width - 0.008, 0.009, depth - 0.008, 0.012, .07, profile), materials.rubber,
      [cx, top - 0.006, cz], key, 'Joint périphérique d’étanchéité');
    const fins = [];
    for (let i = 0; i < 9; i++) for (const side of [-1, 1])
      fins.push([cx - width * 0.37 + i * width * 0.0925, cy - 0.015, cz + side * depth / 2]);
    instances(parent, roundedBox(0.017, height * 0.72, 0.047, 0.007), materials.aluminium,
      fins, key, 'Nervures verticales de fonderie');
    const bosses = [];
    for (let i = 0; i < 4; i++) for (const side of [-1, 1])
      bosses.push([cx + side * (width / 2 - 0.048), top - 0.045, cz - depth * 0.39 + i * depth * 0.26]);
    instances(parent, new THREE.CylinderGeometry(0.028, 0.033, 0.08, 16), materials.aluminium,
      bosses, key, 'Bossages taraudés de fixation');
    const lid = tag(new THREE.Group(), key, 'Couvercle démontable');
    lid.position.set(cx, top, cz); parent.add(lid);
    mesh(lid, roundedBox(width + 0.022, 0.027, depth + 0.022, 0.079, profile), materials.lid,
      [0, 0, 0], key, 'Couvercle métallique embouti');
    mesh(lid, roundedBox(width * 0.73, 0.018, depth * 0.80, 0.06, profile), materials.lid,
      [profile ? width * .04 : 0, 0.018, 0], key, 'Renfort embouti du couvercle');
    if (profile) {
      instances(lid, roundedBox(width * .62, .014, .022, .004), materials.lid,
        Array.from({ length: 10 }, (_, i) => [width * .04, .034, -depth * .015 + i * depth * .036]),
        key, 'Nervures et rainures du couvercle moulé');
    }
    const plate = mesh(lid, new THREE.PlaneGeometry(width * (profile ? .66 : .45), depth * .18),
      new THREE.MeshBasicMaterial({ map: labelTexture(title, subtitle), polygonOffset: true,
        polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [-width * 0.08, 0.031, -depth * 0.20], key, title);
    plate.rotation.x = -Math.PI / 2; plate.castShadow = false;
    const bolts = bosses.map(([x, , z]) => [x - cx, 0.022, z - cz]);
    instances(lid, new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6), materials.dark,
      bolts, key, 'Vis hexagonales de fixation');
    instances(lid, new THREE.CylinderGeometry(0.021, 0.021, 0.004, 16), materials.lid,
      bolts.map(([x,y,z]) => [x,y - 0.008,z]), key, 'Rondelles du couvercle');
    const boardY = bottom + 0.073;
    mesh(parent, roundedBox(width * 0.84, 0.012, depth * 0.84, 0.025, profile), materials.pcb,
      [cx, boardY, cz], key, 'Circuit imprimé de commande et de conversion');
    const ledMaterial = materials.glow.clone(); ledMaterials.push({ key, material: ledMaterial });
    mesh(parent, new THREE.SphereGeometry(0.006, 8, 6), ledMaterial,
      [cx + width * 0.31, boardY + 0.012, cz + depth * 0.34], key, 'Témoin de diagnostic');
    lids.push({ key, object: lid, y: top, x: cx, z: cz, depth });
    return { parent, center, size, bottom, top, boardY };
  }

  function electronicsDetail(assembly, key) {
    const { parent, center: [cx,,cz], size: [w,,d], boardY } = assembly;
    const smt = [], pads = [], chips = [], legs = [], tracks = [], plugs = [];
    // Small components along the edges leave the power stage readable at the centre.
    for (const side of [-1, 1]) for (let i = 0; i < 20; i++) {
      const x = cx + side * w * 0.35, z = cz - d * 0.33 + i * d * 0.035;
      smt.push([x, boardY + 0.014, z]);
      pads.push([x - 0.010, boardY + 0.012, z], [x + 0.010, boardY + 0.012, z]);
      tracks.push([x - side * 0.032, boardY + 0.007, z]);
    }
    for (let i = 0; i < 4; i++) {
      const x = cx - w * 0.22 + i * w * 0.146, z = cz - d * 0.34;
      chips.push([x, boardY + 0.018, z]);
      for (const side of [-1,1]) for (let j = 0; j < 8; j++)
        legs.push([x - 0.024 + j * 0.007, boardY + 0.011, z + side * 0.035]);
      plugs.push([x, boardY + 0.023, cz + d * 0.35]);
    }
    instances(parent, new THREE.BoxGeometry(0.015, 0.008, 0.008), materials.ceramic, smt, key, 'Condensateurs CMS');
    instances(parent, new THREE.BoxGeometry(0.005, 0.004, 0.009), materials.lid, pads, key, 'Soudures des composants');
    instances(parent, roundedBox(0.068, 0.02, 0.06, 0.006), materials.dark, chips, key, 'Circuits intégrés de commande');
    instances(parent, new THREE.BoxGeometry(0.0025, 0.004, 0.012), materials.lid, legs, key, 'Broches des circuits intégrés');
    instances(parent, new THREE.BoxGeometry(0.043, 0.001, 0.002), materials.trace, tracks, key, 'Pistes fines du circuit imprimé');
    instances(parent, roundedBox(0.08, 0.035, 0.037, 0.006), materials.ivory, plugs, key, 'Connecteurs basse tension');
  }

  const inverter = caseAssembly('inverter', 'INVERTER', 'DC / U V W');
  const [ix, , iz] = inverter.center;
  electronicsDetail(inverter, 'inverter');
  const switches = [], legs = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) for (let parallel = 0; parallel < 4; parallel++) {
    const x = ix - 0.235 + col * 0.19 + (parallel % 2) * 0.065;
    const z = iz + 0.035 + row * 0.16 + Math.floor(parallel / 2) * 0.063;
    switches.push([x, inverter.boardY + 0.032, z]);
    for (const side of [-1,1]) legs.push([x + side * 0.033, inverter.boardY + 0.018, z]);
  }
  instances(groups.inverter, roundedBox(0.05, 0.03, 0.047, 0.004), materials.ceramic,
    switches, 'inverter', 'Modules de puissance · six groupes de commutation');
  instances(groups.inverter, new THREE.BoxGeometry(0.021, 0.005, 0.03), materials.copper,
    legs, 'inverter', 'Languettes des modules de puissance');
  mesh(groups.inverter, roundedBox(0.56, 0.12, 0.20, 0.035), materials.dark,
    [ix, inverter.boardY + 0.072, iz - 0.17], 'inverter', 'Condensateur film du bus continu');
  instances(groups.inverter, roundedBox(0.58, 0.011, 0.027, 0.004), materials.copper,
    [[ix, inverter.boardY + 0.089, iz - 0.045], [ix, inverter.boardY + 0.067, iz + 0.12]],
    'inverter', 'Jeu de barres laminées en cuivre');
  instances(groups.inverter, roundedBox(0.041, 0.013, 0.16, 0.006), materials.copper,
    [-0.13,0,0.13].map(x => [ix + x, inverter.boardY + 0.074, iz + 0.29]),
    'inverter', 'Sorties triphasées internes U V W');

  const charger = caseAssembly('charger', 'CHARGEUR', 'AC → DC');
  const [ox, , oz] = charger.center;
  electronicsDetail(charger, 'charger');
  const windingParts = [], coreParts = [];
  for (let i = 0; i < 3; i++) {
    const cx = ox + 0.08, cz = oz - 0.35 + i * 0.26, cy = charger.boardY + 0.09;
    const core = new THREE.TorusGeometry(0.09, 0.028, 8, 32); core.rotateX(Math.PI / 2); core.translate(cx, cy, cz); coreParts.push(core);
    for (let turn = 0; turn < 24; turn++) {
      const a = turn * Math.PI * 2 / 24;
      const coil = new THREE.TorusGeometry(0.034, 0.0058, 5, 12);
      coil.rotateY(a); coil.translate(cx + Math.cos(a) * 0.09, cy, cz - Math.sin(a) * 0.09);
      windingParts.push(coil);
    }
  }
  mesh(groups.charger, mergeGeometries(coreParts), materials.dark, [0,0,0], 'charger', 'Noyaux ferrite des inductances');
  mesh(groups.charger, mergeGeometries(windingParts), materials.copper, [0,0,0], 'charger', 'Enroulements de cuivre verni');
  [...coreParts,...windingParts].forEach(g => g.dispose());
  const cans = Array.from({length:6}, (_,i) => [ox - 0.19, charger.boardY + 0.082, oz - 0.32 + i * 0.13]);
  instances(groups.charger, new THREE.CylinderGeometry(0.044,0.044,0.15,24), materials.dark,
    cans, 'charger', 'Condensateurs de filtrage');
  instances(groups.charger, new THREE.CylinderGeometry(0.040,0.040,0.004,24), materials.lid,
    cans.map(([x,y,z]) => [x,y + 0.078,z]), 'charger', 'Opercules métalliques des condensateurs');
  instances(groups.charger, new THREE.CylinderGeometry(.0445,.0445,.018,16,1,true), materials.ivory,
    cans.map(([x,y,z]) => [x,y + .038,z]), 'charger', 'Bandes isolantes des condensateurs de filtrage');
  mesh(groups.charger, roundedBox(0.18,0.13,0.18,0.025), materials.ivory,
    [ox + 0.12, charger.boardY + 0.077, oz + 0.40], 'charger', 'Transformateur haute fréquence isolé');
  instances(groups.charger, roundedBox(0.19,0.018,0.014,0.004), materials.copper,
    Array.from({length:8},(_,i) => [ox + 0.12, charger.boardY + 0.148, oz + 0.337 + i * 0.017]),
    'charger', 'Enroulement du transformateur');

  // Deux raccords distincts alimentent une plaque froide ; les reliefs du capot ne sont pas un ventilateur.
  for (const x of [ox - .24, ox + .04]) {
    const tube = mesh(groups.charger, new THREE.CylinderGeometry(.023,.023,.095,16,1,true), materials.aluminium,
      [x, charger.bottom + .060, oz - charger.size[2] / 2 - .022], 'charger', 'Raccord du refroidissement liquide');
    tube.rotation.x = Math.PI / 2;
    mesh(groups.charger, new THREE.TorusGeometry(.026,.005,6,24), materials.rubber,
      [x, charger.bottom + .060, oz - charger.size[2] / 2 - .056], 'charger', 'Joint étanche du raccord de liquide');
  }
  for (const offset of [-.012, .012]) {
    const path = new THREE.CatmullRomCurve3([
      vec([ox + .12, charger.boardY + .105, oz + .29 + offset]),
      vec([ox - .04, charger.boardY + .105, oz + .30 + offset]),
      vec([ox - .19, charger.boardY + .105, oz + .24 + offset]),
    ]);
    mesh(groups.charger, new THREE.TubeGeometry(path,16,.010,6,false), materials.copper,
      [0,0,0], 'charger', 'Liaisons de cuivre du transformateur au filtrage DC');
  }

  const physicalPorts = {};
  for (const [name, at] of Object.entries(POWER_LAYOUT.terminals)) {
    const key = name.split('.')[0];
    if (!['inverter','charger'].includes(key)) continue;
    const phase = /\.[UVW]$/.test(name);
    const geometry = new THREE.CylinderGeometry(phase ? 0.018 : 0.028, phase ? 0.018 : 0.028, 0.037, 16);
    if (name === 'charger.ac' || phase) geometry.rotateX(Math.PI / 2);
    else geometry.rotateZ(Math.PI / 2);
    const contact = mesh(groups[key], geometry, materials.copper, at, key, 'Contact physique ' + name);
    contact.userData.terminal = name; physicalPorts[name] = contact;
    if (!phase) {
      mesh(groups[key], roundedBox(0.10,0.085,0.09,0.015), materials.orange, at, key, 'Embase HT à verrouillage');
      mesh(groups[key], roundedBox(0.043,0.015,0.035,0.005), materials.dark,
        [at[0],at[1] + 0.047,at[2]], key, 'Verrou du connecteur');
    } else {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(at[0],inverter.boardY + 0.074,0.40),
        new THREE.Vector3(at[0],inverter.boardY + 0.065,0.51),
        new THREE.Vector3(at[0],at[1] + 0.04,at[2]), vec(at),
      ]);
      mesh(groups[key],new THREE.TubeGeometry(curve,10,0.013,6,false),materials.copper,
        [0,0,0],key,'Liaison interne du module de puissance au moteur');
    }
  }

  for (const { title, subtitle, position, rotation } of [
    { title: 'AC', subtitle: 'ENTRÉE', position: [ox, POWER_LAYOUT.terminals['charger.ac'][1] + .075, POWER_LAYOUT.terminals['charger.ac'][2] + .055], rotation: 0 },
    { title: 'DC + −', subtitle: 'SORTIE', position: [POWER_LAYOUT.terminals['charger.dc+'][0] - .055, POWER_LAYOUT.terminals['charger.dc+'][1] + .075,
      (POWER_LAYOUT.terminals['charger.dc+'][2] + POWER_LAYOUT.terminals['charger.dc-'][2]) / 2], rotation: -Math.PI / 2 },
  ]) {
    const plate = mesh(groups.charger, new THREE.PlaneGeometry(.17,.075),
      new THREE.MeshBasicMaterial({ map: labelTexture(title, subtitle), side: THREE.DoubleSide }), position,
      'charger', title === 'AC' ? 'Entrée AC du chargeur' : 'Sortie DC du chargeur');
    plate.rotation.y = rotation; plate.castShadow = false;
  }

  // Fuse static case and electronic details by material; lids remain independent.
  function batchStatic(parent, key) {
    const buckets = new Map();
    for (const child of [...parent.children]) {
      if (!child.isMesh || child.isInstancedMesh || child.userData.terminal || child.material.isMeshBasicMaterial) continue;
      child.updateMatrix();
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      if (!buckets.has(child.material)) buckets.set(child.material, { geometries: [], labels: [] });
      buckets.get(child.material).geometries.push(geometry);
      buckets.get(child.material).labels.push(child.userData.label);
      parent.remove(child);
      pickables.splice(pickables.indexOf(child),1);
    }
    for (const [material, { geometries, labels }] of buckets) {
      const assembly = mesh(parent, mergeGeometries(geometries), material, [0,0,0], key, 'Assemblage détaillé · ' + (key === 'inverter' ? 'onduleur' : 'chargeur'));
      assembly.userData.parts = labels;
      geometries.forEach(g => g.dispose());
    }
  }
  for (const key of ['inverter','charger']) {
    batchStatic(groups[key],key);
    batchStatic(lids.find(l => l.key === key).object,key);
  }

  const curves = new Map(), jacketGeometries = [], phaseGeometries = [], collarGeometries = [], connectorGeometries = [];
  const circuitIds = { charge: 1, dc: 2, phases: 3 };
  const focusedCircuit = { value: 0 };
  const circuitForCable = (id) => id.startsWith('charge') ? 1 : id.startsWith('traction') ? 2 : 3;
  const withCircuit = (geometry, circuit) => {
    geometry.setAttribute('cableCircuit', new THREE.Float32BufferAttribute(
      new Float32Array(geometry.attributes.position.count).fill(circuit), 1,
    ));
    return geometry;
  };
  // Per-vertex circuit identity keeps all eight cables batched in three draws.
  function circuitMaterial(source) {
    const material = source.clone();
    material.onBeforeCompile = shader => {
      shader.uniforms.uCableFocus = focusedCircuit;
      shader.uniforms.uCableMuted = { value: new THREE.Color(0x9ea8a4) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float cableCircuit;\nvarying float vCableCircuit;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCableCircuit = cableCircuit;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCableFocus;\nuniform vec3 uCableMuted;\nvarying float vCableCircuit;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float cableFocusActive = step(0.5, uCableFocus);
          float cableSelected = 1.0 - step(0.25, abs(vCableCircuit - uCableFocus));
          diffuseColor.rgb = mix(diffuseColor.rgb, uCableMuted, cableFocusActive * (1.0 - cableSelected) * 0.90);
        `)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * cableFocusActive * cableSelected * 0.14;
        `);
    };
    material.customProgramCacheKey = () => 'elan-cable-circuit-focus-v1';
    return material;
  }
  const axis = new THREE.Vector3(), quaternion = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  const unitScale = new THREE.Vector3(1, 1, 1);
  function fittedCylinder(radius, height, at, direction, segments = 10) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
    quaternion.setFromUnitVectors(UP, direction.clone().normalize());
    matrix.compose(at, quaternion, unitScale);
    geometry.applyMatrix4(matrix);
    return geometry;
  }
  for (const cable of ELECTRICAL_CABLES) {
    const curve = new THREE.CatmullRomCurve3(cable.points.map(vec), false, 'centripetal');
    const circuit = circuitForCable(cable.id);
    curves.set(cable.id, curve);
    const cableGeometry = new THREE.TubeGeometry(curve, Math.max(20, cable.points.length * 7), cable.radius, 12, false);
    (cable.kind === 'AC3' ? phaseGeometries : jacketGeometries).push(withCircuit(cableGeometry, circuit));
    for (const t of [0, 1]) {
      const position = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      collarGeometries.push(withCircuit(fittedCylinder(cable.radius * 1.40, 0.055, position, tangent, 16), circuit));
      if (cable.kind !== 'AC3') {
        const housing = roundedBox(cable.radius * 3.3, 0.095, cable.radius * 3.0, 0.019);
        quaternion.setFromUnitVectors(UP, tangent.clone().normalize());
        matrix.compose(position.clone().addScaledVector(tangent, t === 0 ? 0.026 : -0.026), quaternion, unitScale);
        housing.applyMatrix4(matrix);
        connectorGeometries.push(withCircuit(housing, circuit));
        for (let ring = 0; ring < 3; ring++) collarGeometries.push(withCircuit(fittedCylinder(cable.radius * 1.23, 0.007,
          position.clone().addScaledVector(tangent, (t === 0 ? 1 : -1) * (0.078 + ring * 0.012)), tangent, 12), circuit));
      }
    }
    // A few restrained retention clips keep the loom readable as a physical assembly.
    if (cable.id.startsWith('traction')) for (const t of [0.24, 0.55, 0.80]) {
      collarGeometries.push(withCircuit(fittedCylinder(cable.radius * 1.11, 0.017, curve.getPointAt(t), curve.getTangentAt(t)), circuit));
    }
  }
  const mergeCableParts = (geometries, material, label) => {
    const result = mesh(groups.hv, mergeGeometries(geometries.map(g => g.index ? g.toNonIndexed() : g), false), circuitMaterial(material), [0, 0, 0], 'hv', label);
    geometries.forEach(geometry => geometry.dispose());
    return result;
  };
  mergeCableParts(jacketGeometries, materials.orange, 'Gaines orange · haute tension DC et AC');
  mergeCableParts(phaseGeometries, materials.copper, 'Trois connexions internes · cuivre U V W');
  mergeCableParts(collarGeometries, materials.dark, 'Connecteurs étanches et fixations de faisceaux');
  mergeCableParts(connectorGeometries, materials.orange, 'Verrouillages des connecteurs haute tension');

  function portMarker(text, position, width = 0.23) {
    const plate = mesh(groups.hv, new THREE.PlaneGeometry(width, 0.075),
      new THREE.MeshBasicMaterial({ map: labelTexture(text, ''), side: THREE.DoubleSide }),
      position, 'hv', text);
    plate.castShadow = false;
    return plate;
  }
  const phaseMarker = portMarker('U  V  W', [1.98, -0.945, 0.635], 0.43);
  const dcMarker = portMarker('DC + −', [1.29, -0.65, 0.25], 0.25);
  dcMarker.rotation.y = -Math.PI / 2;
  const markers = [{ object: phaseMarker, circuit: 3 }, { object: dcMarker, circuit: 2 }];
  markers.forEach(({ object }) => { object.material.transparent = true; });

  const pulses = [];
  const pulseGeometry = new THREE.ConeGeometry(0.052, 0.13, 7);
  ['charge-ac', 'charge-positive', 'traction-positive', 'phase-V'].forEach(id => {
    const material = materials.pulse.clone();
    material.transparent = true;
    const count = id === 'traction-positive' ? 5 : 3;
    const arrows = tag(new THREE.InstancedMesh(pulseGeometry, material, count), 'hv', 'Sens du transfert d’énergie');
    arrows.frustumCulled = false;
    arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    groups.hv.add(arrows);
    pulses.push({ id, arrows, material, count, curve: curves.get(id), phase: 0 });
  });

  const anchors = {
    inverter: vec(POWER_LAYOUT.inverter.center), charger: vec(POWER_LAYOUT.charger.center),
    hv: new THREE.Vector3(1.80, -1.07, 1.13),
    dc: new THREE.Vector3(1.80, -1.07, 1.13),
    phases: new THREE.Vector3(1.98, -1.02, 0.59),
    'charge-port': vec(POWER_LAYOUT.terminals['port.ac']),
  };
  for (const [name, point] of Object.entries({
    chargerInput: vec(POWER_LAYOUT.terminals['charger.ac']),
    chargerConversion: new THREE.Vector3(ox + .12, charger.boardY + .15, oz + .40),
    chargerOutput: vec(POWER_LAYOUT.terminals['charger.dc+']).add(vec(POWER_LAYOUT.terminals['charger.dc-'])).multiplyScalar(.5),
  })) {
    const anchor = tag(new THREE.Object3D(), 'charger', name);
    anchor.position.copy(point); groups.charger.add(anchor); anchors[name] = anchor;
  }
  const samples = (id, count = 22) => curves.get(id).getSpacedPoints(count);
  const chargeAC = samples('charge-ac');
  const chargeDC = samples('charge-positive');
  const paths = {
    chargeAC, chargeDC,
    charge: [...chargeAC, vec(POWER_LAYOUT.charger.center), ...chargeDC],
    dc: samples('traction-positive', 32),
    phases: samples('phase-V', 18),
  };
  let previousTime = null;
  const transform = new THREE.Object3D();
  const glowOn = new THREE.Color(0xa4d44d), glowOff = new THREE.Color(0x304038);
  function setFrame({ time = 0, dt: frameDt = null, running = true, power = 0, mode = 'drive', connected = false,
    charging = false, recovering = false, opened = false, focus = null, progress = 1 } = {}) {
    const activity = electricalActivity({ power, mode, connected, charging, recovering });
    const normalizedPower = Number.isFinite(power) ? clamp(Math.abs(power), 0, 1) : 0;
    const dt = running ? clamp(Number.isFinite(frameDt) ? frameDt : previousTime !== null && Number.isFinite(time) ? time - previousTime : 0, 0, .06) : 0;
    if (running && Number.isFinite(time)) previousTime = time;
    focusedCircuit.value = opened ? (circuitIds[focus] || 0) : 0;
    for (const marker of markers) {
      marker.object.material.opacity = !focusedCircuit.value || marker.circuit === focusedCircuit.value ? 1 : 0.30;
    }
    const opening = opened ? clamp(Number.isFinite(progress) ? progress : 1, 0, 1) : 0;
    for (const lid of lids) {
      const amount = opening * ((focus === lid.key || focus === 'hv') ? 1 : 0);
      lid.object.position.y = lid.y + amount * 0.45;
      lid.object.position.x = lid.x + amount * 0.15;
      lid.object.position.z = lid.z - amount * (lid.depth * 0.85 + 0.10);
      lid.object.rotation.x = -amount * 0.8;
      lid.object.rotation.z = amount * 0.06;
    }
    for (const led of ledMaterials) {
      led.material.color.copy((led.key === 'charger' ? activity.charge : activity.traction) ? glowOn : glowOff);
    }
    for (const pulse of pulses) {
      const chargeRoute = pulse.id.startsWith('charge');
      pulse.arrows.visible = normalizedPower > 0 && (chargeRoute ? activity.charge : activity.traction);
      if (!pulse.arrows.visible) continue;
      const direction = chargeRoute ? 1 : activity.direction;
      pulse.material.opacity = !focusedCircuit.value || circuitForCable(pulse.id) === focusedCircuit.value ? 1 : 0.20;
      pulse.material.color.setHex(direction < 0 ? 0xa4d44d : 0xf9d371);
      // L’entrée est |kW| / 300. La racine rend les faibles puissances lisibles sans ajouter de flux au repos.
      const rate = 0.22 * Math.sqrt(normalizedPower) / Math.max(0.7, pulse.curve.getLength());
      pulse.phase = ((pulse.phase + dt * rate * direction) % 1 + 1) % 1;
      for (let i = 0; i < pulse.count; i++) {
        const t = (i / pulse.count + pulse.phase) % 1;
        transform.position.copy(pulse.curve.getPointAt(t));
        axis.copy(pulse.curve.getTangentAt(t)).multiplyScalar(direction);
        transform.quaternion.setFromUnitVectors(UP, axis.normalize());
        transform.updateMatrix(); pulse.arrows.setMatrixAt(i, transform.matrix);
      }
      pulse.arrows.instanceMatrix.needsUpdate = true;
    }
  }
  setFrame();
  group.updateMatrixWorld(true);
  const metrics = { triangles: 0, drawCalls: 0, cables: ELECTRICAL_CABLES.length, powerSwitches: 6,
    chargingPowerKW: 11, powerPackages: 24, integratedPhaseConnections: true, illustrative: true };
  group.traverse(object => {
    if (!object.isMesh) return;
    const count = object.isInstancedMesh ? object.count : 1;
    metrics.triangles += ((object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3) * count;
    metrics.drawCalls += 1;
  });
  return { group, groups, pickables, setFrame, anchors, paths, physicalPorts, metrics };
}
