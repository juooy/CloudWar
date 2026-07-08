import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState, createCloud } from '../src/state';
import {
  DT,
  WORLD_SIZE,
  START_MASS,
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
} from '../src/constants';
import type { GameState } from '../src/types';

/** 스폰 로직만 관찰하기 위해 구름·초기 수증기를 비운 상태 */
function emptyWorld(seed: number): GameState {
  const state = createInitialState(seed);
  state.clouds = [];
  state.vapors = [];
  return state;
}

describe('수증기 스폰', () => {
  it('틱마다 VAPOR_SPAWN_PER_TICK개씩 스폰된다', () => {
    const state = emptyWorld(42);
    simulate(state, {}, DT);
    expect(state.vapors).toHaveLength(VAPOR_SPAWN_PER_TICK);
    simulate(state, {}, DT);
    expect(state.vapors).toHaveLength(VAPOR_SPAWN_PER_TICK * 2);
  });

  it('VAPOR_MAX를 넘지 않는다', () => {
    const state = emptyWorld(42);
    const enoughTicks = Math.ceil(VAPOR_MAX / VAPOR_SPAWN_PER_TICK) + 50;
    for (let i = 0; i < enoughTicks; i++) simulate(state, {}, DT);
    expect(state.vapors).toHaveLength(VAPOR_MAX);
  });

  it('스폰 위치는 월드 범위 안이다', () => {
    const state = emptyWorld(42);
    for (let i = 0; i < 100; i++) simulate(state, {}, DT);
    for (const v of state.vapors) {
      expect(v.pos.x).toBeGreaterThanOrEqual(0);
      expect(v.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
      expect(v.pos.y).toBeGreaterThanOrEqual(0);
      expect(v.pos.y).toBeLessThanOrEqual(WORLD_SIZE);
    }
  });

  it('수증기 id는 초기 배치·스폰을 통틀어 중복되지 않는다', () => {
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

describe('수증기 경합 규칙', () => {
  it('두 구름 반경에 동시에 들면 clouds 배열의 앞선 구름이 먹는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const a = state.clouds[0]!; // r = 40
    const b = createCloud(2, { x: a.pos.x + 50, y: a.pos.y }, a.polarity, true);
    // 같은 극성 겹침은 같은 틱에 밀어내기가 일어나 수증기가 경계 밖으로 벗어난다 —
    // 보호막으로 전투 상호작용을 끄고 순수 경합만 관찰 (보호막 중 수증기 흡수는 허용됨)
    a.shieldTicks = 100;
    b.shieldTicks = 100;
    state.clouds.push(b);
    // 두 구름 사이 — a에서 25, b에서 25 (둘 다 반경 40 안)
    state.vapors = [{ id: 900, pos: { x: a.pos.x + 25, y: a.pos.y } }];
    simulate(state, {}, DT);
    expect(a.mass).toBeGreaterThan(b.mass);
    expect(state.vapors.some((v) => v.id === 900)).toBe(false);
  });

  it('죽은 구름은 수증기를 먹지 못하고, 배열 뒤 구름이 먹는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const a = state.clouds[0]!;
    a.respawnTicks = 30;
    const b = createCloud(2, { x: a.pos.x + 50, y: a.pos.y }, a.polarity, true);
    state.clouds.push(b);
    state.vapors = [{ id: 900, pos: { x: a.pos.x + 25, y: a.pos.y } }];
    simulate(state, {}, DT);
    expect(b.mass).toBe(START_MASS + VAPOR_MASS);
  });
});
