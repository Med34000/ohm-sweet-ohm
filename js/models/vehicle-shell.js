import * as THREE from 'three';
import { ELECTRIC_VEHICLE_LAYOUT } from '../data/vehicle-layout.js';

const PRESENTATIONS = new Set(['assembled', 'cutaway', 'exploded']);
const SHELL_COLOR = new THREE.Color(0x59e8dc);
const EDGE_COLOR = 0x7df8ec;

function createBodyGeometry() {
  const sections = [
    { x: -4.22, width: 1.42, bottom: -1.86, belt: -0.62, roof: -0.34 },
    { x: -3.68, width: 1.66, bottom: -1.99, belt: -0.42, roof: -0.06 },
    { x: -3.47, width: 1.72, bottom: -2.02, belt: -0.34, roof: 0.08 },
    { x: -2.705, width: 1.8, bottom: -2.05, flank: -0.92, belt: -0.23, roof: 0.36 },
    { x: -1.94, width: 1.82, bottom: -2.05, belt: -0.2, roof: 0.54 },
    { x: -0.82, width: 1.82, bottom: -2.05, belt: -0.18, roof: 0.64 },
    { x: 0.92, width: 1.79, bottom: -2.05, belt: -0.2, roof: 0.6 },
    { x: 1.94, width: 1.82, bottom: -2.04, belt: -0.27, roof: 0.44 },
    { x: 2.705, width: 1.82, bottom: -2.02, flank: -0.92, belt: -0.4, roof: 0.18 },
    { x: 3.47, width: 1.7, bottom: -1.96, belt: -0.5, roof: -0.02 },
    { x: 3.82, width: 1.6, bottom: -1.9, belt: -0.56, roof: -0.15 },
    { x: 4.22, width: 1.36, bottom: -1.8, belt: -0.72, roof: -0.46 },
  ];
  const ringSize = 8;
  const positions = [];
  const indices = [];

  sections.forEach(({ x, width, bottom, flank = -1.28, belt, roof }) => {
    const ring = [
      [x, bottom, -width * 0.76],
      [x, flank, -width],
      [x, belt, -width * 0.98],
      [x, roof, -width * 0.6],
      [x, roof, width * 0.6],
      [x, belt, width * 0.98],
      [x, flank, width],
      [x, bottom, width * 0.76],
    ];
    ring.forEach((point) => positions.push(...point));
  });

  for (let section = 0; section < sections.length - 1; section += 1) {
    const current = section * ringSize;
    const next = (section + 1) * ringSize;
    const midpoint = (sections[section].x + sections[section + 1].x) * 0.5;
    const insideWheelOpening = [
      ELECTRIC_VEHICLE_LAYOUT.wheel.frontAxleX,
      ELECTRIC_VEHICLE_LAYOUT.wheel.rearAxleX,
    ].some((axleX) => (
      Math.abs(midpoint - axleX) < ELECTRIC_VEHICLE_LAYOUT.wheel.radius * 1.18
    ));
    for (let edge = 0; edge < ringSize; edge += 1) {
      if (insideWheelOpening && (edge === 0 || edge === 6 || edge === 7)) continue;
      const following = (edge + 1) % ringSize;
      indices.push(
        current + edge,
        next + following,
        next + edge,
        current + edge,
        current + following,
        next + following,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createWheelArchGeometry() {
  const points = [];
  const radius = ELECTRIC_VEHICLE_LAYOUT.wheel.radius * 1.18;
  const axles = [
    ELECTRIC_VEHICLE_LAYOUT.wheel.frontAxleX,
    ELECTRIC_VEHICLE_LAYOUT.wheel.rearAxleX,
  ];
  const sides = [-1, 1];
  const segments = 24;

  axles.forEach((axleX) => {
    sides.forEach((side) => {
      const z = side * (ELECTRIC_VEHICLE_LAYOUT.body.width * 0.5 - 0.06);
      for (let index = 0; index < segments; index += 1) {
        const angleA = (index / segments) * Math.PI;
        const angleB = ((index + 1) / segments) * Math.PI;
        points.push(
          axleX + Math.cos(angleA) * radius,
          ELECTRIC_VEHICLE_LAYOUT.wheel.centerY + Math.sin(angleA) * radius,
          z,
          axleX + Math.cos(angleB) * radius,
          ELECTRIC_VEHICLE_LAYOUT.wheel.centerY + Math.sin(angleB) * radius,
          z,
        );
      }
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function createGlassMaterial(opacity = 0.14) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x8fd4e8,
    transparent: true,
    opacity,
    metalness: 0.12,
    roughness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
}

function createAccentLight(color, position, scale) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    metalness: 0.2,
    roughness: 0.35,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scale), material);
  mesh.position.set(...position);
  mesh.renderOrder = 6;
  return { mesh, material };
}

function createShellMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: SHELL_COLOR.clone() },
      uOpacity: { value: 1 },
      uCutaway: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vLocalPosition = position;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uCutaway;
      uniform float uTime;
      varying vec3 vLocalPosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        float cutLimit = mix(2.2, 0.025, smoothstep(0.0, 1.0, uCutaway));
        if (uCutaway > 0.01 && vLocalPosition.z > cutLimit) discard;
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), normalize(vViewDirection))), 2.35);
        float scan = 0.93 + 0.07 * sin(vLocalPosition.x * 4.5 - uTime * 0.7);
        float underfloor = smoothstep(-2.12, -1.78, vLocalPosition.y) * (1.0 - smoothstep(-1.72, -1.45, vLocalPosition.y));
        float alpha = (0.02 + fresnel * 0.22 + underfloor * 0.04) * uOpacity * scan;
        vec3 tint = uColor * (0.68 + fresnel * 0.72) + vec3(0.08, 0.18, 0.16) * underfloor;
        gl_FragColor = vec4(tint, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

function createEdgeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(EDGE_COLOR) },
      uOpacity: { value: 0.36 },
      uCutaway: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uCutaway;
      varying vec3 vLocalPosition;
      void main() {
        float cutLimit = mix(2.2, 0.025, smoothstep(0.0, 1.0, uCutaway));
        if (uCutaway > 0.01 && vLocalPosition.z > cutLimit) discard;
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createVehicleShell() {
  const group = new THREE.Group();
  group.name = 'Silhouette holographique de compacte électrique';
  group.userData.contextOnly = true;
  const prefersReducedMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bodyGeometry = createBodyGeometry();
  const shellMaterial = createShellMaterial();
  const body = new THREE.Mesh(bodyGeometry, shellMaterial);
  body.name = 'Carrosserie translucide générique';
  body.renderOrder = 4;

  const edgeMaterial = createEdgeMaterial();
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeometry, 18), edgeMaterial);
  edges.name = 'Contours de la carrosserie';
  edges.renderOrder = 5;

  const archGeometry = createWheelArchGeometry();
  const arches = new THREE.LineSegments(archGeometry, edgeMaterial);
  arches.name = 'Passages de roues';
  arches.renderOrder = 5;

  const glassMaterial = createGlassMaterial(0.13);
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.05),
    glassMaterial,
  );
  windshield.name = 'Pare-brise holographique';
  windshield.position.set(-2.55, 0.08, 0);
  windshield.rotation.set(-0.55, Math.PI / 2, 0);
  windshield.renderOrder = 5;

  const rearGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.82),
    glassMaterial,
  );
  rearGlass.name = 'Lunette arrière holographique';
  rearGlass.position.set(2.75, -0.08, 0);
  rearGlass.rotation.set(0.48, -Math.PI / 2, 0);
  rearGlass.renderOrder = 5;

  const sideGlassGeometry = new THREE.PlaneGeometry(2.7, 0.72);
  const sideGlassLeft = new THREE.Mesh(sideGlassGeometry, glassMaterial);
  sideGlassLeft.position.set(0.1, -0.02, -1.72);
  sideGlassLeft.rotation.y = 0.04;
  const sideGlassRight = new THREE.Mesh(sideGlassGeometry, glassMaterial);
  sideGlassRight.position.set(0.1, -0.02, 1.72);
  sideGlassRight.rotation.y = Math.PI - 0.04;
  sideGlassLeft.renderOrder = sideGlassRight.renderOrder = 5;

  const headlightLeft = createAccentLight(0xd8fbff, [-3.95, -0.92, -0.72], [0.12, 0.14, 0.42]);
  const headlightRight = createAccentLight(0xd8fbff, [-3.95, -0.92, 0.72], [0.12, 0.14, 0.42]);
  const taillightLeft = createAccentLight(0xff6a52, [3.98, -0.78, -0.78], [0.1, 0.12, 0.46]);
  const taillightRight = createAccentLight(0xff6a52, [3.98, -0.78, 0.78], [0.1, 0.12, 0.46]);
  const accentLights = [headlightLeft, headlightRight, taillightLeft, taillightRight];

  // Halo bas pour rappeler le pack batterie sous le plancher.
  const underGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(
      ELECTRIC_VEHICLE_LAYOUT.battery.size[0] * 0.92,
      ELECTRIC_VEHICLE_LAYOUT.battery.size[2] * 0.86,
    ),
    new THREE.MeshBasicMaterial({
      color: 0x35d8c1,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  underGlow.name = 'Halo batterie sous plancher';
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.set(
    ELECTRIC_VEHICLE_LAYOUT.battery.center[0],
    ELECTRIC_VEHICLE_LAYOUT.battery.center[1] - 0.14,
    0,
  );
  underGlow.renderOrder = 3;

  group.add(
    body,
    edges,
    arches,
    windshield,
    rearGlass,
    sideGlassLeft,
    sideGlassRight,
    underGlow,
    ...accentLights.map((item) => item.mesh),
  );

  let focus = 'overview';
  let presentation = 'assembled';
  let currentOpacity = 1;
  let targetOpacity = 1;
  let currentCutaway = 0;
  let targetCutaway = 0;
  let elapsed = 0;

  function applyAccessoryVisibility(opacity, cutaway) {
    const glassOpacity = opacity * (presentation === 'exploded' ? 0.04 : 0.13);
    glassMaterial.opacity = glassOpacity;
    underGlow.material.opacity = 0.035 + opacity * 0.07;
    const cutHidesRightSide = cutaway > 0.45;
    sideGlassRight.visible = !cutHidesRightSide;
    headlightRight.mesh.visible = !cutHidesRightSide;
    taillightRight.mesh.visible = !cutHidesRightSide;
    accentLights.forEach(({ material }, index) => {
      const isTail = index >= 2;
      material.opacity = 0.35 + opacity * 0.55;
      material.emissiveIntensity = (isTail ? 0.7 : 0.9) * (0.55 + opacity * 0.55);
    });
  }

  function recomputeTargets(immediate = false) {
    const focusOpacity = focus === 'overview' || focus === 'wheels' || focus === 'chargePort'
      ? 1
      : 0.28;
    const presentationOpacity = presentation === 'assembled'
      ? 1
      : presentation === 'cutaway'
        ? 0.68
        : 0.35;
    targetOpacity = focusOpacity * presentationOpacity;
    targetCutaway = presentation === 'cutaway' ? 1 : 0;
    if (!immediate) return;
    currentOpacity = targetOpacity;
    currentCutaway = targetCutaway;
    shellMaterial.uniforms.uOpacity.value = currentOpacity;
    shellMaterial.uniforms.uCutaway.value = currentCutaway;
    edgeMaterial.uniforms.uOpacity.value = 0.08 + currentOpacity * 0.3;
    edgeMaterial.uniforms.uCutaway.value = currentCutaway;
    applyAccessoryVisibility(currentOpacity, currentCutaway);
  }

  function setFocus(nextFocus = 'overview', { immediate = false } = {}) {
    focus = nextFocus || 'overview';
    recomputeTargets(immediate);
  }

  function setPresentation(nextPresentation = 'assembled', { immediate = false } = {}) {
    if (!PRESENTATIONS.has(nextPresentation)) return false;
    presentation = nextPresentation;
    recomputeTargets(immediate);
    return true;
  }

  function update(deltaSeconds = 0, time = null) {
    const dt = Math.max(0, Number(deltaSeconds) || 0);
    elapsed = Number.isFinite(time) ? time : elapsed + dt;
    const ease = 1 - Math.exp(-dt * 5.8);
    currentOpacity = THREE.MathUtils.lerp(currentOpacity, targetOpacity, ease);
    currentCutaway = THREE.MathUtils.lerp(currentCutaway, targetCutaway, ease);
    shellMaterial.uniforms.uOpacity.value = currentOpacity;
    shellMaterial.uniforms.uCutaway.value = currentCutaway;
    shellMaterial.uniforms.uTime.value = prefersReducedMotion ? 0 : elapsed;
    edgeMaterial.uniforms.uOpacity.value = 0.08 + currentOpacity * 0.3;
    edgeMaterial.uniforms.uCutaway.value = currentCutaway;
    applyAccessoryVisibility(currentOpacity, currentCutaway);
    if (!prefersReducedMotion) {
      const pulse = 0.75 + Math.sin(elapsed * 2.4) * 0.18;
      accentLights.forEach(({ material }, index) => {
        const isTail = index >= 2;
        material.emissiveIntensity = (isTail ? 0.65 : 0.85) * pulse * (0.55 + currentOpacity * 0.55);
      });
    }
  }

  function dispose() {
    bodyGeometry.dispose();
    archGeometry.dispose();
    edges.geometry.dispose();
    shellMaterial.dispose();
    edgeMaterial.dispose();
    glassMaterial.dispose();
    sideGlassGeometry.dispose();
    windshield.geometry.dispose();
    rearGlass.geometry.dispose();
    underGlow.geometry.dispose();
    underGlow.material.dispose();
    accentLights.forEach(({ mesh, material }) => {
      mesh.geometry.dispose();
      material.dispose();
    });
  }

  recomputeTargets(true);
  return {
    group,
    setFocus,
    setPresentation,
    update,
    dispose,
    get state() {
      return Object.freeze({ focus, presentation, opacity: currentOpacity });
    },
  };
}
