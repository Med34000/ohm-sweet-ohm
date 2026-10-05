import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import * as THREE from '../libs/three.module.min.js';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { createTeachingMotor } = await import('../js/models/teaching-motor.js');
const { GLTFLoader } = await import('../libs/GLTFLoader.js');
const { createGLTFLoader } = await import('../js/models/gltf-loader.js');
const TAU = Math.PI * 2;

function allMeshes(root) {
  const items = []; root.traverse(object => { if (object.isMesh) items.push(object); }); return items;
}
async function detailedMotor() {
  const file = await readFile(new URL('../assets/web/elan-drive-unit.glb', import.meta.url));
  const asset = await createGLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const previous = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => asset;
  try { const model = createTeachingMotor(); await model.loadDetailedModel(); return model; }
  finally { GLTFLoader.prototype.loadAsync = previous; }
}

test('le moteur utilise 54 encoches, trois bobinages distribués et six pôles enterrés', () => {
  const model = createTeachingMotor(), items = allMeshes(model.group);
  assert.equal(model.metrics.statorSlots, 54);
  assert.equal(model.metrics.statorTeeth, 54);
  assert.equal(model.metrics.poles, 6);
  assert.equal(model.metrics.polePairs, 3);
  const teeth = items.find(object => object.name === '54 dents en acier feuilleté');
  assert.ok(teeth.isInstancedMesh);
  assert.equal(teeth.count, 54);
  const phases = items.filter(object => object.userData.phase);
  assert.deepEqual(phases.map(object => object.userData.phase), ['U', 'V', 'W']);
  assert.equal(phases.reduce((sum, object) => sum + object.count, 0), 54);
  assert.equal(new Set(phases.map(object => object.material.color.getHex())).size, 1, 'Les fils restent de cuivre naturel.');
  const magnets = items.find(object => object.userData.magnetTopology === 'buried-v');
  assert.equal(magnets.count, 12);
  assert.equal(magnets.userData.poles, 6);
  model.setFrame({ opened: true, focus: 'overview', power: .8 });
  assert.ok(phases.every(object => object.material.emissiveIntensity === 0));
  model.setFrame({ opened: true, focus: 'phases', power: .8 });
  assert.ok(phases.every(object => object.material.emissiveIntensity > 0));
});

