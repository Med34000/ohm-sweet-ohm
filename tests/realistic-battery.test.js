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

function allMeshes(root, visible = false) {
  const result = [];
  root[visible ? 'traverseVisible' : 'traverse'](object => { if (object.isMesh) result.push(object); });
  return result;
}

test('la batterie représente quatre modules et conserve le rapport physique 21 × 70 des cellules 2170', () => {
  const battery = createTeachingBattery();
  const barrels = allMeshes(battery.group).find(object => object.userData.cellDimensionsMM);
  assert.equal(battery.metrics.modules, 4);
  assert.equal(barrels.count, 3072);
  assert.equal(battery.metrics.cells, barrels.count);
  assert.equal(battery.metrics.illustrative, true);
  assert.match(battery.metrics.note, /nombre et implantation simplifiés/);
  barrels.geometry.computeBoundingBox();
  const size = barrels.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y / size.x - 70 / 21) < 1e-6, 'Cellules de nouveau trapues');
  assert.ok(barrels.geometry.parameters.radialSegments >= 12);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < barrels.count; i++) {
    barrels.getMatrixAt(i, matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    assert.ok(scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-8, 'Mise à l’échelle non uniforme d’une cellule');
    assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).x < 1.05, 'Une cellule occupe la baie électronique');
  }
});

test('la baie électronique laisse la demi-largeur négative disponible pour le PCS', () => {
  const battery = createTeachingBattery();
  const bounds = new THREE.Box3().setFromObject(battery.focusGroups.bms);
  assert.ok(bounds.min.x >= 1.10 && bounds.max.x <= 2.06);
  assert.ok(bounds.min.z >= 0.24 && bounds.max.z <= 1.32, 'Le BMS empiète sur le PCS ou le joint périphérique');
  for (const key of ['bms', 'sensing', 'contactors', 'fuse']) assert.ok(bounds.containsPoint(battery.anchors[key]), key);
});

test('ouvrir le pack conserve les faisceaux de mesure branchés au BMS sans réallouer les buffers', () => {
  const battery = createTeachingBattery();
  const harnesses = allMeshes(battery.group).filter(object => object.name.startsWith('Faisceau basse tension'));
  assert.equal(harnesses.length, 4);
  const state = harnesses.map(object => ({ object, array: object.geometry.attributes.position.array,
    first: object.geometry.attributes.position.array.slice(0, 21),
    last: object.geometry.attributes.position.array.slice(-21) }));
  battery.setFrame({ opened: true, focus: 'cooling' });
  for (const { object, array, first, last } of state) {
    const positions = object.geometry.attributes.position.array;
    assert.equal(positions, array);
    assert.deepEqual(positions.slice(-21), last, 'Le connecteur BMS se débranche pendant l’éclaté');
    assert.notDeepEqual(positions.slice(0, 21), first, 'Le départ du faisceau ne suit pas son module');
  }
  battery.setFrame({ opened: false });
  for (const { object, first } of state) assert.deepEqual(object.geometry.attributes.position.array.slice(0, 21), first);
});

test('les cellules et le serpentin dense ne sont dessinés que lorsque le pack est ouvert', () => {
  const battery = createTeachingBattery();
  const drawBudget = { closed: 30, open: 65 };
  const cost = () => allMeshes(battery.group, true).reduce((sum, object) => {
    sum.draws++;
    sum.triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
    return sum;
  }, { draws: 0, triangles: 0 });
  const closed = cost();
  assert.ok(closed.draws <= drawBudget.closed && closed.triangles < 20000);
  battery.setFrame({ opened: true });
  const open = cost();
  assert.ok(open.draws <= drawBudget.open && open.triangles < 250000);
  assert.ok(open.triangles > closed.triangles * 10);
  const ribbons = allMeshes(battery.group).find(object => object.name.startsWith('Rubans ondulés'));
  assert.equal(ribbons.count, 4);
  ribbons.geometry.computeBoundingBox();
  assert.ok(ribbons.geometry.boundingBox.max.y > 0.04, 'Refroidissement dessiné uniquement sous les cellules');
});
