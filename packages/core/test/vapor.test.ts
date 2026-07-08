import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import {
  DT,
  WORLD_SIZE,
  START_MASS,
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
} from '../src/constants';

describe('수증기 스폰', () => {
  it('틱마다 VAPOR_SPAWN_PER_TICK개씩 VAPOR_MAX까지 스폰된다', () => {
    const state = createInitialState(42);
    simulate(state, {}, DT);
    expect(state.vapors).toHaveLength(VAPOR_SPAWN_PER_TICK);
    for (let i = 0; i < VAPOR_MAX * 2; i++) simulate(state, {}, DT);
    expect(state.vapors.length).toBeLessThanOrEqual(VAPOR_MAX);
  });

  it('스폰 위치는 월드 범위 안이다', () => {
    const state = createInitialState(42);
    for (let i = 0; i < 100; i++) simulate(state, {}, DT);
    for (const v of state.vapors) {
      expect(v.pos.x).toBeGreaterThanOrEqual(0);
      expect(v.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
      expect(v.pos.y).toBeGreaterThanOrEqual(0);
      expect(v.pos.y).toBeLessThanOrEqual(WORLD_SIZE);
    }
  });

  it('수증기 id는 중복되지 않는다', () => {
    const state = createInitialState(42);
    for (let i = 0; i < 50; i++) simulate(state, {}, DT);
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('수증기 흡수', () => {
  it('구름 반지름 안의 수증기는 흡수되어 질량이 늘어난다', () => {
    const state = createInitialState(42);
    const c = state.clouds[0]!;
    // 반지름(40) 안쪽과 바깥쪽에 수증기를 수동 배치
    state.vapors = [
      { id: 100, pos: { x: c.pos.x + 30, y: c.pos.y } }, // 거리 30 < 40 → 흡수
      { id: 101, pos: { x: c.pos.x + 100, y: c.pos.y } }, // 거리 100 → 유지
    ];
    simulate(state, {}, DT);
    expect(c.mass).toBe(START_MASS + VAPOR_MASS);
    expect(state.vapors.some((v) => v.id === 100)).toBe(false);
    expect(state.vapors.some((v) => v.id === 101)).toBe(true);
  });
});
