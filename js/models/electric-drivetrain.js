import * as THREE from 'three';
import {
  ELECTRIC_LOSS_BREAKDOWN as ELECTRIC_LOSS_UNITS,
  ENERGY_MODEL,
} from '../data/science.js';
import { ELECTRIC_VEHICLE_LAYOUT } from '../data/vehicle-layout.js';

const LAYOUT = ELECTRIC_VEHICLE_LAYOUT;

function layoutVector(values) {
  return new THREE.Vector3(...values);
}

const COLORS = {
  aluminium: 0x9aa7ae,
  darkSteel: 0x27343b,
  steel: 0x5d6a70,
  copper: 0xd8752c,
  hvOrange: 0xf06b22,
  batteryBlue: 0x243f63,
  electricBlue: 0x3ca9ff,
  electricCyan: 0x42e0cf,
  tire: 0x111417,
};

const MATERIALS = {
  aluminium: new THREE.MeshStandardMaterial({
    color: COLORS.aluminium, metalness: 0.85, roughness: 0.32,
  }),
  brushedAluminium: new THREE.MeshStandardMaterial({
    color: 0x74848d, metalness: 0.78, roughness: 0.34,
  }),
  darkSteel: new THREE.MeshStandardMaterial({
    color: COLORS.darkSteel, metalness: 0.82, roughness: 0.27,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: COLORS.steel, metalness: 0.88, roughness: 0.27,
  }),
  copper: new THREE.MeshStandardMaterial({
    color: COLORS.copper, emissive: COLORS.copper, emissiveIntensity: 0.03,
    metalness: 0.88, roughness: 0.3,
  }),
  hvCable: new THREE.MeshPhysicalMaterial({
    color: COLORS.hvOrange, metalness: 0.08, roughness: 0.38, clearcoat: 0.55,
  }),
  batteryCase: new THREE.MeshPhysicalMaterial({
    color: COLORS.batteryBlue, metalness: 0.55, roughness: 0.42,
    clearcoat: 0.55, clearcoatRoughness: 0.28,
  }),
  cell: new THREE.MeshStandardMaterial({
    color: 0x56708d, metalness: 0.7, roughness: 0.28,
  }),
  tire: new THREE.MeshStandardMaterial({
    color: COLORS.tire, metalness: 0.04, roughness: 0.88,
  }),
  brake: new THREE.MeshStandardMaterial({
    color: 0x6e7b80, metalness: 0.88, roughness: 0.31,
  }),
  shell: new THREE.MeshPhysicalMaterial({
    color: 0x6b8997, transparent: true, opacity: 0.18,
    metalness: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x8dc9db, transparent: true, opacity: 0.12,
    metalness: 0.15, roughness: 0.16, side: THREE.DoubleSide, depthWrite: false,
  }),
  connector: new THREE.MeshStandardMaterial({
    color: 0xe7a33c, metalness: 0.72, roughness: 0.25,
  }),
};

/**
 * Décomposition visuelle des 32 unités perdues dans le repère V1.
 *
 * Les 10 unités de recharge et les 3 unités d'auxiliaires suivent le diagramme
 * combiné DOE/EPA utilisé par le projet. Les 19 unités restantes sont réparties
 * entre onduleur, moteur et transmission uniquement pour la pédagogie : ce
 * n'est ni une mesure constructeur, ni une valeur universelle par composant.
 */
export const ELECTRIC_LOSS_BREAKDOWN = Object.freeze({
  total: ENERGY_MODEL.losses,
  unit: 'unités sur 100 fournies au véhicule',
  illustrative: true,
  note: 'Sous-répartition pédagogique illustrative des pertes du système électrique, non issue d’un véhicule constructeur.',
  sourceAligned: Object.freeze({
    charging: 10,
    auxiliariesAndCooling: 3,
    electricDriveRemainder: 19,
  }),
  branches: Object.freeze([
    Object.freeze({
      id: 'charging',
      label: 'Recharge',
      component: 'charge-port',
      units: ELECTRIC_LOSS_UNITS.charging,
      timeOffset: 0,
      basis: 'reference-combined-cycle',
      illustrative: false,
    }),
    Object.freeze({
      id: 'battery',
      label: 'Auxiliaires et refroidissement',
      component: 'battery',
      units: ELECTRIC_LOSS_UNITS.auxiliaries,
      timeOffset: 0.14,
      basis: 'reference-combined-cycle-localized-for-teaching',
      illustrative: true,
    }),
    Object.freeze({
      id: 'inverter',
      label: 'Onduleur',
      component: 'inverter',
      units: ELECTRIC_LOSS_UNITS.inverter,
      timeOffset: 0.36,
      basis: 'illustrative-subdivision-of-electric-drive-losses',
      illustrative: true,
    }),
    Object.freeze({
      id: 'motor',
      label: 'Moteur',
      component: 'motor',
      units: ELECTRIC_LOSS_UNITS.motor,
      timeOffset: 0.53,
      basis: 'illustrative-subdivision-of-electric-drive-losses',
      illustrative: true,
    }),
    Object.freeze({
      id: 'transmission',
      label: 'Réducteur et transmission',
      component: 'reduction',
      units: ELECTRIC_LOSS_UNITS.transmission,
      timeOffset: 0.7,
      basis: 'illustrative-subdivision-of-electric-drive-losses',
      illustrative: true,
    }),
  ]),
});

const configuredElectricLosses = ELECTRIC_LOSS_BREAKDOWN.branches
  .reduce((total, branch) => total + branch.units, 0);
if (configuredElectricLosses !== ENERGY_MODEL.losses) {
  throw new RangeError('La décomposition des pertes électriques doit rester égale à 32 unités.');
}

function tag(object, component, label = component) {
  object.name = label;
  object.userData.component = component;
  object.userData.label = label;
  return object;
}

function addPickable(parent, object, pickables, component, label) {
  tag(object, component, label);
  parent.add(object);
  if (object.isMesh) pickables.push(object);
  return object;
}

