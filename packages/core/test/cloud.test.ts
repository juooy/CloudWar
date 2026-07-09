import { describe, it, expect } from 'vitest';
import { cloudRadius, cloudSpeed, isAlive } from '../src/cloud';
import { RADIUS_SCALE, BASE_SPEED, START_MASS, MIN_MASS } from '../src/constants';
import { createCloud } from '../src/state';

describe('구름 공식', () => {
  it('반지름은 질량의 제곱근에 비례한다', () => {
    expect(cloudRadius(100)).toBeCloseTo(RADIUS_SCALE * 10);
    expect(cloudRadius(400)).toBeCloseTo(RADIUS_SCALE * 20);
  });

  it('기준 질량에서 속도는 BASE_SPEED다', () => {
    expect(cloudSpeed(START_MASS)).toBeCloseTo(BASE_SPEED);
  });

  it('질량이 클수록 느리다', () => {
    expect(cloudSpeed(400)).toBeLessThan(cloudSpeed(100));
    expect(cloudSpeed(100)).toBeLessThan(cloudSpeed(50));
  });

  it('퇴화 질량(0·음수)은 MIN_MASS로 클램프되어 유한값을 준다', () => {
    expect(cloudSpeed(0)).toBe(cloudSpeed(MIN_MASS));
    expect(cloudSpeed(-5)).toBe(cloudSpeed(MIN_MASS));
    expect(Number.isFinite(cloudSpeed(0))).toBe(true);
    expect(cloudRadius(0)).toBe(cloudRadius(MIN_MASS));
    expect(cloudRadius(-5)).toBe(cloudRadius(MIN_MASS));
  });
});

describe('isAlive', () => {
  it('respawnTicks가 0이면 생존, 양수면 사망 상태다', () => {
    const cloud = createCloud(1, { x: 0, y: 0 }, 1, false);
    expect(isAlive(cloud)).toBe(true);
    cloud.respawnTicks = 30;
    expect(isAlive(cloud)).toBe(false);
  });
});
