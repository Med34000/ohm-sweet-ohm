// 2026-09-30 ≈18:22 (Europe/Zurich) — Codex — OpenAI : régressions des flux à puissance variable.
// 2026-09-30 ≈19:00 (Europe/Zurich) — Codex — OpenAI : chargeur à contour chanfreiné, repères attachés et composants dégagés.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from '../libs/three.module.min.js';
import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from '../js/data/vehicle-layout.js';
import { POWER_LAYOUT, ELECTRICAL_CABLES } from '../js/data/electrical-topology.js';

// Match the application's import map. Run the delivered modules unchanged,
// including BufferGeometryUtils, without installing another Three.js version.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') {
      return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const [{ createTeachingBattery }, { createTeachingMotor }, { createTeachingPower }] = await Promise.all([
  import('../js/models/teaching-battery.js'),
  import('../js/models/teaching-motor.js'),
  import('../js/models/teaching-power.js'),
]);

function powerModel({ printedText = null } = {}) {
  // Power cases use canvas solely for printed labels. Geometry tests do not
  // assert raster output: the browser QA checks those real canvas textures.
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement(tag) {
      assert.equal(tag, 'canvas');
      return { width: 0, height: 0, getContext(type) {
        assert.equal(type, '2d');
        return { fillRect() {}, fillText(text) { if (printedText) printedText.push(text); } };
      } };
    } },
  });
  try { return createTeachingPower(); }
  finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  }
}

function meshes(group, predicate = () => true) {
  const found = [];
  group.traverse(object => { if (object.isMesh && predicate(object)) found.push(object); });
  return found;
}

function approximatePoint(actual, expected, tolerance = 1e-8) {
  const target = Array.isArray(expected) ? new THREE.Vector3(...expected) : expected;
  assert.ok(actual.distanceTo(target) <= tolerance, `${actual.toArray()} ne rejoint pas ${target.toArray()}`);
}

