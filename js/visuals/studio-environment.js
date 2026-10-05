import * as THREE from 'three';

/**
 * Environnement studio procédural.
 *
 * Construit une petite pièce sombre entourée de panneaux lumineux doux
 * (softboxes), puis la convertit en carte d'environnement PMREM. Les
 * matériaux métalliques ont ainsi de vraies choses à réfléchir, sans
 * aucun fichier HDRI externe : l'architecture statique reste intacte.
 *
 * Les couleurs des panneaux dépassent volontairement 1.0 (valeurs HDR)
 * pour produire des reflets francs après tone mapping ACES.
 */
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(28, 16, 28),
    new THREE.MeshBasicMaterial({ color: 0x10171c, side: THREE.BackSide }),
  );
  studio.add(room);

  const panel = (color, intensity, [width, height], position) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  };

  // Softbox zénithal : grand reflet principal sur les carters et capots.
  panel(0xffffff, 9, [11, 2.4], [-1, 7.6, 2]);
  panel(0xffffff, 6, [12, 1.3], [1, 5.0, 8]);
  // Latéral froid, côté chaîne électrique.
  panel(0xe1ecff, 5, [9, 3], [-12, 3, -4]);
  // Accent chaud discret pour détacher les volumes métalliques du fond froid.
  panel(0xfff2e6, 4, [7, 2], [11, 2.5, 5]);
  // Bandeaux bas : reflets horizontaux sur les pièces cylindriques
  // (arbres, cylindres, disques) vues de côté.
  panel(0x9fb4c0, 2.4, [16, 1.2], [0, -5.5, 10]);
  panel(0x9fb4c0, 1.8, [16, 1.2], [0, -5.2, -10]);

  // Bandes verticales façon studio automobile : de longs reflets nets qui suivent les flancs, les ailes et les portières.
  panel(0xf4f8ff, 7.5, [1.3, 7], [-13, 2.2, 7]);
  panel(0xf4f8ff, 7.5, [1.3, 7], [-13, 2.2, -7]);
  panel(0xfff6ec, 6, [1.3, 7], [13, 2.2, 7]);
  panel(0xfff6ec, 6, [1.3, 7], [13, 2.2, -7]);
  // Ciel de studio doux au-dessus : évite un toit uniformément noir.
  panel(0xdfe9f5, 2.2, [22, 22], [0, 7.9, 0]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, 0.04).texture;
  pmrem.dispose();
  studio.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) object.material.dispose();
  });
  return texture;
}
