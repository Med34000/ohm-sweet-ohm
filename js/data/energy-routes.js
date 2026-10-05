import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from './vehicle-layout.js';
import { POWER_LAYOUT, ELECTRICAL_CABLES } from './electrical-topology.js';

// 2026-09-22 ≈23:25 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Opus 5.5.
// 2026-09-30 ≈10:35 (Europe/Zurich) — Codex — OpenAI : stockage chimique de la batterie.
// Trajets du « mode Courant » : géométrie pédagogique dans le repère de la chaîne
// (X longueur, Y verticale, Z largeur). Ce n’est pas un schéma de câblage constructeur.

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const T = POWER_LAYOUT.terminals;
const cable = id => ELECTRICAL_CABLES.find(item => item.id === id).points.map(point => [...point]);
const lerp = (a, b, t) => a + (b - a) * t;

/** Nature de ce qui circule sur chaque tronçon. */
export const CURRENT_KINDS = freeze({
  grid: { label: 'Réseau · alternatif', short: 'AC', color: 0x3ad6ff },
  dc: { label: 'Courant continu', short: 'DC', color: 0xb9f35c },
  ac3: { label: 'Triphasé', short: 'AC 3~', color: 0xffad3a },
  mech: { label: 'Mouvement', short: 'rotation', color: 0xf2f5ff },
  heat: { label: 'Chaleur perdue', short: 'pertes', color: 0xff5a36 },
});

const port = VEHICLE.chargePort.center;
const station = [port[0] + 0.6, VEHICLE.groundY, port[2] + 1.7];
const batteryCenter = VEHICLE.battery.center;
// Dessus des cellules, sous le couvercle du pack.
export const LANE_Y = batteryCenter[1] + 0.1;
// Quatre modules longitudinaux : mêmes positions que la maquette de batterie.
export const MODULE_LANES = freeze([-0.975, -0.325, 0.325, 0.975]);
const LANE_FRONT = batteryCenter[0] - 0.525 - 1.45;
const LANE_REAR = batteryCenter[0] - 0.525 + 1.45;
const contactors = [batteryCenter[0] + 1.367, batteryCenter[1] + 0.302, 1.024];
const obc = [...POWER_LAYOUT.charger.center];
const inverter = [...POWER_LAYOUT.inverter.center];
const motor = [...VEHICLE.motor.center];
const reducer = [...VEHICLE.reducer.center];
const differential = [...VEHICLE.differential.center];
const rearAxle = VEHICLE.wheel.rearAxleX, wheelY = VEHICLE.wheel.centerY;
const PHASES = ['U', 'V', 'W'];

const segment = (id, kind, points) => ({ id, kind, points });
const SEGMENTS = [
  // Recharge : borne → prise → chargeur embarqué → pack.
  segment('station-cable', 'grid', [
    [station[0] - 0.31, VEHICLE.groundY + 0.9, station[2]],
    [station[0] - 0.55, VEHICLE.groundY + 0.35, station[2] - 0.5],
    [port[0], port[1] - 0.15, port[2] + 0.35],
    [...port],
  ]),
  segment('charge-ac', 'grid', cable('charge-ac')),
  segment('obc-in', 'grid', [[...T['charger.ac']], [obc[0], obc[1] + 0.06, obc[2] + 0.3], obc]),
  segment('obc-out', 'dc', [obc, [obc[0] - 0.3, obc[1] + 0.05, obc[2] + 0.2], [...T['charger.dc+']]]),
  segment('charge-dc', 'dc', cable('charge-positive')),
  ...MODULE_LANES.map((z, i) => segment(`pack-in-${i}`, 'dc', [
    [...T['battery.charge+']],
    [T['battery.charge+'][0] + 0.12, LANE_Y + 0.02, lerp(T['battery.charge+'][2], z, 0.55)],
    [LANE_REAR, LANE_Y, z],
    [LANE_FRONT, LANE_Y, z],
  ])),
  // Traction : modules → contacteurs → câble DC → onduleur → trois phases → moteur → roues.
  ...MODULE_LANES.map((z, i) => segment(`pack-out-${i}`, 'dc', [
    [LANE_FRONT, LANE_Y, z],
    [LANE_REAR, LANE_Y, z],
    [LANE_REAR + 0.26, LANE_Y + 0.1, lerp(z, contactors[2], 0.65)],
    contactors,
    [...T['battery.dc+']],
  ])),
  segment('dc-link', 'dc', cable('traction-positive')),
  segment('inverter-in', 'dc', [[...T['inverter.dc+']], [lerp(T['inverter.dc+'][0], inverter[0], 0.5), inverter[1] + 0.03, 0.14], inverter]),
  ...PHASES.map(phase => segment(`inverter-${phase}`, 'ac3', [
    inverter, [T[`inverter.${phase}`][0], inverter[1] - 0.07, 0.34], [...T[`inverter.${phase}`]],
  ])),
  ...PHASES.map(phase => segment(`phase-${phase}`, 'ac3', cable(`phase-${phase}`))),
  ...PHASES.map(phase => segment(`motor-${phase}`, 'ac3', [
    [...T[`motor.${phase}`]], [T[`motor.${phase}`][0], motor[1] + 0.12, 0.3], motor,
  ])),
  segment('shaft', 'mech', [motor, [lerp(motor[0], reducer[0], 0.5), lerp(motor[1], reducer[1], 0.7), 0], reducer, differential]),
  ...[1, -1].map(side => segment(`axle-${side > 0 ? 'left' : 'right'}`, 'mech', [
    differential, [rearAxle, wheelY, side * 0.7], [rearAxle, wheelY, side * (VEHICLE.wheel.rearTrackHalf - 0.28)],
  ])),
];
export const ENERGY_SEGMENTS = freeze(SEGMENTS);