function instanceCenters(object) {
  object.updateWorldMatrix(true, false);
  return Array.from({ length: object.count }, (_, index) => {
    const matrix = new THREE.Matrix4();
    object.getMatrixAt(index, matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
  });
}

test('les trois modèles livrés ont des géométries valides et restent dans leur budget de rendu', () => {
  for (const [name, model, triangleBudget, drawBudget] of [
    ['batterie', createTeachingBattery(), 250000, 65],
    ['moteur', createTeachingMotor(), 145000, 55],
    ['électronique et câblage', powerModel(), 65000, 70],
  ]) {
    const geometrySeen = new Set();
    let triangles = 0, drawCalls = 0;
    for (const object of meshes(model.group)) {
      assert.ok(object.userData.component && object.userData.label, `${name} : pièce sans nom`);
      const geometry = object.geometry;
      if (!geometrySeen.has(geometry)) {
        for (const [attributeName, attribute] of Object.entries(geometry.attributes)) {
          for (const value of attribute.array) assert.ok(Number.isFinite(value), `${name} : ${attributeName}`);
        }
        const vertexCount = geometry.attributes.position.count;
        assert.ok(vertexCount >= 3);
        if (geometry.index) {
          assert.equal(geometry.index.count % 3, 0);
          for (const index of geometry.index.array) assert.ok(index >= 0 && index < vertexCount);
        }
        geometrySeen.add(geometry);
      }
      if (object.isInstancedMesh) for (const value of object.instanceMatrix.array) assert.ok(Number.isFinite(value));
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
      drawCalls++;
    }
    assert.ok(triangles > 0 && triangles <= triangleBudget, `${name} : ${triangles} triangles`);
    assert.ok(drawCalls <= drawBudget, `${name} : ${drawCalls} appels de dessin`);
    assert.equal(model.metrics.triangles, triangles, `${name} : métrique erronée`);
    assert.equal(model.metrics.drawCalls, drawCalls);
  }
});

test('les extrémités des câbles rejoignent les bornes physiques des deux modèles indépendants', () => {
  const battery = createTeachingBattery();
  battery.group.position.set(...VEHICLE.battery.center);
  battery.group.updateMatrixWorld(true);
  const batteryTerminals = {
    positive: 'battery.dc+', negative: 'battery.dc-',
    chargingPositive: 'battery.charge+', chargingNegative: 'battery.charge-',
  };
  const physicalBatteryPins = meshes(battery.group, object => object.userData.batteryPart === 'terminals' && object.isInstancedMesh)
    .flatMap(instanceCenters);
  for (const [anchorName, terminal] of Object.entries(batteryTerminals)) {
    const worldAnchor = battery.group.localToWorld(battery.anchors[anchorName].clone());
    approximatePoint(worldAnchor, POWER_LAYOUT.terminals[terminal]);
    assert.ok(physicalBatteryPins.some(point => point.distanceTo(worldAnchor) < 0.008), `${terminal} sans contact physique`);
    assert.ok(ELECTRICAL_CABLES.some(cable => cable.from === terminal || cable.to === terminal));
  }

  const motor = createTeachingMotor();
  motor.group.position.set(...VEHICLE.motor.center);
  motor.group.updateMatrixWorld(true);
  const connector = meshes(motor.group, object => object.isInstancedMesh
    && object.userData.motorPart === 'phases' && !object.userData.phase && object.count === 3);
  assert.equal(connector.length, 1, 'Un bornier distinct doit recevoir les trois phases.');
  const pins = instanceCenters(connector[0]).sort((a, b) => a.x - b.x);
  ['U', 'V', 'W'].forEach((phase, index) => {
    approximatePoint(pins[index], POWER_LAYOUT.terminals[`motor.${phase}`], 1e-6);
    approximatePoint(pins[index], ELECTRICAL_CABLES.find(cable => cable.id === `phase-${phase}`).points.at(-1), 1e-6);
  });
});

test('les chemins animés suivent les mêmes bornes que les câbles physiques', () => {
  const power = powerModel();
  for (const [pathName, from, to] of [
    ['chargeAC', 'port.ac', 'charger.ac'],
    ['chargeDC', 'charger.dc+', 'battery.charge+'],
    ['dc', 'battery.dc+', 'inverter.dc+'],
    ['phases', 'inverter.V', 'motor.V'],
  ]) {
    const path = power.paths[pathName];
    assert.ok(path.length > 8, `${pathName} ne permet pas une interpolation lisible`);
    approximatePoint(path[0], POWER_LAYOUT.terminals[from]);
    approximatePoint(path.at(-1), POWER_LAYOUT.terminals[to]);
    for (const point of path) assert.ok(point.toArray().every(Number.isFinite));
  }
});

test('les boîtiers conservent leurs contacts physiques et dégagent leurs circuits pendant l’ouverture', () => {
  const power = powerModel();
  assert.equal(Object.keys(power.physicalPorts).length, 8);
  const lids = ['inverter', 'charger'].map(key => power.groups[key].children.find(object => object.name === 'Couvercle démontable'));
  const closed = lids.map(lid => lid.position.clone());
  for (let step = 0; step <= 20; step++) {
    power.setFrame({ opened: true, focus: 'hv', progress: step / 20 });
    for (const [name, contact] of Object.entries(power.physicalPorts)) {
      assert.equal(contact.parent, power.groups[name.split('.')[0]]);
      approximatePoint(contact.position, POWER_LAYOUT.terminals[name]);
    }
  }
  lids.forEach((lid, index) => {
    assert.ok(lid.position.y - closed[index].y > 0.4);
    assert.ok(lid.position.z < closed[index].z - 0.8, 'Le couvercle doit dégager la vue des circuits.');
  });
  power.setFrame({ opened: false });
  lids.forEach((lid, index) => {
    approximatePoint(lid.position, closed[index]);
    assert.ok(Math.abs(lid.rotation.x) < 1e-12);
  });
  for (const cable of ELECTRICAL_CABLES.filter(item => item.kind === 'AC3')) {
    const length = cable.points.slice(1).reduce((sum, point, index) =>
      sum + new THREE.Vector3(...point).distanceTo(new THREE.Vector3(...cable.points[index])), 0);
    assert.ok(length < 0.25, 'Les phases du groupe intégré sont des connexions courtes.');
  }
});

test('ouvrir les modèles déplace leurs repères progressivement sans arracher les connexions HT', () => {
  const battery = createTeachingBattery(), motor = createTeachingMotor();
  const fixedBatteryPins = ['positive', 'negative', 'chargingPositive', 'chargingNegative']
    .map(key => [key, battery.anchors[key].clone()]);
  const stationaryStator = motor.anchors.stator.clone();
  const stationaryPhases = motor.anchors.phases.clone();
  let previousCells = battery.anchors.cells.clone(), previousRotor = motor.anchors.rotor.clone();
  for (let step = 0; step <= 20; step++) {
    const progress = step / 20;
    battery.setFrame({ opened: true, progress, focus: 'cells' });
    motor.setFrame({ opened: true, progress, rotorAngle: 0.4 });
    assert.ok(battery.anchors.cells.y >= previousCells.y - 1e-10);
    assert.ok(battery.anchors.cells.distanceTo(previousCells) < 0.05, 'Saut du repère des cellules');
    assert.ok(motor.anchors.rotor.z >= previousRotor.z - 1e-10);
    assert.ok(motor.anchors.rotor.distanceTo(previousRotor) < 0.10, 'Saut du repère du rotor');
    for (const [key, original] of fixedBatteryPins) approximatePoint(battery.anchors[key], original);
    approximatePoint(motor.anchors.stator, stationaryStator);
    approximatePoint(motor.anchors.phases, stationaryPhases);
    previousCells.copy(battery.anchors.cells); previousRotor.copy(motor.anchors.rotor);
  }
  assert.ok(previousCells.y > 0.3, 'Les cellules doivent sortir visiblement du plateau.');
  assert.ok(previousRotor.z > 0.6, 'Le rotor doit être extrait visiblement du stator.');
  const cellHeight = battery.anchors.cells.y;
  battery.setFrame({ opened: true, focus: 'cooling' });
  assert.ok(battery.anchors.cells.y > cellHeight + 0.2, 'Le refroidissement doit être dégagé.');
  battery.setFrame({ opened: false }); motor.setFrame({ opened: false });
  assert.ok(battery.anchors.cells.y < 0.15);
  approximatePoint(motor.anchors.rotor, [0, 0.18, 0]);
});

test('la pause conserve angle moteur, courants illustrés et positions du flux malgré le temps écoulé', () => {
  const motor = createTeachingMotor(), power = powerModel();
  const motorState = { power: 0.55, mode: 'drive', opened: true };
  const powerState = { power: 0.55, mode: 'drive' };
  motor.setFrame({ ...motorState, rotorAngle: 1.23, running: true });
  power.setFrame({ ...powerState, time: 2.5, running: true });
  const rotor = motor.group.children.find(object => object.userData.motorPart === 'rotor');
  const originalAngle = rotor.rotation.z;
  const windingMaterials = meshes(motor.group, object => Boolean(object.userData.phase)).map(object => object.material);
  const phaseLevels = windingMaterials.map(material => material.emissiveIntensity);
  const fluxMeshes = meshes(power.group, object => object.isInstancedMesh && object.instanceMatrix.usage === THREE.DynamicDrawUsage);
  const fluxPositions = fluxMeshes.map(object => Array.from(object.instanceMatrix.array));
  assert.ok(fluxMeshes.some(object => object.visible));
  for (const time of [4, 12, 300]) {
    motor.setFrame({ ...motorState, running: false, time });
    power.setFrame({ ...powerState, running: false, time });
    assert.equal(rotor.rotation.z, originalAngle);
    assert.deepEqual(windingMaterials.map(material => material.emissiveIntensity), phaseLevels);
    assert.deepEqual(fluxMeshes.map(object => Array.from(object.instanceMatrix.array)), fluxPositions);
  }
  power.setFrame({ ...powerState, running: true, time: 301 });
  assert.notDeepEqual(fluxMeshes.map(object => Array.from(object.instanceMatrix.array)), fluxPositions);
});

test('les flux des câbles ralentissent sans reculer, font demi-tour sur place et cessent à puissance nulle', () => {
  const power = powerModel();
  const pulses = meshes(power.group, object => object.isInstancedMesh && object.name === 'Sens du transfert d’énergie');
  const pulse = pulses.find(object => object.count === 5);
  assert.ok(pulse, 'le trajet batterie → onduleur est présent');
  const buffer = pulse.instanceMatrix.array;
  const pose = () => {
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    pulse.getMatrixAt(0, matrix); matrix.decompose(position, rotation, scale);
    return { position, direction: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation) };
  };
  power.setFrame({ mode: 'drive', power: .81, time: 100, dt: 0 });
  for (let frame = 1; frame <= 10; frame++) power.setFrame({ mode: 'drive', power: .81, time: 100 + frame * .02, dt: .02 });
  const beforeHigh = pose();
  power.setFrame({ mode: 'drive', power: .81, time: 100.22, dt: .02 });
  const high = pose(), fastDistance = high.position.distanceTo(beforeHigh.position);
  power.setFrame({ mode: 'drive', power: .09, time: 100.24, dt: .02 });
  const low = pose(), slowDistance = low.position.distanceTo(high.position);
  assert.ok(low.position.clone().sub(high.position).dot(high.direction) > 0, 'moins de puissance conserve le sens du transfert');
  assert.ok(slowDistance > 0 && slowDistance < fastDistance * .5, 'une puissance divisée par neuf ralentit nettement le flux');
  power.setFrame({ mode: 'regen', recovering: true, power: .09, time: 100.24, dt: 0 });
  const reversed = pose();
  assert.ok(reversed.position.distanceTo(low.position) < 1e-6, 'le demi-tour garde la position');
  assert.ok(reversed.direction.dot(low.direction) < -.9999, 'la flèche pointe vers la batterie');
  power.setFrame({ mode: 'regen', recovering: true, power: .09, time: 100.26, dt: .02 });
  const recovering = pose();
  assert.ok(recovering.position.clone().sub(reversed.position).dot(reversed.direction) > 0, 'le retour avance vers la batterie');
  const held = Array.from(buffer);
  power.setFrame({ mode: 'regen', recovering: true, power: .09, running: false, time: 999, dt: .06 });
  assert.deepEqual(Array.from(buffer), held, 'la pause n’accumule aucun mouvement');
  power.setFrame({ mode: 'regen', recovering: false, power: 0, time: 1000, dt: .06 });
  assert.ok(pulses.every(object => !object.visible), 'aucune flèche à puissance nulle');
  power.setFrame({ mode: 'regen', recovering: true, power: .09, time: 1000, dt: 0 });
  assert.ok(pose().position.distanceTo(recovering.position) < 1e-6, 'reprendre ne rattrape pas le temps sans transfert');
  power.setFrame({ mode: 'charge', connected: true, charging: true, power: 0, time: 1000.02, dt: .02 });
  assert.ok(pulses.every(object => !object.visible), 'un câble branché ne crée pas de flux sans puissance');
  assert.equal(pulse.instanceMatrix.array, buffer, 'les mêmes buffers sont conservés');
});

