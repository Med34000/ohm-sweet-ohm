const frozenVector = (values) => Object.freeze([...values]);

/**
 * Référentiel métrique commun de la compacte électrique.
 *
 * Deux unités de scène représentent un mètre. Les axes X, Y et Z désignent
 * respectivement la longueur du véhicule, la verticale et sa largeur.
 */
export const ELECTRIC_VEHICLE_LAYOUT = Object.freeze({
  unitsPerMeter: 2,
  wheel: Object.freeze({
    radius: 0.647,
    width: 0.430,
    centerY: -1.70,
    frontAxleX: -2.705,
    rearAxleX: 2.705,
    frontTrackHalf: 1.550,
    rearTrackHalf: 1.551,
  }),
  battery: Object.freeze({
    center: frozenVector([-0.20, -1.94, 0]),
    size: frozenVector([4.30, 0.22, 2.76]),
  }),
  chargePort: Object.freeze({
    center: frozenVector([2.05, -1.25, 1.62]),
  }),
  inverter: Object.freeze({
    center: frozenVector([1.98, -0.79, 0.10]),
    size: frozenVector([0.88, 0.24, 0.90]),
  }),
  driveUnit: Object.freeze({
    center: frozenVector([2.34, -1.50, 0]),
    size: frozenVector([0.90, 1.00, 1.30]),
  }),
  motor: Object.freeze({
    center: frozenVector([1.98, -1.35, 0]),
    radius: 0.42,
    length: 1.05,
  }),
  reducer: Object.freeze({
    center: frozenVector([2.34, -1.55, 0]),
    size: frozenVector([1.45, 1.00, 0.90]),
    gears: Object.freeze({
      stage1PinionTeeth: 12,
      stage1GearTeeth: 36,
      stage2PinionTeeth: 11,
      finalGearTeeth: 37,
      ratio: (36 / 12) * (37 / 11),
    }),
  }),
  differential: Object.freeze({
    center: frozenVector([2.705, -1.70, 0]),
    radius: 0.36,
  }),
  body: Object.freeze({
    length: 8.574,
    width: 3.672,
    height: 3.008,
    wheelbase: 5.410,
  }),
  groundY: -2.347,
});
