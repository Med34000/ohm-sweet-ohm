import * as THREE from 'three';

// 2026-09-22 — Codex / OpenAI. Shared, deterministic metal microfinish.
// A tiny tiling texture adds surface variation without extra geometry or assets.
export function applyTechnicalMaterials(roots) {
  const size = 64, bytes = new Uint8Array(size * size * 4);
  let seed = 173;
  for (let i = 0; i < size * size; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = seed / 4294967295;
    bytes[i * 4] = 122 + Math.floor(noise * 12);
    bytes[i * 4 + 1] = 122 + Math.floor((1 - noise) * 12);
    bytes[i * 4 + 2] = 255; bytes[i * 4 + 3] = 255;
  }
  const normal = new THREE.DataTexture(bytes, size, size);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(22, 22);
  normal.magFilter = THREE.LinearFilter;
  normal.minFilter = THREE.LinearMipmapLinearFilter;
  normal.generateMipmaps = true; normal.needsUpdate = true;
  const seen = new Set();
  for (const root of roots) root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (seen.has(material) || !material.isMeshStandardMaterial || material.normalMap) continue;
      seen.add(material);
      if (material.metalness < 0.6) continue;
      material.normalMap = normal;
      const cast = /carter|moul|cast|aluminium/i.test(material.name);
      material.normalScale.setScalar(cast ? 0.28 : 0.09);
      material.envMapIntensity = cast ? 0.82 : 1.05;
      material.needsUpdate = true;
    }
  });
  return { texture: normal, materials: seen.size };
}
