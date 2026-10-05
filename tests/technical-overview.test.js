// 2026-09-30 ≈18:22 (Europe/Zurich) — Codex — OpenAI : continuité et arrêt des flèches de l’éclaté.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from '../libs/three.module.min.js';
import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from '../js/data/vehicle-layout.js';
import { POWER_LAYOUT } from '../js/data/electrical-topology.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { createTechnicalOverview } = await import('../js/visuals/technical-overview.js');

function fixture() {
  const drivetrain = { group: new THREE.Group() };
  drivetrain.group.position.set(0.2, 0.4, -0.3);
  drivetrain.group.rotation.y = 0.5;
  const battery = { group: new THREE.Group() }, motor = { group: new THREE.Group() };
  battery.group.position.set(...VEHICLE.battery.center);
  motor.group.position.set(...VEHICLE.motor.center);
  const powertrain = { groups: { inverter: new THREE.Group(), charger: new THREE.Group(), hv: new THREE.Group() } };
  const organs = { battery: battery.group, motor: motor.group, inverter: powertrain.groups.inverter, charger: powertrain.groups.charger };
  for (const [name, node] of Object.entries(organs)) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), new THREE.MeshBasicMaterial());
    if (POWER_LAYOUT[name]) mesh.position.set(...POWER_LAYOUT[name].center);
    node.add(mesh); drivetrain.group.add(node);
  }
  drivetrain.group.add(powertrain.groups.hv);
  const home = Object.fromEntries(Object.entries(organs).map(([key, node]) => [key, node.position.clone()]));
  const overview = createTechnicalOverview({ battery, motor, powertrain, drivetrain });
  return { overview, drivetrain, organs, home, powertrain };
}

function samePoint(actual, expected, tolerance = 1e-7) {
  assert.ok(actual.distanceTo(expected) <= tolerance, `${actual.toArray()} ≠ ${expected.toArray()}`);
}

test('les huit conducteurs restent raccordés à leurs deux organes pendant tout l’éclaté', () => {
  const { overview, organs, home } = fixture();
  assert.equal(overview.cables.length, 8);
  for (let step = 0; step <= 40; step++) {
    overview.setProgress(step / 40);
    for (const cable of overview.cables) {
      for (const [terminal, endpoint] of [[cable.from, 0], [cable.to, 1]]) {
        const key = terminal.split('.')[0];
        const expected = new THREE.Vector3(...POWER_LAYOUT.terminals[terminal]);
        if (organs[key]) expected.add(organs[key].position).sub(home[key]);
        samePoint(cable.curve.getPoint(endpoint), expected);
        // The actual rendered end ring, not just its defining curve, is centred on the port.
        const center = new THREE.Vector3();
        const start = endpoint ? cable.mesh.geometry.attributes.position.count - 7 : 0;
        for (let side = 0; side < 6; side++) center.add(new THREE.Vector3().fromBufferAttribute(cable.mesh.geometry.attributes.position, start + side));
        samePoint(center.divideScalar(6), expected, 2e-6);
      }
      for (const attribute of Object.values(cable.mesh.geometry.attributes)) {
        for (const value of attribute.array) assert.ok(Number.isFinite(value));
      }
    }
  }
  overview.dispose();
});

test('fermer la vue restaure exactement les positions et le câblage du véhicule', () => {
  const { overview, organs, home, powertrain, drivetrain } = fixture();
  assert.equal(overview.group.visible, false);
  assert.equal(powertrain.groups.hv.visible, true);
  for (const value of [0.1, 1, 0.36, 0]) overview.setProgress(value);
  for (const [name, node] of Object.entries(organs)) samePoint(node.position, home[name], 0);
  assert.equal(overview.group.visible, false);
  assert.equal(powertrain.groups.hv.visible, true);
  overview.setProgress(1);
  assert.equal(overview.group.visible, true);
  assert.equal(powertrain.groups.hv.visible, false);
  const bounds = overview.bounds();
  assert.ok(!bounds.isEmpty());
  for (const cable of overview.cables) {
    for (const end of [cable.points[0], cable.points.at(-1)]) {
      assert.ok(bounds.containsPoint(drivetrain.group.localToWorld(end.clone())));
    }
  }
  for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) assert.ok(Number.isFinite(value));
  overview.dispose();
  assert.equal(overview.group.parent, null);
  for (const [name, node] of Object.entries(organs)) samePoint(node.position, home[name], 0);
});