test('les détails de la batterie suivent seulement la charge reçue et ne créent pas une recharge décorative', () => {
  const battery = createTeachingBattery();
  const gauge = meshes(battery.group, object => object.userData.batteryPart === 'soc')[0];
  assert.ok(gauge?.isInstancedMesh);
  battery.setFrame({ soc: 0.5, opened: true, time: 0 });
  const baseline = Array.from(gauge.instanceColor.array);
  for (const [time, mode, focus] of [[10, 'charge', 'cells'], [50, 'drive', 'bms'], [500, 'regen', 'cooling']]) {
    battery.setFrame({ soc: 0.5, time, mode, focus, power: 1, opened: true, running: true });
    assert.deepEqual(Array.from(gauge.instanceColor.array), baseline);
  }
  battery.setFrame({ soc: 0 });
  const empty = Array.from(gauge.instanceColor.array);
  battery.setFrame({ soc: 1 });
  const full = Array.from(gauge.instanceColor.array);
  assert.notDeepEqual(empty, full);
  battery.setFrame({ soc: 4 });
  assert.deepEqual(Array.from(gauge.instanceColor.array), full);
  battery.setFrame({ soc: -2 });
  assert.deepEqual(Array.from(gauge.instanceColor.array), empty);
});

test('la récupération inverse le décalage du champ sans inverser la rotation mécanique', () => {
  const motor = createTeachingMotor();
  const rotor = motor.group.children.find(object => object.userData.motorPart === 'rotor');
  const field = motor.group.children.find(object => object.userData.motorPart === 'field');
  motor.setFrame({ rotorAngle: 0.8, power: 0.7, opened: true, running: true, mode: 'drive' });
  const mechanicalAngle = rotor.rotation.z;
  const motoringOffset = field.rotation.z - mechanicalAngle;
  motor.setFrame({ power: 0.7, opened: true, running: true, mode: 'regen' });
  assert.equal(rotor.rotation.z, mechanicalAngle);
  assert.ok(motoringOffset > 0);
  assert.ok(field.rotation.z - mechanicalAngle < 0);
  motor.setFrame({ power: 0.7, opened: true, running: true, mode: 'charge' });
  assert.equal(field.visible, false, 'Une recharge ne doit pas afficher un moteur électriquement actif.');
});

