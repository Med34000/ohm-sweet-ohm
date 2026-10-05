// 2026-09-22 ≈23:25 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Opus 5.5.
// 2026-09-30 ≈10:43 (Europe/Zurich) — Codex — OpenAI : régression de la lisibilité des repères mobiles.
// 2026-09-30 (Europe/Zurich) — Codex — OpenAI : régressions du transfert réel, de l'arrêt et des phases cumulatives.
// 2026-09-30 (Europe/Zurich) — Codex — OpenAI : contraste du parcours complet de recharge à 11 kW.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { ENERGY_SEGMENTS, ENERGY_ROUTES, CURRENT_KINDS, segmentById, advanceAlong } from '../js/data/energy-routes.js';
import { POWER_LAYOUT } from '../js/data/electrical-topology.js';
import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from '../js/data/vehicle-layout.js';
import { PerspectiveCamera, Color } from '../libs/three.module.min.js';

// Même module Three.js local que l’application, sans installation ni remplacement du rendu.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { placeEnergyLabel, createEnergyCurrent } = await import('../js/visuals/energy-current.js');

const same = (a, b) => a.every((value, axis) => Math.abs(value - b[axis]) < 1e-9);
const kindsOf = strand => strand.map(id => segmentById(id).kind).filter((kind, i, all) => kind !== all[i - 1]);

test('chaque brin est continu : un tronçon commence là où le précédent finit', () => {
  for (const [name, route] of Object.entries(ENERGY_ROUTES)) {
    assert.ok(route.strands.length > 0, name);
    for (const strand of route.strands) {
      for (let i = 1; i < strand.length; i++) {
        const previous = segmentById(strand[i - 1]), next = segmentById(strand[i]);
        assert.ok(previous && next, `${name} : tronçon inconnu`);
        assert.ok(same(previous.points.at(-1), next.points[0]), `${name} : rupture entre ${previous.id} et ${next.id}`);
      }
    }
  }
});

test('la recharge passe de l’alternatif au continu dans le chargeur embarqué', () => {
  for (const strand of ENERGY_ROUTES.charge.strands) {
    assert.deepEqual(kindsOf(strand), ['grid', 'dc']);
    assert.equal(strand[0], 'station-cable');
    assert.ok(same(segmentById('station-cable').points.at(-1), VEHICLE.chargePort.center), 'la borne arrive à la prise');
    assert.ok(same(segmentById('obc-out').points[0], POWER_LAYOUT.charger.center));
  }
  assert.equal(new Set(ENERGY_ROUTES.charge.strands.map(strand => strand.at(-1))).size, 4, 'les quatre modules reçoivent l’énergie');
});

test('la traction va du continu au triphasé puis au mouvement des deux roues arrière', () => {
  const strands = ENERGY_ROUTES.drive.strands;
  for (const strand of strands) assert.deepEqual(kindsOf(strand), ['dc', 'ac3', 'mech']);
  assert.equal(strands.length, 4 * 3 * 2);
  const phases = new Set(strands.map(strand => strand.find(id => id.startsWith('phase-'))));
  assert.deepEqual([...phases].sort(), ['phase-U', 'phase-V', 'phase-W']);
  for (const side of ['left', 'right']) {
    const axle = segmentById(`axle-${side}`);
    assert.ok(Math.abs(axle.points.at(-1)[0] - VEHICLE.wheel.rearAxleX) < 1e-9, 'propulsion arrière');
  }
});

test('la récupération emprunte les mêmes conducteurs, dans l’autre sens', () => {
  assert.equal(ENERGY_ROUTES.regen.strands, ENERGY_ROUTES.drive.strands);
  assert.equal(ENERGY_ROUTES.regen.reverse, true);
  assert.deepEqual(ENERGY_ROUTES.regen.stops.map(stop => stop.id), [...ENERGY_ROUTES.drive.stops.map(stop => stop.id)].reverse());
  assert.equal(ENERGY_ROUTES.regen.stops.at(-1).id, 'battery');
});

test('géométrie valide, identifiants uniques et couleurs définies', () => {
  const ids = new Set();
  for (const segment of ENERGY_SEGMENTS) {
    assert.ok(!ids.has(segment.id)); ids.add(segment.id);
    assert.ok(CURRENT_KINDS[segment.kind], segment.id);
    assert.ok(segment.points.length >= 2);
    for (const point of segment.points) assert.ok(point.length === 3 && point.every(Number.isFinite));
  }
  for (const route of Object.values(ENERGY_ROUTES)) for (const stop of route.stops) {
    assert.ok(stop.at.length === 3 && stop.at.every(Number.isFinite));
    assert.ok(CURRENT_KINDS[stop.kind]);
  }
});

