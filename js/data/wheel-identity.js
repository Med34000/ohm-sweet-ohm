import { ELECTRIC_VEHICLE_LAYOUT as LAYOUT } from './vehicle-layout.js';

// Read the wheel's assembled position in the drivetrain's local frame, before
// any presentation offset. Array order and the current camera are irrelevant.
export function wheelIdentityAt(position) {
  const axle = Math.abs(position.x - LAYOUT.wheel.frontAxleX)
    < Math.abs(position.x - LAYOUT.wheel.rearAxleX) ? 'front' : 'rear';
  // Forward is -X and up is +Y: up × forward gives the driver's left, +Z.
  const side = position.z > 0 ? 'left' : 'right';
  return {
    component: 'wheel',
    wheelId: `wheel-${axle}-${side}`,
    axle,
    side,
    label: `Roue ${axle === 'front' ? 'avant' : 'arrière'} ${side === 'right' ? 'droite' : 'gauche'}`,
  };
}

export function labelWheelModel(model, identity) {
  model.traverse(object => Object.assign(object.userData, identity));
}
