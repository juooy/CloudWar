import { describe, it, expect } from 'vitest';
import { cloudRadius, cloudSpeed } from '../src/cloud';
import { RADIUS_SCALE, BASE_SPEED, START_MASS } from '../src/constants';

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
});
