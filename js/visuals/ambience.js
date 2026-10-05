// Ohm Sweet Ohm — ambiance du mode Courant : particules en suspension et ondes d’énergie au sol.
// 2026-09-29 ≈16:00 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Sonnet 5.5.
// 2026-09-30 ≈18:24 (Europe/Zurich) — Codex — OpenAI : ondes arrêtées sans transfert, cadence selon la puissance réelle.
//
// Trois objets seulement (3 appels de rendu) : un nuage de 240 points additifs qui défile vers l’arrière quand la
// voiture roule (sensation de vitesse), et un plan au sol dont le shader dessine des anneaux qui se propagent,
// teintés selon la nature du flux (réseau, traction, récupération). Aucune texture, aucun fichier.
import * as THREE from 'three';

export const AMBIENCE_COLORS = Object.freeze({ charge: 0x3ad6ff, drive: 0xffad3a, regen: 0xb9f35c });
const COUNT = 240, HALF_X = 11, HALF_Z = 7, TOP = 6;

export function createAmbience() {
  const group = new THREE.Group(); group.name = 'Ambiance — particules et ondes au sol';
  // Générateur pseudo-aléatoire déterministe : même nuage à chaque chargement (tests, clips reproductibles).
  let seed = 12345; const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const positions = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT), lift = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions.set([(random() * 2 - 1) * HALF_X, random() * TOP, (random() * 2 - 1) * HALF_Z], i * 3);
    seeds[i] = random(); lift[i] = .1 + random() * .22;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const dustMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(0x9fdcff) }, uVis: { value: 0 }, uSize: { value: 5.5 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uVis, uSize, uPR; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.55 + aSeed) * (16.0 / max(-mv.z, 1.0));
        vAlpha = uVis * (0.2 + 0.8 * aSeed);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, a * a * vAlpha);
      }`,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false; dust.renderOrder = 4; group.add(dust);

  const waves = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(AMBIENCE_COLORS.charge) }, uVis: { value: 0 }, uPhase: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uVis, uPhase; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;             // 0 au centre, 1 au bord du plan
        float rings = 0.0;
        for (int i = 0; i < 3; i++) {
          float front = fract(uPhase + float(i) / 3.0);   // position de l’onde, de 0 à 1
          rings += exp(-pow((r - front * 0.92) * 14.0, 2.0)) * (1.0 - front);
        }
        float edge = smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(uColor, rings * edge * uVis * 0.55);
      }`,
  }));
  waves.rotation.x = -Math.PI / 2; waves.position.y = .012; waves.renderOrder = 3; waves.frustumCulled = false; group.add(waves);
  // Flaque de lumière sous la voiture : donne un sol au studio sombre de l’Histoire (visible même hors mode Courant).
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(0x3f7fb0) }, uVis: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uVis; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float glow = pow(clamp(1.0 - r, 0.0, 1.0), 3.0);
        float edge = smoothstep(0.98, 0.9, r);
        gl_FragColor = vec4(uColor, glow * edge * uVis * 0.42);
      }`,
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = .008; pool.renderOrder = 2; pool.frustumCulled = false; group.add(pool);
  group.visible = false;

  const target = new THREE.Color(), tint = new THREE.Color(0x9fdcff);
  let phase = 0;
  return {
    group, dust, waves, pool, metrics: { particles: COUNT, drawCalls: 3 },
    /** visibility 0–1 (mode Courant), route 'charge'|'drive'|'regen', active : flux en cours, power 0–1, speed en m/s. */
    update({ dt = 0, visibility = 0, backdrop = 0, route = 'charge', active = false, power = 0, speed = 0, pixelRatio = 1, running = true } = {}) {
      group.visible = visibility > .01 || backdrop > .01;
      if (!group.visible) return;
      pool.material.uniforms.uVis.value = backdrop;
      dust.visible = visibility > .01;
      const transfer = active && Number.isFinite(power) && power > 0;
      const strength = transfer ? Math.sqrt(THREE.MathUtils.clamp(power, 0, 1)) : 0;
      waves.visible = visibility > .01 && transfer;
      if (!dust.visible) return;
      const flowColor = AMBIENCE_COLORS[route] ?? AMBIENCE_COLORS.charge;
      target.setHex(flowColor); waves.material.uniforms.uColor.value.lerp(target, Math.min(1, dt * 4));
      tint.lerp(target.clone().lerp(new THREE.Color(0xffffff), .55), Math.min(1, dt * 2));
      dustMaterial.uniforms.uColor.value.copy(tint);
      dustMaterial.uniforms.uPR.value = pixelRatio;
      dustMaterial.uniforms.uVis.value = visibility * (.45 + .4 * Math.min(1, speed / 25));
      waves.material.uniforms.uVis.value = visibility * strength;
      if (!running) return;
      phase = (phase + dt * .48 * strength) % 1; waves.material.uniforms.uPhase.value = phase;
      // Les particules défilent vers l’arrière (+X, la voiture avance vers −X) proportionnellement à la vitesse.
      const flow = speed * .55 + .05;
      for (let i = 0; i < COUNT; i++) {
        const k = i * 3;
        positions[k] += flow * dt * (.6 + seeds[i] * .8);
        positions[k + 1] += lift[i] * dt;
        if (positions[k] > HALF_X) positions[k] -= 2 * HALF_X;
        if (positions[k + 1] > TOP) positions[k + 1] -= TOP;
      }
      dustGeometry.attributes.position.needsUpdate = true;
    },
    dispose() { dustGeometry.dispose(); dustMaterial.dispose(); waves.geometry.dispose(); waves.material.dispose(); },
  };
}
