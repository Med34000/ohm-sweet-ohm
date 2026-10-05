import * as THREE from 'three';
import { OrbitControls } from '../libs/OrbitControls.js';
import { createGLTFLoader } from './models/gltf-loader.js';
import { createElectricDrivetrain } from './models/electric-drivetrain.js';
import { createVehicleShell } from './models/vehicle-shell.js';
import { createTeachingBattery } from './models/teaching-battery.js';
import { createTeachingMotor } from './models/teaching-motor.js?v=20260930-4';
import { createTeachingPower } from './models/teaching-power.js?v=20260930-6';
import { loadSignatureBody } from './models/signature-body.js';
import { createStudioEnvironment } from './visuals/studio-environment.js';
import { ELECTRIC_VEHICLE_LAYOUT as LAYOUT } from './data/vehicle-layout.js';
import { applyTechnicalMaterials } from './visuals/technical-materials.js';
import { createTechnicalOverview } from './visuals/technical-overview.js?v=20260930-5';
import { createEnergyCurrent, hologramMaterial } from './visuals/energy-current.js?v=20260930-6';
import { createAdaptiveQuality } from './visuals/adaptive-quality.js';
import { mergeHologramGeometry } from './visuals/merged-hologram.js';
import { createAmbience } from './visuals/ambience.js?v=20260930-5';
const assemblyDirection = new THREE.Vector3(-.72, .48, .78).normalize();

// 2026-09-30 ≈19:15 (Europe/Zurich) — Codex / OpenAI : chargeur détaillé, borne Ohm Sweet Ohm et flux réels.
// Les marges sont exprimées dans le repère projeté du canvas, indépendamment du format d’écran.
export function fitCameraPoints(points, { center, direction, aspect, fov = 35, viewport = { left: -1, right: 1, bottom: -1, top: 1 }, minDistance = 2.6, margin = 1.08 } = {}) {
  const facing = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), facing);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();
  const up = new THREE.Vector3().crossVectors(facing, right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const horizontal = tangent * Math.max(aspect, .1);
  const middleX = (viewport.left + viewport.right) / 2, middleY = (viewport.bottom + viewport.top) / 2;
  let distance = minDistance;
  for (const point of points) {
    const offset = point.clone().sub(center);
    const x = offset.dot(right) / horizontal, y = offset.dot(up) / tangent, z = offset.dot(facing);
    distance = Math.max(distance,
      (x + viewport.right * z) / (viewport.right - middleX),
      (-x - viewport.left * z) / (middleX - viewport.left),
      (y + viewport.top * z) / (viewport.top - middleY),
      (-y - viewport.bottom * z) / (middleY - viewport.bottom));
  }
  distance *= margin;
  const target = center.clone().addScaledVector(right, -middleX * horizontal * distance).addScaledVector(up, -middleY * tangent * distance);
  return { target, position: target.clone().addScaledVector(facing, distance), distance };
}

