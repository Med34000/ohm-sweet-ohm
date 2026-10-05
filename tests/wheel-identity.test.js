import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from '../libs/three.module.min.js';
import { ELECTRIC_VEHICLE_LAYOUT as LAYOUT } from '../js/data/vehicle-layout.js';
import { wheelIdentityAt, labelWheelModel } from '../js/data/wheel-identity.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { createElectricDrivetrain } = await import('../js/models/electric-drivetrain.js');
const forward = new THREE.Vector3(LAYOUT.wheel.frontAxleX - LAYOUT.wheel.rearAxleX, 0, 0).normalize();
const driverLeft = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

test('les quatre roues sont nommées dans le référentiel du véhicule', () => {
  // Derive left from the actual vehicle axes, independently of the production
  // Z-sign condition; this catches an inherited left/right naming convention.
  for (const [axle, x, track, axleLabel] of [
    ['front', LAYOUT.wheel.frontAxleX, LAYOUT.wheel.frontTrackHalf, 'avant'],
    ['rear', LAYOUT.wheel.rearAxleX, LAYOUT.wheel.rearTrackHalf, 'arrière'],
  ]) for (const [side, direction, sideLabel] of [['left', 1, 'gauche'], ['right', -1, 'droite']]) {
    const position = new THREE.Vector3(x, LAYOUT.wheel.centerY, 0).addScaledVector(driverLeft, track * direction);
    assert.deepEqual(wheelIdentityAt(position), {
      component: 'wheel', wheelId: `wheel-${axle}-${side}`, axle, side,
      label: `Roue ${axleLabel} ${sideLabel}`,
    });
  }
});

test('l’ordre arrière-avant réel des roues n’altère pas les libellés affichés', () => {
  const drivetrain = createElectricDrivetrain();
  const wheels = drivetrain.group.children.filter(child => child.userData.component === 'wheel' && child.isGroup && child.children[0]?.isGroup);
  assert.equal(wheels.length, 4);
  assert.equal(wheels[0].position.x, LAYOUT.wheel.rearAxleX);
  for (const wheel of wheels) {
    const axleLabel = wheel.position.x === LAYOUT.wheel.frontAxleX ? 'avant' : 'arrière';
    const sideLabel = wheel.position.dot(driverLeft) > 0 ? 'gauche' : 'droite';
    assert.equal(wheel.userData.label, `Roue ${axleLabel} ${sideLabel}`, 'Le libellé doit suivre le point de vue du conducteur.');
  }
});

test('les demi-arbres historiques utilisent la même gauche conducteur que les roues', () => {
  const drivetrain = createElectricDrivetrain(), shafts = [];
  drivetrain.group.traverse(object => {
    if (object.isGroup && object.userData.component === 'axle') shafts.push(object);
  });
  assert.equal(shafts.length, 2);
  for (const shaft of shafts) {
    const center = new THREE.Box3().setFromObject(shaft).getCenter(new THREE.Vector3());
    assert.equal(shaft.userData.label, center.dot(driverLeft) > 0 ? 'Demi-arbre gauche' : 'Demi-arbre droit');
  }
});

test('chaque maillage d’une roue conserve son identité pendant rotation et déplacement de présentation', () => {
  const model = new THREE.Group(), nested = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  model.add(nested); nested.add(mesh);
  const identity = wheelIdentityAt({ x: LAYOUT.wheel.frontAxleX, z: LAYOUT.wheel.frontTrackHalf });
  labelWheelModel(model, identity);
  model.position.set(50, 20, -50); model.rotation.set(1, 2, 3);
  model.traverse(object => assert.deepEqual(object.userData, identity));
  mesh.geometry.dispose(); mesh.material.dispose();
});
