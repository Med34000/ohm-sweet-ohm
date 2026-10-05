export const BOUNDARY = 'De 100 unités fournies à la recharge jusqu’aux roues. Fabrication du véhicule et production de l’électricité non incluses.';

export const ENERGY_MODEL = Object.freeze({
  useful: 68,
  losses: 32,
  recoveredOnCombinedCycle: 22,
  effectiveWithReuse: 90,
  label: 'Voiture électrique',
});

// Sous-répartition pédagogique cohérente avec le total fixe de 32 unités.
// Le DOE/EPA publie les grands postes ; cette ventilation composant par
// composant sert à synchroniser la narration et ne décrit pas un modèle précis.
export const ELECTRIC_LOSS_BREAKDOWN = Object.freeze({
  charging: 10,
  inverter: 3,
  motor: 10,
  transmission: 6,
  auxiliaries: 3,
});

export const ELECTRIC_LOSS_NOTE = 'Ventilation illustrative des 32 unités perdues : elle synchronise la démonstration composant par composant et ne constitue pas une mesure constructeur.';

export const BRAKING_MODEL = Object.freeze({ recovered: 60, losses: 40 });

export const SOURCES = Object.freeze([
  Object.freeze({
    label: 'DOE — composants et recharge',
    url: 'https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work',
  }),
  Object.freeze({
    label: 'DOE/EPA — flux d’énergie électrique',
    url: 'https://www.fueleconomy.gov/feg/atv-ev.shtml',
  }),
  Object.freeze({
    label: 'SuisseEnergie — rendement et freinage',
    url: 'https://pubdb.bfe.admin.ch/fr/publication/download/10484',
  }),
]);

export const SCIENCE_NOTE = 'Valeurs indicatives : elles varient selon le véhicule, la température, la vitesse, le relief et les accessoires.';
