import { BASE_SPEED, MIN_MASS, RADIUS_SCALE, SPEED_EXPONENT, START_MASS } from './constants';
import type { Cloud } from './types';

/** 공식은 질량을 MIN_MASS 하한으로 클램프한다 — 전투로 질량이 0 이하가 되는 순간에도 유한값 보장 */
export function cloudRadius(mass: number): number {
  return RADIUS_SCALE * Math.sqrt(Math.max(mass, MIN_MASS));
}

export function cloudSpeed(mass: number): number {
  return BASE_SPEED * (START_MASS / Math.max(mass, MIN_MASS)) ** SPEED_EXPONENT;
}

export function isAlive(cloud: Cloud): boolean {
  return cloud.respawnTicks === 0;
}
