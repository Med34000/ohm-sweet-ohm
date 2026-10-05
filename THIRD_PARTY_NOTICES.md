# Avis, licences et attributions de tiers

> Rédigé le 2026-07-14 vers 11:37 (Europe/Zurich) par **Codex — OpenAI, GPT-5.6 Sol Ultra**. Dernière mise à jour le 2026-09-22 vers 07:37 (Europe/Zurich) par **Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement)**.

> **Mise à jour 2026-09-29 vers 18:15 (Europe/Zurich) — Claude (Cowork) — Anthropic, Claude Sonnet 5.5.** La version publiée (dossier `dist/`, produit par `tools/build_dist.sh`) ne diffuse plus les anciens scans (MG4, groupe motopropulseur, onduleur, Car Concept) : ils sont conservés hors diffusion dans `_archive/`. Les modèles diffusés (`elan-sedan`, `elan-drive-unit`, `elan-wheel`, `elan-charger`) sont compressés avec Meshopt (glTF-Transform, outil sous licence MIT, décodeur meshoptimizer sous licence MIT, fourni avec three.js r164), sans changement de géométrie visible. Les logos constructeur du modèle Tesla 2018 Model 3 (Ameer Studio, CC BY 4.0) ont été retirés de la carrosserie ; l'attribution reste requise.

Ce registre central recense les logiciels et ressources 3D de tiers redistribués avec **Dans le moteur**, puis sa nouvelle expérience **Ohm Sweet Ohm**. Il doit rester joint à toute copie publique du projet. Une attribution n'implique ni affiliation ni approbation du projet par les auteurs cités.

## Three.js r164

