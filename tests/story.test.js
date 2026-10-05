// 2026-09-30 ≈14:26 (Europe/Zurich) — Codex — OpenAI : parcours moteur et cohérence du récit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_STEPS, CAMERAS, MODES, stepIndexAt, createDirector } from '../js/story.js';
import { LESSONS } from '../js/data/technical-lessons.js';

test('le scénario est ordonné, complet et se termine par une étape finale unique', () => {
  assert.equal(STORY_STEPS[0].at, 0);
  STORY_STEPS.forEach((step, i) => {
    if (i) assert.ok(step.at > STORY_STEPS[i - 1].at, `étape ${step.id} : instants strictement croissants`);
    assert.ok(MODES.includes(step.mode), `${step.id} : mode connu`);
    assert.ok(CAMERAS.includes(step.camera), `${step.id} : caméra connue`);
    assert.ok(step.title && step.text && step.kicker, `${step.id} : textes présents`);
    assert.ok(step.throttle >= 0 && step.throttle <= 1);
    assert.equal(Boolean(step.final), i === STORY_STEPS.length - 1);
  });
  // Assez long pour lire, assez court pour rester dans un clip : entre 30 et 60 s.
  const duration = STORY_STEPS.at(-1).at;
  assert.ok(duration >= 30 && duration <= 60, `durée ${duration} s`);
  // Chaque étape reste au moins 4 s à l’écran (lisibilité).
  STORY_STEPS.slice(0, -1).forEach((step, i) => assert.ok(STORY_STEPS[i + 1].at - step.at >= 4, `${step.id} trop courte`));
});

test('les incohérences physiques sont exclues : câble branché seulement à l’arrêt, roue libre sans câble', () => {
  for (const step of STORY_STEPS) {
    if (step.connected) assert.equal(step.mode, 'charge', `${step.id} : on ne roule pas branché`);
    if (step.mode === 'charge') assert.equal(step.throttle, 0, `${step.id} : pas d’accélérateur en recharge`);
  }
  const ids = STORY_STEPS.map(step => step.id);
  assert.ok(ids.indexOf('acceleration') > ids.indexOf('cable'), 'la recharge précède la conduite');
  assert.ok(ids.indexOf('recuperation') > ids.indexOf('acceleration'), 'on récupère après avoir roulé');
  const lift = STORY_STEPS.find(step => step.id === 'recuperation');
  assert.equal(lift.throttle, 0, 'la récupération commence pied levé');
  assert.equal(lift.mode, 'drive', 'lever le pied reste dans la conduite à une pédale');
  assert.equal(lift.connected, false);
  assert.ok(lift.startSpeedKmh > 0, 'la récupération dispose du mouvement nécessaire');
});

test('stepIndexAt renvoie la dernière étape atteinte', () => {
  assert.equal(stepIndexAt(0), 0);
  assert.equal(stepIndexAt(4.4), 0);
  assert.equal(stepIndexAt(4.5), 1);
  assert.equal(stepIndexAt(1000), STORY_STEPS.length - 1);
});

test('le réalisateur joue chaque étape une fois, dans l’ordre, puis s’arrête', () => {
  const played = []; let ended = 0;
  const director = createDirector({ apply: (step, index) => played.push([step.id, index]), onEnd: () => ended++ });
  director.start();
  assert.deepEqual(played, [['intro', 0]]);
  for (let i = 0; i < 2000; i++) director.tick(0.05);
  assert.deepEqual(played.map(([id]) => id), STORY_STEPS.map(step => step.id));
  assert.deepEqual(played.map(([, index]) => index), STORY_STEPS.map((_, i) => i));
  assert.equal(ended, 1);
  assert.equal(director.active, false);
  assert.equal(director.ended, true);
});

test('une longue image ne fait sauter aucune étape', () => {
  const played = [];
  const director = createDirector({ apply: step => played.push(step.id) });
  director.start();
  director.tick(23);
  assert.deepEqual(played, ['intro', 'cable', 'chargeur', 'batterie', 'motor']);
});

test('stop() fige le scénario et start() le rejoue depuis le début', () => {
  const played = [];
  const director = createDirector({ apply: step => played.push(step.id) });
  director.start(); director.tick(5); director.stop(); director.tick(100);
  assert.deepEqual(played, ['intro', 'cable']);
  director.start();
  assert.equal(played.at(-1), 'intro');
  assert.equal(director.elapsed, 0);
});