test('les mouvements réutilisent les mêmes géométries et buffers, et une vue immobile ne réécrit rien', () => {
  const { overview } = fixture();
  const geometry = overview.cables.map(cable => cable.mesh.geometry);
  const buffers = geometry.map(item => item.attributes.position.array);
  for (let step = 0; step < 80; step++) overview.setProgress((step % 20) / 19);
  overview.cables.forEach((cable, index) => {
    assert.equal(cable.mesh.geometry, geometry[index]);
    assert.equal(cable.mesh.geometry.attributes.position.array, buffers[index]);
  });
  overview.setProgress(0.5);
  const versions = geometry.map(item => item.attributes.position.version);
  for (let frame = 0; frame < 30; frame++) overview.setProgress(0.5);
  assert.deepEqual(geometry.map(item => item.attributes.position.version), versions);
  assert.ok(overview.metrics.triangles < 4000);
  overview.setProgress(Number.NaN);
  assert.equal(overview.group.visible, false);
  overview.dispose();
});

function arrowState(overview, cableIndex, arrowIndex = 0) {
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  overview.arrows.getMatrixAt(cableIndex * 3 + arrowIndex, matrix);
  matrix.decompose(position, rotation, scale);
  return { position, rotation, scale };
}

test('les flèches suivent uniquement le parcours actif de recharge ou de traction et disparaissent en roue libre', () => {
  const { overview } = fixture();
  overview.setProgress(1);
  for (const [frame, expected] of [
    [{ mode: 'charge', connected: true, charging: true, power: 0.2 }, cable => cable.id.startsWith('charge')],
    [{ mode: 'charge', connected: false, charging: false, power: 0.2 }, () => false],
    [{ mode: 'drive', power: 0.4 }, cable => !cable.id.startsWith('charge')],
    [{ mode: 'regen', power: 0.25, recovering: true }, cable => !cable.id.startsWith('charge')],
    [{ mode: 'drive', power: 0 }, () => false],
  ]) {
    overview.setFrame({ ...frame, time: 2.5 });
    let activeCount = 0;
    overview.cables.forEach((cable, index) => {
      const active = expected(cable);
      for (let arrow = 0; arrow < 3; arrow++) {
        const state = arrowState(overview, index, arrow);
        assert.ok(Math.abs(state.scale.x - (active ? 1 : 0)) < 1e-6, cable.id);
        if (active) activeCount++;
      }
    });
    assert.equal(overview.arrows.visible, activeCount > 0);
  }
  overview.setProgress(0);
  overview.setFrame({ mode: 'drive', power: 0.4, time: 4 });
  assert.equal(overview.group.visible, false, 'Les flèches schématiques ne doublent pas celles de la voiture assemblée.');
  overview.dispose();
});

