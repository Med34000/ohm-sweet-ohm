import * as THREE from 'three';
import { ELECTRICAL_CABLES, electricalActivity } from '../data/electrical-topology.js?v=20260930-5';

// 2026-09-22 — Codex / OpenAI. An explanatory arrangement, not an OEM assembly drawing.
// 2026-09-30 ≈18:20 (Europe/Zurich) — Codex — OpenAI : avancement des flèches sans saut ni flux au repos.
export const TECHNICAL_OFFSETS = Object.freeze({
  battery: Object.freeze([-2.2, 0.3, -0.2]),
  motor: Object.freeze([1.02, 0.55, 0.6]),
  inverter: Object.freeze([0.52, 1.86, -1.22]),
  charger: Object.freeze([-0.35, 1.95, 0]),
  port: Object.freeze([0, 0, 0]),
});

const SEGMENTS = 32, SIDES = 6, EPSILON = 0.00001, ARROWS_PER_CABLE = 3;

/**
 * Move complete electrical organs apart while retaining their internal local
 * coordinate systems. Each conductor's two ends follow its own physical ports.
 * The intermediate route stretches with them; it is explicitly schematic.
 */
export function createTechnicalOverview({ battery, motor, powertrain, drivetrain }) {
  const group = new THREE.Group();
  group.name = 'Connexions de la vue éclatée technique';
  group.userData = { component: 'hv', label: 'Liaisons haute tension', schematic: true };
  drivetrain.group.add(group);

  const organs = {
    battery: battery.group, motor: motor.group,
    inverter: powertrain.groups.inverter, charger: powertrain.groups.charger,
  };
  const homes = Object.fromEntries(Object.entries(organs).map(([key, node]) => [key, node.position.clone()]));
  const offsets = Object.fromEntries(Object.entries(TECHNICAL_OFFSETS).map(([key, values]) => [key, new THREE.Vector3(...values)]));
  const material = new THREE.MeshStandardMaterial({ color: 0xe87928, metalness: 0.08, roughness: 0.36 });
  const point = new THREE.Vector3();

  const cables = ELECTRICAL_CABLES.map(specification => {
    const original = specification.points.map(values => new THREE.Vector3(...values));
    const points = original.map(value => value.clone());
    const lengths = [0];
    for (let i = 1; i < original.length; i++) lengths.push(lengths[i - 1] + original[i].distanceTo(original[i - 1]));
    const fractions = lengths.map(distance => distance / lengths.at(-1));
    const source = offsets[specification.from.split('.')[0]], target = offsets[specification.to.split('.')[0]];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(curve, SEGMENTS, specification.radius, SIDES, false);
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = specification.label;
    mesh.userData = {
      component: 'hv', label: specification.label, cableId: specification.id,
      from: specification.from, to: specification.to, schematic: true,
    };
    group.add(mesh);
    return { id: specification.id, from: specification.from, to: specification.to, mesh, curve, points,
      original, fractions, source, target, radius: specification.radius, phase: 0.08 };
  });

  // One shared draw call shows energy transfer on whichever route is active.
  // In particular, these arrows do not depict individual electrons in AC.
  const arrowGeometry = new THREE.ConeGeometry(0.063, 0.16, 7);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffeed0, depthWrite: false });
  const arrows = new THREE.InstancedMesh(arrowGeometry, arrowMaterial, cables.length * ARROWS_PER_CABLE);
  arrows.name = 'Sens du transfert d’énergie dans la vue éclatée';
  arrows.userData = { component: 'hv', label: 'Sens du transfert d’énergie', schematic: true };
  arrows.frustumCulled = false;
  arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(arrows);
  const transform = new THREE.Object3D(), tangent = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let previousTime = null;

  function setFrame({ time = 0, dt: frameDt = null, running = true, power = 0, mode = 'drive', connected = false,
    charging = false, recovering = false } = {}) {
    const activity = electricalActivity({ mode, power, connected, charging, recovering });
    const normalizedPower = Number.isFinite(power) ? THREE.MathUtils.clamp(Math.abs(power), 0, 1) : 0;
    const dt = running ? THREE.MathUtils.clamp(Number.isFinite(frameDt) ? frameDt : previousTime !== null && Number.isFinite(time) ? time - previousTime : 0, 0, .06) : 0;
    if (running && Number.isFinite(time)) previousTime = time;
    arrows.visible = normalizedPower > 0 && (activity.charge || activity.traction);
    for (let cableIndex = 0; cableIndex < cables.length; cableIndex++) {
      const cable = cables[cableIndex], charge = cable.id.startsWith('charge');
      const active = normalizedPower > 0 && (charge ? activity.charge : activity.traction);
      const direction = charge ? 1 : activity.direction;
      const rate = 0.30 * Math.sqrt(normalizedPower) / Math.max(0.7, cable.curve.getLength());
      if (active) cable.phase = ((cable.phase + dt * rate * direction) % 1 + 1) % 1;
      for (let index = 0; index < ARROWS_PER_CABLE; index++) {
        if (active) {
          const fraction = (index / ARROWS_PER_CABLE + cable.phase) % 1;
          cable.curve.getPointAt(fraction, transform.position);
          cable.curve.getTangentAt(fraction, tangent).multiplyScalar(direction);
          transform.quaternion.setFromUnitVectors(up, tangent.normalize());
          transform.scale.setScalar(1);
        } else {
          transform.position.set(0, 0, 0); transform.quaternion.identity(); transform.scale.setScalar(0);
        }
        transform.updateMatrix();
        arrows.setMatrixAt(cableIndex * ARROWS_PER_CABLE + index, transform.matrix);
      }
    }
    arrows.instanceMatrix.needsUpdate = true;
  }

  // TubeGeometry is allocated once. Rewriting its existing attributes avoids
  // GPU allocation/disposal churn while the slider or transition is moving.
  function updateCable(cable, progress) {
    for (let i = 0; i < cable.points.length; i++) {
      cable.points[i].copy(cable.source).lerp(cable.target, cable.fractions[i])
        .multiplyScalar(progress).add(cable.original[i]);
    }
    cable.curve.needsUpdate = true;
    const frames = cable.curve.computeFrenetFrames(SEGMENTS, false);
    const positions = cable.mesh.geometry.attributes.position;
    const normals = cable.mesh.geometry.attributes.normal;
    for (let i = 0; i <= SEGMENTS; i++) {
      cable.curve.getPoint(i / SEGMENTS, point);
      const normal = frames.normals[i], binormal = frames.binormals[i];
      for (let j = 0; j <= SIDES; j++) {
        const angle = j / SIDES * Math.PI * 2;
        const sine = Math.sin(angle), cosine = -Math.cos(angle);
        const nx = cosine * normal.x + sine * binormal.x;
        const ny = cosine * normal.y + sine * binormal.y;
        const nz = cosine * normal.z + sine * binormal.z;
        const index = i * (SIDES + 1) + j;
        normals.setXYZ(index, nx, ny, nz);
        positions.setXYZ(index, point.x + cable.radius * nx, point.y + cable.radius * ny, point.z + cable.radius * nz);
      }
    }
    positions.needsUpdate = true; normals.needsUpdate = true;
    cable.mesh.geometry.computeBoundingBox();
    cable.mesh.geometry.computeBoundingSphere();
  }

  let previous = -1;
  function setProgress(value = 0) {
    const progress = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
    const active = progress > EPSILON;
    group.visible = active;
    powertrain.groups.hv.visible = !active;
    // Always restore exact home coordinates at either endpoint.
    if (progress === previous || (progress > 0 && progress < 1 && Math.abs(progress - previous) < EPSILON)) return;
    previous = progress;
    for (const [key, node] of Object.entries(organs)) node.position.copy(homes[key]).addScaledVector(offsets[key], progress);
    for (const cable of cables) updateCable(cable, progress);
  }

  function bounds() {
    const result = new THREE.Box3();
    drivetrain.group.updateWorldMatrix(true, true);
    for (const node of Object.values(organs)) result.expandByObject(node);
    if (group.visible) for (const cable of cables) result.expandByObject(cable.mesh);
    return result;
  }

  function dispose() {
    setProgress(0);
    for (const cable of cables) cable.mesh.geometry.dispose();
    material.dispose();
    arrowGeometry.dispose(); arrowMaterial.dispose();
    group.removeFromParent();
  }

  setProgress(0);
  setFrame();
  return {
    group, setProgress, setFrame, bounds, dispose, cables, arrows,
    metrics: Object.freeze({ cables: cables.length, drawCalls: cables.length + 1,
      triangles: cables.length * SEGMENTS * SIDES * 2 + arrowGeometry.index.count / 3 * arrows.count }),
  };
}
