// Ohm Sweet Ohm — qualité adaptative : ajuste la résolution de rendu selon la fluidité réelle de l’appareil.
// 2026-09-29 ≈15:20 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Sonnet 5.5.
//
// Principes retenus (forum three.js, guides de performance mobile) : fenêtre d’échantillonnage d’au moins
// 20 images, seuils de baisse et de remontée différents (hystérésis), paliers discrets, vérification qu’une
// baisse améliore vraiment la fluidité (sinon le goulot n’est pas la résolution : on annule et on arrête).
// Logique pure, sans DOM ni three.js : testable avec une horloge injectée.

export const QUALITY_SCALES = Object.freeze([1, 0.85, 0.7, 0.55]);

export function createAdaptiveQuality({
  scales = QUALITY_SCALES, onChange = () => {}, now = () => performance.now(),
  windowFrames = 40, dropBelowFps = 38, riseAboveFps = 57, riseAfterMs = 12000, minGapMs = 2500, riseRetryMs = 20000,
} = {}) {
  let level = 0, sum = 0, count = 0, lastChange = now(), previousFps = null, verifying = false;
  let dropLocked = false, riseLocked = false, stableSince = null, lastRise = -Infinity;
  const apply = next => { level = next; lastChange = now(); onChange(scales[level], level); };
  return {
    /** À appeler à chaque image avec la durée réelle de l’image en millisecondes. */
    frame(ms) {
      if (!(ms > 0) || ms > 250) return; // onglet en arrière-plan ou saccade unique : ignoré
      sum += ms; count++;
      if (count < windowFrames) return;
      const fps = 1000 * count / sum; sum = 0; count = 0;
      const t = now();
      if (verifying) {
        verifying = false;
        if (fps < previousFps * 1.08) { dropLocked = true; apply(level - 1); return; } // la résolution n’était pas le goulot
        return;
      }
      if (fps < dropBelowFps && level < scales.length - 1 && !dropLocked && t - lastChange >= minGapMs) {
        if (t - lastRise < riseRetryMs) riseLocked = true; // rechute peu après une remontée : on ne remonte plus
        previousFps = fps; verifying = true; stableSince = null; apply(level + 1); return;
      }
      if (fps >= riseAboveFps && level > 0 && !riseLocked) {
        stableSince ??= t;
        if (t - stableSince >= riseAfterMs && t - lastChange >= minGapMs) { lastRise = t; stableSince = null; apply(level - 1); }
      } else if (fps < riseAboveFps) stableSince = null;
    },
    get level() { return level; },
    get scale() { return scales[level]; },
    get locked() { return { drop: dropLocked, rise: riseLocked }; },
  };
}
