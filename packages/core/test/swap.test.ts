import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { isAlive } from '../src/cloud';
import { DT, MIN_MASS, START_MASS, SWAP_COOLDOWN_TICKS, SWAP_COST_RATIO } from '../src/constants';

describe('극성 스왑', () => {
  it('스왑하면 극성이 반전되고 질량 15%를 잃고 쿨다운이 걸린다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(-1);
    expect(c.mass).toBeCloseTo(START_MASS * (1 - SWAP_COST_RATIO));
    expect(c.swapCooldown).toBe(SWAP_COOLDOWN_TICKS);
    expect(state.events.some((e) => e.type === 'swap' && e.cloudId === 1)).toBe(true);
  });

  it('쿨다운 중에는 스왑이 무시된다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    const massAfterFirst = c.mass;
    state.vapors = []; // 직전 틱에 스폰된 수증기가 질량 단언을 오염시키지 않도록
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(-1); // 그대로
    expect(c.mass).toBe(massAfterFirst);
  });

  it('쿨다운이 끝나면 다시 스왑할 수 있다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    for (let i = 0; i < SWAP_COOLDOWN_TICKS; i++) simulate(state, {}, DT);
    expect(c.swapCooldown).toBe(0);
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(1);
  });

  it('스왑 비용으로 MIN_MASS 미만이 되면 그 틱에 죽는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS + 1; // 21 * 0.85 = 17.85 < 20
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(isAlive(c)).toBe(false);
  });

  it('죽은 구름은 스왑할 수 없다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.respawnTicks = 30;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(1);
  });
});
