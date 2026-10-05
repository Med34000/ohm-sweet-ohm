import * as THREE from 'three';
import { ENERGY_SEGMENTS, ENERGY_ROUTES, CURRENT_KINDS, MODULE_LANES, LANE_Y, segmentById, advanceAlong } from '../data/energy-routes.js?v=20260930-2';
import { ELECTRIC_VEHICLE_LAYOUT as VEHICLE } from '../data/vehicle-layout.js';

// 2026-09-22 ≈23:25 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Opus 5.5.
// 2026-09-30 ≈10:40 (Europe/Zurich) — Codex — OpenAI : légende protégée et placement borné des repères.
// 2026-09-30 (Europe/Zurich) — Codex — OpenAI : transfert nul immédiatement immobile ; cadence intégrée selon la puissance réelle.
// 2026-09-30 (Europe/Zurich) — Codex — OpenAI : luminosité lisible à faible puissance, séparée de la cadence physique du flux.
// « Mode Courant » : conduits lumineux, comètes d’énergie, cellules qui se remplissent,
// pertes en chaleur et étapes numérotées. Tout est procédural : aucun fichier ajouté.

const KIND_INDEX = { grid: 0, dc: 1, ac3: 2, mech: 3 };
const KIND_COLORS = ['grid', 'dc', 'ac3', 'mech'].map(key => new THREE.Color(CURRENT_KINDS[key].color));
const HEAT = new THREE.Color(CURRENT_KINDS.heat.color);
const SAMPLE_STEP = 0.025;
const COMETS = 84, TRAIL = 6, SPARKS = 56;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Cherche une place libre près de l’ancre, sans rabattre tous les repères sur le bord supérieur. */
export function placeEnergyLabel({ x, top, w, h, width, height, minTop, obstacles }) {
  const minX = 6, maxX = width - w - 6, maxTop = height - h - 4;
  if (maxX < minX || maxTop < minTop) return null;
  x = clamp(x, minX, maxX); top = clamp(top, minTop, maxTop);
  const isFree = (px, py) => px >= minX && px <= maxX && py >= minTop && py <= maxTop
    && !obstacles.some(r => px < r.x + r.w + 6 && px + w + 6 > r.x && py < r.y + r.h + 5 && py + h + 5 > r.y);
  if (isFree(x, top)) return { x, top };
  const unique = values => [...new Set(values)].filter(Number.isFinite);
  // Les limites des obstacles donnent les rangées et colonnes où un rectangle peut tenir.
  const columns = unique([x, minX, maxX, ...obstacles.flatMap(r => [r.x + r.w + 8, r.x - w - 8])])
    .filter(px => px >= minX && px <= maxX).sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
  const rows = unique([top, minTop, maxTop, ...obstacles.flatMap(r => [r.y - h - 6, r.y + r.h + 6])])
    .filter(py => py >= minTop && py <= maxTop).sort((a, b) => Math.abs(a - top) - Math.abs(b - top));
  // D’abord un déplacement latéral ; puis au-dessus ou au-dessous, sans sortir du canvas.
  for (const px of columns) if (isFree(px, top)) return { x: px, top };
  for (const py of rows) if (isFree(x, py)) return { x, top: py };
  // Enfin une grille bornée par les obstacles, visitée de la position la plus proche à la plus éloignée.
  const candidates = columns.flatMap(px => rows.map(py => ({ x: px, top: py, distance: (px - x) ** 2 + (py - top) ** 2 })));
  candidates.sort((a, b) => a.distance - b.distance);
  const free = candidates.find(p => isFree(p.x, p.top));
  return free ? { x: free.x, top: free.top } : null;
}

function curveOf(points) {
  const vectors = points.map(p => new THREE.Vector3(...p));
  return vectors.length === 2 ? new THREE.LineCurve3(...vectors) : new THREE.CatmullRomCurve3(vectors, false, 'centripetal');
}

