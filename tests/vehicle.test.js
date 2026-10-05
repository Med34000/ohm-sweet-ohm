// 2026-09-30 ≈18:26 (Europe/Zurich) — Codex — OpenAI : cohérence entre bilan énergétique et flux instantané.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, createVehicleState, advanceVehicle, getEnergyTransfer } from '../js/simulation/vehicle.js';
const initialControls = { mode: 'drive', throttle: 0.8, regen: 0.65, connected: false, running: true };
function simulate(initial, seconds, overrides = {}) { let state = initial; for (let i = 0; i < seconds * 60; i++) state = advanceVehicle(state, 1 / 60, { ...initialControls, ...overrides }); return state; }
test('le câble débranché ne recharge pas la voiture', () => {
 const before = createVehicleState(), after = simulate(before, 10, { mode: 'charge' });
 assert.equal(after.soc, before.soc); assert.equal(after.speed, 0); assert.equal(after.chargedKWh, 0);
});
test('la recharge est bornée par la capacité et arrête les roues', () => {
 const after = simulate({ ...createVehicleState(), soc: 0.999, speed: 15 }, 10, { mode: 'charge', connected: true });
 assert.equal(after.soc, 1); assert.equal(after.speed, 0); assert.ok(Math.abs(after.chargedKWh - 0.06) < 1e-8); assert.equal(after.charging, false);
});
test('accélérer consomme assez d’énergie pour expliquer le mouvement créé', () => {
 const after = simulate(createVehicleState(), 12);
 assert.ok(after.speed > 10); assert.ok(after.soc < 0.62);
 const kineticKWh = 0.5 * CONFIG.mass * after.speed ** 2 / 3.6e6;
 assert.ok(after.consumedKWh * CONFIG.efficiency >= kineticKWh);
});
test('la batterie ne paie que le travail du moteur', () => {
 const before = { ...createVehicleState(), speed: 10 };
 const seconds = 0.1;
 const after = advanceVehicle(before, seconds, { ...initialControls, throttle: 0.5 });
 const distance = (before.speed + after.speed) / 2 * seconds;
 const motorWork = CONFIG.mass * after.tractionAccel * distance;
 const batteryWork = (after.consumedKWh - before.consumedKWh) * 3.6e6 * CONFIG.efficiency;
 assert.ok(after.tractionAccel > 0 && after.consumedKWh > 0);
 assert.ok(Math.abs(batteryWork - motorWork) < 1e-6);
});
// 2026-09-23 — Claude (Cowork) : l’accélérateur fixe une allure, la vitesse suit la pédale.
test('la vitesse suit la pédale et se stabilise', () => {
 const at20 = simulate(createVehicleState(), 30, { throttle: 0.2 });
 const at60 = simulate(createVehicleState(), 40, { throttle: 0.6 });
 assert.ok(Math.abs(at20.speed - 0.2 * CONFIG.maxSpeed) < 1, `20 % → ${at20.speed * 3.6} km/h`);
 assert.ok(Math.abs(at60.speed - 0.6 * CONFIG.maxSpeed) < 1.2, `60 % → ${at60.speed * 3.6} km/h`);
 const cruise = advanceVehicle(at20, 1 / 60, { ...initialControls, throttle: 0.2 });
 const accelerating = advanceVehicle({ ...createVehicleState(), speed: 5 }, 1 / 60, { ...initialControls, throttle: 0.8 });
 assert.ok(cruise.powerKW > 0 && accelerating.powerKW > cruise.powerKW * 3, 'accélérer coûte bien plus que maintenir l’allure');
});
test('pied levé, le moteur-générateur freine et recharge la batterie', () => {
 const fast = simulate(createVehicleState(), 30, { throttle: 0.8 });
 const lifted = simulate(fast, 3, { throttle: 0.2 });
 assert.ok(lifted.speed < fast.speed - 3, 'la voiture ralentit nettement');
 assert.equal(lifted.consumedKWh, fast.consumedKWh, 'aucune consommation pied levé');
 assert.ok(lifted.recoveredKWh > fast.recoveredKWh && lifted.powerKW < 0 && lifted.recovering);
 const released = 0.5 * CONFIG.mass * (fast.speed ** 2 - lifted.speed ** 2) / 3.6e6;
 assert.ok(lifted.recoveredKWh - fast.recoveredKWh <= released * CONFIG.recoveryEfficiency, 'jamais plus que l’énergie du mouvement');
 const settled = simulate(lifted, 40, { throttle: 0.2 });
 assert.ok(Math.abs(settled.speed - 0.2 * CONFIG.maxSpeed) < 1, 'la voiture se stabilise à la nouvelle allure');
});
test('batterie pleine : pas de récupération au lever de pied, roue libre', () => {
 const fast = { ...createVehicleState(), soc: 1, speed: 28 };
 const lifted = simulate(fast, 3, { throttle: 0.2 });
 assert.equal(lifted.recoveredKWh, 0); assert.equal(lifted.soc, 1);
 assert.ok(lifted.speed > 28 - 3 * 0.5, 'seules les résistances freinent');
});
test('aucune récupération ne peut apparaître à l’arrêt', () => {
 const after = simulate(createVehicleState(), 10, { mode: 'regen', regen: 1 });
 assert.equal(after.recoveredKWh, 0); assert.equal(after.soc, 0.62); assert.equal(after.speed, 0);
});
test('le freinage ne récupère jamais plus que l’énergie cinétique disponible', () => {
 const driven = simulate(createVehicleState(), 12);
 const stopped = simulate(driven, 50, { mode: 'regen', regen: 0.8 });
 const kineticKWh = 0.5 * CONFIG.mass * driven.speed ** 2 / 3.6e6;
 assert.ok(stopped.recoveredKWh > 0); assert.ok(stopped.recoveredKWh <= kineticKWh * CONFIG.recoveryEfficiency);
 assert.ok(stopped.recoveredKWh < driven.consumedKWh); assert.equal(stopped.speed, 0); assert.ok(stopped.soc < 0.62);
});
test('une batterie pleine limite le retour d’énergie pendant le freinage', () => {
 const after = simulate({ ...createVehicleState(), soc: 1, speed: 20 }, 30, { mode: 'regen' });
 assert.equal(after.soc, 1); assert.equal(after.recoveredKWh, 0); assert.equal(after.speed, 0);
});
test('la pause conserve tout l’état et ne fait pas disparaître le flux de récupération', () => {
 const before = { ...createVehicleState(), recovering: true, speed: 13, powerKW: -10 };
 assert.deepEqual(advanceVehicle(before, 1, { ...initialControls, running: false }), before);
});
test('une batterie vide ne peut pas accélérer le véhicule', () => {
 const after = simulate({ ...createVehicleState(), soc: 0 }, 20);
 assert.equal(after.speed, 0); assert.equal(after.soc, 0); assert.equal(after.consumedKWh, 0);
});

