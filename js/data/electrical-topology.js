import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from './vehicle-layout.js';

// 2026-09-22 — Codex / OpenAI. Teaching geometry, not a Tesla wiring diagram.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const POWER_LAYOUT = freeze({
  inverter: { center: [...VEHICLE.inverter.center], size: [...VEHICLE.inverter.size] },
  charger: { center: [1.36, -1.60, -0.56], size: [0.90, 0.32, 1.35] },
  terminals: {
    'port.ac': [...VEHICLE.chargePort.center],
    'charger.ac': [1.36, -1.50, 0.13],
    'charger.dc+': [0.90, -1.53, -0.16],
    'charger.dc-': [0.90, -1.53, 0.01],
    'battery.charge+': [0.50, -1.77, 1.06],
    'battery.charge-': [0.50, -1.77, 1.21],
    'battery.dc+': [1.95, -1.78, 0.95],
    'battery.dc-': [1.95, -1.78, 1.10],
    'inverter.dc+': [1.53, -0.75, 0.15],
    'inverter.dc-': [1.53, -0.75, 0.33],
    'inverter.U': [1.85, -0.94, 0.53],
    'inverter.V': [1.98, -0.94, 0.53],
    'inverter.W': [2.11, -0.94, 0.53],
    'motor.U': [1.85, -1.10, 0.59],
    'motor.V': [1.98, -1.10, 0.59],
    'motor.W': [2.11, -1.10, 0.59],
  },
});

function cable(id, label, kind, from, to, waypoints, radius = 0.034) {
  return { id, label, kind, from, to, radius,
    points: [POWER_LAYOUT.terminals[from], ...waypoints, POWER_LAYOUT.terminals[to]] };
}

export const ELECTRICAL_CABLES = freeze([
  cable('charge-ac', 'Faisceau de recharge AC', 'AC', 'port.ac', 'charger.ac', [
    [1.91, -1.24, 1.52], [1.39, -1.33, 1.43], [1.26, -1.46, 0.57], [1.30, -1.50, 0.25],
  ], 0.052),
  cable('charge-positive', 'Recharge DC · borne +', 'DC', 'charger.dc+', 'battery.charge+', [
    [0.73, -1.53, -0.13], [0.61, -1.61, 0.37], [0.50, -1.65, 0.92],
  ]),
  cable('charge-negative', 'Recharge DC · borne −', 'DC', 'charger.dc-', 'battery.charge-', [
    [0.81, -1.53, 0.06], [0.77, -1.61, 0.52], [0.63, -1.66, 1.17],
  ]),
  cable('traction-positive', 'Batterie → onduleur · DC +', 'DC', 'battery.dc+', 'inverter.dc+', [
    [2.13, -1.70, 0.95], [2.20, -1.54, 0.99], [2.12, -1.03, 1.03],
    [1.45, -0.92, 0.99], [1.35, -0.76, 0.68], [1.38, -0.75, 0.15],
  ], 0.038),
  cable('traction-negative', 'Batterie → onduleur · DC −', 'DC', 'battery.dc-', 'inverter.dc-', [
    [2.25, -1.70, 1.10], [2.34, -1.54, 1.15], [2.24, -1.03, 1.19],
    [1.29, -0.92, 1.15], [1.20, -0.76, 0.81], [1.28, -0.75, 0.33],
  ], 0.038),
  ...['U', 'V', 'W'].map((phase, index) => cable(
    `phase-${phase}`, `Phase ${phase} · courant alternatif`, 'AC3',
    `inverter.${phase}`, `motor.${phase}`,
    [[1.85 + index * 0.13, -0.98, 0.575],
      [1.85 + index * 0.13, -1.045, 0.59]],
    0.018,
  )),
]);

export const ELECTRICAL_TOPOLOGY = freeze({
  illustrative: true,
  chargingPowerKW: 11,
  chargingPowerNote: 'Réglage pédagogique de la recharge AC ; pas une spécification constructeur.',
  nodes: {
    port: { label: 'Prise', input: 'AC', output: 'AC' },
    charger: { label: 'Chargeur embarqué', input: 'AC', output: 'DC' },
    battery: { label: 'Batterie', input: 'DC', output: 'DC' },
    inverter: { label: 'Onduleur', input: 'DC', output: 'AC3', reversible: true },
    motor: { label: 'Moteur', input: 'AC3', output: 'mechanical', reversible: true },
  },
  energyRoutes: {
    charge: ['port', 'charger', 'battery'],
    drive: ['battery', 'inverter', 'motor'],
    regen: ['motor', 'inverter', 'battery'],
  },
  sources: [
    'https://service.tesla.com/docs/Model3/ServiceManual/en-us/GUID-EF4FF490-1CAD-4F69-80B7-BA93994EB821.html',
    'https://service.tesla.com/docs/Model3/ServiceManual/en-us/GUID-30AA424E-D9A3-4CCF-B948-C1776C851A0D.html',
    'https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work',
    'https://documentation.infineon.com/aurixtc3xx/docs/nnc1745576047829',
    'https://www.tesla.com/en_gb/support/charging/onboard-charger',
    'https://www.tesla.com/ownersmanual/model3/fr_us/GUID-8FA15856-1720-440F-838B-ACFBA8D7D608.html',
  ],
  note: 'Les flèches représentent le transfert d’énergie. Les conducteurs AC ne transportent pas un flux d’électrons à sens unique. La recharge rapide DC, non simulée ici, emploie un convertisseur extérieur.',
});

// Running controls motion only: a paused scene preserves which route was active.
// 2026-09-30 ≈18:24 (Europe/Zurich) — Codex — OpenAI : aucun seuil artificiel sur les faibles puissances normalisées.
export function electricalActivity({ mode = 'drive', power = 0, connected = false,
  charging = false, recovering = false } = {}) {
  const charge = mode === 'charge' && connected && charging;
  const regen = mode === 'regen' && recovering && Number.isFinite(power) && Math.abs(power) > 0;
  const drive = mode === 'drive' && Number.isFinite(power) && power > 0;
  return { charge, traction: drive || regen, direction: regen ? -1 : 1 };
}