/** Échantillonne un brin complet : positions, normales pour l’ondulation AC, longueurs cumulées. */
function buildStrand(ids, curves) {
  const pts = [], kinds = [];
  ids.forEach((id, index) => {
    const curve = curves.get(id);
    const n = Math.max(6, Math.ceil(curve.getLength() / SAMPLE_STEP));
    curve.getSpacedPoints(n).forEach((p, j) => { if (index && !j) return; pts.push(p); kinds.push(KIND_INDEX[segmentById(id).kind]); });
  });
  const count = pts.length;
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), distance = new Float32Array(count);
  const tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    pts[i].toArray(position, i * 3);
    if (i) distance[i] = distance[i - 1] + pts[i].distanceTo(pts[i - 1]);
    tangent.subVectors(pts[Math.min(i + 1, count - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(tangent, Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    side.toArray(normal, i * 3);
  }
  return { ids, position, normal, distance, kinds: Uint8Array.from(kinds), length: distance[count - 1], count };
}

function sampleStrand(strand, d, out, outNormal) {
  const { distance, position, normal } = strand;
  let lo = 0, hi = strand.count - 1;
  d = clamp(d, 0, strand.length);
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (distance[mid] < d) lo = mid; else hi = mid; }
  const span = distance[hi] - distance[lo] || 1, t = (d - distance[lo]) / span;
  out.set(
    position[lo * 3] + (position[hi * 3] - position[lo * 3]) * t,
    position[lo * 3 + 1] + (position[hi * 3 + 1] - position[lo * 3 + 1]) * t,
    position[lo * 3 + 2] + (position[hi * 3 + 2] - position[lo * 3 + 2]) * t,
  );
  outNormal?.set(normal[lo * 3], normal[lo * 3 + 1], normal[lo * 3 + 2]);
  return strand.kinds[t < 0.5 ? lo : hi];
}

const glowTexture = (() => {
  let texture = null;
  return () => {
    if (texture) return texture;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.75)');
    g.addColorStop(0.45, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
})();

const overlay = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false };

function conduitMaterial(color, length, wave, halo) {
  return new THREE.ShaderMaterial({
    ...overlay,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uLength: { value: length },
      uDir: { value: 1 }, uSpeed: { value: 1.4 }, uActive: { value: 0 }, uOpacity: { value: 0 }, uWave: { value: wave ? 1 : 0 },
      uHalo: { value: halo ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime, uLength, uDir, uSpeed, uActive, uOpacity, uWave, uHalo;
      varying vec2 vUv; varying float vFacing;
      void main() {
        float s = vUv.x * uLength;
        float f = fract((s - uTime * uSpeed) / 0.55);
        float head = exp(-pow(min(f, 1.0 - f) * 22.0, 2.0));
        float tail = uDir > 0.0 ? f : 1.0 - f;
        float dash = head + pow(tail, 8.0) * 0.35;
        float wave = uWave * (0.5 + 0.5 * sin(s * 26.0 - uTime * uSpeed * 26.0));
        float edge = uHalo > 0.5 ? pow(vFacing, 2.6) : pow(vFacing, 0.8);
        float energy = 0.16 + uActive * (0.35 + 1.25 * dash + 0.45 * wave);
        float ends = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
        float alpha = uOpacity * edge * energy * ends * (uHalo > 0.5 ? 0.42 : 1.0);
        vec3 color = mix(uColor, vec3(1.0), (uHalo > 0.5 ? 0.0 : 0.55) * dash * uActive);
        gl_FragColor = vec4(color, alpha);
      }`,
  });
}

function sparkMaterial() {
  return new THREE.ShaderMaterial({
    ...overlay,
    uniforms: { uScale: { value: 600 }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
      uniform float uScale; varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.2, -mv.z);
        vColor = aColor; vAlpha = aAlpha;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vColor; varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float halo = pow(1.0 - r, 2.4);
        float core = smoothstep(0.42, 0.0, r);
        gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.85), (halo + core) * vAlpha * uOpacity);
      }`,
  });
}

function cellGridMaterial() {
  return new THREE.ShaderMaterial({
    ...overlay,
    uniforms: {
      uColor: { value: new THREE.Color(CURRENT_KINDS.dc.color) }, uFill: { value: 0.62 }, uTime: { value: 0 },
      uOpacity: { value: 0 }, uActive: { value: 0 }, uDir: { value: 1 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uFill, uTime, uOpacity, uActive, uDir; varying vec2 vUv;
      void main() {
        // u : avant → arrière du pack ; v : quatre modules.
        float module = floor(vUv.y * 4.0); float mv = fract(vUv.y * 4.0);
        float inside = step(0.08, mv) * step(mv, 0.92);
        vec2 grid = vec2(vUv.x * 28.0, (mv - 0.08) / 0.84 * 5.0);
        vec2 cell = fract(grid) - 0.5;
        float aa = fwidth(length(cell)) * 1.5;
        float dotShape = 1.0 - smoothstep(0.32 - aa, 0.32 + aa, length(cell));
        float lit = step(vUv.x, uFill);
        float front = exp(-pow((vUv.x - uFill) * 38.0, 2.0));
        float travel = fract(vUv.x * 2.2 + uDir * uTime * 0.55 + module * 0.17);
        float shimmer = pow(travel, 6.0) * uActive;
        float glow = dotShape * inside * (0.025 + lit * (0.1 + 0.75 * shimmer) + front * (0.45 + 0.7 * uActive)) + inside * lit * 0.035;
        float frame = inside * (1.0 - smoothstep(0.0, 0.05, min(mv - 0.08, 0.92 - mv))) * 0.18;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), front * 0.6 + shimmer * 0.3), (glow + frame) * uOpacity);
      }`,
  });
}

function hologramMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(0x9fdcff) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uSweep: { value: 99 } },
    vertexShader: /* glsl */`
      varying float vFacing; varying float vHeight; varying float vX;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * world;
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        vHeight = world.y; vX = world.x;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity, uTime, uSweep; varying float vFacing; varying float vHeight; varying float vX;
      void main() {
        float rim = pow(1.0 - vFacing, 2.6);
        float scan = 0.82 + 0.18 * smoothstep(0.7, 1.0, fract(vHeight * 3.2 - uTime * 0.35));
        float sweep = exp(-pow((vX - uSweep) * 1.6, 2.0));
        gl_FragColor = vec4(mix(uColor, vec3(1.0), sweep * 0.6), ((0.018 + rim * 0.42) * scan + sweep * (0.1 + rim * 0.6)) * uOpacity);
      }`,
  });
}

/**
 * Couche « Courant ». `host` reçoit les étiquettes numérotées (élément positionné).
 */
export function createEnergyCurrent({ host = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Mode Courant — trajet de l’énergie';
  group.userData.energyOverlay = true;
  group.renderOrder = 20;
  const curves = new Map(ENERGY_SEGMENTS.map(seg => [seg.id, curveOf(seg.points)]));

  // Conduits : un cœur fin et un halo par tronçon.
  const conduits = new Map();
  for (const seg of ENERGY_SEGMENTS) {
    const curve = curves.get(seg.id), length = curve.getLength();
    const tubular = Math.max(12, Math.ceil(length / 0.04));
    const wave = seg.kind === 'grid' || seg.kind === 'ac3';
    const radius = seg.kind === 'mech' ? 0.03 : seg.kind === 'ac3' ? 0.016 : 0.022;
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, radius, 8, false), conduitMaterial(CURRENT_KINDS[seg.kind].color, length, wave, false));
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, radius * 3.4, 10, false), conduitMaterial(CURRENT_KINDS[seg.kind].color, length, wave, true));
    [core, halo].forEach((mesh, i) => { mesh.renderOrder = 21 + i; mesh.frustumCulled = false; mesh.name = `Conduit ${seg.id}`; group.add(mesh); });
    conduits.set(seg.id, { seg, meshes: [core, halo] });
  }
  const strands = {
    charge: ENERGY_ROUTES.charge.strands.map(ids => buildStrand(ids, curves)),
    traction: ENERGY_ROUTES.drive.strands.map(ids => buildStrand(ids, curves)),
  };
  const segmentsOf = key => new Set(ENERGY_ROUTES[key].strands.flat());
  const routeSegments = { charge: segmentsOf('charge'), drive: segmentsOf('drive'), regen: segmentsOf('regen') };

  // Comètes : une tête et une traîne, couleur selon la nature du courant.
  const totalPoints = COMETS * TRAIL;
  const cometGeometry = new THREE.BufferGeometry();
  const cometPosition = new Float32Array(totalPoints * 3), cometColor = new Float32Array(totalPoints * 3);
  const cometSize = new Float32Array(totalPoints), cometAlpha = new Float32Array(totalPoints);
  cometGeometry.setAttribute('position', new THREE.BufferAttribute(cometPosition, 3).setUsage(THREE.DynamicDrawUsage));
  cometGeometry.setAttribute('aColor', new THREE.BufferAttribute(cometColor, 3).setUsage(THREE.DynamicDrawUsage));
  cometGeometry.setAttribute('aSize', new THREE.BufferAttribute(cometSize, 1).setUsage(THREE.DynamicDrawUsage));
  cometGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(cometAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const cometMaterial = sparkMaterial();
  const comets = new THREE.Points(cometGeometry, cometMaterial);
  comets.name = 'Comètes — transfert énergétique';
  comets.frustumCulled = false; comets.renderOrder = 30; group.add(comets);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const cometState = Array.from({ length: COMETS }, (_, i) => ({ strand: i, d: 0, speed: 0.8 + random() * 0.45, wobble: random() * 6.28, rank: random() }));

  // Pertes : étincelles qui montent au-dessus des convertisseurs.
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPosition = new Float32Array(SPARKS * 3), sparkColor = new Float32Array(SPARKS * 3), sparkSize = new Float32Array(SPARKS), sparkAlpha = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) HEAT.toArray(sparkColor, i * 3);
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPosition, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute('aColor', new THREE.BufferAttribute(sparkColor, 3));
  sparkGeometry.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(sparkAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const sparkMat = sparkMaterial();
  const sparks = new THREE.Points(sparkGeometry, sparkMat);
  sparks.name = 'Pertes thermiques — convertisseurs';
  sparks.frustumCulled = false; sparks.renderOrder = 31; group.add(sparks);
  const sparkState = Array.from({ length: SPARKS }, () => ({ alive: false, life: -random() * 1.4, x: 0, y: 0, z: 0, vx: 0, vz: 0 }));

  // Cellules du pack : elles s’allument jusqu’au niveau de charge.
  const lanesSpan = (MODULE_LANES.at(-1) - MODULE_LANES[0]) + 0.62;
  const packLength = 2.9;
  const cellMaterial = cellGridMaterial();
  const cells = new THREE.Mesh(new THREE.PlaneGeometry(packLength, lanesSpan), cellMaterial);
  cells.rotation.x = -Math.PI / 2;
  cells.position.set(VEHICLE.battery.center[0] - 0.525, LANE_Y + 0.012, 0);
  cells.renderOrder = 20; cells.frustumCulled = false; cells.name = 'Cellules — niveau de charge'; group.add(cells);

  // Halos des étapes et anneaux sur les roues motrices.
  const stopSprites = new Map();
  for (const route of Object.values(ENERGY_ROUTES)) for (const stop of route.stops) {
    if (stopSprites.has(stop.id)) continue;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, ...overlay }));
    sprite.name = `Halo — ${stop.id}`;
    sprite.position.set(...stop.at); sprite.renderOrder = 25; group.add(sprite);
    stopSprites.set(stop.id, sprite);
  }
  const ringMaterial = new THREE.ShaderMaterial({
    ...overlay,
    uniforms: { uColor: { value: new THREE.Color(CURRENT_KINDS.mech.color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() { float dash = smoothstep(0.35, 0.5, fract(vUv.x * 14.0)) * smoothstep(1.0, 0.85, fract(vUv.x * 14.0));
        gl_FragColor = vec4(uColor, (0.18 + dash * 0.9) * uOpacity); }`,
  });
  // Récupération : ondes de « production » qui partent du moteur devenu générateur.
  const ringTexture = (() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,.08)');
    g.addColorStop(0.82, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  })();
  const producer = ENERGY_ROUTES.regen.stops.find(stop => stop.produces);
  const bursts = [0, 1, 2].map(() => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture, color: 0xffe07a, ...overlay }));
    sprite.name = 'Ondes — production du générateur';
    sprite.position.set(...producer.at); sprite.renderOrder = 26; group.add(sprite); return sprite;
  });
  const rings = [1, -1].map(side => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(VEHICLE.wheel.radius * 0.9, 0.014, 6, 120), ringMaterial);
    ring.name = 'Anneaux — transfert mécanique';
    ring.position.set(VEHICLE.wheel.rearAxleX, VEHICLE.wheel.centerY, side * (VEHICLE.wheel.rearTrackHalf + VEHICLE.wheel.width / 2 + 0.03));
    ring.renderOrder = 24; group.add(ring); return ring;
  });

  // Étiquettes numérotées, projetées sur la scène.
  const labelLayer = host ? document.createElement('div') : null;
  const currentLegend = host?.parentElement?.querySelector('.current-legend');
  const labels = new Map();
  if (labelLayer) { labelLayer.className = 'energy-labels'; labelLayer.setAttribute('aria-hidden', 'true'); host.append(labelLayer); }
  function labelFor(route, index) {
    const stop = ENERGY_ROUTES[route].stops[index];
    const key = `${route}:${stop.id}`;
    if (!labels.has(key)) {
      const el = document.createElement('div'); el.className = 'energy-label';
      el.style.setProperty('--kind', `#${new THREE.Color(CURRENT_KINDS[stop.kind].color).getHexString()}`);
      el.innerHTML = `<b>${index + 1}</b><span>${stop.label}<small>${stop.detail}</small></span>${stop.produces ? '<em hidden>ϟ production</em>' : ''}`;
      labelLayer.append(el); labels.set(key, { el, stop });
    }
    return labels.get(key);
  }

  const tmp = new THREE.Vector3(), tmpNormal = new THREE.Vector3(), projected = new THREE.Vector3(), color = new THREE.Color();
  let opacity = 0, family = null, lossFamily = null, activity = 0, clock = 0, flow = 0, cellFlow = 0, heldWheelAngle = 0;
  const buffer = new THREE.Vector2();

  /**
   * route : 'charge' | 'drive' | 'regen' ; active : un transfert a lieu ; power : puissance normalisée linéaire 0…1.
   * La racine carrée rend les petites puissances lisibles, sans vitesse minimale à zéro.
   * Les phases sont intégrées : changer de puissance ou de sens ne replace pas les têtes.
   * `visibility` (0…1) pilote le fondu d’ensemble.
   */
  function update({ dt = 0, running = true, route = 'charge', active = false, power = 0, soc = 0.62, visibility = 0,
    camera = null, renderer = null, wheelAngle = 0 } = {}) {
    opacity = visibility;
    group.visible = opacity > 0.004;
    if (labelLayer) labelLayer.style.opacity = String(smooth(0.35, 1, opacity));
    activity = active ? Math.sqrt(clamp(Number.isFinite(power) ? Math.abs(power) : 0, 0, 1)) : 0;
    // Réponse continue : un transfert faible doit se voir dans le studio sombre.
    // Aucun plancher, aucune nouvelle racine ; le gain lumineux ne change pas l'avancement.
    const brightness = activity / (.28 + .72 * activity);
    const poolName = route === 'charge' ? 'charge' : 'traction';
    if (!activity || lossFamily !== poolName) {
      // Aucun reliquat de production, même après une séquence où la couche était masquée.
      sparkState.forEach(sp => { sp.alive = false; sp.life = Math.min(sp.life, 0); });
      sparkAlpha.fill(0); sparkGeometry.attributes.aAlpha.needsUpdate = true;
    }
    lossFamily = poolName;
    if (!group.visible) { labels.forEach(({ el }) => { el.hidden = true; }); return; }
    const reverse = Boolean(ENERGY_ROUTES[route].reverse);
    const dir = reverse ? -1 : 1;
    const elapsed = running && Number.isFinite(dt) ? Math.max(dt, 0) : 0;
    const step = elapsed * activity;
    const speed = 3.2 * activity;
    // Position du flux intégrée : le sens ne dépend que de `dir`, jamais d’une variation de vitesse.
    clock += step; flow += dir * speed * elapsed; cellFlow += (route === 'drive' ? -1 : 1) * step;
    if (running && Number.isFinite(wheelAngle)) heldWheelAngle = wheelAngle;

    const segs = routeSegments[route];
    conduits.forEach(({ seg, meshes }) => {
      const on = segs.has(seg.id);
      meshes.forEach(mesh => {
        mesh.visible = on;
        if (!on) return;
        const u = mesh.material.uniforms;
        u.uTime.value = flow; u.uDir.value = dir; u.uSpeed.value = 0.8; u.uActive.value = brightness; u.uOpacity.value = opacity;
      });
    });

    // Comètes.
    const pool = route === 'charge' ? strands.charge : strands.traction;
    // Rouler ↔ récupérer : mêmes conducteurs, les comètes font demi-tour sur place.
    if (family !== poolName) {
      family = poolName;
      cometState.forEach((c, i) => { c.strand = i % pool.length; c.d = random() * pool[c.strand].length; });
    }
    const visibleShare = activity > 0 ? 0.3 + 0.7 * brightness : 0;
    for (let i = 0; i < COMETS; i++) {
      const c = cometState[i], strand = pool[c.strand];
      const shown = c.rank < visibleShare;
      if (step > 0) c.d = advanceAlong(c.d, strand.length, dir, speed * c.speed, elapsed);
      const head = c.d;
      for (let k = 0; k < TRAIL; k++) {
        const p = i * TRAIL + k;
        const d = head - dir * k * 0.06;
        const kind = sampleStrand(strand, d, tmp, tmpNormal);
        if (kind === KIND_INDEX.grid || kind === KIND_INDEX.ac3) {
          tmp.addScaledVector(tmpNormal, 0.03 * Math.sin(d * 21 - flow * 9 + c.wobble));
        }
        tmp.toArray(cometPosition, p * 3);
        KIND_COLORS[kind].toArray(cometColor, p * 3);
        const fade = smooth(0, 0.3, d) * smooth(0, 0.35, strand.length - d);
        cometAlpha[p] = shown ? fade * (1 - k / TRAIL) ** 1.6 * (k ? 0.75 : 1) : 0;
        cometSize[p] = (k ? 0.09 : 0.17) * (1 - k / (TRAIL * 1.4)) * (0.85 + brightness * 0.45);
      }
    }
    ['position', 'aColor', 'aSize', 'aAlpha'].forEach(name => { cometGeometry.attributes[name].needsUpdate = true; });

    // Pertes thermiques aux convertisseurs.
    const lossStops = ENERGY_ROUTES[route].stops.filter(stop => stop.loss);
    for (let i = 0; i < SPARKS; i++) {
      const sp = sparkState[i];
      sp.life += step;
      if (sp.alive && sp.life > 1.3) { sp.alive = false; sp.life = -random() * 0.6; }
      if (!sp.alive && step > 0 && sp.life > 0 && lossStops.length && random() < step * (2 + activity * 7)) {
        const stop = lossStops[i % lossStops.length];
        sp.x = stop.at[0] + (random() - 0.5) * 0.35; sp.y = stop.at[1] + 0.08; sp.z = stop.at[2] + (random() - 0.5) * 0.35;
        sp.vx = (random() - 0.5) * 0.14; sp.vz = (random() - 0.5) * 0.14; sp.life = 0; sp.alive = true;
      }
      const t = sp.alive ? clamp(sp.life / 1.3, 0, 1) : 0;
      sparkPosition[i * 3] = sp.x + sp.vx * t; sparkPosition[i * 3 + 1] = sp.y + t * 0.7; sparkPosition[i * 3 + 2] = sp.z + sp.vz * t;
      sparkAlpha[i] = sp.alive ? Math.sin(Math.PI * t) * 0.85 * brightness : 0;
      sparkSize[i] = 0.05 + t * 0.06;
    }
    ['position', 'aSize', 'aAlpha'].forEach(name => { sparkGeometry.attributes[name].needsUpdate = true; });

    // Pixels par unité, identiques pour comètes et étincelles.
    if (camera && renderer) {
      const height = renderer.getDrawingBufferSize(buffer).y;
      const scale = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      cometMaterial.uniforms.uScale.value = scale; sparkMat.uniforms.uScale.value = scale;
    }
    cometMaterial.uniforms.uOpacity.value = opacity * brightness; sparkMat.uniforms.uOpacity.value = opacity;

    // Cellules, halos, anneaux.
    const cu = cellMaterial.uniforms;
    cu.uFill.value = clamp(soc, 0, 1); cu.uTime.value = cellFlow; cu.uActive.value = brightness;
    cu.uDir.value = 1; cu.uOpacity.value = opacity;
    const stops = ENERGY_ROUTES[route].stops;
    stopSprites.forEach((sprite, id) => {
      const index = stops.findIndex(stop => stop.id === id);
      sprite.visible = index >= 0 && activity > 0;
      if (!sprite.visible) { sprite.material.opacity = 0; return; }
      const beat = 0.5 + 0.5 * Math.sin(clock * 5 - index * 1.2);
      const size = (id === 'battery' ? 0.9 : 0.55) * (1 + brightness * (0.25 + 0.25 * beat));
      sprite.scale.set(size, size, 1);
      sprite.material.color.copy(color.setHex(CURRENT_KINDS[stops[index].kind].color));
      sprite.material.opacity = opacity * brightness * (0.57 + 0.3 * beat);
    });
    const producing = route === 'regen' && activity > 0;
    bursts.forEach((sprite, i) => {
      sprite.visible = producing;
      if (!producing) { sprite.material.opacity = 0; return; }
      const phase = (clock * 0.75 + i / bursts.length) % 1;
      const size = 0.3 + phase * 1.5;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = opacity * brightness * (1 - phase) ** 1.4;
    });
    const turning = route !== 'charge' && activity > 0;
    rings.forEach(ring => { ring.visible = turning; ring.rotation.z = heldWheelAngle; });
    ringMaterial.uniforms.uOpacity.value = opacity * brightness;

    // Étiquettes : ordre du transfert, légèrement décalées pour ne pas se chevaucher.
    if (!labelLayer || !camera) return;
    labels.forEach(({ el }) => { el.hidden = true; });
    const width = host.clientWidth, heightPx = host.clientHeight, placed = [];
    // La puissance et la clé des couleurs restent lisibles : elles font partie des obstacles.
    // Les repères sont placés dans le canvas, la légende dans son parent : ramener son rectangle au host.
    if (currentLegend && !currentLegend.hidden) {
      const legendRect = currentLegend.getBoundingClientRect();
      if (legendRect.width > 0 && legendRect.height > 0) {
        const hostRect = host.getBoundingClientRect();
        placed.push({ x: legendRect.left - hostRect.left, y: legendRect.top - hostRect.top, w: legendRect.width, h: legendRect.height });
      }
    }
    stops.forEach((stop, index) => {
      const { el } = labelFor(route, index);
      const producing = Boolean(stop.produces) && activity > 0;
      el.classList.toggle('produces', producing);
      const badge = el.querySelector('em');
      if (badge) badge.hidden = !producing;
      projected.set(...stop.at); group.localToWorld(projected); projected.project(camera);
      if (projected.z > 1 || projected.z < -1) return;
      el.hidden = false;
      // L’étiquette flotte au-dessus de son organe, reliée par un fil : la pièce reste visible.
      const ax = (projected.x + 1) / 2 * width, ay = (1 - projected.y) / 2 * heightPx;
      const w = el.offsetWidth || 120, h = el.offsetHeight || 30;
      const minTop = innerWidth > 760 ? 78 : 4;
      const position = placeEnergyLabel({ x: ax - 15, top: ay - 46 - h, w, h, width, height: heightPx, minTop, obstacles: placed });
      // Sans place disponible, ne pas recouvrir une information déjà lisible.
      if (!position) { el.hidden = true; return; }
      const { x, top } = position;
      placed.push({ x, y: top, w, h });
      el.classList.toggle('live', activity > 0.05);
      const lx = clamp(ax - x, 14, w - 14), dx = ax - x - lx, dy = ay - top - h;
      el.style.setProperty('--lead-x', `${Math.round(lx)}px`);
      el.style.setProperty('--dx', `${Math.round(dx)}px`); el.style.setProperty('--dy', `${Math.round(dy)}px`);
      el.style.setProperty('--lead', `${Math.round(Math.hypot(dx, dy))}px`);
      el.style.setProperty('--lead-angle', `${Math.atan2(-dx, dy)}rad`);
      el.style.transform = `translate(${Math.round(x)}px,${Math.round(top)}px)`;
    });
  }

  const metrics = { segments: ENERGY_SEGMENTS.length, comets: COMETS, trail: TRAIL, sparks: SPARKS,
    strands: { charge: strands.charge.length, traction: strands.traction.length } };
  return { group, update, strands, metrics, hologramMaterial };
}

export { hologramMaterial };