test('le dernier freinage garde son énergie comptabilisée mais arrête le flux dès que les roues s’immobilisent', () => {
 const controls = { ...initialControls, mode: 'regen', regen: 1 };
 const before = { ...createVehicleState(), speed: .07, rotating: true };
 const stopped = advanceVehicle(before, .1, controls);
 assert.equal(stopped.speed, 0);
 assert.equal(stopped.rotating, false);
 assert.ok(stopped.recoveredKWh > before.recoveredKWh, 'le dernier intervalle contient encore de l’énergie récupérée');
 assert.ok(stopped.powerKW < 0, 'le registre conserve la puissance moyenne du dernier intervalle');
 const copy = { ...stopped }, flow = getEnergyTransfer(stopped, controls);
 assert.equal(flow.route, 'regen');
 assert.equal(flow.active, false);
 assert.equal(flow.powerKW, 0);
 assert.equal(flow.power, 0);
 assert.equal(flow.recovering, false);
 assert.deepEqual(stopped, copy, 'la présentation ne modifie pas le bilan');
 const paused = advanceVehicle(stopped, .1, { ...controls, running: false });
 assert.deepEqual(getEnergyTransfer(paused, controls), flow, 'une pause au dernier intervalle ne peut garder un flux fantôme');
 assert.equal(getEnergyTransfer({ ...stopped, speed: .005 }, controls).active, false, 'même seuil d’immobilisation que les roues');
});

