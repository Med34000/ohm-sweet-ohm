import * as THREE from 'three';
import { createGLTFLoader } from './gltf-loader.js';
import { wheelIdentityAt, labelWheelModel } from '../data/wheel-identity.js';

const BODY_URL = 'assets/web/elan-sedan.glb?v=explorable-3';
const WHEEL_URL = 'assets/web/elan-wheel.glb';
export const signatureBodyStatus = { state: 'idle', progress: 0, loaded: 0, total: 2, error: null };

function inspectBody(root) {
  let meshes = 0, triangles = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
  });
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.x < 8.8 || size.x > 9.3 || size.y < 2.4 || size.y > 2.9 || size.z < 3.8 || size.z > 4.4) {
    throw new Error('Les proportions de la nouvelle berline sont inattendues.');
  }
  if (!meshes || triangles > 650000) throw new Error('La géométrie de la berline dépasse le budget prévu.');
  return { meshes, triangles: Math.round(triangles), bounds: { minimum: bounds.min.toArray(), maximum: bounds.max.toArray(), size: size.toArray() } };
}

export async function loadSignatureBody({ fallbackShell = null, drivetrain = null } = {}) {
  signatureBodyStatus.state = 'loading';
  const loader = createGLTFLoader();
  try {
    const [bodyAsset, wheelAsset] = await Promise.all([BODY_URL, WHEEL_URL].map(url => loader.loadAsync(url).then(asset => {
      signatureBodyStatus.loaded++;
      signatureBodyStatus.progress = signatureBodyStatus.loaded / 2;
      return asset;
    })));
    const root = bodyAsset.scene;
    const geometry = inspectBody(root);
    root.name = 'Ohm Sweet Ohm — carrosserie de berline électrique adaptée';
    root.userData.component = 'vehicle-shell'; root.userData.contextOnly = true;
    root.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = false;
      object.userData.component = object.userData.category || 'body';
      object.userData.label ||= 'Carrosserie de berline électrique adaptée pour Ohm Sweet Ohm';
      object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.envMapIntensity = 1;
    });
    // Logos constructeur (capot et coffre) : retirés, Ohm Sweet Ohm n’est affilié à aucune marque.
    const brandMarks = [];
    root.traverse(object => { if (object.isMesh && /chrome_bonnet|chrome\.001_movsteer/i.test(object.name)) brandMarks.push(object); });
    for (const mark of brandMarks) { mark.parent?.remove(mark); mark.geometry?.dispose(); }
    const wheels = [];
    if (drivetrain) {
      const assemblies = drivetrain.group.children.filter(child => child.userData.component === 'wheel' && child.isGroup && child.children[0]?.isGroup);
      for (const assembly of assemblies) {
        const identity = wheelIdentityAt(assembly.position);
        Object.assign(assembly.userData, identity);
        const rotating = assembly.children[0];
        Object.assign(rotating.userData, identity);
        const model = wheelAsset.scene.clone(true);
        model.name = 'Jante et pneu';
        labelWheelModel(model, identity);
        if (assembly.position.z < 0) model.rotation.y = Math.PI;
        model.traverse(object => {
          if (!object.isMesh) return;
          object.castShadow = true; object.receiveShadow = true;
        });
        for (const child of rotating.children) child.visible = false;
        rotating.add(model); wheels.push({ assembly, rotating, model });
      }
    }
    if (fallbackShell) fallbackShell.group.visible = false;
    signatureBodyStatus.state = 'ready'; signatureBodyStatus.error = null;
    return { group: root, wheels, status: signatureBodyStatus, metrics: { url: BODY_URL, geometry }, error: null };
  } catch (error) {
    signatureBodyStatus.state = 'fallback'; signatureBodyStatus.error = error.message;
    if (fallbackShell) fallbackShell.group.visible = true;
    console.warn('Carrosserie Ohm Sweet Ohm indisponible :', error.message);
    return { group: null, wheels: [], status: signatureBodyStatus, metrics: null, error };
  }
}
export function signatureBodyRequested() { return true; }