test('la récupération retourne les flèches vers la batterie et la pause fige leur position sans reconstruire leurs buffers', () => {
  const { overview } = fixture();
  overview.setProgress(1);
  const matrixBuffer = overview.arrows.instanceMatrix.array;
  const geometry = overview.arrows.geometry;
  overview.setFrame({ mode: 'drive', power: 0.5, time: 0 });
  const drive = overview.cables.map((cable, index) => arrowState(overview, index));
  overview.setFrame({ mode: 'regen', power: 0.5, recovering: true, time: 0 });
  overview.cables.forEach((cable, index) => {
    if (cable.id.startsWith('charge')) return;
    const regen = arrowState(overview, index);
    samePoint(regen.position, drive[index].position);
    const before = new THREE.Vector3(0, 1, 0).applyQuaternion(drive[index].rotation);
    const after = new THREE.Vector3(0, 1, 0).applyQuaternion(regen.rotation);
    assert.ok(before.dot(after) < -0.99999, `${cable.id} : sens de récupération incorrect`);
  });
  overview.setFrame({ mode: 'drive', power: 0.5, time: 2.5 });
  const paused = Array.from(matrixBuffer);
  for (const time of [5, 20, 1200]) {
    overview.setFrame({ mode: 'drive', power: 0.5, time, running: false });
    assert.deepEqual(Array.from(matrixBuffer), paused);
  }
  overview.setFrame({ mode: 'drive', power: 0.5, time: 4, running: true });
  assert.notDeepEqual(Array.from(matrixBuffer), paused);
  assert.equal(overview.arrows.geometry, geometry);
  assert.equal(overview.arrows.instanceMatrix.array, matrixBuffer);
  assert.equal(overview.arrows.count, 24);
  assert.equal(overview.metrics.drawCalls, 9);
  overview.dispose();
});

test('le flux de l’éclaté suit la puissance, conserve sa position au demi-tour et ne rattrape pas les intervalles inactifs', () => {
  const { overview } = fixture(); overview.setProgress(1);
  const cableIndex = overview.cables.findIndex(cable => cable.id === 'traction-positive');
  const geometry = overview.arrows.geometry, buffer = overview.arrows.instanceMatrix.array;
  const pose = () => {
    const state = arrowState(overview, cableIndex);
    return { ...state, direction: new THREE.Vector3(0, 1, 0).applyQuaternion(state.rotation) };
  };
  overview.setFrame({ mode: 'drive', power: .81, time: 100, dt: 0 });
  for (let frame = 1; frame <= 10; frame++) overview.setFrame({ mode: 'drive', power: .81, time: 100 + frame * .02, dt: .02 });
  const beforeHigh = pose();
  overview.setFrame({ mode: 'drive', power: .81, time: 100.22, dt: .02 });
  const high = pose(), fastDistance = high.position.distanceTo(beforeHigh.position);
  overview.setFrame({ mode: 'drive', power: .09, time: 100.24, dt: .02 });
  const low = pose(), slowDistance = low.position.distanceTo(high.position);
  assert.ok(low.position.clone().sub(high.position).dot(high.direction) > 0, 'la baisse de puissance ne fait pas reculer le motif');
  assert.ok(slowDistance > 0 && slowDistance < fastDistance * .5, 'la cadence baisse avec la puissance');
  overview.setFrame({ mode: 'regen', recovering: true, power: .09, time: 100.24, dt: 0 });
  const reversed = pose();
  samePoint(reversed.position, low.position);
  assert.ok(reversed.direction.dot(low.direction) < -.9999, 'le sens change sans saut de position');
  overview.setFrame({ mode: 'regen', recovering: true, power: .09, time: 100.26, dt: .02 });
  const recovering = pose();
  assert.ok(recovering.position.clone().sub(reversed.position).dot(reversed.direction) > 0, 'la récupération avance dans le nouveau sens');
  const held = Array.from(buffer);
  overview.setFrame({ mode: 'regen', recovering: true, power: .09, running: false, time: 999, dt: .06 });
  assert.deepEqual(Array.from(buffer), held, 'la pause conserve le motif');
  overview.setFrame({ mode: 'regen', recovering: false, power: 0, time: 1000, dt: .06 });
  assert.equal(overview.arrows.visible, false, 'le transfert cesse immédiatement à puissance nulle');
  overview.setFrame({ mode: 'regen', recovering: true, power: .09, time: 1000, dt: 0 });
  samePoint(pose().position, recovering.position);
  overview.setFrame({ mode: 'charge', connected: true, charging: true, power: 0, time: 1000.02, dt: .02 });
  assert.equal(overview.arrows.visible, false, 'la recharge inactive n’anime aucune flèche');
  assert.equal(overview.arrows.geometry, geometry); assert.equal(overview.arrows.instanceMatrix.array, buffer);
  overview.dispose();
});