test('le chargeur révèle un carter asymétrique, des raccords de liquide et des répétitions instanciées', () => {
  const printedText = [], power = powerModel({ printedText }), charger = power.groups.charger;
  const lid = charger.children.find(object => object.name === 'Couvercle démontable');
  assert.ok(printedText.includes('CHARGEUR') && printedText.includes('AC → DC'));
  assert.equal(printedText.includes('PCS / AC'), false, 'l’enseigne emploie un nom compréhensible');
  assert.ok(printedText.includes('ENTRÉE') && printedText.includes('SORTIE'));
  const casing = meshes(lid, object => !object.isInstancedMesh && object.material.name === 'Power_lid')[0];
  const vertices = casing.geometry.attributes.position;
  let minZ = Infinity, maxX = -Infinity;
  for (let i = 0; i < vertices.count; i++) { minZ = Math.min(minZ, vertices.getZ(i)); maxX = Math.max(maxX, vertices.getX(i)); }
  let backLeft = Infinity, backRight = -Infinity;
  for (let i = 0; i < vertices.count; i++) if (vertices.getZ(i) <= minZ + .012) {
    backLeft = Math.min(backLeft, vertices.getX(i)); backRight = Math.max(backRight, vertices.getX(i));
  }
  assert.ok(maxX - backRight > .10, 'le coin coupé existe dans la géométrie du couvercle');
  assert.ok(-backLeft - backRight > .05, 'les deux angles arrière ne sont pas une simple boîte symétrique');
  const ribs = meshes(lid, object => object.name === 'Nervures et rainures du couvercle moulé');
  assert.equal(ribs.length, 1); assert.ok(ribs[0].isInstancedMesh && ribs[0].count >= 8);
  const capacitors = meshes(charger, object => object.name === 'Condensateurs de filtrage');
  assert.equal(capacitors.length, 1); assert.ok(capacitors[0].isInstancedMesh && capacitors[0].count === 6);
  const bands = meshes(charger, object => object.name === 'Bandes isolantes des condensateurs de filtrage');
  assert.equal(bands.length, 1); assert.ok(bands[0].isInstancedMesh && bands[0].count === 6);
  const liquid = meshes(charger, object => object.userData.parts?.includes('Raccord du refroidissement liquide'));
  assert.equal(liquid.length, 1, 'les deux raccords partagent l’assemblage métallique');
  assert.equal(liquid[0].userData.parts.filter(part => part === 'Raccord du refroidissement liquide').length, 2);
  const box = new THREE.Box3().setFromObject(liquid[0]);
  assert.ok(box.min.z < POWER_LAYOUT.charger.center[2] - POWER_LAYOUT.charger.size[2] / 2, 'les raccords sortent réellement de la paroi arrière');
  assert.ok(meshes(charger).every(object => !/ventilateur|\bfan\b/i.test(object.name)));
  assert.ok(meshes(charger).every(object => object.userData.component === 'charger'));
  const closed = new THREE.Box3().setFromObject(charger);
  assert.ok(closed.min.z > -1.34 && closed.max.z < .20, 'le chargeur reste dans sa demi-baie et à proximité des bornes existantes');
  assert.ok(power.metrics.drawCalls <= 70 && power.metrics.triangles <= 65000, 'la refonte conserve le budget livré');
});

