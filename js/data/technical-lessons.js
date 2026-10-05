// 2026-09-30 ≈19:05 (Europe/Zurich) — Codex — OpenAI.
// Découverte progressive : chaque étape relie un détail visible à un phénomène simple.
// Les quantités éventuelles décrivent uniquement cette maquette pédagogique.
export const TECHNICAL_PARTS = {
  battery: {
    name: 'La batterie', label: 'Batterie',
    simple: 'Sous le plancher, des cellules stockent l’énergie. Ouvre le pack : tu verras aussi comment il est refroidi et surveillé.',
    diagram: ['Cellules', 'Modules', 'Pack'],
    technical: '<p><strong>Série et parallèle.</strong> Relier des cellules en série additionne leurs tensions ; des branches en parallèle augmentent la capacité disponible. L’énergie du pack dépend de sa tension et de sa capacité.</p><p><strong>Surveiller et isoler.</strong> Le BMS mesure notamment tensions et températures. Il adapte les limites de charge et de décharge ; les contacteurs permettent d’isoler le pack du circuit extérieur. Un fusible apporte une protection contre les surintensités.</p><p><strong>Garder la bonne température.</strong> Des rubans parcourus par un liquide passent entre les rangées de cellules et évacuent leur chaleur. Le refroidissement ne transporte pas l’énergie électrique vers le moteur.</p><p class="tech-note">Architecture inspirée du pack cylindrique de la Model 3 de première génération : quatre longs modules et cellules au format 2170 (21 × 70 mm). Les 3 072 cellules affichées simplifient la densité réelle ; leur nombre ne détermine pas les 60 kWh simulés.</p>',
  },
  bms: {
    name: 'Le BMS et les protections', label: 'BMS',
    simple: 'Le système de gestion de batterie mesure l’état des cellules. Il fixe les limites de charge et de décharge et pilote les protections du pack.',
    diagram: ['Mesurer', 'Décider', 'Protéger'],
    technical: '<p><strong>Mesurer.</strong> Des circuits de surveillance remontent les tensions des cellules et des mesures de température. Le BMS estime aussi l’état de charge et suit les limites du pack.</p><p><strong>Décider.</strong> Il communique les courants admissibles aux systèmes de charge et de traction. L’équilibrage aide à limiter les écarts entre cellules.</p><p><strong>Agir.</strong> Les contacteurs relient ou isolent la batterie du circuit haute tension. Ils sont distincts de la carte BMS. Le fusible constitue une protection supplémentaire contre une surintensité.</p><p class="tech-note">Carte et protections rapprochées pour l’observation. Ce sous-ensemble est illustratif, pas le schéma d’un BMS Tesla.</p>',
  },
  motor: {
    name: 'Le moteur électrique', label: 'Moteur',
    simple: 'Comment du cuivre immobile fait-il tourner les roues ? Observe les bobines, le champ puis le rotor. Au freinage, ce même moteur peut produire de l’électricité.',
    diagram: ['Trois courants', 'Champ tournant', 'Rotor · arbre'],
    technical: '<p><strong>Les bobines restent fixes.</strong> L’onduleur pilote trois courants décalés dans les bobines de cuivre du stator. Ensemble, ils créent un champ magnétique tournant, tandis que les bobines restent immobiles.</p><p><strong>Le rotor entraîne l’arbre.</strong> Des aimants sont logés dans le rotor, au centre du stator. Le champ agit sur le rotor et produit un couple. L’arbre tourne avec lui ; le réducteur adapte la vitesse et le couple avant les roues.</p><p><strong>Le même moteur peut produire.</strong> Lorsque les roues l’entraînent, il devient générateur. La conversion contrôlée par l’électronique s’oppose au mouvement et renvoie une partie de l’énergie vers la batterie, avec des pertes et dans les limites du pack. Le rotor garde son sens de rotation.</p><p class="tech-note">Les couleurs et le champ animé rendent visible un phénomène invisible : ce sont des repères pédagogiques, pas une simulation du champ réel. La démonstration isolée est ralentie et indépendante de la vitesse et du bilan d’énergie de la voiture.</p>',
  },
  hv: {
    name: 'Les liaisons haute tension', label: 'Câbles HT',
    simple: 'Les câbles orange relient les organes électriques. Suis le trajet : courant continu côté batterie, trois phases côté moteur.',
    diagram: ['Batterie · DC', 'Onduleur', 'Moteur · AC'],
    technical: '<p><strong>Deux côtés différents.</strong> La paire positive et négative relie la batterie à l’onduleur en courant continu (DC). Les sorties U, V et W alimentent les trois phases du moteur en courant alternatif (AC). Sur cette architecture intégrée, ces connexions sont courtes et internes au groupe moteur ; l’éclaté les écarte pour les rendre visibles.</p><p><strong>L’énergie peut revenir.</strong> Au freinage régénératif, la conversion est réversible et le transfert d’énergie s’inverse. Les impulsions animées montrent ce transfert, pas la vitesse ni le sens instantané des électrons.</p><p><strong>Les petits fils ont un autre rôle.</strong> Les signaux de commande et de surveillance sont distincts de la puissance haute tension. Le liquide de refroidissement suit encore un autre circuit, représenté en bleu.</p><p class="tech-note">Tracés et connecteurs schématiques. La haute tension réelle est réservée aux professionnels habilités ; cette vue n’est pas une procédure d’intervention.</p>',
  },
  inverter: {
    name: 'L’onduleur', label: 'Onduleur',
    simple: 'Il transforme le courant continu de la batterie en trois courants alternatifs pilotés. C’est lui qui dose l’effort du moteur.',
    diagram: ['DC · continu', 'Conversion', 'AC · 3 phases'],
    technical: '<p><strong>Une commutation rapide.</strong> Des interrupteurs électroniques de puissance commandent les trois phases. Le pilotage des courants agit sur le couple du moteur.</p><p><strong>Une commande précise.</strong> Le calculateur tient compte de la position du rotor, du courant demandé et des limites du système. La fréquence électrique dépend de la vitesse et du nombre de paires de pôles.</p><p><strong>Une conversion réversible.</strong> Pendant la récupération, l’électronique contrôle le courant renvoyé vers la batterie, dans ses limites d’acceptation.</p><p class="tech-note">Les composants et leur agencement sont illustratifs ; les commutations réelles sont trop rapides pour être représentées à leur fréquence normale.</p>',
  },
  charger: {
    name: 'Le chargeur embarqué', label: 'Chargeur AC',
    simple: 'Comment la batterie reçoit-elle l’électricité de la borne ? Ouvre ce boîtier : entrée AC, conversion, puis sortie DC vers les cellules.',
    diagram: ['Prise · AC', 'Chargeur', 'Batterie · DC'],
    technical: '<p><strong>Recevoir et convertir.</strong> À l’arrière du pack, le chargeur reçoit le courant alternatif de la prise. Son électronique le redresse, puis adapte la tension et le courant à la batterie. Les bobines et condensateurs participent au filtrage ; le transformateur de cette architecture assure une isolation électrique entre les deux côtés.</p><p><strong>Réguler et refroidir.</strong> La sortie DC est contrôlée avec les systèmes de charge et de gestion de la batterie. Les raccords à l’arrière du boîtier appartiennent au circuit de liquide qui évacue la chaleur : ils ne transportent pas de courant.</p><p><strong>En recharge rapide DC.</strong> La conversion a lieu dans la borne ; ce trajet contourne le chargeur AC embarqué. Ce second circuit n’est pas animé dans cette maquette.</p><p class="tech-note">Boîtier, composants et agencement illustratifs, sans reproduction d’un chargeur constructeur. La recharge AC de 11 kW est accélérée 120 fois ; les impulsions montrent un transfert d’énergie, pas le mouvement des électrons.</p>',
  },
};