function addInstancedPickable(
  parent,
  geometry,
  material,
  instances,
  pickables,
  component,
  label,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
  const transform = new THREE.Object3D();
  instances.forEach(({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }, index) => {
    transform.position.set(...position);
    transform.rotation.set(...rotation);
    transform.scale.set(...scale);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  return addPickable(parent, mesh, pickables, component, label);
}

function addSemanticHitTarget(
  parent,
  hitTargets,
  geometry,
  position,
  component,
  label,
  { rotation = [0, 0, 0], presentations = ['assembled', 'cutaway', 'exploded'] } = {},
) {
  const target = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ visible: false, depthWrite: false }),
  );
  target.position.set(...position);
  target.rotation.set(...rotation);
  target.userData.semanticHitTarget = true;
  target.userData.presentations = Object.freeze([...presentations]);
  tag(target, component, label);
  parent.add(target);
  hitTargets.push(target);
  return target;
}

function addBolt(parent, position, rotation, scale, pickables, component) {
  const bolt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 0.045 * scale, 12),
    MATERIALS.darkSteel,
  );
  bolt.position.copy(position);
  if (rotation) bolt.rotation.copy(rotation);
  return addPickable(parent, bolt, pickables, component, 'Boulon de fixation');
}

function createCable(points, radius, material, component, label, pickables) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(32, points.length * 18), radius, 12, false),
    material,
  );
  tag(cable, component, label);
  pickables.push(cable);
  return cable;
}

function createGear(radius, width, teeth, material, component, pickables) {
  const gear = tag(new THREE.Group(), component, 'Engrenage de réduction');
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.84, radius * 0.84, width, 64),
    material,
  );
  body.rotation.x = Math.PI / 2;
  addPickable(gear, body, pickables, component, 'Corps de pignon');

  const toothGeometry = new THREE.BoxGeometry(radius * 0.16, radius * 0.18, width);
  const toothInstances = Array.from({ length: teeth }, (_, index) => {
    const angle = (index / teeth) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9, 0],
      rotation: [0, 0, angle],
    };
  });
  addInstancedPickable(
    gear,
    toothGeometry,
    material,
    toothInstances,
    pickables,
    component,
    'Dents d’engrenage instanciées',
  );

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width * 1.18, 32),
    MATERIALS.darkSteel,
  );
  hub.rotation.x = Math.PI / 2;
  addPickable(gear, hub, pickables, component, 'Moyeu d’engrenage');
  return gear;
}

function createWheel(side, pickables, brakeMaterials, {
  axle = 'arrière',
  interactive = true,
} = {}) {
  const wheelPickables = interactive ? pickables : [];
  const sideLabel = side > 0 ? 'gauche' : 'droite';
  const assembly = tag(new THREE.Group(), 'wheel', `Roue ${axle} ${sideLabel}`);
  const rotating = new THREE.Group();
  assembly.add(rotating);

  const tireTubeRadius = LAYOUT.wheel.width * 0.5;
  const tireMajorRadius = LAYOUT.wheel.radius - tireTubeRadius;

  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(tireMajorRadius, tireTubeRadius, 20, 72),
    MATERIALS.tire,
  );
  addPickable(rotating, tire, wheelPickables, 'wheel', `Pneu ${axle}`);

  const treadGeometry = new THREE.BoxGeometry(0.115, 0.14, LAYOUT.wheel.width * 0.96);
  const treadInstances = Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return {
      position: [
        Math.cos(angle) * (LAYOUT.wheel.radius - 0.065),
        Math.sin(angle) * (LAYOUT.wheel.radius - 0.065),
        0,
      ],
      rotation: [0, 0, angle],
    };
  });
  addInstancedPickable(
    rotating,
    treadGeometry,
    MATERIALS.tire,
    treadInstances,
    wheelPickables,
    'wheel',
    'Sculptures du pneu instanciées',
  );

  const rimRadius = 0.432;
  const rimBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius, rimRadius, LAYOUT.wheel.width * 0.64, 64, 1, true),
    MATERIALS.aluminium,
  );
  rimBarrel.rotation.x = Math.PI / 2;
  addPickable(rotating, rimBarrel, wheelPickables, 'wheel', 'Jante aluminium 17 pouces');

  const rimLip = new THREE.Mesh(
    new THREE.TorusGeometry(rimRadius - 0.035, 0.032, 12, 64),
    MATERIALS.aluminium,
  );
  rimLip.position.z = side * LAYOUT.wheel.width * 0.31;
  addPickable(rotating, rimLip, wheelPickables, 'wheel', 'Rebord de jante');

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, LAYOUT.wheel.width * 0.72, 32),
    MATERIALS.darkSteel,
  );
  hub.rotation.x = Math.PI / 2;
  addPickable(rotating, hub, wheelPickables, 'wheel', 'Moyeu de roue');

  const spokeGeometry = new THREE.BoxGeometry(0.36, 0.045, 0.06);
  const spokeInstances = Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 0.21, Math.sin(angle) * 0.21, side * 0.14],
      rotation: [0, 0, angle],
    };
  });
  addInstancedPickable(
    rotating,
    spokeGeometry,
    MATERIALS.aluminium,
    spokeInstances,
    wheelPickables,
    'wheel',
    'Branches de jante instanciées',
  );

  const discMaterial = MATERIALS.brake.clone();
  brakeMaterials.push(discMaterial);
  const brakeDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.03, 64),
    discMaterial,
  );
  brakeDisc.rotation.x = Math.PI / 2;
  brakeDisc.position.z = -side * 0.075;
  addPickable(rotating, brakeDisc, wheelPickables, 'brakes', 'Disque de frein');

  const caliperMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e7d79, emissive: 0x3e7d79, emissiveIntensity: 0.03,
    metalness: 0.65, roughness: 0.3,
  });
  brakeMaterials.push(caliperMaterial);
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.13), caliperMaterial);
  caliper.position.set(-0.25, 0.03, -side * 0.075);
  caliper.rotation.z = -0.22;
  addPickable(assembly, caliper, wheelPickables, 'brakes', 'Étrier de frein');

  const lugGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.035, 10);
  const lugInstances = Array.from({ length: 5 }, (_, index) => {
    const angle = (index / 5) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 0.065, Math.sin(angle) * 0.065, side * 0.16],
      rotation: [Math.PI / 2, 0, 0],
    };
  });
  addInstancedPickable(
    rotating,
    lugGeometry,
    MATERIALS.darkSteel,
    lugInstances,
    wheelPickables,
    'wheel',
    'Écrous de roue instanciés',
  );

  return { assembly, rotating };
}