test('batterie pleine ou vide : le dernier transfert et ses compteurs restent exacts, puis le flux cesse', () => {
 const charge = { ...initialControls, mode: 'charge', connected: true };
 const full = advanceVehicle({ ...createVehicleState(), soc: 1 - 1e-8 }, .1, charge);
 assert.equal(full.soc, 1); assert.ok(full.chargedKWh > 0); assert.equal(full.charging, true);
 assert.equal(getEnergyTransfer(full, charge).active, false);
 const regen = { ...initialControls, mode: 'regen' };
 const recovered = advanceVehicle({ ...createVehicleState(), speed: 5, soc: 1 - 1e-8 }, .1, regen);
 assert.equal(recovered.soc, 1); assert.ok(recovered.recoveredKWh > 0);
 assert.equal(getEnergyTransfer(recovered, regen).active, false);
 const empty = advanceVehicle({ ...createVehicleState(), speed: 5, soc: 1e-9 }, .1, initialControls);
 assert.equal(empty.soc, 0); assert.ok(empty.consumedKWh > 0);
 assert.equal(getEnergyTransfer(empty, initialControls).active, false);
 const charging = advanceVehicle(createVehicleState(), .1, charge);
 assert.equal(getEnergyTransfer(charging, charge).active, true, 'recharge réelle à roues immobiles');
 assert.equal(getEnergyTransfer(charging, initialControls).active, false, 'changer de mode pendant une pause ne transforme pas une ancienne recharge en traction');
});

test('le flux suit la puissance réelle : accélération, allure stable, lever de pied et récupération décroissante', () => {
 const accelerating = advanceVehicle({ ...createVehicleState(), speed: 20 }, 1 / 60, initialControls);
 const cruising = advanceVehicle(simulate(createVehicleState(), 40), 1 / 60, initialControls);
 const boost = getEnergyTransfer(accelerating, initialControls), steady = getEnergyTransfer(cruising, initialControls);
 assert.equal(boost.route, 'drive'); assert.equal(steady.route, 'drive');
 assert.ok(boost.active && steady.active);
 assert.ok(boost.power > steady.power * 3, 'le même accélérateur produit des flux différents suivant l’effort demandé');
 const lifted = advanceVehicle(cruising, .1, { ...initialControls, throttle: 0 });
 const returning = getEnergyTransfer(lifted, { ...initialControls, throttle: 0 });
 assert.equal(returning.route, 'regen'); assert.equal(returning.phase, 'brake');
 assert.ok(returning.active && returning.recovering && returning.powerKW < 0);
 assert.equal(returning.tractionActive, false);
 assert.deepEqual(getEnergyTransfer(advanceVehicle(lifted, 1, { ...initialControls, running: false }), initialControls), returning, 'la pause fige le transfert actif');
 let braking = { ...createVehicleState(), speed: 8 }, previousPower = Infinity;
 const regen = { ...initialControls, mode: 'regen', regen: .65 };
 for (let frame = 0; frame < 600; frame++) {
   braking = advanceVehicle(braking, 1 / 60, regen);
   const flow = getEnergyTransfer(braking, regen);
   assert.ok(flow.power <= previousPower + 1e-12, 'le flux récupéré décroît pendant ce freinage constant');
   previousPower = flow.power;
   if (!braking.rotating) { assert.equal(flow.active, false); assert.equal(flow.power, 0); break; }
 }
 assert.equal(braking.rotating, false);
});
