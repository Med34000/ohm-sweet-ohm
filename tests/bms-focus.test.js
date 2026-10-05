import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from '../libs/three.module.min.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { createTeachingBattery } = await import('../js/models/teaching-battery.js');

function meshes(group, visibleOnly = false) {
  const result = [];
  group[visibleOnly ? 'traverseVisible' : 'traverse'](object => {
    if (object.isMesh) result.push(object);
  });
  return result;
}

test('le focus BMS expose la vraie carte, ses contacteurs et son fusible sans dupliquer le pack', () => {
  const battery = createTeachingBattery();
  const bms = battery.focusGroups.bms;
  const studyMeshes = meshes(bms);
  assert.equal(bms.parent, battery.group);
  assert.ok(studyMeshes.some(object => object.userData.label.startsWith('BMS :')));
  assert.ok(studyMeshes.some(object => object.userData.label.startsWith('Deux contacteurs')));
  assert.ok(studyMeshes.some(object => object.userData.label.startsWith('Fusible haute tension')));
  assert.ok(studyMeshes.every(object => object.userData.component === 'bms'));
  assert.ok(!studyMeshes.some(object => ['cells', 'cooling', 'case', 'lid'].includes(object.userData.batteryPart)));

  const bounds = new THREE.Box3().setFromObject(bms);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 0.7 && size.x < 1 && size.z > 0.85 && size.z < 1.2,
    'Le cadrage BMS doit inclure la carte et les protections, sans toute la batterie.');
  for (const key of ['bms', 'sensing', 'contactors', 'fuse']) {
    assert.ok(bounds.containsPoint(battery.anchors[key]), `Repère hors du sous-ensemble : ${key}`);
  }
});

test('isoler le BMS persiste pendant les images et restaure le pack sans déplacer ses bornes', () => {
  const battery = createTeachingBattery();
  const bmsMeshes = meshes(battery.focusGroups.bms);
  const originalPositions = new Map(bmsMeshes.map(object => [object, object.position.clone()]));
  const originalPins = ['positive', 'negative', 'chargingPositive', 'chargingNegative']
    .map(key => [key, battery.anchors[key].clone()]);

  battery.setFocusVisibility('bms');
  for (const progress of [0, 0.5, 1]) {
    battery.setFrame({ opened: true, progress, focus: 'bms' });
    assert.deepEqual(new Set(meshes(battery.group, true)), new Set(bmsMeshes));
    for (const [object, position] of originalPositions) assert.ok(object.position.equals(position));
    for (const [key, position] of originalPins) assert.ok(battery.anchors[key].equals(position));
  }

  battery.setFocusVisibility(null);
  assert.ok(meshes(battery.group, true).some(object => object.userData.batteryPart === 'cells'));
  battery.setFrame({ opened: false });
  const closedParts = meshes(battery.group, true).map(object => object.userData.batteryPart);
  assert.ok(closedParts.includes('case') && closedParts.includes('lid'));
  assert.ok(!closedParts.includes('bms') && !closedParts.includes('cells'));
});