export function createElectricDrivetrain() {
  const group = tag(new THREE.Group(), 'electric-drivetrain', 'Chaîne de traction électrique');
  group.name = 'Chaîne de traction électrique complète';
  const pickables = [];
  const hitTargets = [];
  const coils = [];
  const brakeMaterials = [];
  const annotationAnchors = {};

  function addAnnotationAnchor(id, position) {
    const anchor = new THREE.Object3D();
    anchor.name = `Ancre pédagogique — ${id}`;
    if (position?.isVector3) anchor.position.copy(position);
    else anchor.position.set(...position);
    group.add(anchor);
    annotationAnchors[id] = anchor;
    return anchor;
  }

  // Pack batterie structurel sous le plancher.
  const battery = tag(new THREE.Group(), 'battery', 'Pack batterie haute tension');
  battery.position.copy(layoutVector(LAYOUT.battery.center));
  group.add(battery);

  const [batteryLength, batteryHeight, batteryWidth] = LAYOUT.battery.size;
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(batteryLength, batteryHeight * 0.41, batteryWidth),
    MATERIALS.darkSteel,
  );
  tray.position.y = -batteryHeight * 0.295;
  addPickable(battery, tray, pickables, 'battery', 'Bac structurel de batterie');

  const perimeterRails = [
    { size: [batteryLength, 0.12, 0.08], position: [0, -0.02, batteryWidth * 0.5 - 0.04] },
    { size: [batteryLength, 0.12, 0.08], position: [0, -0.02, -batteryWidth * 0.5 + 0.04] },
    { size: [0.08, 0.12, batteryWidth - 0.16], position: [batteryLength * 0.5 - 0.04, -0.02, 0] },
    { size: [0.08, 0.12, batteryWidth - 0.16], position: [-batteryLength * 0.5 + 0.04, -0.02, 0] },
  ];
  perimeterRails.forEach(({ size, position }) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(...size), MATERIALS.brushedAluminium);
    rail.position.set(...position);
    addPickable(battery, rail, pickables, 'battery', 'Cadre de protection batterie');
  });

  const moduleGeometry = new THREE.BoxGeometry(1.22, 0.1, 1.18);
  const cellGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16);
  const moduleInstances = [];
  const cellInstances = [];
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 2; row += 1) {
      const modulePosition = [-1.36 + column * 1.36, 0.025, -0.61 + row * 1.22];
      moduleInstances.push({ position: modulePosition });

      for (let cellX = 0; cellX < 5; cellX += 1) {
        for (let cellZ = 0; cellZ < 3; cellZ += 1) {
          cellInstances.push({
            position: [
              modulePosition[0] - 0.44 + cellX * 0.22,
              0.08,
              modulePosition[2] - 0.36 + cellZ * 0.36,
            ],
          });
        }
      }
    }
  }
  addInstancedPickable(
    battery,
    moduleGeometry,
    MATERIALS.batteryCase,
    moduleInstances,
    pickables,
    'battery',
    'Modules de batterie instanciés',
  );
  addInstancedPickable(
    battery,
    cellGeometry,
    MATERIALS.cell,
    cellInstances,
    pickables,
    'battery',
    'Cellules cylindriques instanciées',
  );

  const packCover = new THREE.Mesh(
    new THREE.BoxGeometry(batteryLength - 0.08, 0.025, batteryWidth - 0.08),
    MATERIALS.glass,
  );
  packCover.position.y = batteryHeight * 0.445;
  addPickable(battery, packCover, pickables, 'battery', 'Couvercle de batterie en coupe');

  [-2.04, 2.04].forEach((x) => {
    [-1.29, 1.29].forEach((z) => {
      addBolt(battery, new THREE.Vector3(x, 0.095, z), null, 0.72, pickables, 'battery');
    });
  });

  const batteryTerminal = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.24),
    MATERIALS.connector,
  );
  batteryTerminal.position.set(2.03, 0.035, 1.12);
  addPickable(battery, batteryTerminal, pickables, 'battery', 'Connecteur haute tension batterie');

  // Port de charge : marque l'entrée des 100 unités dans le véhicule.
  // Groupe indépendant de la batterie procédurale pour rester visible
  // quand le banc d'essai remplace celle-ci par un scan réel.
  const chargePort = tag(new THREE.Group(), 'charge-port', 'Port de charge');
  chargePort.position.copy(layoutVector(LAYOUT.chargePort.center));
  group.add(chargePort);

  const portDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.52, 0.04),
    MATERIALS.brushedAluminium,
  );
  portDoor.position.set(0, 0.02, -0.08);
  addPickable(chargePort, portDoor, pickables, 'charge-port', 'Trappe du port de charge');

  const portFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.055, 28),
    MATERIALS.aluminium,
  );
  portFlange.rotation.x = Math.PI / 2;
  addPickable(chargePort, portFlange, pickables, 'charge-port', 'Port de charge — l’énergie entre ici');

  const portSocket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.12, 28),
    MATERIALS.hvCable,
  );
  portSocket.rotation.x = Math.PI / 2;
  portSocket.position.z = 0.06;
  addPickable(chargePort, portSocket, pickables, 'charge-port', 'Port de charge — l’énergie entre ici');

  [-0.055, 0.055].forEach((x) => {
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.07, 12),
      MATERIALS.connector,
    );
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, 0.03, 0.11);
    addPickable(chargePort, pin, pickables, 'charge-port', 'Broche du port de charge');
  });

  const portLedMaterial = new THREE.MeshStandardMaterial({
    color: 0x4ce08a, emissive: 0x2fd67a, emissiveIntensity: 1.05,
    metalness: 0.08, roughness: 0.35,
  });
  const portLed = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.018, 10, 28),
    portLedMaterial,
  );
  portLed.rotation.x = Math.PI / 2;
  portLed.position.z = 0.02;
  addPickable(chargePort, portLed, pickables, 'charge-port', 'Voyant de charge');

  // Cible invisible élargie pour le tactile.
  const portHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  addPickable(chargePort, portHit, pickables, 'charge-port', 'Zone de sélection du port de charge');

  const chargePortCenter = layoutVector(LAYOUT.chargePort.center);
  const batteryTerminalWorld = layoutVector(LAYOUT.battery.center)
    .add(new THREE.Vector3(2.03, 0.035, 1.12));
  const portCable = createCable([
    chargePortCenter.clone().add(new THREE.Vector3(0, -0.03, -0.06)),
    new THREE.Vector3(2.02, -1.55, 1.52),
    batteryTerminalWorld.clone(),
  ], 0.05, MATERIALS.hvCable, 'hv-bus', 'Liaison port de charge vers batterie', pickables);
  group.add(portCable);

  // Borne schématique, présente uniquement lorsque le véhicule est branché.
  const charger = new THREE.Group();
  charger.name = 'Borne de recharge';
  const chargerCenter = chargePortCenter.clone().add(new THREE.Vector3(0.6, 0, 1.7));
  const chargerBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.5, 0.38), MATERIALS.darkSteel);
  chargerBody.position.set(chargerCenter.x, LAYOUT.groundY + 0.75, chargerCenter.z);
  charger.add(chargerBody);
  const chargerScreen = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.02), portLedMaterial);
  chargerScreen.position.set(chargerCenter.x, LAYOUT.groundY + 1.13, chargerCenter.z + 0.2);
  charger.add(chargerScreen);
  const chargingCablePoints = [
    new THREE.Vector3(chargerCenter.x - 0.31, LAYOUT.groundY + 0.9, chargerCenter.z),
    new THREE.Vector3(chargerCenter.x - 0.55, LAYOUT.groundY + 0.35, chargerCenter.z - 0.5),
    chargePortCenter.clone().add(new THREE.Vector3(0, -0.15, 0.35)),
    chargePortCenter.clone(),
  ];
  charger.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chargingCablePoints), 32, 0.047, 8, false),
    MATERIALS.hvCable,
  ));
  charger.visible = false;
  group.add(charger);

  // Onduleur, connectique HV et refroidissement.
  const inverter = tag(new THREE.Group(), 'inverter', 'Onduleur de puissance');
  inverter.position.copy(layoutVector(LAYOUT.inverter.center));
  group.add(inverter);

  const inverterMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d777c, emissive: 0x1d656e, emissiveIntensity: 0.04,
    metalness: 0.68, roughness: 0.28,
  });
  const inverterCase = new THREE.Mesh(
    new THREE.BoxGeometry(...LAYOUT.inverter.size),
    inverterMaterial,
  );
  addPickable(inverter, inverterCase, pickables, 'inverter', 'Carter de l’onduleur');

  const inverterFinGeometry = new THREE.BoxGeometry(0.035, 0.14, 0.52);
  const inverterFinInstances = Array.from({ length: 9 }, (_, index) => ({
    position: [-0.28 + index * 0.07, 0.28, 0],
  }));
  addInstancedPickable(
    inverter,
    inverterFinGeometry,
    MATERIALS.aluminium,
    inverterFinInstances,
    pickables,
    'inverter',
    'Ailettes de refroidissement instanciées',
  );
  [-0.3, 0.3].forEach((x) => {
    [-0.25, 0.25].forEach((z) => {
      addBolt(inverter, new THREE.Vector3(x, 0.24, z), null, 0.62, pickables, 'inverter');
    });
  });

  const packToInverter = createCable([
    batteryTerminalWorld.clone(),
    new THREE.Vector3(1.78, -1.55, 1.02),
    new THREE.Vector3(1.7, -1.03, 0.55),
    layoutVector(LAYOUT.inverter.center).add(new THREE.Vector3(-0.18, -0.08, 0.25)),
  ], 0.06, MATERIALS.hvCable, 'hv-bus', 'Câble haute tension batterie-onduleur', pickables);
  group.add(packToInverter);

  const motorPhaseCables = [-0.18, 0, 0.18].map((offset, index) => {
    const cable = createCable([
      layoutVector(LAYOUT.inverter.center).add(new THREE.Vector3(0.16, -0.18, offset)),
      new THREE.Vector3(2.08, -1.04 - index * 0.015, offset * 0.75),
      layoutVector(LAYOUT.motor.center).add(new THREE.Vector3(0.18, 0.31, offset * 0.58)),
    ], 0.043, MATERIALS.hvCable, 'hv-bus', `Câble de phase ${index + 1}`, pickables);
    group.add(cable);
    return cable;
  });

  // Moteur synchrone en coupe : stator bobiné, rotor à aimants et arbre.
  const motor = tag(new THREE.Group(), 'motor', 'Moteur électrique en coupe');
  motor.position.copy(layoutVector(LAYOUT.motor.center));
  group.add(motor);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      LAYOUT.motor.radius,
      LAYOUT.motor.radius,
      LAYOUT.motor.length,
      72,
      1,
      true,
      0.2,
      Math.PI * 1.62,
    ),
    MATERIALS.shell,
  );
  shell.rotation.x = Math.PI / 2;
  addPickable(motor, shell, pickables, 'stator', 'Carter moteur en coupe');

  const flangeGeometry = new THREE.TorusGeometry(
    LAYOUT.motor.radius,
    0.035,
    12,
    72,
    Math.PI * 1.62,
  );
  [-1, 1].forEach((side) => {
    const flange = new THREE.Mesh(flangeGeometry, MATERIALS.aluminium);
    flange.position.z = side * LAYOUT.motor.length * 0.5;
    flange.rotation.z = 0.2;
    addPickable(motor, flange, pickables, 'stator', 'Bride du carter moteur');
  });

  const toothGeometry = new THREE.BoxGeometry(0.12, 0.15, 0.76);
  const endWindingGeometry = new THREE.TorusGeometry(0.07, 0.018, 8, 20);
  const windingBarGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 10);
  const statorToothInstances = [];
  const windingPhases = Array.from({ length: 3 }, (_, phaseIndex) => {
    const material = MATERIALS.copper.clone();
    material.emissiveIntensity = 0.04;
    coils.push({ material, phase: (phaseIndex / 3) * Math.PI * 2 });
    return { material, loops: [], bars: [] };
  });
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const radius = 0.335;
    statorToothInstances.push({
      position: [Math.cos(angle) * radius, Math.sin(angle) * radius, 0],
      rotation: [0, 0, angle],
    });
    const windingPhase = windingPhases[index % windingPhases.length];
    const windingCenterX = Math.cos(angle) * 0.31;
    const windingCenterY = Math.sin(angle) * 0.31;

    [-0.38, 0.38].forEach((z) => {
      windingPhase.loops.push({ position: [windingCenterX, windingCenterY, z] });
    });
    [-0.09, 0.09].forEach((tangentOffset) => {
      windingPhase.bars.push({
        position: [
          windingCenterX - Math.sin(angle) * tangentOffset,
          windingCenterY + Math.cos(angle) * tangentOffset,
          0,
        ],
        rotation: [Math.PI / 2, 0, 0],
      });
    });
  }
  addInstancedPickable(
    motor,
    toothGeometry,
    MATERIALS.darkSteel,
    statorToothInstances,
    pickables,
    'stator',
    'Dents du stator instanciées',
  );
  windingPhases.forEach(({ material, loops, bars }, phaseIndex) => {
    addInstancedPickable(
      motor,
      endWindingGeometry,
      material,
      loops,
      pickables,
      'stator',
      `Têtes de bobine — phase ${phaseIndex + 1}`,
    );
    addInstancedPickable(
      motor,
      windingBarGeometry,
      material,
      bars,
      pickables,
      'stator',
      `Conducteurs de bobine — phase ${phaseIndex + 1}`,
    );
  });

  const rotorGroup = tag(new THREE.Group(), 'rotor', 'Rotor à aimants permanents');
  motor.add(rotorGroup);
  const rotorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.205, 0.88, 64),
    MATERIALS.darkSteel,
  );
  rotorCore.rotation.x = Math.PI / 2;
  addPickable(rotorGroup, rotorCore, pickables, 'rotor', 'Paquet de tôles du rotor');

  const magnetMaterials = [
    new THREE.MeshStandardMaterial({
      color: COLORS.electricBlue, emissive: COLORS.electricBlue,
      emissiveIntensity: 0.16, metalness: 0.45, roughness: 0.25,
    }),
    new THREE.MeshStandardMaterial({
      color: COLORS.electricCyan, emissive: COLORS.electricCyan,
      emissiveIntensity: 0.16, metalness: 0.45, roughness: 0.25,
    }),
  ];
  const magnetGeometry = new THREE.BoxGeometry(0.1, 0.12, 0.72);
  const magnetInstances = [[], []];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    magnetInstances[index % 2].push({
      position: [Math.cos(angle) * 0.235, Math.sin(angle) * 0.235, 0],
      rotation: [0, 0, angle],
    });
  }
  magnetInstances.forEach((instances, index) => addInstancedPickable(
    rotorGroup,
    magnetGeometry,
    magnetMaterials[index],
    instances,
    pickables,
    'rotor',
    index ? 'Aimants pôle sud instanciés' : 'Aimants pôle nord instanciés',
  ));

  const motorShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1.3, 32),
    MATERIALS.steel,
  );
  motorShaft.rotation.x = Math.PI / 2;
  addPickable(rotorGroup, motorShaft, pickables, 'shaft', 'Arbre du moteur');

  // Réducteur compact à deux étages : 36/12 × 37/11 ≈ 10,1:1.
  const reducer = tag(new THREE.Group(), 'reduction', 'Réducteur mécanique à deux étages');
  reducer.position.copy(layoutVector(LAYOUT.reducer.center));
  group.add(reducer);

  const reducerShell = new THREE.Mesh(
    new THREE.BoxGeometry(...LAYOUT.reducer.size),
    MATERIALS.shell,
  );
  addPickable(reducer, reducerShell, pickables, 'reduction', 'Carter du réducteur en coupe');

  const driveGear = createGear(
    0.09,
    0.18,
    LAYOUT.reducer.gears.stage1PinionTeeth,
    MATERIALS.steel,
    'reduction',
    pickables,
  );
  driveGear.position.set(-0.36, 0.2, 0);
  reducer.add(driveGear);
  const drivenGear = createGear(
    0.27,
    0.2,
    LAYOUT.reducer.gears.stage1GearTeeth,
    MATERIALS.brushedAluminium,
    'reduction',
    pickables,
  );
  drivenGear.position.set(-0.021, 0.078, 0);
  reducer.add(drivenGear);
  const transferPinion = createGear(
    0.103,
    0.18,
    LAYOUT.reducer.gears.stage2PinionTeeth,
    MATERIALS.steel,
    'reduction',
    pickables,
  );
  transferPinion.position.copy(drivenGear.position);
  reducer.add(transferPinion);
  const outputGear = createGear(
    0.346,
    0.22,
    LAYOUT.reducer.gears.finalGearTeeth,
    MATERIALS.brushedAluminium,
    'reduction',
    pickables,
  );
  outputGear.position.set(0.365, -0.15, 0);
  reducer.add(outputGear);

  const outputShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.02, 28),
    MATERIALS.steel,
  );
  outputShaft.rotation.x = Math.PI / 2;
  outputShaft.position.copy(outputGear.position);
  addPickable(reducer, outputShaft, pickables, 'shaft', 'Arbre de sortie du réducteur');

  // Le moteur, les deux étages et les demi-arbres partagent désormais l’axe Z.
  const differential = tag(new THREE.Group(), 'differential', 'Différentiel');
  differential.position.copy(layoutVector(LAYOUT.differential.center));
  group.add(differential);

  const differentialHousing = new THREE.Mesh(
    new THREE.SphereGeometry(LAYOUT.differential.radius, 48, 28, 0.18, Math.PI * 1.62),
    MATERIALS.shell,
  );
  differentialHousing.scale.set(1.08, 0.88, 0.88);
  addPickable(differential, differentialHousing, pickables, 'differential', 'Carter du différentiel en coupe');

  const differentialCarrier = tag(new THREE.Group(), 'differential', 'Porte-satellites du différentiel');
  differential.add(differentialCarrier);

  const crownMaterial = MATERIALS.brushedAluminium;
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 14, 56), crownMaterial);
  addPickable(differentialCarrier, crownRing, pickables, 'differential', 'Couronne du différentiel');
  const crownToothGeometry = new THREE.BoxGeometry(0.055, 0.07, 0.08);
  const crownToothInstances = Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 0.275, Math.sin(angle) * 0.275, 0],
      rotation: [0, 0, angle],
    };
  });
  addInstancedPickable(
    differentialCarrier,
    crownToothGeometry,
    crownMaterial,
    crownToothInstances,
    pickables,
    'differential',
    'Dents de couronne instanciées',
  );

  const sideGearGeometry = new THREE.ConeGeometry(0.12, 0.15, 24, 1, false);
  [-1, 1].forEach((side) => {
    const sideGear = new THREE.Mesh(sideGearGeometry, MATERIALS.steel);
    sideGear.rotation.x = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    sideGear.position.z = side * 0.1;
    addPickable(differentialCarrier, sideGear, pickables, 'differential', 'Planétaire conique');
  });
  [-1, 1].forEach((side) => {
    const satellite = new THREE.Mesh(sideGearGeometry, MATERIALS.darkSteel);
    satellite.rotation.z = side * Math.PI / 2;
    satellite.position.x = side * 0.11;
    addPickable(differentialCarrier, satellite, pickables, 'differential', 'Satellite conique');
  });

  const axleRotors = [];
  [-1, 1].forEach((side) => {
    const axleRotor = tag(new THREE.Group(), 'axle', side > 0 ? 'Demi-arbre gauche' : 'Demi-arbre droit');
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, LAYOUT.wheel.rearTrackHalf, 24),
      MATERIALS.steel,
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.z = side * LAYOUT.wheel.rearTrackHalf * 0.5;
    addPickable(axleRotor, axle, pickables, 'axle', 'Demi-arbre de transmission');

    const bootInstances = [];
    [0.2, LAYOUT.wheel.rearTrackHalf - 0.22].forEach((distance) => {
      for (let rib = 0; rib < 4; rib += 1) {
        bootInstances.push({
          position: [0, 0, side * (distance + rib * 0.035)],
          scale: [1 + rib * 0.14, 1 + rib * 0.14, 1],
        });
      }
    });
    addInstancedPickable(
      axleRotor,
      new THREE.TorusGeometry(0.07, 0.018, 8, 24),
      MATERIALS.tire,
      bootInstances,
      pickables,
      'axle',
      'Soufflets de joint homocinétique instanciés',
    );
    differential.add(axleRotor);
    axleRotors.push(axleRotor);
  });

  const drivenWheels = [-1, 1].map((side) => {
    const wheel = createWheel(side, pickables, brakeMaterials, { axle: 'arrière' });
    wheel.assembly.position.set(
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      side * LAYOUT.wheel.rearTrackHalf,
    );
    group.add(wheel.assembly);
    return wheel;
  });

  const frontWheels = [-1, 1].map((side) => {
    const wheel = createWheel(side, pickables, brakeMaterials, {
      axle: 'avant',
      interactive: false,
    });
    wheel.assembly.position.set(
      LAYOUT.wheel.frontAxleX,
      LAYOUT.wheel.centerY,
      side * LAYOUT.wheel.frontTrackHalf,
    );
    wheel.assembly.userData.contextOnly = true;
    group.add(wheel.assembly);
    return wheel;
  });
  const wheels = [...frontWheels, ...drivenWheels];

  // Un petit jeu de volumes sémantiques remplace le raycast sur plusieurs
  // centaines de pièces. Huit cibles sont actives en vue assemblée, dix en
  // coupe/éclaté. Les cibles internes suivent leurs groupes mécaniques lorsque
  // ceux-ci s'écartent dans la présentation éclatée.
  addSemanticHitTarget(
    group,
    hitTargets,
    new THREE.SphereGeometry(0.4, 12, 8),
    LAYOUT.chargePort.center,
    'charge-port',
    'Cible sémantique — port de charge',
  );
  addSemanticHitTarget(
    group,
    hitTargets,
    new THREE.BoxGeometry(...LAYOUT.battery.size),
    LAYOUT.battery.center,
    'battery',
    'Cible sémantique — batterie',
  );
  addSemanticHitTarget(
    group,
    hitTargets,
    new THREE.BoxGeometry(...LAYOUT.inverter.size),
    LAYOUT.inverter.center,
    'inverter',
    'Cible sémantique — onduleur',
  );
  addSemanticHitTarget(
    reducer,
    hitTargets,
    new THREE.BoxGeometry(...LAYOUT.reducer.size),
    [0, 0, 0],
    'reduction',
    'Cible sémantique — réducteur',
  );
  addSemanticHitTarget(
    differential,
    hitTargets,
    new THREE.SphereGeometry(LAYOUT.differential.radius * 1.35, 12, 8),
    [0, 0, 0],
    'differential',
    'Cible sémantique — différentiel',
  );
  [-1, 1].forEach((side) => addSemanticHitTarget(
    group,
    hitTargets,
    new THREE.SphereGeometry(LAYOUT.wheel.radius * 1.08, 12, 8),
    [
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      side * LAYOUT.wheel.rearTrackHalf,
    ],
    'wheel',
    'Cible sémantique — roue motrice',
  ));
  addSemanticHitTarget(
    motor,
    hitTargets,
    new THREE.SphereGeometry(LAYOUT.motor.radius * 1.08, 12, 8),
    [0, 0, 0],
    'motor',
    'Cible sémantique — moteur',
    { presentations: ['assembled'] },
  );
  addSemanticHitTarget(
    motor,
    hitTargets,
    new THREE.TorusGeometry(0.34, 0.11, 8, 24),
    [0, 0, 0],
    'stator',
    'Cible sémantique — stator',
    { presentations: ['cutaway', 'exploded'] },
  );
  addSemanticHitTarget(
    motor,
    hitTargets,
    new THREE.CylinderGeometry(0.24, 0.24, 0.78, 12),
    [0, 0, 0],
    'rotor',
    'Cible sémantique — rotor',
    { rotation: [Math.PI / 2, 0, 0], presentations: ['cutaway', 'exploded'] },
  );
  addSemanticHitTarget(
    motor,
    hitTargets,
    new THREE.SphereGeometry(0.16, 10, 7),
    [0, 0, -0.58],
    'shaft',
    'Cible sémantique — extrémité de l’arbre moteur',
    { presentations: ['cutaway', 'exploded'] },
  );

  // Berceau et fixations : contexte mécanique sans masquer les organes actifs.
  [-0.9, 0.9].forEach((z) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 0.1), MATERIALS.darkSteel);
    rail.position.set(LAYOUT.driveUnit.center[0], -2.08, z);
    addPickable(group, rail, pickables, 'subframe', 'Berceau arrière');
  });
  [-0.72, 0.58].forEach((offset) => {
    const crossMember = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.9), MATERIALS.darkSteel);
    crossMember.position.set(LAYOUT.wheel.rearAxleX + offset, -2.08, 0);
    addPickable(group, crossMember, pickables, 'subframe', 'Traverse du berceau arrière');
  });

  const batteryFlowPoint = layoutVector(LAYOUT.battery.center)
    .add(new THREE.Vector3(0, 0.07, 0));
  const inverterFlowPoint = layoutVector(LAYOUT.inverter.center);
  const motorFlowPoint = layoutVector(LAYOUT.motor.center);
  const reducerFlowPoint = layoutVector(LAYOUT.reducer.center);
  const differentialFlowPoint = layoutVector(LAYOUT.differential.center);
  const mainToDiff = [
    chargePortCenter.clone(),
    batteryTerminalWorld.clone(),
    new THREE.Vector3(1.1, -1.87, 0.72),
    batteryFlowPoint,
    new THREE.Vector3(1.46, -1.65, 0.62),
    inverterFlowPoint,
    motorFlowPoint,
    reducerFlowPoint,
    differentialFlowPoint,
  ];
  const rightBranch = [
    differentialFlowPoint.clone(),
    new THREE.Vector3(
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      LAYOUT.wheel.rearTrackHalf * 0.58,
    ),
    new THREE.Vector3(
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      LAYOUT.wheel.rearTrackHalf,
    ),
  ];
  const leftBranch = [
    differentialFlowPoint.clone(),
    new THREE.Vector3(
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      -LAYOUT.wheel.rearTrackHalf * 0.58,
    ),
    new THREE.Vector3(
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      -LAYOUT.wheel.rearTrackHalf,
    ),
  ];
  const main = [...mainToDiff, ...rightBranch.slice(1)];
  const regenToBattery = mainToDiff.slice(3);
  const rightRegen = [...rightBranch]
    .reverse()
    .concat([...regenToBattery].reverse().slice(1));
  const leftRegen = [...leftBranch]
    .reverse()
    .concat([...regenToBattery].reverse().slice(1));
  const regen = [rightRegen, leftRegen];
  const lossPaths = {
    charging: [
      chargePortCenter.clone(),
      chargePortCenter.clone().add(new THREE.Vector3(0.18, 0.64, 0.18)),
      chargePortCenter.clone().add(new THREE.Vector3(0.3, 1.38, 0.34)),
    ],
    battery: [
      batteryFlowPoint.clone().add(new THREE.Vector3(-0.55, 0, -0.62)),
      batteryFlowPoint.clone().add(new THREE.Vector3(-0.68, 0.72, -0.82)),
      batteryFlowPoint.clone().add(new THREE.Vector3(-0.84, 1.5, -1.02)),
    ],
    inverter: [
      inverterFlowPoint.clone().add(new THREE.Vector3(0, 0.2, 0)),
      inverterFlowPoint.clone().add(new THREE.Vector3(0.08, 0.8, 0.16)),
      inverterFlowPoint.clone().add(new THREE.Vector3(0.22, 1.52, 0.34)),
    ],
    motor: [
      motorFlowPoint.clone().add(new THREE.Vector3(0, 0.3, -0.18)),
      motorFlowPoint.clone().add(new THREE.Vector3(-0.08, 1.02, -0.28)),
      motorFlowPoint.clone().add(new THREE.Vector3(-0.2, 1.78, -0.42)),
    ],
    transmission: [
      reducerFlowPoint.clone().add(new THREE.Vector3(0.18, 0.18, 0)),
      reducerFlowPoint.clone().add(new THREE.Vector3(0.3, 0.9, -0.18)),
      reducerFlowPoint.clone().add(new THREE.Vector3(0.46, 1.62, -0.38)),
    ],
  };
  // Les repères partent des mêmes points que les volutes thermiques. Placés sous
  // le groupe racine, ils restent visibles quand les scans GLB remplacent les
  // carters procéduraux.
  Object.entries(lossPaths).forEach(([id, path]) => addAnnotationAnchor(id, path[0]));
  addAnnotationAnchor('wheels', rightBranch[rightBranch.length - 1]);
  const losses = ELECTRIC_LOSS_BREAKDOWN.branches.map((branch) => ({
    ...branch,
    path: lossPaths[branch.id].map((point) => point.clone()),
  }));
  const flowPaths = {
    main,
    losses,
    lossBreakdown: ELECTRIC_LOSS_BREAKDOWN,
    regen,
    charging: [...chargingCablePoints, ...mainToDiff.slice(1, 4)],
    leftWheel: [...mainToDiff.slice(3), ...leftBranch.slice(1)],
    rightWheel: [...mainToDiff.slice(3), ...rightBranch.slice(1)],
  };
  group.userData.lossBreakdown = ELECTRIC_LOSS_BREAKDOWN;

  let selectedComponent = null;
  const selectionHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0x42e0cf,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const selectionHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.58, 48),
    selectionHaloMaterial,
  );
  selectionHalo.name = 'Halo de sélection';
  selectionHalo.rotation.x = -Math.PI / 2;
  selectionHalo.visible = false;
  selectionHalo.renderOrder = 20;
  group.add(selectionHalo);

  const SELECTION_ANCHORS = Object.freeze({
    chargePort: LAYOUT.chargePort.center,
    'charge-port': LAYOUT.chargePort.center,
    charge: LAYOUT.chargePort.center,
    battery: LAYOUT.battery.center,
    inverter: LAYOUT.inverter.center,
    motor: LAYOUT.motor.center,
    stator: LAYOUT.motor.center,
    rotor: LAYOUT.motor.center,
    shaft: LAYOUT.motor.center,
    reduction: LAYOUT.reducer.center,
    differential: LAYOUT.differential.center,
    wheel: [
      LAYOUT.wheel.rearAxleX,
      LAYOUT.wheel.centerY,
      LAYOUT.wheel.rearTrackHalf,
    ],
  });

  function selectionFamily(componentKey) {
    const aliases = {
      chargePort: 'charge-port',
      charge: 'charge-port',
      brakes: 'wheel',
      brake: 'wheel',
      axle: 'differential',
      subframe: 'differential',
      'hv-bus': 'inverter',
    };
    const resolved = aliases[componentKey] || componentKey;
    if (!resolved) return new Set();
    if (resolved === 'motor' || resolved === 'stator' || resolved === 'rotor' || resolved === 'shaft') {
      return new Set(['motor', 'stator', 'rotor', 'shaft']);
    }
    if (resolved === 'wheel') return new Set(['wheel', 'brakes']);
    if (resolved === 'differential') return new Set(['differential', 'axle', 'subframe']);
    if (resolved === 'inverter') return new Set(['inverter', 'hv-bus']);
    if (resolved === 'reduction') return new Set(['reduction', 'shaft']);
    return new Set([resolved]);
  }

  function setSelection(componentKey = null) {
    selectedComponent = componentKey || null;
    const anchor = SELECTION_ANCHORS[selectedComponent]
      || SELECTION_ANCHORS[selectionFamily(selectedComponent).values().next().value];
    if (!anchor) {
      selectionHalo.visible = false;
      return;
    }
    selectionHalo.visible = true;
    selectionHalo.position.set(anchor[0], anchor[1] - 0.08, anchor[2]);
    const scale = selectedComponent === 'battery' || selectedComponent === 'wheel'
      ? 1.55
      : selectedComponent === 'chargePort' || selectedComponent === 'charge-port'
        ? 0.72
        : 1;
    selectionHalo.scale.setScalar(scale);
  }

  let rotorAngle = 0;
  let previousFrameTime = null;

  function setFrame(time, power, running, drivePhase = 'accelerate', motionAngle = null) {
    const normalizedPower = THREE.MathUtils.clamp(power, 0, 1);
    const charging = drivePhase === 'charge';
    const activeSpeed = running && !charging ? 1.25 + normalizedPower * 7.5 : 0;
    const dt = previousFrameTime === null ? 0 : THREE.MathUtils.clamp(time - previousFrameTime, 0, 0.06);
    previousFrameTime = time;
    charger.visible = charging;
    const braking = drivePhase === 'brake';
    const cruiseFactor = drivePhase === 'cruise' ? 0.72 : 1;
    rotorAngle = Number.isFinite(motionAngle) ? motionAngle : rotorAngle + dt * activeSpeed * cruiseFactor;
    const firstStageAngle = -rotorAngle
      * (LAYOUT.reducer.gears.stage1PinionTeeth / LAYOUT.reducer.gears.stage1GearTeeth);
    const axleAngle = -firstStageAngle
      * (LAYOUT.reducer.gears.stage2PinionTeeth / LAYOUT.reducer.gears.finalGearTeeth);
    const family = selectionFamily(selectedComponent);
    const motorSelected = family.has('stator') || family.has('rotor');
    const inverterSelected = family.has('inverter');
    const brakesSelected = family.has('brakes') || family.has('wheel');
    const chargeSelected = family.has('charge-port');

    rotorGroup.rotation.z = rotorAngle;
    driveGear.rotation.z = rotorAngle;
    drivenGear.rotation.z = firstStageAngle;
    transferPinion.rotation.z = firstStageAngle;
    outputGear.rotation.z = axleAngle;
    differentialCarrier.rotation.z = axleAngle;
    axleRotors.forEach((axle) => { axle.rotation.z = axleAngle; });
    wheels.forEach(({ rotating }) => { rotating.rotation.z = axleAngle; });

    coils.forEach(({ material, phase }) => {
      const electricalWave = Math.sin(rotorAngle * 2 + phase) * 0.5 + 0.5;
      material.emissiveIntensity = (running ? 0.06 : 0.025)
        + electricalWave * (charging ? 0 : normalizedPower) * (braking ? 0.95 : 0.68)
        + (motorSelected ? 0.28 : 0);
    });

    inverterMaterial.emissiveIntensity = (running ? 0.04 : 0.015)
      + (charging ? 0 : normalizedPower) * (braking ? 0.5 : 0.24)
      + (inverterSelected ? 0.3 : 0);
    magnetMaterials.forEach((material) => {
      material.emissiveIntensity = 0.12 + normalizedPower * (braking ? 0.46 : 0.22)
        + (motorSelected ? 0.24 : 0);
    });
    brakeMaterials.forEach((material) => {
      material.emissive = material.emissive || new THREE.Color(0x6f291d);
      material.emissive.setHex(braking ? 0x9b3d25 : 0x182126);
      material.emissiveIntensity = (braking ? 0.22 + normalizedPower * 0.35 : 0.015)
        + (brakesSelected ? 0.2 : 0);
    });
    portLedMaterial.emissiveIntensity = (chargeSelected ? 1.65 : 0.9)
      + normalizedPower * 0.35
      + (running ? Math.sin(time * 4.2) * 0.12 + 0.12 : 0.08);

    if (selectionHalo.visible) {
      selectionHaloMaterial.opacity = 0.28 + Math.sin(time * 3.1) * 0.12 + 0.12;
      selectionHalo.rotation.z = time * 0.35;
    }
  }

  function getHitTargets(presentation = 'assembled') {
    const activeTargets = hitTargets.filter((target) => (
      target.userData.presentations.includes(presentation)
    ));
    if (activeTargets.length > 10) {
      throw new RangeError('La scène électrique ne doit pas dépasser 10 cibles sémantiques actives.');
    }
    return activeTargets;
  }

  return {
    group,
    pickables,
    hitTargets,
    getHitTargets,
    setFrame,
    setSelection,
    flowPaths,
    annotationAnchors: Object.freeze(annotationAnchors),
    lossBreakdown: ELECTRIC_LOSS_BREAKDOWN,
  };
}
