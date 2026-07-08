import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state';
import { START_MASS, WORLD_SIZE } from '../src/constants';

describe('createInitialState', () => {
  it('월드 중앙에 시작 질량의 구름 1개를 만든다', () => {
    const state = createInitialState(42);
    expect(state.tick).toBe(0);
    expect(state.rngState).toBe(42);
    expect(state.clouds).toHaveLength(1);
    expect(state.clouds[0]).toEqual({
      id: 1,
      pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      mass: START_MASS,
    });
    expect(state.vapors).toHaveLength(0);
    expect(state.nextEntityId).toBe(2);
  });
});
