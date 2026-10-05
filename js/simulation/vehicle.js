// Modèle pédagogique longitudinal. Paramètres illustratifs, unités SI.
// 2026-09-30 ≈18:18 (Europe/Zurich) — Codex — OpenAI : transfert instantané partagé par le rendu et les compteurs.
export const CONFIG = Object.freeze({ mass: 1800, capacityKWh: 60, chargeKW: 11, chargeTimeScale: 120, efficiency: 0.9, recoveryEfficiency: 0.65, maxSpeed: 36, maxAcceleration: 3.2, liftRegen: 1.6, wheelRadius: 0.3235, reduction: (36 / 12) * (37 / 11) });
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
export function createVehicleState() { return { soc: 0.62, speed: 0, consumedKWh: 0, recoveredKWh: 0, chargedKWh: 0, powerKW: 0, rotating: false, charging: false, recovering: false }; }

// La puissance du registre est une moyenne sur le dernier pas de simulation.
// Son dernier intervalle peut finir à l’arrêt ou avec une batterie pleine/vide :
// il reste comptabilisé, mais ne doit pas entretenir un flux à l’image suivante.
export function getEnergyTransfer(vehicle, { mode = 'drive', connected = false } = {}) {
  const kw = Number.isFinite(vehicle.powerKW) ? vehicle.powerKW : 0;
  const moving = vehicle.speed > 0.01;
  const route = mode === 'charge' ? 'charge' : mode === 'regen' || (vehicle.recovering && kw < 0) ? 'regen' : 'drive';
  const active = Boolean(route === 'charge'
    ? connected && vehicle.charging && vehicle.soc < 1 && kw > 1e-7
    : route === 'regen'
      ? vehicle.recovering && moving && vehicle.soc < 1 && kw < -1e-7
      : !vehicle.charging && vehicle.soc > 0 && kw > 1e-7);
  const powerKW = active ? kw : 0;
  return {
    route, active, powerKW,
    // Échelle commune de 300 kW, au-dessus des pointes du modèle pédagogique.
    // Les effets appliquent ensuite une courbe racine pour lire les faibles flux.
    power: Math.min(Math.abs(powerKW) / 300, 1),
    phase: route === 'charge' ? 'charge' : route === 'regen' ? 'brake' : 'accelerate',
    charging: active && route === 'charge',
    recovering: active && route === 'regen',
    tractionActive: active && route === 'drive',
  };
}
export function advanceVehicle(state, dt, controls) {
  if (!controls.running || !Number.isFinite(dt) || dt <= 0) return { ...state };
  const next = { ...state, powerKW: 0, charging: false, recovering: false };
  const seconds = Math.min(dt, 0.1);
  if (controls.mode === 'charge') {
    next.speed = 0;
    if (controls.connected && next.soc < 1) {
      const energy = Math.min((1 - next.soc) * CONFIG.capacityKWh, CONFIG.chargeKW * seconds * CONFIG.chargeTimeScale / 3600);
      next.soc += energy / CONFIG.capacityKWh;
      next.chargedKWh += energy;
      next.powerKW = CONFIG.chargeKW;
      next.charging = energy > 0;
    }
  } else {
    const oldKinetic = 0.5 * CONFIG.mass * state.speed ** 2;
    const resistance = state.speed > 0 ? 0.16 + 0.00023 * state.speed ** 2 : 0;
    if (controls.mode === 'drive') {
      const pedal = clamp(Number(controls.throttle) || 0, 0, 1);
      // 2026-09-23 — Claude (Cowork) : l’accélérateur fixe une allure visée (0 → 130 km/h).
      // Sous l’allure : le moteur accélère ; à l’allure : il compense les résistances ;
      // au-dessus (pied levé) : conduite « à une pédale », le moteur devient générateur,
      // freine la voiture et renvoie de l’énergie vers la batterie (si elle a de la place).
      const target = pedal * CONFIG.maxSpeed;
      const traction = pedal > 0 && next.soc > 0
        ? clamp((target - state.speed) * 0.9 + resistance, 0, CONFIG.maxAcceleration + resistance) : 0;
      next.speed = clamp(state.speed + (traction - resistance) * seconds, 0, CONFIG.maxSpeed);
      next.tractionAccel = traction;
      const roadWork = resistance * CONFIG.mass * ((state.speed + next.speed) / 2) * seconds;
      const kineticChange = 0.5 * CONFIG.mass * next.speed ** 2 - oldKinetic;
      // Seul le travail du moteur est facturé à la batterie.
      const requestedEnergy = traction > 0 ? Math.max(0, kineticChange + roadWork) / (3.6e6 * CONFIG.efficiency) : 0;
      const energy = Math.min(next.soc * CONFIG.capacityKWh, requestedEnergy);
      if (energy < requestedEnergy) {
        next.speed = Math.sqrt(Math.max(0, (oldKinetic + energy * 3.6e6 * CONFIG.efficiency - roadWork) * 2 / CONFIG.mass));
      }
      next.soc -= energy / CONFIG.capacityKWh;
      next.consumedKWh += energy;
      next.powerKW = energy * 3600 / seconds;
      if (traction === 0 && state.speed > 0.3) {
        // Récupération au lever de pied : plus l’écart d’allure est grand, plus elle est forte.
        const lift = next.soc < 0.999 ? clamp((state.speed - target) * 0.3, 0, CONFIG.liftRegen) : 0;
        if (lift > 0) Object.assign(next, recover(state, next, resistance, lift, seconds, oldKinetic));
      }
    } else if (controls.mode === 'regen') {
      const strength = clamp(Number(controls.regen) || 0, 0, 1);
      Object.assign(next, recover(state, next, resistance, strength * 2.8, seconds, oldKinetic));
    }
  }
  next.soc = clamp(next.soc, 0, 1);
  next.rotating = next.speed > 0.01;
  return next;
}

// Freinage par le moteur-générateur : seule la part de ralentissement due au moteur est récupérée.
function recover(state, next, resistance, regenDeceleration, seconds, oldKinetic) {
  const out = { ...next };
  out.speed = Math.max(0, state.speed - (resistance + regenDeceleration) * seconds);
  const kineticReleased = Math.max(0, oldKinetic - 0.5 * CONFIG.mass * out.speed ** 2);
  const fractionFromBraking = resistance + regenDeceleration > 0 ? regenDeceleration / (resistance + regenDeceleration) : 0;
  const availableEnergy = kineticReleased * fractionFromBraking * CONFIG.recoveryEfficiency / 3.6e6;
  const recovered = Math.min((1 - out.soc) * CONFIG.capacityKWh, availableEnergy);
  out.soc += recovered / CONFIG.capacityKWh;
  out.recoveredKWh += recovered;
  out.powerKW = -recovered * 3600 / seconds;
  out.recovering = recovered > 1e-10;
  return out;
}
