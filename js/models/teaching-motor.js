import * as THREE from 'three';
import { createGLTFLoader } from './gltf-loader.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const POLE_PAIRS = 3;
const PHASE_COLORS = [0xff9b50, 0xffcd78, 0xf77843];
const ASSET_URL = 'assets/web/elan-drive-unit.glb?v=realistic-1';

function tag(object, label, part = 'motor') {
  object.name = label;
  Object.assign(object.userData, { component: 'motor', label, motorPart: part });
  return object;
}
function mesh(parent, geometry, material, label, part, position = [0, 0, 0]) {
  const object = tag(new THREE.Mesh(geometry, material), label, part);
  object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
function instances(parent, geometry, material, transforms, label, part) {
  const object = tag(new THREE.InstancedMesh(geometry, material, transforms.length), label, part);
  const transform = new THREE.Object3D();
  transforms.forEach((item, index) => {
    transform.position.set(...(item.position || [0, 0, 0]));
    transform.rotation.set(...(item.rotation || [0, 0, 0]));
    transform.scale.set(...(item.scale || [1, 1, 1]));
    transform.updateMatrix(); object.setMatrixAt(index, transform.matrix);
  });
  object.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  object.instanceMatrix.needsUpdate = true;
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
function cylinderGeometry(radius, length, segments = 48) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  geometry.rotateX(Math.PI / 2); return geometry;
}
function ringGeometry(inner, outer, length, segments = 64) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, TAU, true); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1, curveSegments: segments / 4 });
  geometry.translate(0, 0, -length / 2); return geometry;
}
function coilGeometry(radius, layer) {
  // Distributed coil: two axial conductors, separated by nine of the 54 slots,
  // joined by curved end turns. A few strands indicate the dense real winding.
  const pitch = TAU * 9 / 54;
  const halfLength = .309;
  const points = [];
  for (let i = 0; i <= 5; i++) points.push(new THREE.Vector3(radius, 0, -halfLength + 2 * halfLength * i / 5));
  for (let i = 1; i <= 10; i++) {
    const t = i / 10, a = pitch * t, r = radius + .022 * Math.sin(Math.PI * t);
    points.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), halfLength + (.071 + layer * .006) * Math.sin(Math.PI * t)));
  }
  for (let i = 1; i <= 5; i++) points.push(new THREE.Vector3(radius * Math.cos(pitch), radius * Math.sin(pitch), halfLength - 2 * halfLength * i / 5));
  for (let i = 1; i < 10; i++) {
    const t = i / 10, a = pitch * (1 - t), r = radius + .022 * Math.sin(Math.PI * t);
    points.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), -halfLength - (.071 + layer * .006) * Math.sin(Math.PI * t)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, 'centripetal'), 40, .0033, 4, true);
}
function castGrain() {
  const size = 64, pixels = new Uint8Array(size * size);
  let seed = 97123;
  for (let i = 0; i < pixels.length; i++) { seed = Math.imul(seed ^ seed >>> 13, 1274126177); pixels[i] = 105 + (seed >>> 24) % 45; }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RedFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(7, 7); texture.needsUpdate = true;
  return texture;
}

