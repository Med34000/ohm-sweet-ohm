# Ohm Sweet Ohm : l'électrique, de l'intérieur

Simulation 3D pédagogique pour comprendre comment fonctionne une voiture électrique : recharge, batterie, onduleur, moteur, traction et **freinage régénératif** (« et si ralentir rechargeait la batterie ? »).

**Démo en ligne : https://ohm-sweet-ohm.netlify.app**

*English: an interactive 3D educational simulation of how an electric car works (charging, battery pack, inverter, permanent-magnet motor, regenerative braking). Runs in the browser, no build step, no account, no tracking. The French interface is the reference; the code is MIT.*

## Ce que tu peux faire

- **Voir l'histoire en 51 secondes** : 9 chapitres guidés, de la recharge au freinage régénératif.
- **Explorer librement** trois dispositions : **Voiture**, **Chaîne électrique**, **Éclaté technique** (151 pièces explorables).
- **Recharger** : brancher le câble et suivre l'énergie de la borne à la batterie (AC puis DC).
- **Rouler** : de 0 à 130 km/h, avec la conduite à une pédale. Pied levé, le moteur devient générateur et renvoie de l'énergie vers la batterie.
- **Récupérer** : doser le freinage et voir une partie de l'énergie du mouvement revenir.
- **Le secret du moteur** : trois courants, champ magnétique tournant, rotor à aimants, puis fonctionnement en générateur.

Les explications partent de zéro, avec plus de détails à la demande.

## Lancer en local

Aucune dépendance à installer : c'est du JavaScript natif (modules ES) avec Three.js r164 fourni dans `libs/`.

```sh
npm start        # serveur statique local sur http://127.0.0.1:8131
npm test         # 94 tests (node --test)
```

Il faut Node.js (pour les tests) et Python 3 (pour le petit serveur local). Tu peux aussi servir le dossier avec n'importe quel serveur statique : les modules ES et les modèles `.glb` ne fonctionnent pas en ouvrant `index.html` directement depuis le disque.

## Structure

| Dossier | Contenu |
|---|---|
| `index.html`, `css/` | Interface |
| `js/` | Scène 3D, histoire, simulation (batterie, moteur, chargeur, récupération), visuels |
| `js/simulation/`, `js/models/`, `js/data/` | Physique simplifiée, maquettes 3D procédurales, topologie électrique |
| `assets/web/` | Modèles 3D optimisés (carrosserie, roues, borne, carters moteur) |
| `libs/` | Three.js r164 et chargeurs (MIT) |
| `tests/` | Tests automatisés |
| `tools/` | Scripts Blender de préparation des modèles et outils de présentation |

## Important : ce que c'est, et ce que ce n'est pas

- C'est une **maquette pédagogique**. Les valeurs sont **illustratives** : formes, quantités et proportions servent à expliquer, pas à reproduire une configuration technique exacte.
- Les effets (champ magnétique, flux d'énergie) sont des **annotations stylisées**, pas un calcul électromagnétique.
- Projet indépendant, **non affilié à Tesla**, ni à aucun constructeur. « Tesla » et « Model 3 » sont des marques de leurs titulaires.
- C'est un projet en cours : pas parfait, des choses à améliorer. Les retours sont bienvenus dans les [Issues](../../issues).

## Licences et crédits

- **Code** : [MIT](LICENSE) © 2026 Médéric Morin.
- **Carrosserie et habitacle** (`assets/web/elan-sedan.glb`) : dérivé de *Tesla 2018 Model 3* par **Ameer Studio**, licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([source](https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f)). Modifié (retrait des roues et du châssis, matériaux remplacés, simplification, compression). Cette licence ne couvre que ce modèle, pas le reste du projet.
- **Three.js** r164 : MIT, © three.js authors.
- Détail complet et à jour dans [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Ce fichier décrit aussi des modèles historiques qui ne sont pas inclus dans ce dépôt.
- Les roues, la borne et les carters moteur sont des créations originales du projet.

## Auteur

Médéric Morin, [IAtelier](https://iatelier.ch) : accompagnement digital et IA pour TPE et PME. Projet réalisé avec l'aide de l'IA, sans être développeur de formation.

Suivre le projet sur X : [@Med_34000](https://x.com/Med_34000)

---

*Dernière mise à jour : 2026-10-05 ≈ 08:40 (Europe/Zurich) — Claude (Cowork) — Anthropic, pour Médéric Morin.*