/**
 * Brins complets, de la source vers la destination dans le sens de la traction
 * ou de la recharge. La récupération parcourt les brins de traction à l’envers.
 */
const charge = MODULE_LANES.map((_, i) => ['station-cable', 'charge-ac', 'obc-in', 'obc-out', 'charge-dc', `pack-in-${i}`]);
const traction = [];
MODULE_LANES.forEach((_, lane) => PHASES.forEach(phase => ['left', 'right'].forEach(side => {
  traction.push([`pack-out-${lane}`, 'dc-link', 'inverter-in', `inverter-${phase}`, `phase-${phase}`, `motor-${phase}`, 'shaft', `axle-${side}`]);
})));

/** Étapes nommées, dans l’ordre du transfert d’énergie. */
export const ENERGY_ROUTES = freeze({
  charge: {
    strands: charge,
    stops: [
      { id: 'station', label: 'Borne', detail: 'réseau AC', at: [station[0] - 0.31, VEHICLE.groundY + 1.25, station[2]], kind: 'grid' },
      { id: 'port', label: 'Prise', detail: 'entrée AC', at: [...port], kind: 'grid' },
      { id: 'obc', label: 'Chargeur embarqué', detail: 'AC → DC', at: obc, kind: 'dc', loss: true },
      { id: 'battery', label: 'Batterie', detail: 'énergie chimique', at: [batteryCenter[0] - 0.5, LANE_Y, 0], kind: 'dc' },
    ],
  },
  drive: {
    strands: traction,
    stops: [
      { id: 'battery', label: 'Batterie', detail: 'fournit du DC', at: [batteryCenter[0] - 0.5, LANE_Y, 0], kind: 'dc' },
      { id: 'inverter', label: 'Onduleur', detail: 'DC → triphasé', at: inverter, kind: 'ac3', loss: true },
      { id: 'motor', label: 'Moteur', detail: 'courant → rotation', at: motor, kind: 'mech', loss: true },
      { id: 'wheels', label: 'Roues arrière', detail: 'propulsion', at: [rearAxle, wheelY, VEHICLE.wheel.rearTrackHalf], kind: 'mech' },
    ],
  },
  regen: {
    strands: traction,
    reverse: true,
    stops: [
      { id: 'wheels', label: 'Roues arrière', detail: 'l’élan entraîne le moteur', at: [rearAxle, wheelY, VEHICLE.wheel.rearTrackHalf], kind: 'mech' },
      { id: 'motor', label: 'Moteur = générateur', detail: 'il produit du courant', at: motor, kind: 'ac3', loss: true, produces: true },
      { id: 'inverter', label: 'Onduleur', detail: 'triphasé → DC', at: inverter, kind: 'dc', loss: true },
      { id: 'battery', label: 'Batterie', detail: 'se recharge', at: [batteryCenter[0] - 0.5, LANE_Y, 0], kind: 'dc' },
    ],
  },
});

export function segmentById(id) { return ENERGY_SEGMENTS.find(item => item.id === id); }

/**
 * Avance une position le long d’un brin fermé en boucle. Le déplacement est intégré
 * image par image : quand la puissance baisse (freinage qui s’achève), le flux ralentit
 * mais ne repart jamais en arrière.
 */
export function advanceAlong(distance, length, direction, speed, dt) {
  if (!(length > 0)) return 0;
  const next = distance + Math.sign(direction) * Math.max(0, speed) * Math.max(0, dt);
  return ((next % length) + length) % length;
}
