import test from 'node:test';
import assert from 'node:assert/strict';
import { POWER_LAYOUT, ELECTRICAL_CABLES, ELECTRICAL_TOPOLOGY, electricalActivity } from '../js/data/electrical-topology.js';
import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from '../js/data/vehicle-layout.js';

test('la recharge AC passe par le chargeur embarqué avant le pack DC', () => {
  assert.deepEqual(ELECTRICAL_TOPOLOGY.energyRoutes.charge, ['port', 'charger', 'battery']);
  assert.equal(ELECTRICAL_TOPOLOGY.nodes.charger.input, 'AC');
  assert.equal(ELECTRICAL_TOPOLOGY.nodes.charger.output, 'DC');
  assert.equal(ELECTRICAL_TOPOLOGY.chargingPowerKW, 11);
  const inputs = ELECTRICAL_CABLES.filter(cable => cable.to.startsWith('battery.'));
  assert.equal(inputs.length, 2);
  for (const cable of inputs) {
    assert.equal(cable.kind, 'DC');
    assert.ok(cable.from.startsWith('charger.dc'));
  }
});

test('chaque câble rejoint deux bornes nommées sans rupture ni coordonnée invalide', () => {
  const ids = new Set();
  for (const cable of ELECTRICAL_CABLES) {
    assert.ok(!ids.has(cable.id)); ids.add(cable.id);
    assert.deepEqual(cable.points[0], POWER_LAYOUT.terminals[cable.from]);
    assert.deepEqual(cable.points.at(-1), POWER_LAYOUT.terminals[cable.to]);
    assert.ok(cable.radius > 0);
    for (const point of cable.points) assert.ok(point.length === 3 && point.every(Number.isFinite));
    for (let i = 1; i < cable.points.length; i++) {
      assert.ok(Math.hypot(...cable.points[i].map((value, axis) => value - cable.points[i - 1][axis])) > 0.01);
    }
  }
});

test('le bus DC possède deux conducteurs distincts et le moteur exactement trois phases', () => {
  const dc = ELECTRICAL_CABLES.filter(cable => cable.from.startsWith('battery.dc'));
  assert.equal(dc.length, 2);
  assert.equal(dc[0].to, 'inverter.dc+'); assert.equal(dc[1].to, 'inverter.dc-');
  assert.notDeepEqual(dc[0].points, dc[1].points);
  const phases = ELECTRICAL_CABLES.filter(cable => cable.kind === 'AC3');
  assert.deepEqual(phases.map(cable => cable.to), ['motor.U', 'motor.V', 'motor.W']);
  phases.forEach((cable, index) => {
    assert.deepEqual(cable.points.at(-1), [VEHICLE.motor.center[0] + (index - 1) * 0.13,
      VEHICLE.motor.center[1] + 0.25, 0.59]);
  });
});

test('les gaines restent au-dessus du pack et hors du corps cylindrique du moteur', () => {
  // Port faces are part of the pack; all other waypoints stay clear of its top.
  const packTop = VEHICLE.battery.center[1] + 0.15;
  for (const cable of ELECTRICAL_CABLES) for (const [x, y, z] of cable.points) {
    assert.ok(y - cable.radius > packTop - 0.08, cable.id);
    const insideMotor = Math.abs(z) < VEHICLE.motor.length / 2
      && Math.hypot(x - VEHICLE.motor.center[0], y - VEHICLE.motor.center[1]) < VEHICLE.motor.radius;
    assert.equal(insideMotor, false, cable.id);
  }
});

test('les flux visibles dépendent du transfert réel, pas uniquement du bouton de mode', () => {
  assert.deepEqual(electricalActivity({ mode: 'charge', connected: false, charging: true }),
    { charge: false, traction: false, direction: 1 });
  assert.equal(electricalActivity({ mode: 'charge', connected: true, charging: true }).charge, true);
  assert.equal(electricalActivity({ mode: 'charge', connected: true, charging: false }).charge, false);
  assert.equal(electricalActivity({ mode: 'drive', power: 0 }).traction, false);
  assert.equal(electricalActivity({ mode: 'drive', power: 0.3 }).traction, true);
  assert.equal(electricalActivity({ mode: 'regen', recovering: true, power: 0 }).traction, false);
  assert.equal(electricalActivity({ mode: 'regen', recovering: false, power: -0.3 }).traction, false);
});

test('la récupération inverse le transfert moteur → onduleur → batterie', () => {
  assert.deepEqual(ELECTRICAL_TOPOLOGY.energyRoutes.regen, [...ELECTRICAL_TOPOLOGY.energyRoutes.drive].reverse());
  assert.deepEqual(electricalActivity({ mode: 'regen', recovering: true, power: -0.3 }),
    { charge: false, traction: true, direction: -1 });
  assert.deepEqual(electricalActivity({ mode: 'regen', recovering: true, power: -0.3, running: false }),
    { charge: false, traction: true, direction: -1 });
});