export async function createVehicleScene(host, { onSelect = () => {}, reducedMotion = false } = {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const basePixelRatio = Math.min(devicePixelRatio, innerWidth < 760 ? 1.4 : 1.8);
  renderer.setPixelRatio(basePixelRatio);
  // Qualité adaptative : la résolution de rendu baisse par paliers si l’appareil rame (et remonte s’il est à l’aise).
  const quality = createAdaptiveQuality({ onChange: scale => { renderer.setPixelRatio(basePixelRatio * scale); renderer.setSize(host.clientWidth, host.clientHeight); } });
  let lastFrameAt = 0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = innerWidth > 760;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Voiture en 3D. Glisser pour tourner. Flèches pour déplacer. Touches plus et moins pour zoomer.');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.075;
  controls.minDistance = 2.6;
  controls.maxDistance = 130;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.listenToKeyEvents(renderer.domElement);
  scene.environment = createStudioEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  scene.add(new THREE.HemisphereLight(0xf7f8ff, 0xaaa9a2, 1.05));
  const key = new THREE.DirectionalLight(0xfff8f0, 2.1);
  key.position.set(-4, 9, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.normalBias = 0.009; key.shadow.bias = -0.00008;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  key.shadow.camera.updateProjectionMatrix(); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd8e5ff, 2.6); rim.position.set(5, 4, -6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xd4e0f4, 1.2); fill.position.set(-7, 2, -3); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x293139, opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.015; floor.receiveShadow = true; scene.add(floor);
  const groundCanvas = document.createElement('canvas'); groundCanvas.width = 128; groundCanvas.height = 128;
  const ctx = groundCanvas.getContext('2d'); const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,.6)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(groundCanvas), transparent: true, depthWrite: false, opacity: 0.6 }));
  groundShadow.rotation.x = -Math.PI / 2; groundShadow.position.y = 0.003; scene.add(groundShadow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.65, 5.658, 120), new THREE.MeshBasicMaterial({ color: 0x86918d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);

  const drivetrain = createElectricDrivetrain();
  drivetrain.group.position.y = -LAYOUT.groundY;
  scene.add(drivetrain.group);
  const shell = createVehicleShell(); drivetrain.group.add(shell.group);
  // Replace the three legacy teaching volumes and their old cable routes as one system.
  const retired = new Set(['battery', 'inverter', 'motor', 'hv-bus']);
  for (const child of [...drivetrain.group.children]) {
    if (retired.has(child.userData.component) && !child.userData.semanticHitTarget) drivetrain.group.remove(child);
  }
  // The Blender drive unit already includes the reducer envelope.
  const oldReducerShell = drivetrain.group.getObjectByName('Carter du réducteur en coupe');
  oldReducerShell?.removeFromParent();
  // Les ressources sont indépendantes : lancer leur téléchargement ensemble, sans attendre le moteur.
  const silhouetteReady = loadSignatureBody({ fallbackShell: shell, drivetrain });
  const chargerReady = createGLTFLoader().loadAsync('assets/web/elan-charger.glb?v=20260930-6').catch(() => null);
  const battery = createTeachingBattery();
  battery.group.position.set(...LAYOUT.battery.center);
  const motor = createTeachingMotor();
  await motor.loadDetailedModel().catch(error => {
    console.warn('Détail du moteur indisponible : la maquette simplifiée reste accessible.', error.message);
  });
  motor.group.position.set(...LAYOUT.motor.center);
  const powertrain = createTeachingPower();
  drivetrain.group.add(battery.group, motor.group, powertrain.group);
  const overview = createTechnicalOverview({ battery, motor, powertrain, drivetrain });
  applyTechnicalMaterials([battery.group, motor.group, powertrain.group]);
  const technicalMeshes = [];
  [battery.group, motor.group, powertrain.group, overview.group].forEach(root => root.traverse(o => {
    if (o.isMesh) {
      technicalMeshes.push(o);
      // Cast only larger surfaces: thousands of cells use their shared shading.
      const annotation = o.userData.illustrativeAnnotation || o.material.isShaderMaterial || o.material.isMeshBasicMaterial;
      o.castShadow = !o.isInstancedMesh && !annotation && root !== overview.group;
      o.receiveShadow = !annotation;
    }
  }));
  const technicalBounds = {}, technicalPoints = {}, motorFocusPoints = {};
  function meshCorners(root) {
    const points = [];
    root.traverseVisible(node => {
      if (!node.isMesh) return;
      const box = new THREE.Box3().setFromObject(node);
      for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z])
        points.push(new THREE.Vector3(x,y,z));
    });
    return points;
  }
  const rememberBounds = suffix => {
    scene.updateMatrixWorld(true);
    technicalBounds[`battery${suffix}`] = new THREE.Box3().setFromObject(battery.group);
    technicalBounds[`bms${suffix}`] = new THREE.Box3().setFromObject(battery.focusGroups.bms);
    technicalBounds[`motor${suffix}`] = new THREE.Box3().setFromObject(motor.group);
    technicalBounds[`inverter${suffix}`] = new THREE.Box3().setFromObject(powertrain.groups.inverter);
    technicalBounds[`charger${suffix}`] = new THREE.Box3().setFromObject(powertrain.groups.charger);
    for (const [name, root] of Object.entries({battery:battery.group, bms:battery.focusGroups.bms,
      motor:motor.group, inverter:powertrain.groups.inverter, charger:powertrain.groups.charger})) {
      technicalPoints[name + suffix] = meshCorners(root);
    }
    technicalBounds[`hv${suffix}`] = new THREE.Box3().setFromObject(powertrain.group).union(new THREE.Box3().setFromObject(battery.group)).union(new THREE.Box3().setFromObject(motor.group));
  };
  rememberBounds('');
  battery.setFrame({ opened: true, progress: 1, focus: 'cooling' });
  motor.setFrame({ opened: true, progress: 1 });
  powertrain.setFrame({ opened: true, progress: 1, focus: 'hv' });
  rememberBounds('Open');
  // Chaque révélation dispose de son cadrage : cœur compact pour le champ,
  // pièces écartées pour le rotor et la transmission. Les effets font partie du cadre.
  for (const focus of ['stator', 'field', 'rotor', 'shaft', 'generator']) {
    motor.setFrame({ opened: true, progress: 1, focus, power: .55, mode: focus === 'generator' ? 'regen' : 'drive', running: false, time: 0 });
    scene.updateMatrixWorld(true);
    motorFocusPoints[focus] = meshCorners(motor.group);
  }
  overview.setProgress(1);
  const overviewBounds = overview.bounds();
  const overviewPoints = [];
  // Fit actual component extents rather than the empty corners of their union.
  [battery.group, motor.group, powertrain.groups.inverter, powertrain.groups.charger, overview.group].forEach(root => root.traverse(node => {
    if (!node.isMesh || !node.visible) return;
    const box = new THREE.Box3().setFromObject(node);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) overviewPoints.push(new THREE.Vector3(x, y, z));
  }));
  overview.setProgress(0);
  battery.setFrame({ opened: false }); motor.setFrame({ opened: false }); powertrain.setFrame({ opened: false });
  // Mode Courant : trajet lumineux de l’énergie, carrosserie en hologramme, studio assombri.
  const current = createEnergyCurrent({ host });
  drivetrain.group.add(current.group);
  const ambience = createAmbience(); scene.add(ambience.group);
  let backdropTarget = 0, backdropK = 0;
  const legacyPulses = [];
  powertrain.groups.hv.traverse(object => { if (object.isInstancedMesh && object.name === 'Sens du transfert d’énergie') legacyPulses.push(object); });
  const ghostMaterial = hologramMaterial();
  let ghost = null, currentOn = false, currentK = 0, sweepStart = -1e9;
  const lightBase = [[key, key.intensity], [rim, rim.intensity], [fill, fill.intensity]];
  const hemisphere = scene.children.find(object => object.isHemisphereLight), hemisphereBase = hemisphere?.intensity ?? 1;
  let body = null, lessonFocus = 'overview', opening = 1, openProgress = 0;
  let explosion = 0, targetExplosion = 0, selectedPiece = null, cameraPreset = 'overview';
  const assetCategories = new Set(['wheel']);
  const isAssetSelection = () => assetCategories.has(selection);
  let selection = null, inside = false, reveal = 0, targetReveal = 0, cameraMoving = true, loaded = false;
  // Entrée cinématographique et présentation au repos (désactivées si mouvements réduits).
  let introUntil = 0, lastInteraction = performance.now(), framingScale = 1;
  const markInteraction = () => { lastInteraction = performance.now(); };
  const bodyMaterials = [];
  let paintColor = 0x374252;
  const isolatedVisibility = new Map();
  const hiddenUnderBody = new Map();
  function restoreUnderBody() { hiddenUnderBody.forEach((visible, child) => { child.visible = visible; }); hiddenUnderBody.clear(); }
  function restoreIsolation() { isolatedVisibility.forEach((visible, child) => { child.visible = visible; }); isolatedVisibility.clear(); }
  const cameraTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  const point = new THREE.Vector3();
  const ready = Promise.all([silhouetteReady, chargerReady]).then(([silhouette, chargerAsset]) => {
    if (chargerAsset) {
      const charger = drivetrain.group.getObjectByName('Borne de recharge');
      charger.children[0].visible = false; charger.children[1].visible = false;
      chargerAsset.scene.position.set(LAYOUT.chargePort.center[0] + 0.6, LAYOUT.groundY, LAYOUT.chargePort.center[2] + 1.7);
      chargerAsset.scene.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
      charger.add(chargerAsset.scene);
    }
    body = silhouette;
    if (body.group) {
      drivetrain.group.add(body.group);
      body.group.traverse(object => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (/Paint/.test(material.name)) { material.color.setHex(paintColor); material.metalness = 0.68; material.roughness = 0.22; material.clearcoat = 1; material.clearcoatRoughness = 0.04; }
          if (/Accent/.test(material.name)) { material.color.setHex(0xb8d690); material.metalness = 0.55; }
          if (/Glass/.test(material.name)) { material.color.setHex(0x15212e); material.opacity = 1; material.transparent = false; material.clearcoat = .5; material.clearcoatRoughness = .035; }
          if (/Headlights/.test(material.name)) { material.color.setHex(0xeaf6ff); material.emissive.setHex(0xcde8ff); material.emissiveIntensity = 1.5; }
          if (!bodyMaterials.some(s => s.material === material)) bodyMaterials.push({ material, baseOpacity: material.opacity, transparent: material.transparent });
        });
      });

    }
    if (body.group) {
      // Double « hologramme » : mêmes géométries, sans l’habitacle, pour garder la silhouette lisible.
      ghost = body.group.clone(true);
      ghost.name = 'Carrosserie hologramme — mode Courant';
      const drop = [];
      ghost.traverse(object => {
        if (!object.isMesh) return;
        if (object.userData.category === 'cabin') { drop.push(object); return; }
        object.material = ghostMaterial; object.castShadow = false; object.receiveShadow = false; object.renderOrder = 10;
      });
      drop.forEach(object => object.removeFromParent());
      // Une seule géométrie pour toute la silhouette : mêmes triangles, une centaine d’appels de rendu en moins.
      const merged = mergeHologramGeometry(ghost);
      if (merged) {
        ghost.clear();
        const silhouette = new THREE.Mesh(merged.geometry, ghostMaterial);
        silhouette.name = 'Silhouette hologramme'; silhouette.renderOrder = 10; silhouette.frustumCulled = false;
        silhouette.castShadow = false; silhouette.receiveShadow = false;
        ghost.add(silhouette);
      }
      ghost.userData = { component: 'vehicle-hologram', contextOnly: true };
      ghost.visible = false;
      drivetrain.group.add(ghost);
    }
    loaded = true; applyPresentation(); frameSelection(true);
    if (!reducedMotion) {
      // La caméra part d’un angle bas et éloigné puis glisse vers la vue trois quarts.
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -1.1).multiplyScalar(1.3); offset.y *= .4;
      camera.position.copy(controls.target).add(offset); controls.update();
      cameraMoving = true; introUntil = performance.now() + 2600; markInteraction();
    }
    return { technical: true, body: Boolean(body.group) };
  });

  function frameSelection(immediate = false) {
    const narrow = host.clientWidth / Math.max(host.clientHeight, 1) < 1.1;
    const mobile = innerWidth < 760;
    const app = host.closest('.app');
    const story = app?.classList.contains('story-mode') || (backdropTarget > 0 && !app?.classList.contains('has-study'));
    const motorStudy = inside && selection === 'motor' && host.closest('.app')?.classList.contains('motor-lab');
    // 2026-09-30 (Europe/Zurich) — Codex / OpenAI : les gros plans ouverts utilisent toute la hauteur, la légende restant hors du canvas.
    // Les autres plans du récit gardent le fondu ; sur téléphone, le courant réserve la place des étiquettes et de la légende.
    const viewport = { left: -1, right: 1, bottom: -1, top: 1 };
    if (story || motorStudy || (mobile && currentOn)) {
      const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
      const horizontal = Math.min(mobile ? 18 : 24, width * .12);
      const top = motorStudy ? Math.min(58, height * .2) : story ? Math.min(18, height * .14) : Math.min(64, height * .16);
      const bottom = motorStudy ? Math.min(16, height * .08) : story ? (selection && inside ? Math.min(18, height * .14) : height * .24) : Math.min(82, height * .23);
      viewport.left += horizontal / width * 2; viewport.right -= horizontal / width * 2;
      viewport.top -= top / height * 2; viewport.bottom += bottom / height * 2;
    }
    if (isAssetSelection() && body?.wheels.length) {
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3();
      body.wheels.filter(w => !selectedPiece || w.assembly.userData.wheelId === selectedPiece).forEach(w => box.expandByObject(w.assembly));
      const size = box.getSize(new THREE.Vector3());
      box.getCenter(lookTarget);
      const distance = Math.max(size.y, size.x / Math.max(camera.aspect * .72, .35), size.z, 1.2) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.55;
      cameraTarget.copy(lookTarget).addScaledVector(assemblyDirection, distance);
    } else if (selection) {
      const focusedMotor = selection === 'motor' && inside ? motorFocusPoints[lessonFocus] : null;
      const box = focusedMotor?.length ? new THREE.Box3().setFromPoints(focusedMotor) : technicalBounds[selection + (inside && selection !== 'hv' ? 'Open' : '')];
      if (box) {
        box.getCenter(lookTarget);
        const compactMotor = selection === 'motor' && ['stator', 'field', 'generator'].includes(lessonFocus);
        const direction = compactMotor ? new THREE.Vector3(-.45, .40, 1.65).normalize() : ['battery', 'bms', 'hv'].includes(selection) ? new THREE.Vector3(-.7, story ? 1.65 : 1.25, 1.25).normalize() : ['inverter','charger'].includes(selection) ? new THREE.Vector3(-1, 1.8, 1.1).normalize() : new THREE.Vector3(story ? -.72 : -1.2, story ? .54 : .75, story ? 1.35 : 1).normalize();
        const corners = focusedMotor?.length ? focusedMotor : technicalPoints[selection + (inside && selection !== 'hv' ? 'Open' : '')]
          || [box.min,box.max].flatMap(a => [box.min,box.max].flatMap(b => [box.min,box.max].map(c => new THREE.Vector3(a.x,b.y,c.z))));
        const framed = fitCameraPoints(corners, { center: lookTarget, direction, aspect: camera.aspect, fov: camera.fov, viewport, margin: story ? 1.06 : 1.13 });
        lookTarget.copy(framed.target); cameraTarget.copy(framed.position);
      } else {
        const focus = selection === 'chargePort' ? LAYOUT.chargePort.center : LAYOUT.reducer.center;
        lookTarget.set(...focus).add(drivetrain.group.position);
        cameraTarget.copy(lookTarget).add(new THREE.Vector3(1.4, 2.8, 4.3));
      }
    } else {
      lookTarget.set(0, 1.0, 0);
      let distance = Math.max(13.5, 16.4 / Math.max(camera.aspect, .3));
      const technical = THREE.MathUtils.smoothstep(targetExplosion, .45, 1);
      // La vue du dessus respecte la limite OrbitControls, sans correction du cadrage à chaque image.
      const direction = (cameraPreset === 'front' ? new THREE.Vector3(-1, .22, .001) : cameraPreset === 'side' ? new THREE.Vector3(0, .13, 1) : cameraPreset === 'top' ? new THREE.Vector3(-1, Math.SQRT2 / Math.tan(controls.minPolarAngle), 1) : assemblyDirection.clone()).normalize();
      if (technical > 0) {
        const center = overviewBounds.getCenter(new THREE.Vector3());
        lookTarget.lerp(center, technical);
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
        const up = new THREE.Vector3().crossVectors(direction, right).normalize();
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        let full = 0;
        for (const position of overviewPoints) {
          const offset = position.clone().sub(center);
          full = Math.max(full, offset.dot(direction) + Math.max(Math.abs(offset.dot(up)) / tangent, Math.abs(offset.dot(right)) / (tangent * camera.aspect)));
        }
        distance = THREE.MathUtils.lerp(distance, full * 1.12, technical);
      }
      // Mode Courant : cadrage plus serré, centré sur la chaîne d’énergie.
      if (currentOn && technical === 0 && !narrow) { lookTarget.x += .35; lookTarget.y -= .45; distance *= .86; }
      // Recul supplémentaire demandé par l’Histoire (plein écran) : voiture entière et borne dans le cadre.
      if (technical === 0) distance *= (narrow ? 1 + (framingScale - 1) * .4 : framingScale) * (cameraPreset === 'side' && framingScale > 1 ? .8 : 1);
      cameraTarget.copy(lookTarget).addScaledVector(direction.clone().normalize(), distance);
      if ((mobile && currentOn || story) && technical === 0 && body?.group) {
        scene.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(body.group);
        body.wheels.forEach(wheel => bounds.expandByObject(wheel.assembly));
        const charger = drivetrain.group.getObjectByName('Borne de recharge');
        if (charger?.visible) bounds.expandByObject(charger);
        const center = bounds.getCenter(new THREE.Vector3());
        const corners = [bounds.min, bounds.max].flatMap(a => [bounds.min, bounds.max].flatMap(b => [bounds.min, bounds.max].map(c => new THREE.Vector3(a.x, b.y, c.z))));
        const framed = fitCameraPoints(corners, { center, direction, aspect: camera.aspect, fov: camera.fov, viewport, minDistance: 10, margin: story ? 1.10 : 1.06 });
        lookTarget.copy(framed.target); cameraTarget.copy(framed.position);
      }
    }
    cameraMoving = true;
    if (immediate || reducedMotion) { camera.position.copy(cameraTarget); controls.target.copy(lookTarget); controls.update(); cameraMoving = false; }
  }
  function applyPresentation() {
    const presentation = inside && ['reduction', 'inverter'].includes(selection) ? 'exploded' : selection || targetReveal > 0.3 || targetExplosion > .05 ? 'cutaway' : 'assembled';
    shell.setPresentation(presentation, { immediate: reducedMotion });
    shell.setFocus(selection || 'overview', { immediate: reducedMotion });
    drivetrain.setSelection(null);
  }
  function setStudy({ focus = lessonFocus, progress = opening } = {}) {
    const changed = focus !== lessonFocus;
    lessonFocus = focus; opening = THREE.MathUtils.clamp(progress, 0, 1);
    if (changed && inside && selection === 'motor') frameSelection();
  }

  function setView({ component = selection, opened = inside, xray = targetReveal > 0.3, frame = true, piece = null } = {}) {
    markInteraction();
    restoreUnderBody(); restoreIsolation();
    selection = component; inside = opened; selectedPiece = piece;
    battery.setFocusVisibility(selection === 'bms' && inside ? 'bms' : null);
    hoverLabel.hidden = true;
    targetReveal = isAssetSelection() ? 0 : selection ? 1 : xray ? 0.9 : 0;
    applyPresentation();
    if (frame) frameSelection();
  }
  function setExplosion(value) {
    targetExplosion = THREE.MathUtils.clamp(value, 0, 1); cameraPreset = 'overview'; markInteraction();
    if (!selection) targetReveal = 0;
    restoreUnderBody(); restoreIsolation(); applyPresentation(); frameSelection();
  }
  function setCurrent(on) {
    if (on && !currentOn) sweepStart = performance.now();
    currentOn = Boolean(on); markInteraction(); frameSelection();
  }
  function setFraming(scale) { framingScale = THREE.MathUtils.clamp(Number(scale) || 1, .6, 2); markInteraction(); frameSelection(); }
  function setCamera(preset) { cameraPreset = preset; markInteraction(); frameSelection(); }
  controls.addEventListener('start', () => { cameraMoving = false; introUntil = 0; controls.autoRotate = false; markInteraction(); });
  renderer.domElement.addEventListener('keydown', event => {
    markInteraction();
    if (event.key.startsWith('Arrow')) cameraMoving = false;
    if (!['+', '=', '-'].includes(event.key)) return;
    event.preventDefault(); cameraMoving = false;
    const offset = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * (event.key === '-' ? 1.12 : 0.88), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(distance)); controls.update();
  });
  let pointerStart = null;
  const activePointers = new Set();
  const hoverLabel = document.createElement('div'); hoverLabel.className = 'piece-tooltip'; hoverLabel.hidden = true; host.append(hoverLabel);
  const pointerRay = new THREE.Raycaster();
  let lastHover = 0;
  function rayAt(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointerRay.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
    return pointerRay;
  }
  const visible = object => { let p = object; while (p) { if (!p.visible) return false; if (p === scene) return true; p = p.parent; } return false; };
  function pickComponent(ray) {
    const wheels = body?.wheels.flatMap(w => { const meshes = []; w.assembly.traverse(o => { if (o.isMesh && visible(o)) meshes.push(o); }); return meshes; }) || [];
    const meshes = [...wheels, ...technicalMeshes.filter(visible)];
    const hit = ray.intersectObjects(meshes, false)[0];
    // An opaque body occludes hidden organs; its decorative surfaces have no actions.
    if (body?.group.visible && reveal < .4) {
      const cover = ray.intersectObject(body.group, true)[0];
      if (cover && (!hit || cover.distance < hit.distance)) return null;
    }
    if (hit) {
      const data = hit.object.userData;
      return { component: data.component || 'hv', id: data.wheelId || null, label: data.component === 'wheel' ? data.label : null, hover: data.label || hit.object.name };
    }
    if (reveal < .4) return null;
    const legacy = ray.intersectObjects(drivetrain.getHitTargets(inside ? 'exploded' : 'assembled').filter(t => visible(t) && ['charge-port', 'reduction', 'differential'].includes(t.userData.component)), false)[0];
    return legacy ? { component: legacy.object.userData.component, hover: legacy.object.userData.component === 'charge-port' ? 'Prise de charge' : 'Transmission' } : null;
  }
  renderer.domElement.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || activePointers.size || performance.now() - lastHover < 90) return;
    lastHover = performance.now();
    const hit = pickComponent(rayAt(event));
    hoverLabel.hidden = !hit;
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    if (hit) { hoverLabel.textContent = `${hit.label || hit.hover} ↗`; hoverLabel.style.left = `${Math.max(12, Math.min(innerWidth - 220, event.clientX + 14))}px`; hoverLabel.style.top = `${event.clientY + 18}px`; }
  });
  renderer.domElement.addEventListener('pointerleave', () => { hoverLabel.hidden = true; });
  renderer.domElement.addEventListener('pointerdown', event => { activePointers.add(event.pointerId); pointerStart = activePointers.size === 1 ? { x: event.clientX, y: event.clientY } : null; });
  renderer.domElement.addEventListener('pointerup', event => {
    const click = pointerStart && activePointers.size === 1 && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 7;
    activePointers.delete(event.pointerId); pointerStart = null;
    hoverLabel.hidden = true;
    if (!click) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
    const hit = pickComponent(ray);
    if (hit) onSelect(hit.component, hit);
  });
  renderer.domElement.addEventListener('pointercancel', event => { activePointers.delete(event.pointerId); pointerStart = null; });
  const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1); camera.updateProjectionMatrix(); frameSelection(true); };
  new ResizeObserver(resize).observe(host);
  resize(); frameSelection(true);

  function render(dt, frame) {
    const { time, running, phase, power, rotorAngle, motion, charging, recovering, connected = false, tractionActive = false, soc = .62, demoAngle = 0, demoRunning = false, idleAllowed = false, speed = 0 } = frame;
    const currentTarget = currentOn && loaded && !selection && !inside && targetExplosion < .5 ? 1 : 0;
    currentK = reducedMotion ? currentTarget : THREE.MathUtils.damp(currentK, currentTarget, 3.2, dt);
    explosion = reducedMotion ? targetExplosion : THREE.MathUtils.damp(explosion, targetExplosion, 5, dt);
    drivetrain.setFrame(time, power, running, phase, rotorAngle);
    const active = phase === 'charge' ? charging : phase === 'brake' ? recovering : tractionActive;
    const demonstrating = inside && selection === 'motor';
    const technicalOpen = !selection ? THREE.MathUtils.smoothstep(explosion, .45, 1) : 0;
    openProgress = reducedMotion ? (inside ? opening : 0) : THREE.MathUtils.damp(openProgress, inside ? opening : 0, 6, dt);
    motor.setFrame({ time, rotorAngle: demonstrating ? demoAngle : rotorAngle, running: demonstrating ? demoRunning && running : running && motion, power: demonstrating ? .55 : active ? power : 0, mode: demonstrating ? lessonFocus === 'generator' ? 'regen' : 'drive' : phase === 'brake' ? 'regen' : phase === 'charge' ? 'charge' : 'drive', opened: (inside && selection === 'motor') || technicalOpen > 0, progress: technicalOpen || openProgress, focus: lessonFocus });
    battery.setFrame({ time, soc, running, power: active ? power : 0, mode: phase === 'brake' ? 'regen' : phase === 'charge' ? 'charge' : 'drive', opened: (inside && ['battery', 'bms'].includes(selection)) || technicalOpen > 0, progress: technicalOpen || openProgress, focus: selection === 'bms' ? 'bms' : technicalOpen ? 'cooling' : lessonFocus });
    powertrain.setFrame({ time, dt, running, power: active ? power : 0, mode: phase === 'brake' ? 'regen' : phase === 'charge' ? 'charge' : 'drive', connected, charging, recovering, opened: (inside && ['inverter', 'charger', 'hv'].includes(selection)) || technicalOpen > 0, focus: technicalOpen ? 'hv' : selection === 'hv' ? lessonFocus : selection, progress: technicalOpen || openProgress });
    overview.setProgress(technicalOpen);
    if (technicalOpen > 0) overview.setFrame({ time, dt, running, power: active ? power : 0, mode: phase === 'brake' ? 'regen' : phase === 'charge' ? 'charge' : 'drive', connected, charging, recovering });
    // La borne reste visible débranchée pour montrer où commence le parcours.
    const charger = drivetrain.group.getObjectByName('Borne de recharge');
    if (charger) { charger.visible = phase === 'charge' && explosion < .1 && !isAssetSelection(); charger.children[2].visible = connected; }
    const requestedReveal = Math.max(targetReveal, selection ? 0 : THREE.MathUtils.smoothstep(targetExplosion, 0, .4), currentK > .02 ? 1 : 0);
    reveal = reducedMotion ? requestedReveal : THREE.MathUtils.lerp(reveal, requestedReveal, 1 - Math.exp(-dt * 5));
    if (body?.group) {
      body.group.visible = reveal < 0.997;
      bodyMaterials.forEach(({ material, baseOpacity, transparent }) => {
        const needsTransparency = reveal > 0.02 || transparent;
        if (material.transparent !== needsTransparency) { material.transparent = needsTransparency; material.needsUpdate = true; }
        material.opacity = baseOpacity * Math.pow(1 - reveal, 1.5);
        material.depthWrite = reveal < 0.02;
      });
      shell.group.visible = reveal > 0.02;
      shell.group.traverse(object => { if (object.isLineSegments) object.visible = false; });
    }
    shell.update(reducedMotion ? 100 : dt, time);
    if (body?.group) shell.group.visible = false;
    if (reveal >= 0.015 || selection || explosion > .015) restoreUnderBody();
    // Sous une carrosserie opaque, éviter de dessiner les pièces entièrement cachées.
    if (body?.group && reveal < 0.015 && !selection && explosion < .015) {
      for (const child of drivetrain.group.children) {
        const internal = child === powertrain.group || ['battery', 'inverter', 'motor', 'reduction', 'differential', 'hv-bus', 'subframe', 'axle', 'charge-port'].includes(child.userData.component);
        if (!internal) continue;
        if (!hiddenUnderBody.has(child)) hiddenUnderBody.set(child, child.visible);
        child.visible = false;
      }
    }
    if (inside && isAssetSelection()) {
      if (!isolatedVisibility.size) drivetrain.group.children.forEach(child => isolatedVisibility.set(child, child.visible));
      drivetrain.group.children.forEach(child => { child.visible = body?.wheels.some(w => w.assembly === child && (!selectedPiece || w.assembly.userData.wheelId === selectedPiece)); });
    } else if (!inside && isolatedVisibility.size) restoreIsolation();
    if (!inside) {
      for (const child of drivetrain.group.children) {
        if (body?.wheels.some(w => w.assembly === child)) child.visible = technicalOpen < .12;
        if (['reduction', 'differential', 'axle', 'subframe'].includes(child.userData.component)) child.visible = technicalOpen < .12 && (reveal >= .015 || Boolean(selection));
      }
    }
    floor.visible = explosion < .7;
    ring.visible = explosion < .08 && !selection;
    floor.material.opacity = inside ? 0.095 : 0.18;
    groundShadow.visible = explosion < .65 && !inside;
    groundShadow.material.opacity = .36 * (1 - explosion);
    if (inside && !isAssetSelection()) {
      if (!isolatedVisibility.size) drivetrain.group.children.forEach(child => isolatedVisibility.set(child, child.visible));
      drivetrain.group.children.forEach(child => {
        const component = child.userData.component;
        child.visible = selection === 'battery' ? child === battery.group || child === powertrain.group
          : selection === 'bms' ? child === battery.group
          : selection === 'motor' ? child === motor.group
          : selection === 'reduction' ? ['reduction', 'differential', 'axle'].includes(component)
          : selection === 'hv' ? [battery.group, motor.group, powertrain.group].includes(child)
          : ['inverter', 'charger'].includes(selection) ? child === powertrain.group : component === 'charge-port';
      });
      if (['inverter', 'charger', 'battery'].includes(selection)) {
        for (const [key, group] of Object.entries(powertrain.groups)) group.visible = key === (selection === 'battery' ? 'charger' : selection);
      }
    } else {
      powertrain.groups.inverter.visible = true; powertrain.groups.charger.visible = true;
    }
    if (cameraMoving) {
      const alpha = reducedMotion ? 1 : 1 - Math.exp(-dt * (performance.now() < introUntil ? 1.5 : 4.5));
      camera.position.lerp(cameraTarget, alpha); controls.target.lerp(lookTarget, alpha);
      if (camera.position.distanceToSquared(cameraTarget) < 0.0001) cameraMoving = false;
    }
    // Mode Courant : lumières baissées, hologramme, trajet animé, anciennes flèches masquées.
    lightBase.forEach(([light, base]) => { light.intensity = base * (1 - .78 * currentK); });
    if (hemisphere) hemisphere.intensity = hemisphereBase * (1 - .72 * currentK);
    scene.environmentIntensity = .9 * (1 - .74 * currentK);
    renderer.toneMappingExposure = .92 * (1 - .28 * currentK);
    ring.visible = ring.visible && currentK < .5;
    if (ghost) {
      ghost.visible = currentK > .01;
      ghostMaterial.uniforms.uOpacity.value = currentK; ghostMaterial.uniforms.uTime.value = time;
      // Balayage lumineux de l’avant vers l’arrière à l’activation.
      ghostMaterial.uniforms.uSweep.value = reducedMotion ? 99 : -6 + (performance.now() - sweepStart) / 1500 * 12;
    }
    if (currentK > .3) legacyPulses.forEach(object => { object.visible = false; });
    backdropK += (backdropTarget - backdropK) * Math.min(1, (reducedMotion ? 1 : dt * 2.5));
    ambience.update({ dt: reducedMotion ? 0 : dt, visibility: currentK, backdrop: backdropK, running, pixelRatio: renderer.getPixelRatio(), speed,
      route: phase === 'charge' ? 'charge' : phase === 'brake' || recovering ? 'regen' : 'drive',
      active: phase === 'charge' ? charging : phase === 'brake' || recovering ? recovering : tractionActive,
      power: active ? power : 0 });
    const rearWheel = body?.wheels.find(w => w.assembly.position.x > 0);
    current.update({ dt: reducedMotion ? 0 : dt, running, route: phase === 'charge' ? 'charge' : phase === 'brake' || recovering ? 'regen' : 'drive',
      active: phase === 'charge' ? charging : phase === 'brake' || recovering ? recovering : tractionActive,
      power: active ? power : 0, soc,
      visibility: currentK, camera, renderer, wheelAngle: rearWheel?.rotating.rotation.z ?? 0 });
    // Au repos, la voiture tourne lentement comme sur un plateau d’exposition.
    controls.autoRotate = !reducedMotion && idleAllowed && running && loaded && !selection && !inside && targetExplosion < .05
      && !cameraMoving && !activePointers.size && performance.now() - lastInteraction > 8000;
    controls.autoRotateSpeed = .9;
    // Mode Courant : le studio est sombre, les ombres portées ne se voient plus : on ne les recalcule pas.
    const wantShadowUpdate = currentK < .3;
    if (renderer.shadowMap.autoUpdate !== wantShadowUpdate) { renderer.shadowMap.autoUpdate = wantShadowUpdate; if (wantShadowUpdate) renderer.shadowMap.needsUpdate = true; }
    controls.update(dt); renderer.render(scene, camera);
    const frameAt = performance.now(); if (lastFrameAt) quality.frame(frameAt - lastFrameAt); lastFrameAt = frameAt;
  }
  function setPaint(color) {
    paintColor = color;
    bodyMaterials.forEach(({ material }) => { if (/Paint/.test(material.name)) material.color.setHex(color); });
  }
  function projectPart(part) {
    const batteryKeys = new Set(['cells', 'modules', 'bms', 'cooling', 'contactors', 'sensing', 'fuse']);
    const motorKeys = new Set(['stator', 'rotor', 'shaft', 'phases', 'field']);
    const source = batteryKeys.has(part) ? battery : motorKeys.has(part) ? motor : null;
    if (source?.anchors[part]) {
      const anchor = source.anchors[part];
      if (anchor.isObject3D) anchor.getWorldPosition(point);
      else { point.copy(anchor); source.group.localToWorld(point); }
    } else if (part === 'battery' || part === 'motor') {
      (part === 'battery' ? battery.group : motor.group).getWorldPosition(point);
    } else if (powertrain.anchors[part]) {
      const anchor = powertrain.anchors[part];
      if (anchor.isObject3D) anchor.getWorldPosition(point);
      else { point.copy(anchor); (powertrain.groups[part] || powertrain.group).localToWorld(point); }
    } else {
      const position = part === 'battery' ? LAYOUT.battery.center : part === 'motor' ? LAYOUT.motor.center : part === 'inverter' ? LAYOUT.inverter.center : LAYOUT.chargePort.center;
      point.set(...position).add(drivetrain.group.position);
    }
    point.project(camera);
    const bounds = host.getBoundingClientRect();
    return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2, visible: point.z > -1 && point.z < 1 };
  }
  return { ready, render, setView, setStudy, setExplosion, setCamera, setFraming, setBackdrop: on => { backdropTarget = on ? 1 : 0; }, setCurrent, qualityState: () => ({ level: quality.level, scale: quality.scale, locked: quality.locked, pixelRatio: renderer.getPixelRatio() }), currentMetrics: () => ({ ...current.metrics, visibility: currentK }), projectPart, setPaint, technicalMetrics: () => ({ motor: motor.metrics, battery: battery.metrics, power: powertrain.metrics, overview: overview.metrics }), bodyMetrics: () => body?.metrics ? { ...body.metrics, pieces: (body?.metrics?.meshCount || 147) + (body?.wheels.length || 0), explosion, paint: paintColor.toString(16), wheels: body.wheels.map(({ rotating }) => rotating.rotation.z) } : null, reset: () => { cameraPreset = 'overview'; markInteraction(); frameSelection(); }, renderer, camera, controls, scene, drivetrain };
}
