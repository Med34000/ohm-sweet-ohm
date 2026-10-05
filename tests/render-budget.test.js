import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import * as THREE from '../libs/three.module.min.js';
import { createAdaptiveQuality, QUALITY_SCALES } from '../js/visuals/adaptive-quality.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../libs/three.module.min.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { mergeHologramGeometry } = await import('../js/visuals/merged-hologram.js');

function clock() { let t = 0; return { now: () => t, run: (ms, frames) => { for (let i = 0; i < frames; i++) { t += ms; controller.frame(ms); } } }; }
let controller;
function make(options = {}) {
  const c = clock(); const changes = [];
  controller = createAdaptiveQuality({ now: c.now, onChange: (scale, level) => changes.push([scale, level]), ...options });
  return { c, changes };
}

test('qualité adaptative : une machine fluide ne change rien', () => {
  const { c, changes } = make(); c.run(16.7, 600);
  assert.deepEqual(changes, []); assert.equal(controller.level, 0);
});

test('qualité adaptative : baisse la résolution si la fluidité est mauvaise et que la baisse aide', () => {
  const { c, changes } = make();
  c.run(30, 130);  // ≈ 33 images/s : trop lent (pas de baisse avant 2,5 s, le temps du chargement)
  assert.equal(changes.at(0)[1], 1, 'passe au palier 1');
  c.run(18, 80);   // ≈ 55 images/s : la baisse a aidé, on garde
  assert.equal(controller.level, 1); assert.equal(controller.locked.drop, false);
});

test('qualité adaptative : si baisser la résolution n’améliore pas, on annule et on arrête d’essayer', () => {
  const { c, changes } = make(); c.run(30, 130); // baisse
  c.run(30, 80);                                  // pas d’amélioration (goulot CPU/géométrie)
  assert.equal(controller.level, 0, 'retour à la résolution d’origine');
  assert.equal(controller.locked.drop, true);
  c.run(30, 400);
  assert.equal(controller.level, 0, 'plus aucune baisse tentée');
  assert.equal(changes.length, 2);
});

test('qualité adaptative : remonte seulement après une longue période stable, sans osciller', () => {
  const { c } = make(); c.run(30, 130); c.run(18, 80);
  assert.equal(controller.level, 1);
  c.run(16.7, 300); // ≈ 5 s : trop tôt
  assert.equal(controller.level, 1);
  c.run(16.7, 900); // > 12 s stables
  assert.equal(controller.level, 0);
  // nouvelle chute juste après la remontée : on redescend puis on ne remonte plus jamais
  // Appareil qui rechute : lent en pleine résolution (30 ms), fluide dès le palier 1 (18 ms).
  for (let i = 0; i < 600; i++) c.run(controller.level ? 18 : 30, 1);
  assert.equal(controller.level, 1); assert.equal(controller.locked.rise, true);
  c.run(16.7, 3000);
  assert.equal(controller.level, 1);
});

test('qualité adaptative : ignore les images aberrantes (onglet masqué)', () => {
  const { c, changes } = make(); c.run(2000, 200); c.run(16.7, 200);
  assert.deepEqual(changes, []);
});

test('les échelles sont décroissantes et bornées', () => {
  assert.equal(QUALITY_SCALES[0], 1);
  QUALITY_SCALES.forEach((s, i) => { assert.ok(s > 0.4 && s <= 1); if (i) assert.ok(s < QUALITY_SCALES[i - 1]); });
});

test('fusion de l’hologramme : mêmes triangles, une seule géométrie, transformations conservées', () => {
  const root = new THREE.Group(); root.position.set(5, 0, 0);
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const inner = new THREE.Group(); inner.position.set(2, 0, 0); inner.rotation.y = Math.PI / 2;
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1).toNonIndexed(), new THREE.MeshBasicMaterial()); b.position.set(0, 3, 0);
  inner.add(b); root.add(a, inner);
  const result = mergeHologramGeometry(root);
  const expected = 12 + 12; // deux boîtes = 24 triangles
  assert.equal(result.triangles, expected);
  assert.equal(result.sources.length, 2);
  result.geometry.computeBoundingBox();
  const box = result.geometry.boundingBox;
  // Repère local de `root` : la boîte a couvre [-.5,.5], la boîte b tournée de 90° est centrée en (2,3,0), étendue 1 en x et 2 en z.
  assert.ok(Math.abs(box.min.x + .5) < 1e-5 && Math.abs(box.max.x - 2.5) < 1e-5, `x ${box.min.x}..${box.max.x}`);
  assert.ok(Math.abs(box.max.y - 3.5) < 1e-5 && Math.abs(box.min.y + .5) < 1e-5);
  assert.ok(Math.abs(box.max.z - 1) < 1e-5 && Math.abs(box.min.z + 1) < 1e-5);
  for (let i = 0; i < result.geometry.attributes.normal.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(result.geometry.attributes.normal, i);
    assert.ok(Math.abs(n.length() - 1) < 1e-4);
  }
});