export const LESSONS = {
  battery: [
    { id: 'cells', title: 'Où est l’énergie ?', text: 'Ces petits cylindres sont des cellules : chacune stocke de l’énergie sous forme chimique. Réunies en modules, elles alimentent la voiture.', labels: [['cells', 'Cellules', 'Une réserve d’énergie chimique'], ['modules', 'Modules', 'Des cellules réunies']] },
    { id: 'cooling', title: 'À quoi sert le ruban ?', text: 'Le serpentin passe entre les cellules. Un liquide y emporte leur chaleur pour garder une température adaptée ; il ne transporte pas le courant.', labels: [['cooling', 'Serpentin de refroidissement', 'Le liquide emporte la chaleur']] },
    { id: 'bms', title: 'Qui surveille le pack ?', text: 'Les petits fils remontent tensions et températures au BMS. Il fixe les limites de la batterie ; les contacteurs peuvent l’isoler du circuit.', labels: [['bms', 'BMS', 'Mesurer et fixer les limites'], ['contactors', 'Contacteurs', 'Relier ou isoler le pack']] },
  ],
  bms: [
    { id: 'bms', title: 'Mesurer', text: 'Les petits fils de mesure remontent l’état des cellules au BMS. Ils servent à surveiller, pas à alimenter le moteur.', labels: [['bms', 'Carte BMS', 'Tensions et températures']] },
    { id: 'contactors', title: 'Isoler', text: 'Le BMS pilote la sécurité du pack. Les contacteurs ouvrent ou ferment la liaison haute tension avec le reste de la voiture.', labels: [['contactors', 'Contacteurs', 'Relier ou isoler le pack']] },
    { id: 'fuse', title: 'Protéger', text: 'Le fusible est une protection distincte : en cas de surintensité suffisante, il interrompt le circuit de puissance.', labels: [['fuse', 'Fusible HT', 'Protection contre les surintensités']] },
  ],
  motor: [
    { id: 'stator', title: 'Pourquoi 3 courants ?', text: 'Dans les bobines de cuivre, l’onduleur envoie trois courants décalés. Leur action se combine pour créer un champ magnétique tournant.', labels: [['stator', 'Bobines de cuivre', 'Trois courants décalés']] },
    { id: 'field', title: 'Qu’est-ce qui tourne ?', text: 'Les bobines restent immobiles ; c’est leur champ magnétique qui tourne. L’animation le rend visible : il agit sur les aimants du rotor.', labels: [['stator', 'Stator', 'Le cuivre reste immobile'], ['field', 'Champ tournant', 'Un phénomène rendu visible']] },
    { id: 'rotor', title: 'Comment ça avance ?', text: 'Les aimants du rotor suivent le champ. Le rotor entraîne l’arbre, puis les engrenages transmettent le mouvement aux roues.', labels: [['rotor', 'Rotor aimanté', 'Il tourne au centre'], ['shaft', 'Arbre de sortie', 'Vers les engrenages, puis les roues']] },
    { id: 'generator', title: 'Et si tu ralentis ?', text: 'Quand les roues entraînent le moteur, il devient générateur. L’énergie revient vers la batterie ; le rotor garde son sens de rotation.', labels: [['rotor', 'Rotor entraîné', 'Même sens de rotation'], ['stator', 'Bobines', 'Du mouvement à l’électricité']] },
  ],
  hv: [
    { id: 'dc', title: 'Batterie → onduleur', text: 'Une paire de câbles + et − transporte la puissance en courant continu entre la batterie et l’onduleur.', labels: [['dc', 'Liaison DC', 'Deux conducteurs : + et −']] },
    { id: 'phases', title: 'Onduleur → moteur', text: 'Trois connexions internes U, V et W relient l’onduleur au moteur. Leurs courants décalés créent le champ tournant ; l’éclaté écarte les pièces pour montrer ces connexions.', labels: [['inverter', 'Onduleur', 'DC devient AC triphasé']] },
    { id: 'charge', title: 'Prise → batterie', text: 'En recharge AC, l’énergie passe d’abord par le chargeur embarqué. Elle rejoint ensuite la batterie en courant continu.', labels: [['charger', 'Chargeur embarqué', 'Convertir AC en DC']] },
  ],
  inverter: [
    { id: 'dc', title: 'Recevoir', text: 'La batterie fournit une tension continue à l’entrée de l’onduleur.', labels: [['inverter', 'Entrée DC', 'Depuis la batterie']] },
    { id: 'phases', title: 'Piloter', text: 'L’électronique commande les trois phases du moteur. Le courant est dosé pour produire le couple demandé.', labels: [['inverter', 'Électronique de puissance', 'Trois phases pilotées']] },
  ],
  charger: [
    { id: 'charge-ac', title: 'Que reçoit-il ?', text: 'Le câble apporte le courant alternatif de la borne. L’entrée AC du chargeur le reçoit : la batterie a besoin de courant continu.', labels: [['chargerInput', 'Entrée AC', 'Depuis la prise de recharge']] },
    { id: 'charge-conversion', title: 'Que cache le boîtier ?', text: 'L’électronique convertit et adapte l’électricité. Les bobines de cuivre et les condensateurs aident à la filtrer ; le transformateur assure l’isolation électrique.', labels: [['chargerConversion', 'Conversion et isolation', 'L’électricité est adaptée à la batterie']] },
    { id: 'charge-dc', title: 'Où va l’énergie ?', text: 'La sortie fournit du courant continu contrôlé. Les bornes + et − rejoignent la batterie ; la recharge s’arrête quand elle est pleine.', labels: [['chargerOutput', 'Sortie DC · + / −', 'Vers la batterie']] },
  ],
};