test('les trois repères du chargeur suivent son groupe même après translation, rotation et ouverture', () => {
  const power = powerModel(), charger = power.groups.charger;
  const keys = ['chargerInput', 'chargerConversion', 'chargerOutput'];
  for (const key of keys) { assert.ok(power.anchors[key].isObject3D); assert.equal(power.anchors[key].parent, charger); }
  approximatePoint(power.anchors.chargerInput.position, POWER_LAYOUT.terminals['charger.ac']);
  const output = new THREE.Vector3(...POWER_LAYOUT.terminals['charger.dc+']).add(new THREE.Vector3(...POWER_LAYOUT.terminals['charger.dc-'])).multiplyScalar(.5);
  approximatePoint(power.anchors.chargerOutput.position, output);
  const original = keys.map(key => power.anchors[key].position.clone());
  charger.position.set(.25,.6,-.4); charger.rotation.set(.15,.45,-.2);
  for (let step = 0; step <= 20; step++) {
    power.setFrame({ opened: true, focus: 'charger', progress: step / 20 });
    charger.updateMatrixWorld(true);
    keys.forEach((key, i) => {
      approximatePoint(power.anchors[key].position, original[i]);
      approximatePoint(power.anchors[key].getWorldPosition(new THREE.Vector3()), original[i].clone().applyMatrix4(charger.matrixWorld));
    });
    for (const terminal of ['charger.ac','charger.dc+','charger.dc-']) approximatePoint(power.physicalPorts[terminal].position, POWER_LAYOUT.terminals[terminal]);
  }
});

