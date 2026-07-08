import { BASE_SPEED, RADIUS_SCALE, SPEED_EXPONENT, START_MASS } from './constants';

export function cloudRadius(mass: number): number {
  return RADIUS_SCALE * Math.sqrt(mass);
}

export function cloudSpeed(mass: number): number {
  return BASE_SPEED * (START_MASS / mass) ** SPEED_EXPONENT;
}
