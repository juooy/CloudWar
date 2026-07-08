import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state';
import { INITIAL_VAPOR_COUNT, START_MASS, WORLD_SIZE } from '../src/constants';

describe('createInitialState', () => {
  it('월드 중앙에 시작 질량의 구름 1개를 만든다', () => {
    const state = createInitialState(42);
    expect(state.tick).toBe(0);
    expect(state.clouds).toHaveLength(1);
    expect(state.clouds[0]).toEqual({
      id: 1,
      pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      mass: START_MASS,
    });
  });

  it('시작부터 수증기가 맵에 깔려 있다', () => {
    const state = createInitialState(42);
    expect(state.vapors).toHaveLength(INITIAL_VAPOR_COUNT);
    for (const v of state.vapors) {
      expect(v.pos.x).toBeGreaterThanOrEqual(0);
      expect(v.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
      expect(v.pos.y).toBeGreaterThanOrEqual(0);
      expect(v.pos.y).toBeLessThanOrEqual(WORLD_SIZE);
    }
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('같은 시드는 같은 초기 상태를 만든다', () => {
    expect(JSON.stringify(createInitialState(7))).toBe(JSON.stringify(createInitialState(7)));
  });
});