test('le couvercle ouvert dégage le cuivre, le transformateur et les condensateurs du chargeur', () => {
  const power = powerModel(), charger = power.groups.charger;
  const lid = charger.children.find(object => object.name === 'Couvercle démontable');
  const cans = meshes(charger, object => object.name === 'Condensateurs de filtrage')[0];
  const capTop = new THREE.Box3().setFromObject(cans).max.y;
  const lidClosed = new THREE.Box3().setFromObject(lid);
  assert.ok(capTop < lidClosed.min.y, 'les condensateurs ne traversent pas le couvercle fermé');
  const copper = meshes(charger, object => object.userData.parts?.includes('Enroulements de cuivre verni'))[0];
  assert.ok(copper && copper.material.name === 'Power_copper');
  assert.ok(copper.userData.parts.includes('Liaisons de cuivre du transformateur au filtrage DC'));
  const conversion = power.anchors.chargerConversion.getWorldPosition(new THREE.Vector3());
  assert.ok(new THREE.Box3().setFromObject(charger).containsPoint(conversion));
  power.setFrame({ opened: true, focus: 'charger', progress: 1 });
  charger.updateMatrixWorld(true);
  const lidOpen = new THREE.Box3().setFromObject(lid), components = new THREE.Box3().setFromObject(cans).union(new THREE.Box3().setFromObject(copper));
  assert.ok(lidOpen.max.z < components.min.z, 'le capot laisse les étages de conversion entièrement dégagés');
  power.setFrame({ opened: false }); charger.updateMatrixWorld(true);
  const closedAgain = new THREE.Box3().setFromObject(lid);
  approximatePoint(closedAgain.min, lidClosed.min); approximatePoint(closedAgain.max, lidClosed.max);
});
