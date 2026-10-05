// Ohm Sweet Ohm — chargeur glTF commun : décodage Meshopt (modèles compressés, ≈ 4× plus légers).
// 2026-09-29 ≈17:40 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Sonnet 5.5.
import { GLTFLoader } from '../../libs/GLTFLoader.js';
import { MeshoptDecoder } from '../../libs/meshopt_decoder.module.js';

export function createGLTFLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