test('sauter à un chapitre : l’étape est jouée avec l’indicateur de saut et le temps se recale', () => {
  const calls = [];
  const director = createDirector({ apply: (step, index, info) => calls.push([step.id, index, info.jumped]) });
  const i = STORY_STEPS.findIndex(step => step.id === 'acceleration');
  director.start(); director.jump(i);
  assert.deepEqual(calls.at(-1), ['acceleration', i, true]);
  assert.equal(director.elapsed, STORY_STEPS[i].at);
  director.tick(STORY_STEPS[i + 1].at - STORY_STEPS[i].at + .01);
  assert.deepEqual(calls.at(-1), ['allure', i + 1, false], 'la suite reprend normalement');
});

test('sauter en arrière ou vers la fin et bornes des indices', () => {
  const calls = []; let ended = 0;
  const director = createDirector({ apply: step => calls.push(step.id), onEnd: () => ended++ });
  director.start(); director.jump(99);
  assert.equal(calls.at(-1), 'fin'); assert.equal(ended, 1); assert.equal(director.active, false);
  director.jump(1); // depuis la fin, on peut revenir
  assert.equal(calls.at(-1), 'cable'); assert.equal(director.active, true); assert.equal(director.ended, false);
  director.jump(-5); assert.equal(calls.at(-1), 'intro');
});

test('les chapitres où la voiture roule déjà ont une vitesse de départ pour les sauts', () => {
  for (const id of ['allure', 'recuperation']) {
    const step = STORY_STEPS.find(s => s.id === id);
    assert.ok(step.startSpeedKmh > 20 && step.startSpeedKmh <= 130, `${id} : vitesse de départ plausible`);
    assert.equal(step.mode, 'drive');
  }
});

test('les détails ouverts viennent avant la conduite et les flux restent sur la voiture entière', () => {
  assert.equal(STORY_STEPS.length, 9);
  assert.equal(STORY_STEPS.at(-1).at, 51);
  const battery = STORY_STEPS.find(s => s.id === 'batterie');
  const motor = STORY_STEPS.find(s => s.id === 'motor');
  const acceleration = STORY_STEPS.find(s => s.id === 'acceleration');
  assert.ok(battery.at < motor.at && motor.at < acceleration.at, 'cellules puis moteur, avant l’accélération');
  assert.equal(battery.focus, 'battery');
  assert.equal(battery.studyFocus, 'cells');
  assert.equal(motor.focus, 'motor');
  assert.equal(motor.studyFocus, 'field');
  assert.equal(motor.mode, 'drive');
  assert.equal(motor.connected, false);
  assert.equal(motor.throttle, 0);
  for (const step of STORY_STEPS) {
    assert.equal(step.explosion ?? 0, 0, `${step.id} : aucun éclaté global`);
    if (step.focus) {
      assert.ok(step.opening > 0 && step.opening <= 1, `${step.id} : intérieur ouvert`);
      assert.equal(step.current, false, `${step.id} : aucun trajet global sur une pièce isolée`);
    } else {
      assert.equal(step.opening, undefined, `${step.id} : retour à la voiture entière`);
      assert.equal(step.studyFocus, undefined);
    }
  }
});

test('le parcours moteur suit courant, champ, rotation puis production et le récit commence par le champ', () => {
  const lessons = LESSONS.motor;
  assert.deepEqual(lessons.map(lesson => lesson.id), ['stator', 'field', 'rotor', 'generator']);
  const anchors = new Set(['stator', 'field', 'rotor', 'shaft']);
  lessons.forEach(lesson => {
    assert.ok(lesson.labels.length > 0, `${lesson.id} : un détail visible accompagne l’explication`);
    lesson.labels.forEach(([anchor]) => assert.ok(anchors.has(anchor), `${lesson.id} : repère compatible avec la maquette`));
  });
  assert.ok(lessons.find(lesson => lesson.id === 'rotor').labels.some(([anchor]) => anchor === 'shaft'), 'la rotation relie le rotor à l’arbre de sortie');
  const generatorAnchors = lessons.find(lesson => lesson.id === 'generator').labels.map(([anchor]) => anchor);
  assert.ok(generatorAnchors.includes('rotor') && generatorAnchors.includes('stator'), 'la production montre la machine entraînée et les bobines');
  const motor = STORY_STEPS.find(step => step.id === 'motor');
  assert.ok(lessons.some(lesson => lesson.id === motor.studyFocus), 'le récit utilise une étape réelle du parcours moteur');
  assert.equal(motor.studyFocus, 'field');
  assert.equal(STORY_STEPS.find(step => step.id === 'acceleration').at - motor.at, 6.5, 'le champ et la transmission disposent du même plan de 6,5 s');
});