test('fusion de l’hologramme : rien à fusionner renvoie null', () => {
  assert.equal(mergeHologramGeometry(new THREE.Group()), null);
});

const { createAmbience, AMBIENCE_COLORS } = await import('../js/visuals/ambience.js');

test('ambiance : trois appels de rendu, invisible hors mode Courant, particules bornées', () => {
  const a = createAmbience();
  assert.equal(a.metrics.drawCalls, 3);
  a.update({ dt: .016, visibility: 0 });
  assert.equal(a.group.visible, false);
  for (let i = 0; i < 300; i++) a.update({ dt: .05, visibility: 1, route: 'drive', active: true, power: .8, speed: 30 });
  assert.equal(a.group.visible, true);
  const p = a.dust.geometry.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    assert.ok(Math.abs(p[i]) <= 11 + 1e-6, `x ${p[i]}`); assert.ok(p[i + 1] >= 0 && p[i + 1] <= 6 + 1e-6); assert.ok(Math.abs(p[i + 2]) <= 7);
  }
});

test('ambiance : les particules défilent vers l’arrière quand la voiture roule, à l’arrêt elles flottent à peine', () => {
  const still = createAmbience(), moving = createAmbience();
  const x0 = Float32Array.from(still.dust.geometry.attributes.position.array).filter((_, i) => i % 3 === 0);
  still.update({ dt: .1, visibility: 1, speed: 0 }); moving.update({ dt: .1, visibility: 1, speed: 30 });
  const meanShift = a => { const now = a.dust.geometry.attributes.position.array; let sum = 0; for (let i = 0; i < 240; i++) { let d = now[i * 3] - x0[i]; if (d < -11) d += 22; sum += d; } return sum / 240; };
  assert.ok(meanShift(moving) > meanShift(still) * 10, 'défilement net à 30 m/s');
  assert.ok(meanShift(moving) > 0, 'vers +X, donc vers l’arrière');
});

test('ambiance : une couleur par nature de flux', () => {
  assert.equal(new Set(Object.values(AMBIENCE_COLORS)).size, 3);
});

// 2026-09-30 ≈18:26 (Europe/Zurich) — Codex — OpenAI : pas d’onde d’énergie à transfert nul.
test('ambiance : les ondes suivent la puissance et cessent immédiatement sans transfert, avec pause complète', () => {
  const ambience = createAmbience();
  const frame = { dt: .1, visibility: 1, active: true, route: 'regen', power: .81 };
  ambience.update(frame);
  const fastPhase = ambience.waves.material.uniforms.uPhase.value;
  const bright = ambience.waves.material.uniforms.uVis.value;
  ambience.update({ ...frame, power: .09 });
  const slowPhase = ambience.waves.material.uniforms.uPhase.value;
  assert.ok(slowPhase > fastPhase && slowPhase - fastPhase < fastPhase / 2, 'faible puissance : les ondes avancent plus lentement, dans le même sens');
  assert.ok(ambience.waves.material.uniforms.uVis.value < bright);
  const positions = Array.from(ambience.dust.geometry.attributes.position.array);
  ambience.update({ ...frame, power: .09, running: false });
  assert.equal(ambience.waves.material.uniforms.uPhase.value, slowPhase);
  assert.deepEqual(Array.from(ambience.dust.geometry.attributes.position.array), positions);
  for (const stopped of [{ active: false, power: .81 }, { active: true, power: 0 }]) {
    ambience.update({ ...frame, ...stopped });
    assert.equal(ambience.waves.visible, false);
    assert.equal(ambience.waves.material.uniforms.uVis.value, 0);
    assert.equal(ambience.waves.material.uniforms.uPhase.value, slowPhase, 'aucune onde ne continue d’avancer');
  }
});

// 2026-09-30 (Europe/Zurich) — Codex / OpenAI : vérifier le cadrage par la projection Three.js réelle.
const { fitCameraPoints } = await import('../js/scene.js');
const { createGLTFLoader } = await import('../js/models/gltf-loader.js');
const { GLTFLoader } = await import('../libs/GLTFLoader.js');
const { createTeachingBattery } = await import('../js/models/teaching-battery.js');
const { createTeachingMotor } = await import('../js/models/teaching-motor.js');

function boxCorners(box) {
  return [box.min, box.max].flatMap(a => [box.min, box.max].flatMap(b => [box.min, box.max].map(c => new THREE.Vector3(a.x, b.y, c.z))));
}