// 2026-09-30 ≈14:30 (Europe/Zurich) — Codex / OpenAI : surimpressions pour expliquer, sans simulation électromagnétique ni passe de post-traitement.
function ribbonGeometry(curve, width = .012, segments = 48) {
  const position = new Float32Array((segments + 1) * 6), uv = new Float32Array((segments + 1) * 4), indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize().multiplyScalar(width);
    p.clone().sub(side).toArray(position, i * 6); p.clone().add(side).toArray(position, i * 6 + 3);
    uv.set([t, 0, t, 1], i * 4);
    if (i < segments) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function teachingGlow(color, effect) {
  const fragment = {
    field: 'float edge = pow(max(0.0, 1.0 - abs(vUv.y * 2.0 - 1.0)), 1.5); float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * cos((vUv.x - uTime * 0.18) * 25.13274), 7.0); float alpha = edge * pulse;',
    halo: 'float r = length(vXY); float petals = 0.32 + 0.68 * pow(0.5 + 0.5 * cos(atan(vXY.y, vXY.x) * 6.0), 2.0); float alpha = exp(-pow((r - 0.42) * 8.0, 2.0)) * petals * 0.20;',
    phase: 'float r = length(vXY); float edge = smoothstep(0.0, 0.006, r - uRadius + 0.011) * smoothstep(0.0, 0.006, uRadius + 0.011 - r); float wave = abs(cos(uElectrical - uPhase)); float arc = 0.3 + 0.7 * pow(0.5 + 0.5 * cos(atan(vXY.y, vXY.x) * 3.0 - uElectrical + uPhase), 3.0); float alpha = edge * (0.2 + 0.8 * wave) * arc;',
    shaft: 'float band = 0.2 + 0.8 * pow(0.5 + 0.5 * cos((vUv.y - uTime * 0.35 * uDir) * 25.13274), 9.0); float edge = pow(max(0.0, sin(vUv.y * 3.141593)), 0.5); float alpha = edge * band * 0.65;',
    transfer: 'float edge = max(0.0, 1.0 - abs(vUv.y * 2.0 - 1.0)); float pulse = 0.16 + 0.84 * pow(0.5 + 0.5 * cos((vUv.x - uTime * 0.45 * uDir) * 18.84956), 8.0); float alpha = edge * pulse;',
  }[effect];
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, forceSinglePass: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uStrength: { value: 0 },
      uDir: { value: 1 }, uElectrical: { value: 0 }, uPhase: { value: 0 }, uRadius: { value: .43 } },
    vertexShader: 'varying vec2 vUv; varying vec2 vXY; void main() { vUv = uv; vXY = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uStrength, uDir, uElectrical, uPhase, uRadius; varying vec2 vUv; varying vec2 vXY;
      void main() { ${fragment} gl_FragColor = vec4(uColor, alpha * uStrength); }`,
  });
}

/**
 * Original visual reconstruction inspired by the 54-slot, six-pole Model 3 IPM
 * architecture. Not OEM CAD, a manufacturing drawing or a field simulation.
 * Origin at motor centre; shaft on Z; physical inverter terminals stay fixed.
 */
export function createTeachingMotor() {
  const group = tag(new THREE.Group(), 'Groupe moteur — reconstruction réaliste');
  Object.assign(group.userData, { illustrative: true, polePairs: POLE_PAIRS, statorSlots: 54,
    description: 'Stator à bobinages répartis, rotor à aimants enterrés, carters moulés et refroidissement liquide.' });
  const aluminium = new THREE.MeshStandardMaterial({ color: 0xaab0b4, metalness: .86, roughness: .31 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x535c64, metalness: .92, roughness: .29 });
  const laminationSteel = new THREE.MeshStandardMaterial({ color: 0x273139, metalness: .82, roughness: .42 });
  const black = new THREE.MeshStandardMaterial({ color: 0x22282c, metalness: .12, roughness: .51 });
  const insulation = new THREE.MeshStandardMaterial({ color: 0xa29272, metalness: .08, roughness: .59 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb87a47, metalness: .88, roughness: .29 });
  const magnetMaterial = new THREE.MeshStandardMaterial({ color: 0x979ba0, metalness: .80, roughness: .28 });
  const shaftMaterial = aluminium.clone(); shaftMaterial.emissive.setHex(0x267c87);
  const phaseMaterials = PHASE_COLORS.map(color => {
    const material = copper.clone(); material.emissive.setHex(color); material.emissiveIntensity = 0; return material;
  });
  const casing = tag(new THREE.Group(), 'Carter moulé et refroidissement liquide', 'housing');
  const cover = tag(new THREE.Group(), 'Section de carter ouverte pour observer', 'housing');
  const stator = tag(new THREE.Group(), 'Stator — 54 encoches', 'stator');
  const rotor = tag(new THREE.Group(), 'Rotor métallique — six pôles à aimants enterrés', 'rotor');
  const capFront = tag(new THREE.Group(), 'Flasque avant et roulement', 'bearing');
  const capRear = tag(new THREE.Group(), 'Flasque arrière et roulement', 'bearing');
  group.add(casing, cover, stator, rotor, capFront, capRear);

  // Lightweight fallback is replaced by the Blender die-cast surfaces on load.
  const fallback = [];
  fallback.push(mesh(casing, ringGeometry(.401, .439, .86), aluminium, 'Carter de secours', 'housing'));
  for (const cap of [capFront, capRear]) fallback.push(mesh(cap, ringGeometry(.118, .45, .055), aluminium, 'Flasque de secours', 'bearing'));
  const functional = tag(new THREE.Group(), 'Connexions et accessoires fixes', 'phases');
  group.add(functional);
  mesh(functional, new THREE.BoxGeometry(.36, .085, .072), black, 'Support isolant du bornier triphasé', 'phases', [0, .25, .525]);
  instances(functional, cylinderGeometry(.021, .057, 16), copper, [-1, 0, 1].map(index => ({ position: [index * .13, .25, .59] })), 'Contacts cuivre U, V et W', 'phases');
  instances(functional, ringGeometry(.022, .032, .018, 24), insulation, [-1, 0, 1].map(index => ({ position: [index * .13, .25, .555] })), 'Isolants des trois bornes', 'terminals');

  mesh(stator, ringGeometry(.365, .398, .618, 96), laminationSteel, 'Culasse feuilletée du stator', 'stator');
  const laminations = Array.from({ length: 28 }, (_, i) => ({ position: [0, 0, -.304 + i * .0225] }));
  instances(stator, ringGeometry(.396, .400, .0018, 64), steel, laminations, 'Stries du paquet de tôles', 'stator');
  const teeth = [], liners = [], phaseTransforms = [[], [], []];
  for (let index = 0; index < 54; index++) {
    const a = index / 54 * TAU, rotation = [0, 0, a];
    teeth.push({ position: [.328 * Math.cos(a), .328 * Math.sin(a), 0], rotation });
    liners.push({ position: [.350 * Math.cos(a + TAU / 108), .350 * Math.sin(a + TAU / 108), 0], rotation: [0, 0, a + TAU / 108] });
    phaseTransforms[[0, 2, 1, 0, 2, 1][Math.floor(index / 3) % 6]].push({ rotation: [0, 0, a + TAU / 108] });
  }
  instances(stator, new THREE.BoxGeometry(.078, .018, .613), steel, teeth, '54 dents en acier feuilleté', 'stator');
  instances(stator, new THREE.BoxGeometry(.052, .013, .626), insulation, liners, 'Isolants de fond d’encoche', 'stator');
  const conductorLayers = Array.from({ length: 3 }, (_, layer) => coilGeometry(.322 + layer * .015, layer));
  const winding = mergeGeometries(conductorLayers);
  conductorLayers.forEach(geometry => geometry.dispose());
  for (let phase = 0; phase < 3; phase++) {
    const object = instances(stator, winding, phaseMaterials[phase], phaseTransforms[phase], `Cuivre verni — phase ${['U', 'V', 'W'][phase]}`, 'phases');
    object.userData.phase = ['U', 'V', 'W'][phase]; object.userData.illustrativeColors = false;
  }
  // Neutral metallic rotor. The front end exposes the buried V-shaped magnet
  // sections; no coloured surface magnets suggest an incorrect motor topology.
  mesh(rotor, cylinderGeometry(.2865, .610, 72), steel, 'Paquet de tôles du rotor', 'rotor');
  instances(rotor, ringGeometry(.2855, .287, .0015, 64), laminationSteel,
    Array.from({ length: 21 }, (_, i) => ({ position: [0, 0, -.3 + i * .03] })), 'Fines stries du rotor', 'rotor');
  const magnetTransforms = [], slotTransforms = [];
  for (let pole = 0; pole < 6; pole++) {
    const a = pole / 6 * TAU;
    for (const side of [-1, 1]) {
      const tangent = side * .048;
      const pos = [.206 * Math.cos(a) - tangent * Math.sin(a), .206 * Math.sin(a) + tangent * Math.cos(a), .3065];
      const transform = { position: pos, rotation: [0, 0, a + side * .62] };
      magnetTransforms.push(transform); slotTransforms.push({ ...transform, position: [...pos.slice(0, 2), .306] });
    }
  }
  instances(rotor, new THREE.BoxGeometry(.080, .020, .002), black, slotTransforms, 'Logements des aimants enterrés en V', 'rotor');
  const magnets = instances(rotor, new THREE.BoxGeometry(.073, .013, .002), magnetMaterial, magnetTransforms, 'Douze sections d’aimants enterrés — six pôles', 'rotor');
  magnets.userData.poles = 6; magnets.userData.magnetTopology = 'buried-v';
  mesh(rotor, ringGeometry(.072, .153, .014, 48), aluminium, 'Rondelle de retenue du rotor', 'rotor', [0, 0, .314]);
  mesh(rotor, cylinderGeometry(.066, 1.23, 40), shaftMaterial, 'Arbre moteur usiné', 'shaft');
  instances(rotor, cylinderGeometry(.084, .079, 32), steel, [-.36, .36].map(z => ({ position: [0, 0, z] })), 'Portées de roulement', 'shaft');
  instances(rotor, new THREE.BoxGeometry(.009, .009, .128), steel, Array.from({ length: 18 }, (_, i) => {
    const a = i / 18 * TAU; return { position: [.066 * Math.cos(a), .066 * Math.sin(a), .55], rotation: [0, 0, a] };
  }), 'Cannelures de sortie', 'shaft');
  for (const cap of [capFront, capRear]) {
    mesh(cap, ringGeometry(.091, .116, .068, 48), steel, 'Bague extérieure du roulement', 'bearing');
    mesh(cap, ringGeometry(.067, .078, .071, 48), aluminium, 'Bague intérieure du roulement', 'bearing');
    instances(cap, new THREE.SphereGeometry(.0095, 8, 6), aluminium, Array.from({ length: 12 }, (_, i) => {
      const a = i / 12 * TAU; return { position: [.0845 * Math.cos(a), .0845 * Math.sin(a), .005] };
    }), 'Billes du roulement', 'bearing');
  }

  const field = tag(new THREE.Group(), 'Champ tournant — surimpression pédagogique', 'field');
  Object.assign(field.userData, { illustrative: true, effect: 'rotating-field',
    description: 'Lignes et halo stylisés du champ tournant ; leur forme et leur intensité ne sont pas un calcul électromagnétique.' });
  const overlays = [];
  function overlay(parent, geometry, material, label, part, effect) {
    const object = mesh(parent, geometry, material, label, part);
    Object.assign(object.userData, { illustrative: true, illustrativeAnnotation: true, effect });
    object.castShadow = object.receiveShadow = false; object.renderOrder = 8; overlays.push(object); return object;
  }
  const fieldParts = [];
  // Deux lignes relient chaque pôle N à chacun de ses voisins S : six pôles, sans déplacer les aimants réels.
  for (let north = 0; north < 3; north++) for (const sign of [-1, 1]) for (const lane of [0, 1]) {
    const a = north / 3 * TAU, delta = sign * TAU / 6;
    const polar = (radius, angle, z) => new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
    const curve = new THREE.CatmullRomCurve3([
      polar(.265, a, .365), polar(.43 + lane * .025, a + delta * .20, .41),
      polar(.57 + lane * .045, a + delta * .5, .46), polar(.43 + lane * .025, a + delta * .80, .41), polar(.265, a + delta, .365),
    ]);
    fieldParts.push(ribbonGeometry(curve, lane ? .008 : .012, 48));
  }
  const fieldMaterial = teachingGlow(0x67eaff, 'field');
  overlay(field, mergeGeometries(fieldParts), fieldMaterial, 'Lignes courbes — champ magnétique tournant illustratif', 'field', 'magnetic-lines');
  fieldParts.forEach(geometry => geometry.dispose());
  const haloMaterial = teachingGlow(0x56d7ec, 'halo');
  const fieldHalo = overlay(field, new THREE.RingGeometry(.22, .64, 96), haloMaterial, 'Halo cyan — champ tournant à six pôles', 'field', 'magnetic-halo');
  fieldHalo.position.z = .36;
  group.add(field);
  const phaseOverlay = tag(new THREE.Group(), 'Trois courants — bobinages U V W', 'phases');
  Object.assign(phaseOverlay.userData, { illustrative: true, effect: 'phase-currents',
    description: 'Trois amplitudes décalées de 120 degrés électriques ; couleurs ajoutées à la lecture, cuivre naturel conservé.' });
  const phaseGlows = PHASE_COLORS.map((color, phase) => {
    const radius = .425 + phase * .027, material = teachingGlow(color, 'phase');
    material.uniforms.uPhase.value = phase / 3 * TAU; material.uniforms.uRadius.value = radius;
    const object = overlay(phaseOverlay, new THREE.RingGeometry(radius - .011, radius + .011, 96), material,
      `Courant ${['U', 'V', 'W'][phase]} — déphasage électrique de ${phase * 120}°`, 'phases', 'phase-wave');
    object.position.z = .385; object.userData.phaseIndex = phase; return object;
  });
  group.add(phaseOverlay);
  const fieldMaterials = [0xff7d70, 0x75bdff].map(color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .92, depthWrite: false, depthTest: false, toneMapped: false }));
  const poleOverlay = tag(new THREE.Group(), 'Six pôles — repères pédagogiques', 'field');
  rotor.add(poleOverlay);
  for (let parity = 0; parity < 2; parity++) {
    const transforms = Array.from({ length: 3 }, (_, index) => {
      const a = (index * 2 + parity) / 6 * TAU;
      return { position: [.26 * Math.cos(a), .26 * Math.sin(a), .309] };
    });
    const marker = instances(poleOverlay, cylinderGeometry(.025, .001, 16), fieldMaterials[parity], transforms, `Repères des pôles ${parity ? 'Sud' : 'Nord'}`, 'field');
    marker.userData.pole = parity ? 'S' : 'N'; marker.castShadow = false;
    Object.assign(marker.userData, { illustrative: true, illustrativeAnnotation: true, effect: 'magnetic-poles' });
    const glyph = parity ? [[-.012, .014], [0, .019], [.014, .013], [.010, .003], [-.010, -.003], [-.014, -.013], [0, -.019], [.012, -.014]]
      : [[-.012, -.019], [-.012, .019], [.012, -.019], [.012, .019]];
    const letterParts = [];
    for (let pole = parity; pole < 6; pole += 2) {
      const a = pole / 6 * TAU;
      const points = glyph.map(([x, y]) => new THREE.Vector3(x + .31 * Math.cos(a), y + .31 * Math.sin(a), .331));
      letterParts.push(ribbonGeometry(new THREE.CatmullRomCurve3(points, false, parity ? 'centripetal' : 'catmullrom', parity ? .5 : 0), .0034, 20));
    }
    overlay(poleOverlay, mergeGeometries(letterParts), fieldMaterials[parity], `Pôles ${parity ? 'S — Sud' : 'N — Nord'} du rotor`, 'field', 'pole-symbols');
    letterParts.forEach(geometry => geometry.dispose());
  }
  const transmission = tag(new THREE.Group(), 'Mouvement et transfert mécanique — arbre', 'shaft');
  Object.assign(transmission.userData, { illustrative: true, effect: 'shaft-transfer',
    description: 'Impulsions sur l’arbre : énergie vers les roues en traction, vers le générateur au freinage ; rotation mécanique conservée.' });
  const shaftGlowMaterial = teachingGlow(0xf0fff5, 'shaft');
  const shaftGlow = overlay(transmission, new THREE.CylinderGeometry(.088, .088, .59, 32, 1, true), shaftGlowMaterial,
    'Transfert mécanique — rotation et énergie sur l’arbre', 'shaft', 'mechanical-transfer');
  shaftGlow.rotation.x = Math.PI / 2; shaftGlow.position.z = .30; rotor.add(transmission);
  const electricalTransfer = tag(new THREE.Group(), 'Énergie électrique ↔ bornes U V W', 'phases');
  Object.assign(electricalTransfer.userData, { illustrative: true, effect: 'electrical-transfer',
    description: 'Surimpression du transfert d’énergie triphasée, pas une liaison physique supplémentaire ni des électrons visibles.' });
  const transferParts = [-1, 0, 1].map((index, phase) => ribbonGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(index * .15, .32, .33), new THREE.Vector3(index * .18, .40, .46), new THREE.Vector3(index * .13, .25, .60),
  ]), .011, 24));
  const transferMaterial = teachingGlow(0xffbe6b, 'transfer');
  overlay(electricalTransfer, mergeGeometries(transferParts), transferMaterial, 'Trois phases — énergie vers ou depuis le moteur', 'phases', 'electrical-transfer');
  transferParts.forEach(geometry => geometry.dispose()); group.add(electricalTransfer);
  const anchors = {
    stator: new THREE.Vector3(-.32, .24, .25), rotor: new THREE.Vector3(0, .18, 0),
    shaft: new THREE.Vector3(0, 0, .60), phases: new THREE.Vector3(0, .31, .59),
    housing: new THREE.Vector3(0, .45, 0), field: new THREE.Vector3(0, .26, .42),
  };
  let heldRotorAngle = 0, heldTime = 0;
  function setFrame({ rotorAngle, time, running = true, power = 0, mode = 'drive', opened = false, progress, focus = null } = {}) {
    if (running && Number.isFinite(rotorAngle)) heldRotorAngle = rotorAngle;
    if (running && Number.isFinite(time)) heldTime = time;
    const open = opened ? THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 1, 0, 1) : 0;
    const eased = open * open * (3 - 2 * open);
    const activePower = mode === 'charge' ? 0 : THREE.MathUtils.clamp(Number.isFinite(power) ? power : 0, 0, 1);
    const regenerating = focus === 'generator' || mode === 'regen' || mode === 'brake';
    const torqueAngle = (regenerating ? -1 : 1) * Math.PI / 5 * activePower;
    const electricalAngle = heldRotorAngle * POLE_PAIRS + torqueAngle;
    const compactLesson = ['field', 'stator', 'phases', 'generator'].includes(focus);
    // Le champ agit près du rotor ; seul le chapitre de démontage écarte fortement celui-ci.
    rotor.rotation.z = heldRotorAngle; rotor.position.z = eased * (compactLesson ? .12 : .92);
    capFront.position.z = .465 + eased * 1.34; capRear.position.z = -.465 - eased * .34;
    cover.position.y = eased * .76; cover.position.z = -eased * .16; cover.rotation.z = -eased * .16;
    capFront.visible = capRear.visible = cover.visible = !(compactLesson && open > .3);
    field.visible = open > .3 && activePower > .01 && (!focus || ['field', 'stator', 'phases', 'generator', 'overview'].includes(focus));
    field.rotation.z = heldRotorAngle + torqueAngle / POLE_PAIRS;
    poleOverlay.visible = open > .3 && ['rotor', 'field', 'generator'].includes(focus);
    phaseOverlay.visible = electricalTransfer.visible = open > .3 && activePower > .01 && ['stator', 'phases', 'field', 'generator'].includes(focus);
    transmission.visible = open > .3 && activePower > .01 && ['rotor', 'shaft', 'generator'].includes(focus);
    for (const object of overlays) if (object.material.isShaderMaterial) {
      const uniforms = object.material.uniforms;
      uniforms.uTime.value = heldTime; uniforms.uElectrical.value = electricalAngle; uniforms.uStrength.value = .30 + activePower * .70;
    }
    shaftGlowMaterial.uniforms.uDir.value = regenerating ? -1 : 1;
    shaftGlowMaterial.uniforms.uColor.value.setHex(regenerating ? 0xa4ffc0 : 0xf0fff5);
    transferMaterial.uniforms.uDir.value = regenerating ? 1 : -1;
    group.userData.transferMode = regenerating ? 'generator' : 'motor';
    for (let phase = 0; phase < 3; phase++) {
      const highlighted = open > .3 && activePower > .01 && ['stator', 'phases', 'field', 'generator'].includes(focus);
      phaseMaterials[phase].emissiveIntensity = highlighted ? .12 + Math.abs(Math.cos(electricalAngle - phase / 3 * TAU)) * activePower * .85 : 0;
    }
    shaftMaterial.emissiveIntensity = ['shaft', 'rotor', 'generator'].includes(focus) && open > .3 ? .35 : 0;
    anchors.rotor.z = rotor.position.z; anchors.shaft.z = rotor.position.z + .60; anchors.housing.y = .45 + cover.position.y;
  }
  const metrics = { poles: 6, polePairs: POLE_PAIRS, phases: 3, statorTeeth: 54, statorSlots: 54,
    illustrative: true, axis: 'Z', magnetTopology: 'buried-v', detailLoaded: false,
    teachingEffects: 'stylized rotating magnetic field, three phase currents, explicit N/S, mechanical and electrical energy transfer' };
  function updateMetrics() {
    let triangles = 0, meshes = 0, instancedMeshes = 0;
    group.traverse(object => {
      if (!object.isMesh) return;
      meshes++; if (object.isInstancedMesh) instancedMeshes++;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
    });
    Object.assign(metrics, { meshes, instancedMeshes, triangles, drawCalls: meshes });
    group.userData.metrics = metrics;
  }
  let loading;
  async function loadDetailedModel() {
    if (loading) return loading;
    loading = createGLTFLoader().loadAsync(ASSET_URL).then(asset => {
      const grain = castGrain();
      for (const [key, target] of Object.entries({ casing, cover, capFront, capRear })) {
        const source = asset.scene.getObjectByName(key);
        if (!source) throw new Error(`Carter moteur incomplet : ${key}`);
        source.traverse(object => {
          if (!object.isMesh) return;
          tag(object, object.userData.label || object.name, key.startsWith('cap') ? 'bearing' : 'housing');
          object.castShadow = true; object.receiveShadow = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material.envMapIntensity = 1.05;
            if (material.name.includes('moulé')) { material.bumpMap = grain; material.bumpScale = .0011; }
          }
        });
        while (source.children.length) target.add(source.children[0]);
      }
      for (const object of fallback) { object.removeFromParent(); object.geometry.dispose(); }
      metrics.detailLoaded = true; updateMetrics(); return metrics;
    });
    return loading;
  }
  setFrame(); updateMetrics();
  return { group, setFrame, anchors, metrics, loadDetailedModel,
    groups: { casing, cover, stator, rotor, capFront, capRear, field, poleOverlay, phaseOverlay, transmission, electricalTransfer } };
}
