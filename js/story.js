// Ohm Sweet Ohm — « Histoire » : neuf chapitres guidés en 51 secondes.
// 2026-09-30 ≈14:26 (Europe/Zurich) — Codex — OpenAI, GPT-6.
//
// Ce module ne touche ni à la scène ni au DOM : il décrit les étapes et fournit un
// « réalisateur » qui déclenche `apply(étape, index)` au bon moment. main.js applique
// ensuite l’étape (mode, câble, accélérateur, courant, caméra, pièce ouverte, légende).

export const CAMERAS = Object.freeze(['overview', 'front', 'side', 'top']);
export const MODES = Object.freeze(['charge', 'drive', 'regen']);

export const STORY_STEPS = Object.freeze([
  { id: 'intro', at: 0, hud: false, kicker: '51 SECONDES POUR COMPRENDRE', title: 'Comment une voiture récupère-t-elle de l’énergie en ralentissant ?', text: 'Suis l’énergie, de la prise aux roues… puis des roues à la batterie.', mode: 'charge', connected: false, throttle: 0, current: false, camera: 'overview' },
  { id: 'cable', at: 4.5, kicker: '1 · LA RECHARGE', title: 'Tout commence par un câble.', text: 'La borne envoie le courant du réseau vers la prise de la voiture.', mode: 'charge', connected: true, throttle: 0, current: true, camera: 'overview' },
  { id: 'chargeur', at: 9.5, kicker: '2 · LA CONVERSION', title: 'Le chargeur change la nature du courant.', text: 'Le réseau fournit de l’alternatif. Le chargeur embarqué le convertit en continu pour recharger la batterie.', mode: 'charge', connected: true, throttle: 0, current: true, camera: 'top' },
  { id: 'batterie', at: 15.5, kicker: '3 · SOUS LA CARROSSERIE', title: 'Une batterie, des milliers de cellules.', text: 'Chaque cellule stocke de l’énergie chimique, disponible pour alimenter le moteur.', mode: 'charge', connected: true, throttle: 0, current: false, camera: 'overview', focus: 'battery', studyFocus: 'cells', opening: 0.75 },
  { id: 'motor', at: 21.5, kicker: '4 · AU CŒUR DU MOTEUR', title: 'Comment du cuivre fait-il tourner les roues ?', text: 'Trois courants décalés créent un champ tournant. Il entraîne le rotor, puis l’arbre : les roues reçoivent le mouvement.', mode: 'drive', connected: false, throttle: 0, current: false, camera: 'overview', focus: 'motor', studyFocus: 'field', opening: 1 },
  { id: 'acceleration', at: 28, kicker: '5 · TU ACCÉLÈRES', title: 'L’énergie part vers le moteur.', text: 'L’onduleur dose le courant, le moteur le transforme en rotation, et les roues arrière avancent.', mode: 'drive', connected: false, throttle: 0.62, current: true, camera: 'side' },
  { id: 'allure', at: 37, kicker: '6 · VITESSE STABLE', title: 'Moins de puissance, toujours de l’énergie.', text: 'À allure stable, le moteur compense encore la résistance de l’air et le roulement.', mode: 'drive', connected: false, throttle: 0.62, current: true, camera: 'overview', startSpeedKmh: 78 },
  { id: 'recuperation', at: 43, kicker: '7 · TU LÈVES LE PIED', title: 'Le moteur devient générateur.', text: 'Les roues entraînent le moteur. Il freine la voiture et renvoie une partie de l’énergie vers la batterie.', mode: 'drive', connected: false, throttle: 0, current: true, camera: 'side', startSpeedKmh: 78 },
  { id: 'fin', at: 51, kicker: 'L’ESSENTIEL', title: 'Aucune énergie créée : elle circule.', text: 'Recharger, rouler, récupérer. Le reste, c’est à toi de le découvrir.', mode: 'drive', connected: false, throttle: 0, current: true, camera: 'overview', final: true },
]);

/** Index de l’étape active à l’instant `seconds` (dernière étape dont `at` est atteint). */
export function stepIndexAt(seconds, steps = STORY_STEPS) {
  let index = 0;
  for (let i = 0; i < steps.length; i++) if (seconds >= steps[i].at) index = i;
  return index;
}

/**
 * Réalisateur : avance avec `tick(dt)` (secondes) et appelle `apply` à chaque changement d’étape.
 * Sur l’étape finale il s’arrête et appelle `onEnd`.
 */
export function createDirector({ steps = STORY_STEPS, apply = () => {}, onEnd = () => {} } = {}) {
  let elapsed = 0, index = -1, active = false, ended = false;
  const enter = (next, jumped = false) => {
    index = next; apply(steps[next], next, { jumped });
    if (steps[next].final) { ended = true; active = false; onEnd(steps[next], next); }
  };
  return {
    start() { elapsed = 0; index = -1; active = true; ended = false; enter(0); },
    stop() { active = false; },
    /** Saute directement à un chapitre (barre de progression cliquable). */
    jump(target) {
      const i = Math.max(0, Math.min(steps.length - 1, Math.round(target)));
      elapsed = steps[i].at; ended = false; active = true; enter(i, true);
    },
    tick(dt) {
      if (!active) return;
      elapsed += Math.max(0, dt);
      const next = stepIndexAt(elapsed, steps);
      // On n’en saute aucune : chaque étape est jouée, même après une longue image.
      while (active && index < next) enter(index + 1);
    },
    get active() { return active; },
    get ended() { return ended; },
    get elapsed() { return elapsed; },
    get index() { return index; },
    get total() { return steps.length; },
    get duration() { return steps[steps.length - 1].at; },
  };
}
