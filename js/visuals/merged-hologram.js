// Ohm Sweet Ohm — fusion des pièces de l’hologramme en un seul objet dessinable.
// 2026-09-29 ≈15:20 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Sonnet 5.5.
//
// L’hologramme n’a besoin que de la position et de la normale de chaque sommet : plus d’une centaine
// de maillages deviennent un seul, pour les mêmes triangles (≈110 appels de rendu en moins, décisif sur mobile).
import * as THREE from 'three';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';

/**
 * Fusionne tous les maillages de `root` (transformations relatives à `root` incluses) et renvoie
 * { geometry, sources, triangles } — ou null s’il n’y a rien à fusionner.
 */
export function mergeHologramGeometry(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = [], sources = [], vector = new THREE.Vector3();
  root.traverse(object => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    const source = object.geometry, position = source.attributes.position, normal = source.attributes.normal;
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const positions = new Float32Array(position.count * 3), normals = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      vector.fromBufferAttribute(position, i).applyMatrix4(matrix); positions.set([vector.x, vector.y, vector.z], i * 3);
      if (normal) { vector.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize(); normals.set([vector.x, vector.y, vector.z], i * 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    const indices = source.index ? Uint32Array.from(source.index.array) : Uint32Array.from({ length: position.count }, (_, i) => i);
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    parts.push(geometry); sources.push(object);
  });
  if (!parts.length) return null;
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  return geometry ? { geometry, sources, triangles: geometry.index.count / 3 } : null;
}
