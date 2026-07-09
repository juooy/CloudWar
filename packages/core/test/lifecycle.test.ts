import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { isAlive } from '../src/cloud';
import {
  DT,
  MIN_MASS,
  RESPAWN_TICKS,
  SHIELD_TICKS,
  START_MASS,
  VAPOR_MASS,
} from '../src/constants';

describe('사망과 리스폰', () => {
  it('질량이 MIN_MASS 미만이면 죽고 death 이벤트가 남는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS - 1;
    simulate(state, {}, DT);
    expect(isAlive(c)).toBe(false);
    expect(c.respawnTicks).toBe(RESPAWN_TICKS);
    expect(state.events.some((e) => e.type === 'death' && e.cloudId === 1)).toBe(true);
  });

  it('죽은 구름은 움직이지도 수증기를 먹지도 않는다', () => {
    const state = createInitialState(42);
    const c = state.clouds[0]!;
    c.respawnTicks = 10;
    const before = { ...c.pos };
    state.vapors = [{ id: 900, pos: { x: c.pos.x + 10, y: c.pos.y } }];
    simulate(state, { 1: { dir: { x: 1, y: 0 } } }, DT);
    expect(c.pos).toEqual(before);
    expect(state.vapors.some((v) => v.id === 900)).toBe(true);
    expect(c.mass).toBe(START_MASS);
  });

  it('RESPAWN_TICKS 후 START_MASS와 보호막을 갖고 리스폰한다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS - 1;
    simulate(state, {}, DT); // 사망
    for (let i = 0; i < RESPAWN_TICKS; i++) {
      state.vapors = []; // 랜덤 리스폰 위치의 수증기 흡수가 질량 단언을 오염시키지 않도록
      simulate(state, {}, DT);
    }
    expect(isAlive(c)).toBe(true);
    expect(c.mass).toBe(START_MASS);
    expect(c.shieldTicks).toBe(SHIELD_TICKS); // 리스폰 틱에 설정된 직후 값 (다음 틱부터 감소)
    expect(state.events.some((e) => e.type === 'respawn' && e.cloudId === 1)).toBe(true);
  });

  it('이벤트 버퍼는 매 틱 초기화된다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS - 1;
    simulate(state, {}, DT);
    expect(state.events.length).toBeGreaterThan(0);
    simulate(state, {}, DT);
    expect(state.events).toEqual([]);
  });

  it('보호막 틱은 매 틱 감소한다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.shieldTicks = 5;
    simulate(state, {}, DT);
    expect(c.shieldTicks).toBe(4);
  });

  it('보호막 중에도 수증기는 먹을 수 있다', () => {
    const state = createInitialState(42);
    const c = state.clouds[0]!;
    c.shieldTicks = 100;
    state.vapors = [{ id: 900, pos: { x: c.pos.x + 10, y: c.pos.y } }];
    simulate(state, {}, DT);
    expect(c.mass).toBe(START_MASS + VAPOR_MASS);
  });
});