function assertProjectedFit(box, { width, height, direction, viewport, label }) {
  assert.equal(box.isEmpty(), false, `${label} : volume disponible`);
  const corners = boxCorners(box);
  const framing = fitCameraPoints(corners, {
    center: box.getCenter(new THREE.Vector3()), direction,
    aspect: width / height, fov: 35, viewport, margin: 1.06,
  });
  for (const value of [...framing.position.toArray(), ...framing.target.toArray(), framing.distance]) {
    assert.ok(Number.isFinite(value), `${label} : caméra non finie`);
  }
  const camera = new THREE.PerspectiveCamera(35, width / height, .1, 150);
  camera.position.copy(framing.position); camera.lookAt(framing.target); camera.updateMatrixWorld();
  const projections = [];
  for (const corner of corners) {
    const projected = corner.clone().project(camera);
    projections.push(projected);
    assert.ok(projected.toArray().every(Number.isFinite), `${label} : projection non finie`);
    assert.ok(projected.x >= viewport.left - 1e-6 && projected.x <= viewport.right + 1e-6, `${label} : coin hors largeur utile (${projected.x})`);
    assert.ok(projected.y >= viewport.bottom - 1e-6 && projected.y <= viewport.top + 1e-6, `${label} : coin hors hauteur utile (${projected.y})`);
    assert.ok(projected.z > -1 && projected.z < 1, `${label} : coin hors profondeur visible`);
  }
  return { height: (Math.max(...projections.map(p => p.y)) - Math.min(...projections.map(p => p.y))) * height / 2 };
}

test('cadrage : la carrosserie Meshopt livrée reste entière dans les zones utiles mobile et desktop', async () => {
  const bytes = await readFile(new URL('../assets/web/elan-sedan.glb', import.meta.url));
  const asset = await createGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assert.ok(asset.parser.json.extensionsUsed.includes('EXT_meshopt_compression'), 'vérifier la ressource compressée réellement livrée');
  const box = new THREE.Box3().setFromObject(asset.scene);
  const formats = [
    { width: 402, height: 425, viewport: { left: -.91, right: .91, bottom: -.61, top: .70 } },
    { width: 372, height: 306, viewport: { left: -.90, right: .90, bottom: -.54, top: .68 } },
    { width: 414, height: 466, viewport: { left: -.91, right: .91, bottom: -.52, top: .92 } },
    // Réserve aussi une zone latérale : le volume doit rester visible lorsque le centre utile est décalé.
    { width: 1280, height: 613, viewport: { left: -.66, right: .96, bottom: -.52, top: .94 } },
  ];
  const views = { overview: [-.72, .48, .78], side: [0, .13, 1], top: [-.15, .977, .15] };
  for (const format of formats) for (const [view, vector] of Object.entries(views)) {
    assertProjectedFit(box, { ...format, direction: new THREE.Vector3(...vector), label: `${format.width} × ${format.height} / ${view}` });
  }
});

test('cadrage : les gros plans ouverts restent entiers et grandissent lorsque la réserve du fondu est libérée', () => {
  const battery = createTeachingBattery(), motor = createTeachingMotor();
  battery.setFrame({ opened: true, progress: 1, focus: 'cooling' });
  motor.setFrame({ opened: true, progress: 1, power: .55, focus: 'field' });
  for (const [name, model, direction] of [
    ['batterie', battery, new THREE.Vector3(-.7, 1.65, 1.25)],
    ['moteur', motor, new THREE.Vector3(-.72, .54, 1.35)],
  ]) for (const [width, height] of [[414, 466], [1280, 613]]) {
    const box = new THREE.Box3().setFromObject(model.group);
    const viewport = { left: -.92, right: .96, bottom: -1 + 36 / height, top: 1 - 36 / height };
    const framing = assertProjectedFit(box, { width, height, direction, viewport, label: `${name} ouvert / ${width} × ${height}` });
    const faded = assertProjectedFit(box, { width, height, direction, viewport: { ...viewport, bottom: -.52 }, label: `${name} avec réserve de fondu / ${width} × ${height}` });
    assert.ok(framing.height >= faded.height - 1e-6, `${name} : libérer de la hauteur ne doit pas réduire le gros plan`);
    if (name === 'batterie') assert.ok(framing.height > faded.height * 1.12, 'la batterie doit utiliser la hauteur libérée');
  }
});