- **Projet :** [Three.js](https://github.com/mrdoob/three.js/tree/r164), révision r164.
- **Auteurs :** three.js authors.
- **Licence :** [MIT](https://github.com/mrdoob/three.js/blob/r164/LICENSE).
- **Fichiers redistribués :** `libs/three.module.min.js`, `libs/OrbitControls.js`, `libs/GLTFLoader.js` et `libs/BufferGeometryUtils.js`.
- **Adaptation locale :** le chemin d'import de `BufferGeometryUtils.js` dans `GLTFLoader.js` a été adapté à l'organisation locale des fichiers ; la fonctionnalité reste celle de la révision r164.

Texte de licence applicable :

```text
The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Ressources 3D techniques historiques conservées

Les trois ressources suivantes sont attribuées à **[mkonstadakis](https://sketchfab.com/mkonstadakis)** et diffusées sous [Creative Commons Attribution 4.0 International — CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cette licence autorise le partage et l'adaptation, y compris à des fins commerciales, à condition de créditer l'auteur, de lier la licence et d'indiquer les modifications.

Depuis la refonte technique du 2026-09-22, ces trois GLB restent présents dans `assets/web/`, avec les attributions ci-dessous, mais la scène active ne les charge plus. Leur taille totale vérifiée est de **10 058 680 octets**, environ **10,06 Mo**. Les nouvelles maquettes décrites en fin de registre sont des créations distinctes ; ce remplacement ne modifie pas les licences des fichiers historiques.

### Electric Battery MG4

- **Fichier diffusé :** `assets/web/electric-battery-mg4-web.glb`.
- **Œuvre originale :** [Electric Battery MG4](https://sketchfab.com/3d-models/electric-battery-mg4-8cdf3316174e45d68a65b3058578c7e1).
- **Auteur :** [mkonstadakis](https://sketchfab.com/mkonstadakis).
- **Licence :** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Modifications :** géométrie décimée et simplifiée, attributs quantifiés, ressources consolidées, optimisation et empaquetage GLB pour la diffusion Web avec glTF-Transform 4.4.1.

> This work is based on “Electric Battery MG4” by mkonstadakis, licensed under CC BY 4.0. The model was decimated, quantized and optimized for web delivery.

### Electric Drive Unit (electric Motor)

- **Fichier diffusé :** `assets/web/electric-drive-unit-web.glb`.
- **Œuvre originale :** [Electric Drive Unit (electric Motor)](https://sketchfab.com/3d-models/electric-drive-unit-electric-motor-fcb05aac991e4ceea932097760699251).
- **Auteur :** [mkonstadakis](https://sketchfab.com/mkonstadakis).
- **Licence :** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Modifications :** géométrie décimée et simplifiée, attributs quantifiés, ressources consolidées, optimisation et empaquetage GLB pour la diffusion Web avec glTF-Transform 4.4.1.

> This work is based on “Electric Drive Unit (electric Motor)” by mkonstadakis, licensed under CC BY 4.0. The model was decimated, quantized and optimized for web delivery.

### MG MG4 ev Voltage converter inverter

- **Fichier diffusé :** `assets/web/mg4-inverter-web.glb`.
- **Œuvre originale :** [MG MG4 ev Voltage converter inverter](https://sketchfab.com/3d-models/mg-mg4-ev-voltage-converter-inverter-b7a6d114e9ef4833a1ddd65d4f59a7e3).
- **Auteur :** [mkonstadakis](https://sketchfab.com/mkonstadakis).
- **Licence :** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Modifications :** géométrie décimée et simplifiée, suppression dans Blender de neuf îlots constituant un fragment de scan flottant, orientation et dimensions recalibrées, attributs quantifiés, puis optimisation et empaquetage GLB avec glTF-Transform 4.4.1.

> This work is based on “MG MG4 ev Voltage converter inverter” by mkonstadakis, licensed under CC BY 4.0. The model was cleaned, dimensionally calibrated, quantized and optimized for web delivery.

## Carrosserie signature V0.9 préparée

### Car Concept

- **Fichiers dérivés :** `assets/blender/ve-signature-master.blend` et `assets/web/signature-car-body-web.glb`.
- **Œuvre originale :** [Car Concept — Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept).
- **Artiste indiqué dans les métadonnées officielles :** Eric Chadwick.
- **Titulaire indiqué :** Darmstadt Graphics Group GmbH, 2024.
- **Licence du modèle et des textures :** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Source binaire utilisée :** [CarConcept.glb](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb), SHA-256 `c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b`.
- **Modifications :** extraction de 33 pièces de carrosserie extérieure ; suppression de l'intérieur, des roues, des textures, des variantes de peinture et des éléments portant les logos connus ; remappage des proportions sur le référentiel de la compacte électrique ; remplacement par sept matériaux locaux sans texture ; décimation de 78 382 à 25 208 triangles ; quantification et optimisation Web avec glTF-Transform 4.4.1.

L'attribution est également embarquée dans le champ `asset.copyright` du GLB final.

> “Car Concept” by Eric Chadwick / Darmstadt Graphics Group GmbH (2024), licensed under CC BY 4.0. Exterior-only derivative for “Dans le moteur”: logos, textures, wheels and interior removed; proportions remapped, geometry decimated and quantized for Web delivery.

La source officielle comporte des logos Khronos et 3D Commerce soumis à des mentions juridiques distinctes. Le pipeline local ne sélectionne pas la plaque, l'emblème intérieur ni les textures qui les portent ; aucun de ces logos n'est intentionnellement redistribué dans les deux dérivés.

## Intégrité des fichiers diffusés

Empreintes recalculées le 2026-07-18 vers 14:35 (Europe/Zurich). Elles doivent être recalculées après toute nouvelle optimisation.

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `electric-battery-mg4-web.glb` | 2 807 200 octets | `1938a60e8920dfccbd7d5e956335850dc48573ef03f76a3deb33f5a08b563b3d` |
| `electric-drive-unit-web.glb` | 1 748 156 octets | `6b9267582a89f64bc91fb5251761c3cf85f405f58dca04c3c26f5b02f3f1099c` |
| `mg4-inverter-web.glb` | 5 503 324 octets | `11c27ec5791994f2518dc1ac30b3df74ca872cdca5482beb8c045c3a38f12cd9` |
| `signature-car-body-web.glb` | 409 380 octets | `f0418d869e0d7f8845613c3a2499aa507957cd09cbe8a8d3ee44d45f33abf113` |
| `ve-signature-master.blend` | 690 468 octets | `397619b1a6a8f6599609f10a5e7f09ff7016a6b1525a35cff316d0b55dfef3f1` |

## Marques et autres droits

Les noms **MG** et **MG4**, ainsi que les éventuels logos, formes ou signes distinctifs visibles dans les scans, peuvent être des marques ou éléments protégés appartenant à leurs titulaires respectifs. Leur présence sert uniquement à identifier la provenance technique des pièces dans une démonstration pédagogique.

La licence CC BY 4.0 accordée par l'auteur des modèles 3D ne garantit pas l'autorisation de tous les droits de marque, de dessin, de brevet, de publicité ou de personnalité pouvant s'appliquer. **Dans le moteur n'est ni affilié, ni sponsorisé, ni approuvé par MG Motor, SAIC Motor, Sketchfab ou l'auteur des modèles.** Avant toute campagne commerciale, les marques et logos visibles devront être contrôlés et, si nécessaire, masqués ou remplacés.

## Historique

- **2026-07-14 vers 11:37 (Europe/Zurich) — Codex — OpenAI, GPT-5.6 Sol Ultra** : création du registre central, séparation des assets Web et consignation des empreintes initiales.
- **2026-07-16 vers 11:00 (Europe/Zurich) — Codex — OpenAI, GPT-5 (variante exacte non exposée par l’environnement)** : description du nettoyage Blender de l’onduleur, recalcul de sa taille et de son empreinte SHA-256, et maintien des avertissements de licence et de marque.
- **2026-07-16 vers 11:23 (Europe/Zurich) — Codex — OpenAI, GPT-5 (variante exacte non exposée par l’environnement)** : ajout du copyright CC BY 4.0 dans le GLB lui-même et remplacement de l’empreinte par celle du fichier final issu du pipeline atomique validé.
- **2026-07-18 vers 14:35 (Europe/Zurich) — Codex — OpenAI, GPT-5 (variante exacte non exposée par l’environnement)** : ajout du candidat officiel Khronos Car Concept, de son maître Blender et de sa carrosserie Web sans logos ni textures, avec attribution CC BY 4.0, empreintes et description exacte des transformations.
- **2026-09-22 vers 07:10 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement)** : description de la nouvelle préparation Model 3 conservant l’habitacle et 147 maillages séparés, métadonnées et manifeste ; distinction de l’ancienne préparation fusionnée, maintien des licences et attributions, et consignation de l’empreinte du dérivé livré.
- **2026-09-22 vers 07:37 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement)** : distinction des trois scans techniques historiques désormais conservés sans chargement dans la scène ; ajout de la provenance originale des maquettes pédagogiques de moteur, batterie, onduleur, chargeur embarqué et câblages. Aucune suppression ni modification des attributions historiques.


## Adaptation Ohm Sweet Ohm du 2026-09-05

Dernière mise à jour le 2026-09-05 vers 23:24 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement).

Les modèles tiers ci-dessus sont repris avec leurs attributions. Ohm Sweet Ohm adapte leurs matériaux à l’exécution, leur éclairage, leur présentation et les interactions. Les fichiers source Blender et scripts historiques cités plus haut restent dans le projet test `VE-3D` ; la nouvelle application redistribue les GLB Web nécessaires.

La borne `assets/web/elan-charger.glb`, sa source `assets/blender/elan-charger.blend` et le script `tools/build_charger.py` sont une création originale de cette session pour Médéric Morin. Ils ne dérivent pas d’un modèle tiers. Aucun transfert de licence des autres assets n’est implicite.


## Carrosserie Ohm Sweet Ohm — préparation historique du 2026-09-06

Dernière mise à jour le 2026-09-06 vers 00:12 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement).

La carrosserie introduite le 2026-09-06 provient de [Tesla 2018 Model 3](https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f), par [Ameer Studio / uchiha.321abc](https://sketchfab.com/uchiha.321abc), sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Le modèle a été récupéré depuis la [collection publique Objaverse d’AllenAI](https://huggingface.co/datasets/allenai/objaverse). La licence individuelle `by` et l’auteur ont été vérifiés dans les métadonnées du modèle ; la licence de la collection n’est pas substituée à celle de l’objet.

- Original conservé : `assets/source/tesla-model3-ameer.glb` ; empreinte SHA-256 : `d6d78c9bd1bd9c7ca87a07509a2e7b6585995fcbdec054f297167ba7c15cd878`.
- Attribution et provenance : `assets/source/tesla-model3-license.json`.
- Dérivés : `assets/web/elan-sedan.glb`, `assets/blender/elan-sedan.blend`.
- Modifications de cette ancienne préparation : extraction de l’extérieur, retrait de l’habitacle et des roues d’origine, alignement des axes, mise à l’échelle uniforme, matériaux remplacés, simplification des pièces denses et regroupement par matériau. L’attribution suit le dérivé dans `asset.copyright` du GLB. Cette préparation est remplacée par celle décrite ci-dessous.
- Roues : création originale Ohm Sweet Ohm, conservée dans `assets/source/elan-wheel-design.glb` et optimisée dans `assets/web/elan-wheel.glb`. La scène Blender du 2026-09-06 combinait la carrosserie sous CC BY 4.0 et ces roues, avec attribution de la carrosserie.

La carrosserie indique une provenance visuelle ; la simulation pédagogique ne décrit pas les caractéristiques techniques exactes d’une Tesla Model 3. Ohm Sweet Ohm n’est affilié ni à Tesla, ni à Ameer Studio. Les attributions des ressources historiques, encore présentes dans le dossier, restent applicables.

## Carrosserie et habitacle Ohm Sweet Ohm — préparation active du 2026-09-22

Dernière mise à jour le 2026-09-22 vers 07:10 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement).

Cette préparation repart du même original **Tesla 2018 Model 3**, par **Ameer Studio / uchiha.321abc**, sous **CC BY 4.0**, dont la provenance et les liens de licence figurent ci-dessus. L’original et son attribution restent conservés. La licence s’applique au dérivé automobile et n’est pas remplacée par la licence d’une autre ressource du projet.

- **Dérivés actifs :** `assets/web/elan-sedan.glb`, `assets/blender/elan-sedan.blend` et `assets/web/elan-sedan-manifest.json` ; script reproductible `tools/build_sedan.py`.
- **Modifications :** conservation de l’extérieur et de l’habitacle ; retrait des roues, suspensions, plaques et éléments de châssis d’origine sélectionnés par le script ; alignement des axes et mise à l’échelle uniforme ; remplacement des matériaux ; simplification sélective des intérieurs et ornements denses. Les panneaux peints, vitrages et optiques préservent leur géométrie et leurs normales. Les maillages restent indépendants, sans regroupement par matériau.
- **Structure livrée :** 147 maillages, 440 989 triangles, 8 909 764 octets (environ 8,91 Mo) pour le GLB de carrosserie et d’habitacle. Chaque pièce conserve catégorie, libellé, ensemble et nom source dans les métadonnées glTF ; le manifeste consigne aussi ses dimensions et son nombre de triangles.
- **Attribution embarquée :** `asset.copyright` du GLB et champ `credit` du manifeste ; auteur, licence, source et transformations restent identifiables.
- **Roues originales :** `assets/web/elan-wheel.glb` reste une création Ohm Sweet Ohm distincte, instanciée quatre fois dans la scène Web. Les 151 éléments explorables représentent 147 maillages automobiles et quatre ensembles de roues ; ce nombre n’est pas une nomenclature constructeur.
- **Portée pédagogique :** le châssis, les composants électriques et la simulation restent illustratifs et ne reproduisent pas une configuration technique exacte de Tesla Model 3. Les modèles MG4 et autres ressources conservent leurs attributions propres, détaillées plus haut.

Empreinte du GLB actif recalculée le 2026-09-22 vers 07:10 (Europe/Zurich) :

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `assets/web/elan-sedan.glb` | 8 909 764 octets | `0fabe8d91a62220646e312c18876f0227e1bfccacfe1c0d2608265560e4f1ec3` |

Les empreintes datées de juillet décrivent les ressources historiques à cette date ; elles ne décrivent pas le nouveau GLB automobile. Ohm Sweet Ohm n’est affilié ni à Tesla ni à Ameer Studio.

## Maquettes techniques originales Ohm Sweet Ohm — 2026-09-22

Dernière mise à jour le 2026-09-22 vers 07:37 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement).

Les éléments suivants ont été créés pour Médéric Morin avec Three.js et Blender ; ils ne sont pas des dérivés des scans MG4 ni d’une CAO constructeur :

- `js/models/teaching-motor.js` : moteur synchrone à aimants permanents, six pôles à aimants enterrés, 54 encoches, trois phases, stator, rotor et arbre. Carters originaux construits dans Blender par `tools/build_motor.py`, éditables dans `assets/blender/elan-drive-unit.blend` et exportés vers `assets/web/elan-drive-unit.glb`.
- `js/models/teaching-battery.js` : pack pédagogique de quatre modules et 3 072 cellules aux proportions du format 2170, surveillance BMS, contacteurs, fusible et refroidissement.
- `js/models/teaching-power.js` et `js/data/electrical-topology.js` : onduleur, chargeur embarqué, bornes, câblages DC positif/négatif, trois phases U/V/W et trajets de recharge AC puis DC.

Les formes, quantités, proportions, ouvertures et couleurs servent à l’explication ; elles ne constituent ni un plan de fabrication ni une reproduction technique exacte d’une Tesla Model 3. La documentation primaire citée dans le README et l’interface sert à vérifier les principes, sans redistribution de ses schémas ou de ses modèles. Three.js reste utilisé sous la licence MIT reproduite au début de ce registre. Aucun transfert de licence des modèles tiers historiques vers ces créations originales n’est implicite.

Les ressources 3D binaires chargées par la scène active sont la carrosserie et l’habitacle `elan-sedan.glb`, les roues `elan-wheel.glb` la borne `elan-charger.glb` et les carters originaux `elan-drive-unit.glb`. Les autres pièces techniques sont produites par le code local, sans téléchargement des scans historiques.

Actualisation des maquettes techniques le 2026-09-22 vers 09:04 (Europe/Zurich) — Codex — OpenAI, GPT-6 (variante exacte non exposée par l’environnement). Références de forme et d’architecture liées dans le README ; aucun modèle CAO ni image constructeur redistribué dans ces maquettes originales.
