// 2026-09-30 ≈19:15 (Europe/Zurich) — Codex — OpenAI.
// Découverte progressive, chargeur ouvert et vue Courant accessible en recharge.
import { TECHNICAL_PARTS, LESSONS } from './data/technical-lessons.js?v=20260930-6';
import { createVehicleState, advanceVehicle, getEnergyTransfer, CONFIG } from './simulation/vehicle.js?v=20260930-5';
import { createDirector, STORY_STEPS } from './story.js?v=20260930-4';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'reduce';
const state = { mode: 'charge', connected: false, throttle: 0, regen: 0.65, running: !reducedMotion, xray: false, explosion: 0, labels: false, piece: null, part: null, inside: false, screen: 'lab', discovered: new Set(), quizIndex: 0, quizScore: 0, answered: false, lesson: 0, opening: 1, demo: true, current: false, currentAuto: false, story: false };
let vehicle = createVehicleState(), stage = null, time = 0, angle = 0, previous = null, lastUI = 0, demoAngle = 0;
let renderedRoute = null;
let storyMotorFocus = null;
const modeCopy = {
  charge: { kicker: '01 / STOCKER L’ÉNERGIE', title: 'Un câble.<br><em>Tout commence.</em>', copy: 'Branche la voiture. L’électricité arrive par la prise et la batterie garde cette énergie pour plus tard. Les roues restent à l’arrêt.', action: 'Découvrir la batterie', part: 'battery', route: ['Prise · AC', 'Chargeur', 'Batterie · DC'] },
  drive: { kicker: '02 / CRÉER LE MOUVEMENT', title: 'De l’énergie.<br><em>Au mouvement.</em>', copy: 'Appuie sur l’accélérateur. La batterie alimente le moteur, qui transforme l’électricité en rotation. Les engrenages entraînent les roues.', action: 'Entrer dans le moteur', part: 'motor', route: ['Batterie', 'Onduleur', 'Moteur', 'Roues'] },
  regen: { kicker: '03 / RÉCUPÉRER AU FREINAGE', title: 'Ralentir.<br><em>Et récupérer.</em>', copy: 'Les roues entraînent maintenant le moteur. Il devient générateur et renvoie une partie de l’énergie du mouvement vers la batterie.', action: 'Comprendre ce retour', part: 'motor', route: ['Roues', 'Moteur', 'Onduleur', 'Batterie'] },
};
const PARTS = {
  chargePort: { name: 'La prise de charge', label: 'Prise', simple: 'C’est la porte d’entrée de l’électricité. Un câble la relie à une source extérieure pour recharger la batterie.', diagram: ['Électricité', 'Conversion', 'Batterie'], technical: '<p><strong>Recharge AC.</strong> Le réseau fournit du courant alternatif. Le chargeur embarqué le convertit en courant continu pour la batterie.</p><p><strong>Recharge DC.</strong> Lors d’une recharge rapide, cette conversion a lieu dans la borne.</p><p class="tech-note">La recharge AC représentée passe par le chargeur embarqué ; la recharge rapide DC utilise une conversion dans la borne.</p>' },
  battery: { name: 'La batterie', label: 'Batterie', simple: 'La réserve d’énergie de la voiture. Elle se recharge, puis alimente le moteur quand tu roules.', diagram: ['Recharger', 'Stocker', 'Alimenter'], technical: '<p><strong>Des cellules, puis un pack.</strong> L’énergie est stockée sous forme chimique dans des cellules. Leurs associations permettent d’obtenir la tension et la capacité nécessaires.</p><p><strong>Le BMS veille.</strong> L’électronique surveille notamment tension, température et niveau de charge. Le système thermique maintient une plage de fonctionnement adaptée.</p><p class="tech-note">Batterie de 60 kWh et recharge de 11 kW : paramètres illustratifs. La scène de recharge est accélérée 120 fois. En vue ouverte, les cellules sont agrandies pour être lisibles ; leur forme et leur nombre sont schématiques.</p>' },
  inverter: { name: 'L’onduleur', label: 'Onduleur', simple: 'Le chef d’orchestre du moteur. Il transforme et dose le courant fourni par la batterie pour commander la rotation.', diagram: ['Courant continu', 'Onduleur', 'Courants alternatifs'], technical: '<p><strong>Du continu à l’alternatif.</strong> Des composants de puissance commutent rapidement pour piloter les courants dans les bobines du moteur.</p><p><strong>Un champ qui tourne.</strong> Les courants décalés dans les bobines créent un champ magnétique tournant. Leur pilotage permet de contrôler le couple.</p><p><strong>Au freinage.</strong> La conversion permet le retour de l’énergie électrique produite par le moteur vers la batterie.</p>' },
  motor: { name: 'Le moteur électrique', label: 'Moteur', simple: 'Des bobines créent un champ magnétique tournant. Il entraîne le rotor au centre : l’électricité devient une rotation.', diagram: ['Bobines fixes', 'Champ tournant', 'Rotor mobile'], technical: '<p><strong>Stator et rotor.</strong> Le stator reste fixe. Les champs magnétiques du stator et du rotor interagissent pour produire un effort de rotation : le couple.</p><p><strong>Regarde le centre.</strong> Dans cette maquette, le rotor comporte des aimants permanents. D’autres moteurs électriques utilisent une architecture différente.</p><p><strong>Un fonctionnement réversible.</strong> Quand les roues entraînent le moteur, il peut convertir une partie du mouvement en électricité.</p><p class="tech-note">Flèches et lueurs : représentation pédagogique du champ. Rotations ralenties environ 30 fois pour observer le mécanisme. En vue éclatée, le rotor est décalé hors du stator uniquement pour l’observation.</p>' },
  reduction: { name: 'Les engrenages', label: 'Transmission', simple: 'Le moteur tourne vite. Les engrenages réduisent cette vitesse et augmentent l’effort de rotation transmis aux roues.', diagram: ['Moteur rapide', 'Réduction', 'Roues motrices'], technical: '<p><strong>Vitesse contre couple.</strong> Le réducteur adapte la rotation du moteur aux roues. Dans ce modèle, son rapport est d’environ 10,1 pour 1.</p><p><strong>Et dans un virage ?</strong> Le différentiel permet aux roues gauche et droite de tourner à des vitesses différentes.</p><p class="tech-note">Rapport de réduction pédagogique partagé avec les animations. Les rotations du moteur, des engrenages et des roues restent synchronisées.</p>' },
};
Object.assign(PARTS, TECHNICAL_PARTS);
PARTS.wheel = { name: 'Les roues', label: 'Roues', simple: 'Les pneus transmettent les efforts à la route. Dans cette maquette à propulsion arrière, le moteur entraîne les roues arrière par la transmission.', diagram: ['Moteur', 'Transmission', 'Roues arrière'], technical: '<p><strong>Un repère fixe.</strong> Avant et arrière désignent la position dans la voiture, même lorsque tu tournes la vue. Gauche et droite se lisent depuis le siège du conducteur.</p><p>Le moteur et le réducteur de cette maquette entraînent l’essieu arrière. Les roues avant roulent avec le déplacement du véhicule.</p>' };
const aliases = { 'charge-port': 'chargePort', charge: 'chargePort', stator: 'motor', rotor: 'motor', shaft: 'motor', differential: 'reduction', brakes: 'wheel', axle: 'reduction', 'hv-bus': 'hv', subframe: 'reduction' };
const QUESTIONS = [
  { text: 'Tu branches la voiture. Où va l’énergie ?', options: ['Directement dans les roues', 'Dans la batterie, pour être stockée', 'Dans le moteur pour le faire tourner'], correct: 1, explanation: 'La batterie stocke l’énergie reçue. Le moteur et les roues restent immobiles pendant la recharge.' },
  { text: 'Qu’est-ce qui fait tourner le moteur ?', options: ['La chaleur de la batterie', 'La pression de l’électricité', 'L’interaction de champs magnétiques'], correct: 2, explanation: 'Les courants dans les bobines créent un champ magnétique tournant. Son interaction avec le rotor produit la rotation.' },
  { text: 'Au freinage, d’où vient l’énergie récupérée ?', options: ['Du mouvement que la voiture avait déjà', 'D’une nouvelle énergie créée par le moteur', 'Du câble de recharge'], correct: 0, explanation: 'Le moteur devenu générateur récupère une partie de l’énergie du mouvement. La voiture ralentit ; aucune énergie nouvelle n’est créée.' },
];
function announce(text) { $('announcement').textContent = text; }
function setStory(initial = false) {
  const copy = modeCopy[state.mode];
  $('story-kicker').textContent = copy.kicker;
  $('story-title').innerHTML = initial ? 'Et si ralentir<br><em>rechargeait la batterie&nbsp;?</em>' : state.screen === 'parts' ? 'Sous la carrosserie.<br><em>L’essentiel.</em>' : copy.title;
  $('story-copy').textContent = initial ? 'Ouvre la voiture. Suis l’énergie, puis découvre comment le moteur devient générateur.' : state.screen === 'parts' ? 'Batterie, moteur, BMS, haute tension. Choisis un organe, ouvre-le et découvre son rôle pas à pas.' : copy.copy;
  $('story-action').innerHTML = `${initial ? 'Révéler l’énergie' : copy.action} <span aria-hidden="true">↗</span>`;
}
function renderRoute() {
  const mode = getEnergyTransfer(vehicle, state).route;
  if (renderedRoute === mode) return;
  renderedRoute = mode;
  $('energy-route').replaceChildren(...modeCopy[mode].route.flatMap((name, index) => {
    const text = document.createElement('span'); text.textContent = name; text.className = 'active';
    if (!index) return [text]; const arrow = document.createElement('i'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true'); return [arrow, text];
  }));
  $('energy-route').setAttribute('aria-label', `Trajet de l’énergie : ${modeCopy[mode].route.join(', puis ')}`);
}
function closeViewMenu() { if ($('view-menu')) $('view-menu').open = false; }
function syncButtons() {
  $('app').dataset.mode = state.mode; $('app').dataset.screen = state.screen;
  document.querySelectorAll('[data-mode]').forEach(button => { if (button.tagName !== 'BUTTON') return; const active = button.dataset.mode === state.mode; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  document.querySelectorAll('[data-screen]').forEach(button => { if (button.tagName !== 'BUTTON') return; const active = button.dataset.screen === state.screen; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  ['charge', 'drive', 'regen'].forEach(mode => { $(`${mode}-interaction`).hidden = mode !== state.mode; });
  $('plug-label').textContent = state.connected ? 'Débrancher' : 'Brancher le câble';
  $('plug-toggle').classList.toggle('connected', state.connected); $('plug-toggle').setAttribute('aria-pressed', String(state.connected));
  $('xray-toggle').setAttribute('aria-pressed', String(state.xray));
  $('pause-toggle').setAttribute('aria-pressed', String(!state.running));
  $('study-pause').textContent = state.running ? 'Ⅱ Figer les flux' : '▶ Reprendre les flux'; $('study-pause').setAttribute('aria-pressed', String(!state.running));
  $('pause-toggle').textContent = state.running ? 'Ⅱ' : '▶'; $('pause-toggle').setAttribute('aria-label', state.running ? 'Mettre en pause' : 'Reprendre l’animation');
  $('parts-list').hidden = state.screen !== 'parts'; $('challenge').hidden = state.screen !== 'challenge';
  $('simulation-note').textContent = state.mode === 'charge' && state.connected ? 'Recharge accélérée ×120 · paramètres illustratifs' : 'Simulation pédagogique · valeurs illustratives';
  $('app').classList.toggle('show-labels', state.labels);
  $('app').classList.toggle('is-exploded', state.explosion > .1);
  $('app').classList.toggle('is-technical-overview', state.explosion > .55 && !state.part);
  $('overview-caption').hidden = state.explosion <= .55 || Boolean(state.part);
  $('piece-count').textContent = state.explosion > .55 ? 'Positions illustratives' : 'Le parcours de l’énergie';
  $('explode').value = Math.round(state.explosion * 100);
  $('explode-value').value = `${Math.round(state.explosion * 100)} %`;
  $('labels-toggle').setAttribute('aria-pressed', String(state.labels));
  const currentVisible = state.current && !state.part && state.explosion < .5 && state.screen !== 'challenge';
  $('current-toggle').setAttribute('aria-pressed', String(state.current));
  $('app').classList.toggle('current-mode', currentVisible); $('current-legend').hidden = !currentVisible;
  [['assemble-car', 0], ['explode-car', .45], ['inventory-car', 1]].forEach(([id, value]) => $(id).setAttribute('aria-pressed', String(Math.abs(state.explosion - value) < .02)));
}
function setExplosion(amount) {
  closeViewMenu();
  state.explosion = Math.max(0, Math.min(1, amount)); state.xray = false;
  // L’éclaté déplace les organes : le trajet lumineux n’y serait plus aligné.
  if (state.explosion > .5 && state.current) { state.current = false; stage?.setCurrent(false); }
  if (state.explosion > .55) state.labels = true;
  closePart(); stage?.setExplosion(state.explosion); syncButtons();
}
function closePart(restoreFocus = false) {
  state.part = null; state.inside = false; state.piece = null;
  $('detail-sheet').hidden = true; $('study-panel').hidden = true; $('internal-labels').hidden = true; $('app').classList.remove('has-detail', 'has-study', 'motor-lab');
  stage?.setBackdrop(state.story);
  stage?.setView({ component: null, opened: false, xray: state.xray });
  syncButtons();
  if (restoreFocus) $('story-action').focus({ preventScroll: true });
}
function selectPart(rawKey, detail = null) {
  closeViewMenu();
  const key = aliases[rawKey] || rawKey; if (!PARTS[key]) return;
  if (state.screen === 'challenge') { state.screen = 'parts'; syncButtons(); }
  state.part = key; state.inside = key === 'bms'; state.piece = detail?.id || null;
  state.explosion = 0; stage?.setExplosion(0); syncButtons(); state.lesson = 0; state.opening = 1;
  $('study-panel').hidden = true; $('study-open').value = 100; $('study-open-value').value = '100 %';
  const part = PARTS[key];
  $('detail-title').textContent = detail?.label || part.name; $('detail-simple').textContent = part.simple;
  $('detail-kicker').textContent = 'REGARDER, PUIS COMPRENDRE';
  $('technical-copy').innerHTML = part.technical; $('technical-copy').hidden = true;
  $('technical-toggle').setAttribute('aria-expanded', 'false'); $('technical-toggle').textContent = 'Aller plus loin +';
  $('inside-toggle').hidden = !['battery', 'bms', 'motor', 'reduction', 'inverter', 'charger', 'hv', 'wheel'].includes(key);
  $('inside-toggle').textContent = state.inside ? 'Revenir à la voiture ↙' : insideButton(key);
  renderStudy();
  $('inside-toggle').setAttribute('aria-pressed', String(state.inside));
  $('component-diagram').replaceChildren(...part.diagram.flatMap((text, i) => { const span = document.createElement('span'); span.textContent = text; if (!i) return [span]; const arrow = document.createElement('i'); arrow.textContent = '→'; return [arrow, span]; }));
  $('detail-sheet').hidden = false; $('detail-sheet').scrollTop = 0; $('app').classList.add('has-detail');
  stage?.setView({ component: key, opened: state.inside, xray: true, piece: state.piece });
  document.querySelectorAll('#parts-list button').forEach(button => button.classList.toggle('active', button.dataset.part === key));
  $('detail-close').focus({ preventScroll: true }); announce(`${part.name}. ${part.simple}`);
}
function setMode(mode) {
  if (!modeCopy[mode]) return;
  closeViewMenu();
  const keepStudy = state.inside && Boolean(LESSONS[state.part]);
  if (mode !== state.mode) vehicle = { ...vehicle, powerKW: 0, charging: false, recovering: false };
  state.mode = mode; if (mode !== 'charge') state.connected = false;
  if (mode === 'charge') vehicle = { ...vehicle, speed: 0, powerKW: 0, rotating: false, charging: false, recovering: false };
  if (state.screen === 'challenge') state.screen = 'lab';
  state.xray = false;
  state.explosion = !state.part && state.explosion > .55 ? state.explosion : mode === 'charge' ? 0 : .45; stage?.setExplosion(state.explosion);
  if (!keepStudy) closePart();
  else stage?.setView({ component: state.part, opened: true, xray: true, frame: false });
  setStory(); renderRoute(); syncButtons();
  announce(modeCopy[mode].copy);
}
function setScreen(screen) {
  closeViewMenu();
  state.screen = screen; closePart(); setStory(); syncButtons();
  if (screen === 'parts') { state.labels = true; setExplosion(.45); }
  if (screen === 'challenge') { state.quizIndex = 0; state.quizScore = 0; state.answered = false; renderQuestion(); }
}
function setCurrent(on, automatic = false) {
  state.current = on; state.currentAuto = true;
  if (on) {
    if (state.screen === 'challenge') { state.screen = 'lab'; setStory(); }
    if (state.part) closePart();
    if (state.explosion > .5) setExplosion(state.mode === 'charge' ? 0 : .45);
  }
  stage?.setCurrent(on); syncButtons();
  announce(on ? `${automatic ? 'Mode Courant activé. ' : ''}La carrosserie devient transparente : suis les étapes numérotées de l’énergie.` : 'Mode Courant désactivé.');
}
const CURRENT_STATUS = {
  charge: flow => !state.connected ? ['Câble débranché', 'Aucun courant ne circule. Branche la voiture.'] : vehicle.soc >= 1 ? ['Batterie pleine', 'Le transfert s’arrête, le câble reste branché.'] : !flow.charging ? ['Prête à charger', 'Lance l’animation pour suivre l’énergie.'] : [`${formatKW(flow.powerKW)} entrent`, 'Borne → prise → chargeur AC→DC → cellules.'],
  drive: flow => flow.recovering ? [`${formatKW(-flow.powerKW)} produits`, 'Pied levé : le moteur devient générateur et recharge la batterie.'] : flow.tractionActive ? [`${formatKW(flow.powerKW)} sortent`, 'Batterie → onduleur → moteur → roues arrière.'] : vehicle.speed > 0.01 ? [vehicle.soc >= 1 ? 'Batterie pleine' : 'Roue libre', vehicle.soc >= 1 ? 'Plus de place pour stocker : la voiture roule sur son élan.' : 'Aucun transfert : la voiture roule sur son élan.'] : ['Prête', 'Appuie sur l’accélérateur pour lancer le courant.'],
  regen: flow => flow.recovering ? [`${formatKW(-flow.powerKW)} produits`, 'Le moteur devient générateur : la batterie se recharge.'] : vehicle.speed > 0.01 ? ['Aucune récupération', vehicle.soc >= 1 ? 'Batterie pleine : plus de place pour stocker.' : 'Augmente le freinage.'] : ['À l’arrêt', 'Sans mouvement, il n’y a rien à récupérer.'],
};
// ---- Histoire : scénario guidé (voir js/story.js) ----
function applyStoryStep(step, index, info = {}) {
  // Les gros plans du récit utilisent les mêmes organes que l’exploration libre.
  stage?.setView({ component: null, opened: false, xray: false, frame: false });
  if (step.mode !== state.mode) setMode(step.mode);
  // Saut de chapitre : la voiture démarre à l’allure du chapitre pour que la scène ait un sens tout de suite.
  if (info.jumped) vehicle = { ...vehicle, powerKW: 0, speed: (step.startSpeedKmh ?? 0) / 3.6, rotating: (step.startSpeedKmh ?? 0) > 0, recovering: false };
  const wantExplosion = step.explosion ?? 0;
  if (Math.abs(state.explosion - wantExplosion) > .01) setExplosion(wantExplosion);
  state.labels = wantExplosion > .55;
  state.connected = step.connected;
  state.throttle = step.throttle; $('pedal').value = Math.round(step.throttle * 100); $('pedal-value').value = `${Math.round(step.throttle * 100)} %`;
  setCurrent(step.current, true);
  stage?.setCamera(step.camera);
  if (step.focus) {
    stage?.setView({ component: step.focus, opened: true, xray: true });
    stage?.setStudy({ focus: step.studyFocus, progress: step.opening ?? 1 });
  }
  storyMotorFocus = step.focus === 'motor' ? step.studyFocus : null;
  const card = $('story-card'); card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
  $('sv-kicker').textContent = step.kicker; $('sv-title').textContent = step.title; $('sv-text').textContent = step.text;
  const next = STORY_STEPS[index + 1];
  document.querySelectorAll('#story-progress i').forEach((segment, i) => {
    segment.classList.toggle('done', i < index); segment.classList.toggle('on', i === index);
    if (i === index) segment.style.setProperty('--dur', `${next ? next.at - step.at : 0}s`);
  });
  $('app').classList.toggle('story-focus', Boolean(step.focus));
  $('app').classList.toggle('story-final', Boolean(step.final));
  $('app').classList.toggle('story-nohud', step.hud === false);
  $('story-end').hidden = !step.final; $('story-skip').hidden = Boolean(step.final);
  if (step.final) $('story-explore').focus({ preventScroll: true });
  announce(`${step.title} ${step.text}`);
  syncButtons();
}
// Mode clip (?story=clip&from=5&to=8) : interface épurée pour enregistrer l’écran, sur un ou plusieurs chapitres.
const clipParams = new URLSearchParams(location.search);
const clip = clipParams.get('story') === 'clip' ? { from: Number(clipParams.get('from')) || 0, to: clipParams.has('to') ? Number(clipParams.get('to')) : null } : null;
const director = createDirector({ apply: (step, index, info) => {
  // Fin du clip : on n’applique pas le chapitre suivant, la légende s’efface simplement.
  if (clip && clip.to !== null && index >= clip.to && index > clip.from) { director.stop(); $('story-card').classList.add('clip-out'); return; }
  applyStoryStep(step, index, info);
} });
function startStory() {
  if (!stage) return;
  closeViewMenu();
  $('story-pause').textContent = 'Ⅱ'; $('story-overlay').classList.remove('paused'); $('story-card').classList.remove('clip-out');
  $('story-pause').setAttribute('aria-label', 'Mettre l’histoire en pause'); $('story-pause').setAttribute('aria-pressed', 'false');
  try { sessionStorage.setItem('elan-story-seen', '1'); } catch { /* stockage indisponible : sans conséquence */ }
  closePart(); state.story = true; state.running = true; state.screen = 'lab'; state.labels = false; state.xray = false;
  vehicle = createVehicleState(); state.mode = 'drive'; // force la remise à zéro par setMode('charge') à l’étape 1
  $('app').classList.add('story-mode'); $('story-overlay').hidden = false;
  stage.setFraming(1); stage.setBackdrop(true);
  $('app').classList.toggle('clip', Boolean(clip));
  director.start();
  if (clip && clip.from > 0) director.jump(clip.from);
}
function endStory() {
  director.stop(); state.story = false; stage?.setFraming(1); stage?.setBackdrop(false);
  $('app').classList.remove('story-mode', 'story-focus', 'story-final', 'story-nohud', 'clip'); $('story-overlay').hidden = true; $('story-overlay').classList.remove('paused'); $('story-pause').textContent = 'Ⅱ';
  state.throttle = 0; $('pedal').value = 0; $('pedal-value').value = '0 %';
  vehicle = createVehicleState(); state.connected = false;
  setCurrent(false); state.currentAuto = false;
  setExplosion(0); state.labels = false;
  setScreen('lab'); setMode('charge'); setStory(true); stage?.reset(); syncButtons();
  $('story-action').focus({ preventScroll: true });
}
$('story-progress').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  director.jump([...$('story-progress').children].indexOf(button));
});
$('story-pause').addEventListener('click', () => {
  state.running = !state.running; $('story-pause').textContent = state.running ? 'Ⅱ' : '▶';
  $('story-pause').setAttribute('aria-pressed', String(!state.running)); $('story-pause').setAttribute('aria-label', state.running ? 'Mettre l’histoire en pause' : 'Reprendre l’histoire');
  $('story-overlay').classList.toggle('paused', !state.running); syncButtons();
});
function updateStoryHud() {
  const flow = getEnergyTransfer(vehicle, state);
  const watts = flow.recovering ? 'RETOUR VERS LA BATTERIE' : flow.charging ? 'ENTRE DANS LA BATTERIE' : flow.tractionActive ? 'SORT DE LA BATTERIE' : 'PUISSANCE';
  $('hud-kw-label').textContent = watts;
  $('hud-kw').textContent = Math.abs(flow.powerKW).toLocaleString('fr-CH', { maximumFractionDigits: Math.abs(flow.powerKW) < 20 ? 1 : 0 });
  $('hud-speed').textContent = Math.round(vehicle.speed * 3.6);
  $('hud-soc').textContent = (vehicle.soc * 100).toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $('story-hud').classList.toggle('producing', flow.recovering);
}
$('story-play').addEventListener('click', startStory);
$('story-skip').addEventListener('click', endStory);
$('story-explore').addEventListener('click', endStory);
$('story-replay').addEventListener('click', startStory);
function formatKW(value) { return value > 0 && value < .05 ? '< 0,1 kW' : `${Math.max(0, value).toLocaleString('fr-CH', { maximumFractionDigits: value < 20 ? 1 : 0 })} kW`; }
function markDiscovered(mode) {
  if (state.discovered.has(mode)) return;
  state.discovered.add(mode);
  ['charge', 'drive', 'regen'].forEach((key, index) => { document.querySelectorAll('.discovery-track i')[index].classList.toggle('done', state.discovered.has(key)); document.querySelector(`button.scenario[data-mode="${key}"] .scenario-check`).textContent = state.discovered.has(key) ? '✓' : ''; });
  $('discovery-copy').textContent = state.discovered.size === 3 ? 'Tu as suivi toute l’histoire de l’énergie.' : `${state.discovered.size} geste${state.discovered.size > 1 ? 's' : ''} découvert${state.discovered.size > 1 ? 's' : ''} sur 3`;
}
function renderQuestion() {
  const question = QUESTIONS[state.quizIndex]; $('challenge-answers').replaceChildren(); $('challenge-next').hidden = true; $('challenge-feedback').textContent = '';
  if (!question) {
    $('challenge-progress').textContent = 'LE TRAJET EST BOUCLÉ'; $('challenge-title').textContent = state.quizScore === 3 ? '3 sur 3. Le courant passe !' : `${state.quizScore} sur 3. Encore un petit tour ?`;
    $('challenge-feedback').textContent = 'La batterie stocke, le moteur transforme, les roues avancent. Au freinage, une partie du mouvement peut retourner vers la batterie.';
    $('challenge-next').hidden = false; $('challenge-next').textContent = 'Retourner jouer ↗'; return;
  }
  state.answered = false; $('challenge-progress').textContent = `LE PETIT DÉFI · ${state.quizIndex + 1} / 3`; $('challenge-title').textContent = question.text;
  question.options.forEach((text, index) => { const button = document.createElement('button'); button.textContent = text; button.addEventListener('click', () => {
    if (state.answered) return; state.answered = true;
    if (index === question.correct) state.quizScore++;
    [...$('challenge-answers').children].forEach((item, position) => { item.disabled = true; item.classList.toggle('correct', position === question.correct); item.classList.toggle('wrong', position === index && index !== question.correct); });
    $('challenge-feedback').textContent = `${index === question.correct ? 'Bien vu. ' : 'Presque ! '}${question.explanation}`;
    $('challenge-next').hidden = false; $('challenge-next').textContent = state.quizIndex === 2 ? 'Voir mon résultat →' : 'La suite →'; $('challenge-next').focus();
  }); $('challenge-answers').append(button); });
}
Object.entries(PARTS).sort(([a], [b]) => { const order = ['battery', 'motor', 'bms', 'hv', 'inverter', 'charger', 'chargePort', 'reduction']; return (order.includes(a) ? order.indexOf(a) : 20) - (order.includes(b) ? order.indexOf(b) : 20); }).forEach(([key, part]) => { const button = document.createElement('button'); button.dataset.part = key; button.textContent = part.label; button.setAttribute('aria-label', part.label); button.addEventListener('click', () => selectPart(key)); $('parts-list').append(button); });
document.querySelectorAll('.scenario').forEach(button => button.addEventListener('click', () => {
  setMode(button.dataset.mode);
  // Choisir la recharge révèle le trajet ; Brancher reste le geste qui lance le transfert.
  if (button.dataset.mode === 'charge') setCurrent(true, true);
}));
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => setScreen(button.dataset.screen)));
document.querySelectorAll('.hotspot').forEach(button => button.addEventListener('click', () => selectPart(button.dataset.part)));
$('home').addEventListener('click', event => { event.preventDefault(); if (state.story) { endStory(); return; } setScreen('lab'); setMode('charge'); setStory(true); });
$('story-action').addEventListener('click', () => {
  if (state.explosion < .05 && !state.connected) {
    setExplosion(.45); setCurrent(true); setStory();
    announce('La chaîne électrique apparaît. Branche la voiture, accélère ou lève le pied pour suivre l’énergie.');
  } else selectPart(modeCopy[state.mode].part);
});
$('plug-toggle').addEventListener('click', () => {
  state.connected = !state.connected; state.xray = state.connected;
  state.explosion = state.explosion > .55 ? state.explosion : 0;
  stage?.setExplosion(state.explosion); stage?.setView({ xray: state.xray, frame: false });
  if (state.connected) setCurrent(true, true);
  setStory(); syncButtons();
  announce(state.connected ? state.running ? 'Voiture branchée. L’énergie va de la borne à la batterie.' : 'Voiture branchée. Reprends l’animation pour suivre la recharge.' : 'Voiture débranchée. La recharge s’arrête.');
});
$('pedal').addEventListener('input', event => { state.throttle = Number(event.target.value) / 100; $('pedal-value').value = `${event.target.value} %`; });
$('regen').addEventListener('input', event => { state.regen = Number(event.target.value) / 100; $('regen-value').value = `${event.target.value} %`; });
$('drive-again').addEventListener('click', () => { setMode('drive'); $('pedal').focus(); });
$('pause-toggle').addEventListener('click', () => { state.running = !state.running; syncButtons(); announce(state.running ? 'Animation reprise.' : 'Animation en pause. Tu peux toujours tourner autour de la voiture.'); });
$('xray-toggle').addEventListener('click', () => { state.xray = !state.xray; if (state.part) closePart(); else stage?.setView({ component: null, opened: false, xray: state.xray, frame: false }); syncButtons(); });
$('reset-view').addEventListener('click', () => { closePart(); stage?.reset(); });
$('detail-close').addEventListener('click', () => closePart(true));
document.querySelectorAll('[data-paint]').forEach(button => button.addEventListener('click', () => {
  stage?.setPaint(Number.parseInt(button.dataset.paint, 16));
  document.querySelectorAll('[data-paint]').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch === button)));
  announce(button.getAttribute('aria-label'));
}));
function insideButton(key) {
  return ({ wheel: 'Isoler les roues ↗', bms: 'Observer le BMS ↗', battery: 'Ouvrir la batterie ↗', motor: 'Éclater le moteur ↗', reduction: 'Ouvrir les engrenages ↗', inverter: 'Ouvrir l’onduleur ↗', charger: 'Ouvrir le chargeur ↗', hv: 'Suivre les câbles ↗' }[key] || 'Observer ↗');
}
function renderStudy() {
  const lessons = LESSONS[state.part];
  $('study-panel').hidden = !(state.inside && lessons);
  $('app').classList.toggle('has-study', Boolean(state.inside && lessons)); $('app').dataset.study = state.inside && lessons ? state.part : '';
  $('app').classList.toggle('motor-lab', state.inside && state.part === 'motor');
  stage?.setBackdrop(state.story || Boolean(state.inside && lessons));
  if (state.part === 'motor') $('detail-title').textContent = state.inside ? 'Le moteur' : PARTS.motor.name;
  const expanded = !$('technical-copy').hidden;
  $('technical-toggle').textContent = state.inside ? expanded ? 'Détails −' : 'Détails +' : expanded ? 'Revenir à l’essentiel −' : 'Aller plus loin +';
  $('technical-toggle').setAttribute('aria-label', expanded ? 'Revenir à l’essentiel' : 'Aller plus loin');
  $('motor-demo').hidden = state.part !== 'motor'; $('study-pause').hidden = ['motor', 'bms'].includes(state.part);
  $('motor-demo').setAttribute('aria-pressed', String(state.demo && state.running));
  $('motor-demo').textContent = state.demo && state.running ? 'Ⅱ Immobiliser la démonstration' : '▶ Animer la démonstration';
  if (!lessons) return;
  const lesson = lessons[state.lesson] || lessons[0];
  const caption = $('motor-stage-caption');
  if (caption && state.part === 'motor') {
    caption.textContent = ({ stator: 'Les bobines restent fixes. Les trois courants varient.', field: 'Le champ tourne. Il entraîne le rotor sans contact.', rotor: 'Le rotor entraîne l’arbre, puis la transmission.', generator: 'Même rotation. L’énergie repart vers la batterie.' })[lesson.id] || '';
    $('app').dataset.motorFocus = lesson.id;
  }
  $('study-steps').replaceChildren(...lessons.map((item, i) => {
    const button = document.createElement('button'); button.textContent = `${i + 1}. ${item.title}`; button.setAttribute('aria-pressed', String(i === state.lesson));
    button.addEventListener('click', () => { state.lesson = i; renderStudy(); $('study-steps').children[i].focus({ preventScroll: true }); announce(item.text); }); return button;
  }));
  $('study-copy').textContent = lesson.text;
  $('study-open').closest('label').hidden = ['hv', 'bms'].includes(state.part);
  $('study-note').textContent = state.part === 'motor' ? 'Démonstration ralentie · indépendante de la vitesse de la voiture.' : state.part === 'hv' ? 'Branche, accélère ou freine avec les commandes du bas pour voir l’énergie circuler.' : state.part === 'bms' ? 'Le BMS commande les protections ; la puissance passe par les contacteurs, pas par sa carte.' : 'Pièces écartées pour comprendre · agencement illustratif.';
  $('internal-labels').replaceChildren(...lesson.labels.map(([anchor, title, copy]) => {
    const label = document.createElement('span'); label.className = 'internal-label'; label.dataset.anchor = anchor;
    const strong = document.createElement('b'); strong.textContent = title; const small = document.createElement('small'); small.textContent = copy; label.append(strong, small); return label;
  }));
  stage?.setStudy({ focus: lesson.id, progress: state.opening });
}
$('inside-toggle').addEventListener('click', () => {
  state.inside = !state.inside;
  $('inside-toggle').setAttribute('aria-pressed', String(state.inside));
  $('inside-toggle').textContent = state.inside ? 'Revenir à la voiture ↙' : insideButton(state.part);
  renderStudy(); stage?.setView({ component: state.part, opened: state.inside, xray: true, piece: state.piece });
  $('detail-sheet').scrollTop = 0;
  announce(state.inside ? 'Le composant est isolé. Choisis une étape pour comprendre son rôle.' : 'Retour à la voiture.');
});
$('study-open').addEventListener('input', event => { state.opening = Number(event.target.value) / 100; $('study-open-value').value = `${event.target.value} %`; stage?.setStudy({ progress: state.opening }); });
$('motor-demo').addEventListener('click', () => { if (!state.running) { state.running = true; state.demo = true; syncButtons(); } else state.demo = !state.demo; renderStudy(); });
$('study-pause').addEventListener('click', () => { state.running = !state.running; syncButtons(); announce(state.running ? 'Le transfert d’énergie reprend.' : 'Animation et simulation en pause.'); });
$('technical-entry').addEventListener('click', () => { setScreen('parts'); selectPart('battery'); });
$('motor-secret')?.addEventListener('click', () => {
  setScreen('parts'); selectPart('motor');
  state.inside = true; state.lesson = 1; state.demo = true;
  $('inside-toggle').setAttribute('aria-pressed', 'true'); $('inside-toggle').textContent = 'Revenir à la voiture ↙';
  renderStudy(); stage?.setView({ component: 'motor', opened: true, xray: true });
  announce('Le secret du moteur : un champ magnétique tourne entre des bobines fixes et un rotor mobile.');
});
$('explode').addEventListener('input', event => setExplosion(Number(event.target.value) / 100));
$('assemble-car').addEventListener('click', () => setExplosion(0));
$('explode-car').addEventListener('click', () => setExplosion(.45));
$('inventory-car').addEventListener('click', () => setExplosion(1));
$('labels-toggle').addEventListener('click', () => { state.labels = !state.labels; syncButtons(); });
$('current-toggle').addEventListener('click', () => setCurrent(!state.current));
document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
  stage?.setCamera(button.dataset.camera);
  document.querySelectorAll('[data-camera]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
$('technical-toggle').addEventListener('click', () => { const expanded = $('technical-copy').hidden; $('technical-copy').hidden = !expanded; $('technical-toggle').setAttribute('aria-expanded', String(expanded)); renderStudy(); });
$('challenge-next').addEventListener('click', () => { if (state.quizIndex >= QUESTIONS.length) { setScreen('lab'); return; } state.quizIndex++; renderQuestion(); });
['about-open', 'sources-open'].forEach(id => $(id).addEventListener('click', () => $('about-dialog').showModal()));
$('about-close').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', event => { if (event.target !== $('about-dialog')) return; const box = event.target.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close(); });
document.addEventListener('click', event => { if ($('view-menu')?.open && !$('view-menu').contains(event.target)) closeViewMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('about-dialog').open) { if ($('view-menu')?.open) { closeViewMenu(); $('view-menu').querySelector('summary').focus(); } else if (state.story) endStory(); else if (state.part) closePart(true); else if (state.screen === 'challenge') setScreen('lab'); } });
function refreshLive() {
  const flow = getEnergyTransfer(vehicle, state);
  const mobileStudy = innerWidth < 760 && state.inside && Boolean(LESSONS[state.part]);
  if (mobileStudy && $('technical-copy').hidden) {
    const top = Math.min($('detail-sheet').getBoundingClientRect().bottom + 14, innerHeight - (state.part === 'hv' ? state.mode === 'regen' ? 202 : 185 : 30) - 145);
    const value = `${Math.round(top)}px`;
    if ($('scene').style.top !== value) $('scene').style.top = value;
  } else if ($('scene').style.top) $('scene').style.removeProperty('top');
  if (state.story) updateStoryHud();
  $('battery-value').textContent = `${(vehicle.soc * 100).toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  $('battery-fill').style.height = `${vehicle.soc * 82}%`;
  $('speed-value').textContent = Math.round(vehicle.speed * 3.6);
  const moving = vehicle.speed > 0.01;
  const status = !state.running ? 'Animation en pause' : state.mode === 'charge' ? state.connected ? vehicle.soc >= 1 ? 'Batterie pleine' : flow.charging ? 'L’énergie entre dans la batterie' : 'Prête à charger' : 'À l’arrêt · câble débranché' : state.mode === 'drive' ? moving ? flow.recovering ? 'Pied levé : les roues entraînent le moteur' : flow.tractionActive ? 'Le moteur entraîne les roues' : 'Roue libre · aucun courant' : 'À toi d’accélérer' : flow.recovering ? 'Les roues entraînent le moteur' : moving ? vehicle.soc >= 1 ? 'Batterie pleine · pas de récupération' : 'Aucune récupération' : 'Pas de mouvement, pas d’énergie à récupérer';
  $('status-copy').textContent = status; $('scene-status').classList.toggle('active', state.running && (flow.charging || moving));
  $('charge-hint').textContent = state.connected ? vehicle.soc >= 1 ? 'Batterie pleine. Tu peux débrancher.' : 'Suis le flux : la batterie se recharge, les roues restent immobiles.' : 'La voiture est à l’arrêt. À toi de la brancher.';
  $('regen-hint').textContent = moving ? flow.recovering ? 'Le mouvement ralentit. Une partie de son énergie revient.' : vehicle.soc >= 1 ? 'Batterie pleine : la récupération est limitée.' : 'Augmente le freinage pour ralentir.' : 'Accélère d’abord pour avoir du mouvement à récupérer.';
  // Regarder l’histoire ne valide pas les gestes à la place du visiteur.
  if (!state.story && state.running) {
    if (flow.charging) markDiscovered('charge');
    if (state.mode === 'drive' && moving && flow.tractionActive) markDiscovered('drive');
    if (flow.recovering) markDiscovered('regen');
  }
  renderRoute();
  // Première action effective : le courant devient visible automatiquement (une seule fois).
  const flowing = flow.active;
  if (flowing && !state.currentAuto && stage && state.screen === 'lab' && !state.part && state.explosion < .5) setCurrent(true, true);
  if (!$('current-legend').hidden) {
    const [value, route] = CURRENT_STATUS[state.mode](flow);
    $('current-value').textContent = value; $('current-route').textContent = route;
    $('current-legend').classList.toggle('live', flowing && state.running);
    $('current-legend').dataset.flow = flow.route;
    $('current-legend').classList.toggle('producing', flow.recovering);
  }
  $('internal-labels').hidden = !(stage && LESSONS[state.part] && state.inside);
  if (!$('internal-labels').hidden) {
    const bounds = $('scene').getBoundingClientRect();
    const minY = innerWidth < 760 ? Math.max(bounds.top + 10, $('detail-sheet').getBoundingClientRect().bottom + 8) : bounds.top + 10;
    const placed = [];
    document.querySelectorAll('.internal-label').forEach(label => {
      const pos = stage.projectPart(label.dataset.anchor);
      let x = Math.max(Math.max(12, bounds.left + 12), Math.min(innerWidth - label.offsetWidth - 12, pos.x - label.offsetWidth / 2));
      const y = innerWidth < 760 ? minY : Math.max(minY, Math.min(bounds.bottom - label.offsetHeight - 26, pos.y - label.offsetHeight - 34));
      for (const rect of placed) {
        if (x < rect.right + 10 && x + label.offsetWidth + 10 > rect.x && y < rect.bottom + 8 && y + label.offsetHeight + 8 > rect.y) {
          x = rect.x - label.offsetWidth - 10 >= 12 ? rect.x - label.offsetWidth - 10 : rect.right + 10;
        }
      }
      const visible = pos.visible && y + label.offsetHeight < bounds.bottom - 16 && x + label.offsetWidth <= innerWidth - 12;
      label.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) placed.push({ x, y, right: x + label.offsetWidth, bottom: y + label.offsetHeight });
      label.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    });
  }
  if (stage && state.labels && !state.part && state.screen !== 'challenge') {
    const sceneBox = $('scene').getBoundingClientRect(); const occupied = [];
    document.querySelectorAll('.hotspot').forEach(button => {
      const pos = stage.projectPart(button.dataset.part); const mobile = innerWidth < 760;
      const x = Math.max(mobile ? 14 : sceneBox.left + 35, Math.min(innerWidth - button.offsetWidth - 24, pos.x - button.offsetWidth / 2));
      let y = pos.y - button.offsetHeight - (button.dataset.part === 'motor' ? 48 : 14);
      if (button.dataset.part === 'chargePort') y += 65;
      y = Math.max(sceneBox.top + 12, Math.min(sceneBox.bottom - button.offsetHeight - 52, y));
      const overlaps = occupied.some(r => x < r.x + r.w + 10 && x + button.offsetWidth + 10 > r.x && y < r.y + r.h + 8 && y + button.offsetHeight + 8 > r.y);
      const visible = pos.visible && !(button.dataset.part === 'chargePort' && (mobile || state.explosion > .55)) && !overlaps;
      // Un repère qui apparaît se place directement, sans glisser depuis le coin de l’écran.
      const appearing = visible && button.style.visibility !== 'visible';
      if (appearing) button.style.transition = 'none';
      button.style.visibility = visible ? 'visible' : 'hidden'; button.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
      if (appearing) { void button.offsetWidth; button.style.transition = ''; }
      if (visible) occupied.push({ x, y, w: button.offsetWidth, h: button.offsetHeight });
    });
  } else document.querySelectorAll('.hotspot').forEach(button => { button.style.visibility = 'hidden'; });
}
function animate(now) {
  requestAnimationFrame(animate);
  if (document.hidden) { previous = null; return; }
  const elapsed = previous === null ? 0 : Math.max(0, (now - previous) / 1000); previous = now;
  const dt = Math.min(elapsed, 0.06);
  const running = state.running && !document.hidden;
  if (state.story && running) director.tick(elapsed);
  const motorStep = state.story && STORY_STEPS[director.index]?.focus === 'motor' ? STORY_STEPS[director.index] : null;
  if (motorStep) {
    const localTime = director.elapsed - motorStep.at;
    const focus = localTime < 3 ? 'field' : localTime < 5 ? 'rotor' : 'shaft';
    if (focus !== storyMotorFocus) { storyMotorFocus = focus; stage?.setStudy({ focus, progress: 1 }); }
  }
  vehicle = advanceVehicle(vehicle, dt, { ...state, running });
  const storyMotor = state.story && STORY_STEPS[director.index]?.focus === 'motor';
  if (running) { time += dt; if (storyMotor || (state.inside && state.part === 'motor' && state.demo)) demoAngle += dt * .85; angle += vehicle.speed / CONFIG.wheelRadius * CONFIG.reduction * dt / 30; }
  const flow = getEnergyTransfer(vehicle, state);
  stage?.render(dt, { time, running, ...flow, rotorAngle: angle, motion: vehicle.rotating, connected: state.connected, soc: vehicle.soc, demoAngle, demoRunning: state.demo || storyMotor, speed: vehicle.speed, idleAllowed: !state.story && state.screen === 'lab' && !state.labels && !state.part && !document.hidden });
  if (now - lastUI > 100) { lastUI = now; refreshLive(); }
}
setStory(true); syncButtons(); renderRoute(); refreshLive(); requestAnimationFrame(animate);
try {
  const { createVehicleScene } = await import('./scene.js?v=20260930-6');
  stage = await createVehicleScene($('scene'), { onSelect: selectPart, reducedMotion });
  await stage.ready;
  if (new URLSearchParams(location.search).has('debug')) window.__elan = { stage, state, getVehicle: () => vehicle }; // outil de mesure (?debug)
  $('piece-count').textContent = 'Le parcours de l’énergie';
  stage.setExplosion(state.explosion);
  stage.setView({ component: state.part, opened: state.inside, xray: state.xray, piece: state.piece, frame: false });
  if (state.inside) renderStudy();
  $('loader').classList.add('ready'); setTimeout(() => { $('loader').hidden = true; }, reducedMotion ? 0 : 550);
  // Première visite (par session) : l’histoire démarre seule. ?story=0 l’empêche, ?story=1 la force.
  const storyParam = new URLSearchParams(location.search).get('story');
  let seen = false; try { seen = sessionStorage.getItem('elan-story-seen') === '1'; } catch { /* ignoré */ }
  if (!reducedMotion && storyParam !== '0' && (storyParam === '1' || storyParam === 'clip' || !seen)) startStory();
} catch (error) {
  console.error('Chargement de la scène impossible :', error);
  $('loader').innerHTML = '<p>La 3D n’a pas pu démarrer.</p><small>Active l’accélération graphique ou essaie un autre navigateur.</small><button class="primary-small" id="retry-load">Réessayer</button>';
  $('retry-load').addEventListener('click', () => location.reload());
  announce('La scène 3D n’est pas disponible. Les explications et le défi restent accessibles.');
}

// Instantané en lecture seule pour les vérifications reproductibles de l’expérience.
export function getExperienceSnapshot() {
  return {
    mode: state.mode, running: state.running, connected: state.connected, part: state.part, inside: state.inside, explosion: state.explosion,
    vehicle: { ...vehicle },
    transfer: getEnergyTransfer(vehicle, state),
    camera: stage ? stage.camera.position.toArray() : null,
    rotorAngle: angle,
    body: stage?.bodyMetrics(), technical: stage?.technicalMetrics(),
    graphics: stage ? { calls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles } : null,
    visibleGroups: stage ? stage.drivetrain.group.children.filter(child => child.visible).map(child => child.name) : [],
  };
}