test('au freinage, le flux ralentit sans jamais repartir vers le moteur', () => {
  // La puissance récupérée baisse à mesure que la voiture ralentit : vitesses décroissantes.
  const length = 10, dt = 1 / 60;
  let d = 8, travelled = 0;
  for (let frame = 0; frame < 240; frame++) {
    const speed = 3.2 * (1 - frame / 240);
    const next = advanceAlong(d, length, -1, speed, dt);
    const step = ((d - next) % length + length) % length;
    assert.ok(step >= 0 && step < 0.1, `image ${frame} : pas de recul`);
    travelled += step; d = next;
  }
  assert.ok(travelled > 5, 'le courant progresse vers la batterie');
  const producer = ENERGY_ROUTES.regen.stops.find(stop => stop.produces);
  assert.equal(producer.id, 'motor', 'le moteur devient la source d’énergie');
});

test('les quatre repères restent lisibles sur mobile avec la légende, ou se masquent si aucune place existe', () => {
  const separated = (a, b) => a.x + a.w + 5 <= b.x || b.x + b.w + 5 <= a.x || a.y + a.h + 5 <= b.y || b.y + b.h + 5 <= a.y;
  for (const width of [360, 390]) {
    const height = 185;
    const legend = { x: 6, y: 4, w: width - 12, h: 57 };
    const placed = [legend];
    // Toutes les ancres demandent initialement la rangée occupée par la légende.
    for (const w of [95, 86, 176, 143]) {
      const position = placeEnergyLabel({ x: 160, top: 4, w, h: 34, width, height, minTop: 4, obstacles: placed });
      assert.ok(position, `${width} px : assez d’espace pour chacun des quatre repères`);
      const rect = { x: position.x, y: position.top, w, h: 34 };
      assert.ok(rect.x >= 6 && rect.x + rect.w <= width - 6, 'le repère reste dans la largeur du canvas');
      assert.ok(rect.y >= 4 && rect.y + rect.h <= height - 4, 'le repère reste dans la hauteur du canvas');
      assert.ok(placed.every(other => separated(rect, other)), 'la légende et les repères conservent un espace lisible');
      if (placed.length === 1) assert.ok(rect.y >= legend.y + legend.h + 5, 'sans place au-dessus, le premier repère passe en dessous');
      placed.push(rect);
    }
    assert.equal(placed.length, 5, 'quatre repères plus la légende');
    assert.equal(placeEnergyLabel({ x: 90, top: 4, w: 140, h: 34, width, height: 100, minTop: 4,
      obstacles: [{ x: 0, y: 0, w: width, h: 100 }] }), null, 'aucune place : masquer plutôt que superposer');
  }
});

function fakeElement() {
  const classes = new Set();
  return { children: [], style: { setProperty() {} }, setAttribute() {},
    append(child) { this.children.push(child); },
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
    querySelector(selector) { return selector === 'em' && this.innerHTML?.includes('<em') ? this.badge ??= { hidden: true } : null; },
  };
}
function makeCurrent({ host = null } = {}) {
  const previous = globalThis.document;
  // Les textures procédurales ont besoin d'un canvas ; aucun rendu GPU ni navigateur n'est simulé ici.
  globalThis.document = { createElement: tag => tag === 'canvas' ? ({ getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  }) }) : fakeElement() };
  try { return createEnergyCurrent({ host }); }
  finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}
const objects = current => ({
  comets: current.group.getObjectByName('Comètes — transfert énergétique'),
  losses: current.group.getObjectByName('Pertes thermiques — convertisseurs'),
  cells: current.group.getObjectByName('Cellules — niveau de charge'),
  conduits: current.group.children.filter(object => object.name.startsWith('Conduit ') && object.visible),
  rings: current.group.children.filter(object => object.name === 'Anneaux — transfert mécanique'),
  waves: current.group.children.filter(object => object.name === 'Ondes — production du générateur'),
  halos: current.group.children.filter(object => object.name.startsWith('Halo — ')),
});
function heads(current) {
  const array = objects(current).comets.geometry.attributes.position.array;
  return Array.from({ length: current.metrics.comets }, (_, i) => Array.from(array.slice(i * current.metrics.trail * 3, i * current.metrics.trail * 3 + 3)));
}
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
function snapshot(current) {
  return current.group.children.map(object => ({
    name: object.name, visible: object.visible, scale: object.scale.toArray(), rotation: object.rotation.toArray(),
    opacity: object.material?.opacity,
    uniforms: Object.fromEntries(Object.entries(object.material?.uniforms ?? {}).filter(([, uniform]) => typeof uniform.value === 'number').map(([name, uniform]) => [name, uniform.value])),
    points: object.isPoints ? Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, attribute]) => [name, Array.from(attribute.array)])) : null,
  }));
}
const visibleFrame = { visibility: 1, active: true, running: true, power: .81, dt: 1 / 60, soc: .62, wheelAngle: .7 };