// 2026-09-30 (Europe/Zurich) — Codex / OpenAI : caméra figée au repos, puis sommets réels pendant la rotation ; les coins vides d'une boîte tournée ne sont pas des pixels.
test('cadrage : le moteur détaillé et ses effets restent visibles dans chaque leçon et pendant la rotation', async () => {
  const bytes = await readFile(new URL('../assets/web/elan-drive-unit.glb', import.meta.url));
  const asset = await createGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const previousLoad = GLTFLoader.prototype.loadAsync;
  let model;
  GLTFLoader.prototype.loadAsync = async () => asset;
  try { model = createTeachingMotor(); await model.loadDetailedModel(); }
  finally { GLTFLoader.prototype.loadAsync = previousLoad; }
  assert.equal(model.metrics.detailLoaded, true);
  for (const focus of ['stator', 'field', 'rotor', 'generator']) {
    const compact = focus !== 'rotor';
    model.setFrame({ opened: true, progress: 1, focus, power: .55, rotorAngle: 0, time: 0, mode: focus === 'generator' ? 'regen' : 'drive' });
    model.group.updateMatrixWorld(true);
    const cachedPoints = [];
    model.group.traverseVisible(object => {
      if (object.isMesh) cachedPoints.push(...boxCorners(new THREE.Box3().setFromObject(object)));
    });
    const center = new THREE.Box3().setFromPoints(cachedPoints).getCenter(new THREE.Vector3());
    const frames = [];
    for (const [width, height] of [[370, 280], [400, 380], [936, 522]]) for (const story of [false, true]) {
      const horizontal = width < 760 ? 18 : 24;
      const viewport = { left: -1 + horizontal * 2 / width, right: 1 - horizontal * 2 / width,
        top: 1 - (story ? 18 : Math.min(58, height * .2)) * 2 / height, bottom: -1 + (story ? 18 : 16) * 2 / height };
      const direction = compact ? new THREE.Vector3(-.45, .40, 1.65)
        : new THREE.Vector3(story ? -.72 : -1.2, story ? .54 : .75, story ? 1.35 : 1);
      const framing = fitCameraPoints(cachedPoints, { center, direction, aspect: width / height, fov: 35, viewport, margin: story ? 1.06 : 1.13 });
      assert.ok([...framing.position.toArray(), ...framing.target.toArray(), framing.distance].every(Number.isFinite));
      const camera = new THREE.PerspectiveCamera(35, width / height, .1, 150);
      camera.position.copy(framing.position); camera.lookAt(framing.target); camera.updateMatrixWorld();
      frames.push({ camera, viewport, label: `${focus} / ${width} × ${height} / ${story ? 'récit' : 'laboratoire'}` });
    }
    for (const angle of [0, .5, 1.2, 2.1]) {
      model.setFrame({ opened: true, progress: 1, focus, power: .55, rotorAngle: angle, time: angle, mode: focus === 'generator' ? 'regen' : 'drive' });
      model.group.updateMatrixWorld(true);
      const box = new THREE.Box3(); let visibleGlows = 0, projectedVertices = 0;
      model.group.traverseVisible(object => {
        if (!object.isMesh) return;
        box.union(new THREE.Box3().setFromObject(object));
        if (object.material.isShaderMaterial) visibleGlows++;
        const positions = object.geometry.attributes.position;
        const instanceMatrix = new THREE.Matrix4(), worldMatrix = new THREE.Matrix4();
        for (let instance = 0; instance < (object.isInstancedMesh ? object.count : 1); instance++) {
          if (object.isInstancedMesh) {
            object.getMatrixAt(instance, instanceMatrix); worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
          } else worldMatrix.copy(object.matrixWorld);
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(worldMatrix);
            for (const { camera, viewport, label } of frames) {
              const projected = point.clone().project(camera);
              assert.ok(projected.toArray().every(Number.isFinite), `${label} / angle ${angle} : projection non finie`);
              assert.ok(projected.x >= viewport.left - 1e-6 && projected.x <= viewport.right + 1e-6, `${label} / angle ${angle} : ${object.name} hors largeur utile`);
              assert.ok(projected.y >= viewport.bottom - 1e-6 && projected.y <= viewport.top + 1e-6, `${label} / angle ${angle} : ${object.name} hors hauteur utile`);
              assert.ok(projected.z > -1 && projected.z < 1, `${label} / angle ${angle} : ${object.name} hors profondeur visible`);
              projectedVertices++;
            }
          }
        }
      });
      assert.ok(projectedVertices > 0, `${focus} : les sommets réels doivent être projetés`);
      assert.ok(visibleGlows > 0, `${focus} : les effets doivent participer au volume cadré`);
      assert.equal(model.groups.capFront.visible, !compact);
      assert.equal(model.groups.capRear.visible, !compact);
      if (compact) assert.ok(box.max.z < 1, `${focus} : la flasque éloignée masquée ne doit pas agrandir le cadrage`);
      else assert.ok(box.max.z > 1.8, 'Le démontage conserve les flasques et le rotor séparés.');
    }
  }
});