test('le vrai GLB remplace les carters de secours et conserve un budget mesuré', async () => {
  const model = await detailedMotor(), items = allMeshes(model.group);
  assert.equal(model.metrics.detailLoaded, true);
  assert.equal(items.some(object => object.name.includes('secours')), false);
  assert.ok(items.some(object => object.geometry.attributes.uv && object.material.bumpMap));
  let triangles = 0;
  for (const object of items) {
    const geometry = object.geometry;
    assert.ok(object.userData.component === 'motor' && object.userData.label);
    for (const attribute of Object.values(geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
  }
  assert.equal(model.metrics.triangles, triangles);
  assert.equal(model.metrics.drawCalls, items.length);
  assert.ok(triangles < 145000, `${triangles} triangles`);
  assert.ok(items.length <= 55, `${items.length} appels de dessin, surimpressions pédagogiques comprises`);
  assert.ok(triangles > 100000, 'Le test doit vérifier le carter livré, pas seulement la maquette de secours.');
  model.group.updateMatrixWorld(true);
  const closed = new THREE.Box3().setFromObject(model.group);
  assert.ok(closed.max.x > 1 && closed.max.x < 1.15, 'Le réducteur doit être asymétrique du côté +X.');
  assert.ok(closed.min.z > -.70 && closed.max.z < .70, 'Le modèle chargé doit conserver l’axe Z.');
  model.setFrame({ opened: true }); model.group.updateMatrixWorld(true);
  const open = new THREE.Box3().setFromObject(model.group);
  assert.ok(open.max.z > 1.85 && open.max.z < 2);
  assert.ok(open.max.y > 1.15 && open.max.y < 1.4);
});

test('les carters détaillés restent articulés, sans déplacer le bornier physique', async () => {
  const model = await detailedMotor();
  const casing = model.group.children.find(object => object.userData.motorPart === 'housing');
  const pins = allMeshes(model.group).find(object => object.name === 'Contacts cuivre U, V et W');
  const originalPins = Array.from(pins.instanceMatrix.array);
  const caps = model.group.children.filter(object => object.userData.motorPart === 'bearing');
  const originalFront = caps[0].position.z;
  model.setFrame({ opened: true, progress: 1, rotorAngle: 1.23, mode: 'drive' });
  assert.equal(casing.position.length(), 0);
  assert.ok(caps[0].position.z > originalFront + 1);
  assert.deepEqual(Array.from(pins.instanceMatrix.array), originalPins);
  model.setFrame({ opened: false });
  assert.equal(caps[0].position.z, originalFront);
});

// 2026-09-30 ≈14:30 (Europe/Zurich) — Codex / OpenAI : effets liés aux notions et pause vérifiée sans rendu externe.
test('les effets expliquent trois courants, le champ et les pôles sans envahir les autres vues', () => {
  const model = createTeachingMotor(), g = model.groups;
  assert.equal(g.field.userData.illustrative, true);
  assert.match(g.field.userData.description, /pas un calcul électromagnétique/);
  assert.ok(allMeshes(model.group).filter(object => object.material.isShaderMaterial).every(object => object.material.forceSinglePass), 'Les halos transparents évitent un second passage de rendu inutile.');
  model.setFrame({ opened: true, focus: 'stator', power: .65, rotorAngle: .37, time: 1 });
  assert.equal(g.phaseOverlay.visible, true);
  assert.equal(g.field.visible, true);
  assert.equal(g.transmission.visible, false);
  assert.equal(g.capFront.visible, false); assert.equal(g.capRear.visible, false); assert.equal(g.cover.visible, false);
  assert.ok(g.rotor.position.z <= .12 + 1e-8, 'Le rotor reste près du stator pendant le fonctionnement expliqué.');
  const waves = g.phaseOverlay.children;
  assert.equal(waves.length, 3);
  waves.forEach((wave, phase) => {
    assert.ok(Math.abs(wave.material.uniforms.uPhase.value - phase * TAU / 3) < 1e-8, '120 degrés électriques entre courants');
    assert.equal(wave.userData.illustrativeAnnotation, true);
    assert.equal(wave.castShadow, false);
  });
  const winding = allMeshes(model.group).filter(object => object.userData.phase);
  assert.equal(new Set(winding.map(object => object.material.emissiveIntensity)).size, 3, 'Les trois amplitudes ne pulsent pas ensemble.');
  model.setFrame({ opened: true, focus: 'field', power: .65, rotorAngle: .37 });
  assert.equal(g.poleOverlay.visible, true);
  assert.deepEqual(g.poleOverlay.children.filter(object => object.userData.pole).map(object => [object.userData.pole, object.count]), [['N', 3], ['S', 3]]);
  model.setFrame({ opened: true, focus: 'rotor', power: .65 });
  assert.equal(g.field.visible, false); assert.equal(g.phaseOverlay.visible, false);
  assert.equal(g.transmission.visible, true); assert.equal(g.capFront.visible, true);
  assert.equal(g.rotor.position.z, .92, 'La leçon de démontage garde le rotor écarté.');
  model.setFrame({ opened: false, focus: 'field', power: .65 });
  assert.equal(g.field.visible, false); assert.equal(g.phaseOverlay.visible, false); assert.equal(g.poleOverlay.visible, false);
  model.setFrame({ opened: true, focus: 'field', power: .65, mode: 'charge' });
  assert.equal(g.field.visible, false); assert.equal(g.phaseOverlay.visible, false);
});

test('la pause fige rotor, champ, courants et horloge des halos puis la reprise les anime', () => {
  const model = createTeachingMotor();
  const params = { opened: true, focus: 'generator', power: .55, mode: 'regen' };
  model.setFrame({ ...params, rotorAngle: .7, time: 2, running: true });
  const snapshot = () => ({
    rotor: model.groups.rotor.rotation.z, field: model.groups.field.rotation.z,
    glows: allMeshes(model.group).filter(object => object.material.isShaderMaterial).map(object => Object.fromEntries(
      Object.entries(object.material.uniforms).filter(([, uniform]) => typeof uniform.value === 'number').map(([key, uniform]) => [key, uniform.value]))),
    phases: allMeshes(model.group).filter(object => object.userData.phase).map(object => object.material.emissiveIntensity),
  });
  const held = snapshot();
  for (const time of [10, 100, 1000]) {
    model.setFrame({ ...params, rotorAngle: time, time, running: false });
    assert.deepEqual(snapshot(), held, 'Aucune surimpression ne doit continuer pendant la pause.');
  }
  model.setFrame({ ...params, rotorAngle: .9, time: 3, running: true });
  assert.notDeepEqual(snapshot(), held);
});

test('le générateur inverse le transfert et le couple du champ tout en gardant le sens mécanique', () => {
  const model = createTeachingMotor(), g = model.groups;
  const params = { opened: true, power: .7, running: true, time: 1, rotorAngle: .8 };
  model.setFrame({ ...params, focus: 'field', mode: 'drive' });
  const drivingOffset = g.field.rotation.z - g.rotor.rotation.z;
  assert.ok(drivingOffset > 0);
  assert.equal(g.electricalTransfer.children[0].material.uniforms.uDir.value, -1, 'Énergie électrique vers le moteur.');
  model.setFrame({ ...params, focus: 'generator', mode: 'regen' });
  assert.equal(g.rotor.rotation.z, .8, 'Le rotor ne tourne pas à l’envers au passage en récupération.');
  assert.ok(g.field.rotation.z - g.rotor.rotation.z < 0, 'Le couple électromagnétique s’oppose au mouvement.');
  assert.equal(g.electricalTransfer.visible, true); assert.equal(g.transmission.visible, true);
  assert.equal(g.electricalTransfer.children[0].material.uniforms.uDir.value, 1, 'Énergie électrique quittant le générateur.');
  assert.equal(g.transmission.children[0].material.uniforms.uDir.value, -1, 'Énergie mécanique entrant dans le générateur.');
  assert.match(g.electricalTransfer.userData.description, /pas une liaison physique/);
  model.setFrame({ ...params, rotorAngle: 1.1, focus: 'generator', mode: 'regen' });
  assert.ok(g.rotor.rotation.z > .8, 'La progression mécanique garde son sens pendant la récupération.');
});