test('courant réel : arrêt et roue libre figent immédiatement le trajet et coupent toute production', () => {
  for (const route of ['charge', 'drive', 'regen']) for (const inactive of [{ active: false, power: .81 }, { active: true, power: 0 }]) {
    const current = makeCurrent();
    for (let i = 0; i < 180; i++) current.update({ ...visibleFrame, route });
    const o = objects(current);
    assert.ok(o.comets.geometry.attributes.aAlpha.array.some(alpha => alpha > 0), `${route} : transfert visible avant arrêt`);
    assert.ok(o.losses.geometry.attributes.aAlpha.array.some(alpha => alpha > 0), `${route} : pertes visibles avant arrêt`);
    const positions = Array.from(o.comets.geometry.attributes.position.array);
    const phase = o.conduits[0].material.uniforms.uTime.value;
    const cellPhase = o.cells.material.uniforms.uTime.value;
    for (let i = 0; i < 120; i++) current.update({ ...visibleFrame, route, ...inactive });
    assert.deepEqual(Array.from(o.comets.geometry.attributes.position.array), positions, `${route} : aucun déplacement résiduel`);
    assert.equal(o.conduits[0].material.uniforms.uTime.value, phase);
    assert.equal(o.cells.material.uniforms.uTime.value, cellPhase);
    assert.equal(o.cells.material.uniforms.uFill.value, .62, 'le niveau stocké reste lisible sans transfert');
    assert.ok(o.conduits.every(mesh => mesh.material.uniforms.uActive.value === 0));
    assert.equal(o.comets.material.uniforms.uOpacity.value, 0);
    assert.ok(o.comets.geometry.attributes.aAlpha.array.every(alpha => alpha === 0));
    assert.ok(o.losses.geometry.attributes.aAlpha.array.every(alpha => alpha === 0));
    assert.ok([...o.rings, ...o.waves, ...o.halos].every(object => !object.visible), `${route} : aucun effet de transfert actif`);
    assert.equal(o.rings[0].material.uniforms.uOpacity.value, 0);
    assert.ok(o.waves.every(object => object.material.opacity === 0));
  }
  const host = Object.assign(fakeElement(), { clientWidth: 600, clientHeight: 500 });
  const current = makeCurrent({ host });
  const camera = new PerspectiveCamera(50, 600 / 500, .1, 150);
  camera.position.set(0, 7, 10); camera.lookAt(0, .5, 0); camera.updateMatrixWorld();
  const previousWidth = globalThis.innerWidth, previousDocument = globalThis.document;
  globalThis.innerWidth = 600; globalThis.document = { createElement: () => fakeElement() };
  try {
    current.update({ ...visibleFrame, route: 'regen', camera });
    const label = host.children[0].children.find(child => child.querySelector('em'));
    assert.ok(label, 'repère du moteur devenu générateur présent');
    assert.equal(label.classList.contains('produces'), true);
    assert.equal(label.querySelector('em').hidden, false, 'production signalée pendant le transfert');
    current.update({ ...visibleFrame, route: 'regen', camera, power: 0 });
    assert.equal(label.classList.contains('produces'), false, 'aucun style de production à l’arrêt');
    assert.equal(label.querySelector('em').hidden, true, 'aucun badge de production à l’arrêt');
    assert.equal(label.hidden, false, 'le repère du trajet reste consultable');
  } finally {
    if (previousWidth === undefined) delete globalThis.innerWidth; else globalThis.innerWidth = previousWidth;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});

test('courant réel : cadence et intensité décroissent avec la puissance, jusqu’à zéro sans plancher', () => {
  const current = makeCurrent(); current.update({ ...visibleFrame, route: 'regen', power: 1, dt: 0 });
  const o = objects(current), observations = [];
  for (const power of [1, .25, .01, 0]) {
    const before = o.conduits[0].material.uniforms.uTime.value;
    let travelled = 0, previous = heads(current), maxLoss = 0, maxWave = 0;
    for (let frame = 0; frame < 60; frame++) {
      current.update({ ...visibleFrame, route: 'regen', power });
      const next = heads(current); travelled += next.reduce((sum, point, i) => sum + distance(point, previous[i]), 0); previous = next;
      maxLoss = Math.max(maxLoss, ...o.losses.geometry.attributes.aAlpha.array);
      maxWave = Math.max(maxWave, ...o.waves.map(wave => wave.material.opacity));
    }
    observations.push({ cadence: Math.abs(o.conduits[0].material.uniforms.uTime.value - before), travelled,
      intensity: o.comets.material.uniforms.uOpacity.value, ring: o.rings[0].material.uniforms.uOpacity.value,
      cells: o.cells.material.uniforms.uActive.value, maxLoss, maxWave });
  }
  for (let i = 1; i < observations.length; i++) for (const key of Object.keys(observations[i])) {
    assert.ok(observations[i][key] < observations[i - 1][key], `${key} doit baisser : ${JSON.stringify(observations)}`);
  }
  for (const value of Object.values(observations.at(-1))) assert.equal(value, 0, 'aucun plancher de vitesse ou d’intensité');
  assert.ok(observations[2].travelled > 0 && observations[2].intensity > 0, 'la petite puissance reste représentée');
  const positive = makeCurrent(), negative = makeCurrent();
  for (let i = 0; i < 90; i++) {
    positive.update({ ...visibleFrame, route: 'regen', power: .04 });
    negative.update({ ...visibleFrame, route: 'regen', power: -.04 });
  }
  assert.deepEqual(snapshot(positive), snapshot(negative), 'le signe de puissance ne modifie ni cadence ni trajet ; le sens dépend de la route');
});

test('courant réel : la pause prolongée fige les points, pertes, halos, anneaux et phases des shaders', () => {
  const current = makeCurrent();
  for (let i = 0; i < 120; i++) current.update({ ...visibleFrame, route: 'regen' });
  const before = snapshot(current);
  for (let i = 0; i < 180; i++) current.update({ ...visibleFrame, route: 'regen', running: false, wheelAngle: 5 + i });
  assert.deepEqual(snapshot(current), before);
});

test('courant réel : traction et récupération font demi-tour sur place sans inverser les roues', () => {
  const current = makeCurrent(); current.update({ ...visibleFrame, route: 'drive', dt: 0 });
  const initialHeads = heads(current), o = objects(current);
  const initialPhase = o.conduits[0].material.uniforms.uTime.value;
  const initialCells = o.cells.material.uniforms.uTime.value;
  for (let i = 0; i < 30; i++) current.update({ ...visibleFrame, route: 'drive' });
  assert.ok(o.conduits[0].material.uniforms.uTime.value > initialPhase);
  const turningHeads = heads(current), turningPhase = o.conduits[0].material.uniforms.uTime.value;
  const turningCells = o.cells.material.uniforms.uTime.value;
  current.update({ ...visibleFrame, route: 'regen', dt: 0 });
  assert.deepEqual(heads(current), turningHeads, 'les 84 têtes ne se replacent pas au changement de sens');
  assert.equal(o.conduits[0].material.uniforms.uTime.value, turningPhase);
  assert.equal(o.cells.material.uniforms.uTime.value, turningCells);
  assert.ok(o.rings.every(ring => ring.rotation.z === .7), 'la rotation mécanique garde son sens');
  for (let i = 0; i < 30; i++) current.update({ ...visibleFrame, route: 'regen' });
  assert.ok(Math.abs(o.conduits[0].material.uniforms.uTime.value - initialPhase) < 1e-9);
  assert.ok(Math.abs(o.cells.material.uniforms.uTime.value - initialCells) < 1e-9);
  assert.ok(heads(current).every((head, i) => distance(head, initialHeads[i]) < 1e-6), 'les déplacements réels suivent le trajet dans les deux sens');
});

test('courant réel : recharge roues immobiles et changement de famille masqué sans pertes fantômes', () => {
  const current = makeCurrent(); current.update({ ...visibleFrame, route: 'charge', wheelAngle: 0, dt: 0 });
  const before = heads(current);
  for (let i = 0; i < 180; i++) current.update({ ...visibleFrame, route: 'charge', wheelAngle: 0 });
  const o = objects(current);
  assert.ok(heads(current).some((point, i) => distance(point, before[i]) > .01), 'recharger produit un transfert même sans mouvement');
  assert.ok(o.rings.every(ring => !ring.visible));
  assert.ok(o.losses.geometry.attributes.aAlpha.array.some(alpha => alpha > 0));
  current.update({ ...visibleFrame, route: 'charge', visibility: 0, active: false, power: 0 });
  current.update({ ...visibleFrame, route: 'drive', dt: 0 });
  assert.ok(o.losses.geometry.attributes.aAlpha.array.every(alpha => alpha === 0), 'les anciennes pertes ne réapparaissent pas');
  for (let i = 0; i < 180; i++) current.update({ ...visibleFrame, route: 'drive' });
  const positions = o.losses.geometry.attributes.position.array, alphas = o.losses.geometry.attributes.aAlpha.array;
  const losses = ENERGY_ROUTES.drive.stops.filter(stop => stop.loss);
  assert.ok(alphas.some(alpha => alpha > 0));
  for (let i = 0; i < alphas.length; i++) if (alphas[i] > 0) {
    assert.ok(losses.some(stop => Math.abs(positions[i * 3] - stop.at[0]) < .25 && Math.abs(positions[i * 3 + 2] - stop.at[2]) < .25
      && positions[i * 3 + 1] >= stop.at[1] && positions[i * 3 + 1] <= stop.at[1] + .8), 'les nouvelles pertes restent aux convertisseurs de la route active');
  }
});

test('courant réel : la recharge à 11 kW conserve un trajet AC puis DC clairement matérialisé', () => {
  const current = makeCurrent(), frame = { ...visibleFrame, route: 'charge', power: 11 / 300, wheelAngle: 0 };
  current.update({ ...frame, dt: 0 });
  const o = objects(current), before = heads(current), phase = o.conduits[0].material.uniforms.uTime.value;
  for (let i = 0; i < 60; i++) current.update(frame);
  const segmentIds = new Set(ENERGY_ROUTES.charge.strands.flat());
  assert.equal(o.conduits.length, segmentIds.size * 2, 'chaque tronçon possède un cœur et un halo visibles');
  for (const id of segmentIds) {
    const meshes = o.conduits.filter(mesh => mesh.name === `Conduit ${id}`);
    assert.equal(meshes.length, 2, `${id} : trajet complet de la borne aux quatre modules`);
    assert.ok(meshes.every(mesh => mesh.material.uniforms.uActive.value >= .4), `${id} : impulsions suffisamment contrastées à 11 kW`);
  }
  assert.ok(o.comets.material.uniforms.uOpacity.value >= .4, 'les comètes de recharge ne sont pas noyées par la normalisation à 300 kW');
  const positions = o.comets.geometry.attributes.position.array, alphas = o.comets.geometry.attributes.aAlpha.array;
  const colors = o.comets.geometry.attributes.aColor.array;
  const expectedColors = { grid: new Color(CURRENT_KINDS.grid.color).toArray(), dc: new Color(CURRENT_KINDS.dc.color).toArray() };
  const counts = { grid: 0, dc: 0 }; let visibleHeads = 0, effectiveAlpha = 0;
  for (let i = 0; i < current.metrics.comets; i++) {
    const index = i * current.metrics.trail;
    if (alphas[index] <= 0) continue;
    visibleHeads++; effectiveAlpha += alphas[index] * o.comets.material.uniforms.uOpacity.value;
    const color = Array.from(colors.slice(index * 3, index * 3 + 3));
    for (const [kind, expected] of Object.entries(expectedColors)) if (color.every((value, axis) => Math.abs(value - expected[axis]) < 1e-6)) counts[kind]++;
  }
  assert.ok(visibleHeads >= 45 && effectiveAlpha / visibleHeads >= .35, 'la recharge fournit assez de repères lumineux lisibles');
  assert.ok(counts.grid >= 5 && counts.dc >= 5, 'les deux côtés de la conversion AC → DC sont matérialisés');
  assert.ok(positions.every(Number.isFinite));
  assert.ok(heads(current).some((point, i) => distance(point, before[i]) > .1), 'le parcours avance avec les roues immobiles');
  assert.ok(o.conduits[0].material.uniforms.uTime.value > phase);
  assert.ok(o.rings.every(ring => !ring.visible));
  const paused = snapshot(current);
  for (let i = 0; i < 60; i++) current.update({ ...frame, running: false });
  assert.deepEqual(snapshot(current), paused, 'la mise en pause ne redémarre pas les repères renforcés');
  current.update({ ...frame, active: false, power: 0 });
  assert.equal(o.comets.material.uniforms.uOpacity.value, 0);
  assert.ok(o.comets.geometry.attributes.aAlpha.array.every(alpha => alpha === 0));
  assert.ok(o.conduits.every(mesh => mesh.material.uniforms.uActive.value === 0));
});
