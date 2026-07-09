import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState, createCloud } from '../src/state';
import { cloudRadius, isAlive } from '../src/cloud';
import { DT, WORLD_SIZE } from '../src/constants';

/** 수증기 없는 2구름 상태 — 전투 규칙만 관찰 */
function duel(massA: number, massB: number, dist: number, samePolarity: boolean) {
  const state = createInitialState(42);
  state.vapors = [];
  const a = state.clouds[0]!;
  a.mass = massA;
  const b = createCloud(2, { x: a.pos.x + dist, y: a.pos.y }, samePolarity ? a.polarity : -1, true);
  b.mass = massB;
  state.clouds.push(b);
  return { state, a, b };
}

describe('같은 극성 — 흡수', () => {
  it('1.25배 이상 크고 작은 쪽 중심이 반경 안이면 통째로 흡수한다', () => {
    const { state, a, b } = duel(125, 100, 40, true); // rA=44.7, dist 40 < 44.7
    simulate(state, {}, DT);
    expect(a.mass).toBe(225);
    expect(isAlive(b)).toBe(false);
    expect(state.events.some((e) => e.type === 'absorb' && e.cloudId === 1 && e.otherId === 2)).toBe(true);
  });

  it('1.25배 미만이면 흡수하지 않고 밀어낸다', () => {
    const { state, a, b } = duel(120, 100, 30, true);
    simulate(state, {}, DT);
    expect(isAlive(a)).toBe(true);
    expect(isAlive(b)).toBe(true);
    expect(a.mass).toBe(120);
    expect(b.mass).toBe(100);
    const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    expect(dist).toBeGreaterThanOrEqual(cloudRadius(a.mass) + cloudRadius(b.mass) - 1e-9);
  });

  it('완전히 같은 위치(dist 0)에서도 결정적으로 분리된다', () => {
    const { state, a, b } = duel(100, 100, 0, true);
    simulate(state, {}, DT);
    const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    expect(dist).toBeGreaterThan(0);
  });

  it('보호막이 있는 쌍은 흡수되지 않는다', () => {
    const { state, a, b } = duel(200, 100, 10, true);
    b.shieldTicks = 100;
    simulate(state, {}, DT);
    expect(isAlive(b)).toBe(true);
    expect(a.mass).toBe(200);
  });
});

describe('벽 압착 (crush)', () => {
  it('밀어내기로 벽에 눌린 구름은 눌린 깊이에 비례해 질량을 잃고 crush 이벤트가 남는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const small = state.clouds[0]!; // mass 100, r 40
    small.pos = { x: 40, y: 2000 }; // 왼쪽 벽에 밀착
    const big = createCloud(2, { x: 110, y: 2000 }, small.polarity, true);
    big.mass = 120; // 1.25배 미만 → 흡수 불가, 밀어내기만
    state.clouds.push(big);
    const before = small.mass;
    let crushed = false;
    for (let i = 0; i < 20; i++) {
      simulate(state, { 2: { dir: { x: -1, y: 0 } } }, DT); // 큰 구름이 계속 압박
      crushed = crushed || state.events.some((e) => e.type === 'crush' && e.cloudId === small.id);
    }
    expect(small.mass).toBeLessThan(before);
    expect(crushed).toBe(true);
  });

  it('벽에 닿지 않는 열린 공간의 밀어내기는 질량을 잃지 않는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const a = state.clouds[0]!; // 월드 중앙 — 벽과 무관
    const b = createCloud(2, { x: a.pos.x + 30, y: a.pos.y }, a.polarity, true);
    state.clouds.push(b);
    simulate(state, {}, DT);
    expect(a.mass).toBe(100);
    expect(b.mass).toBe(100);
    expect(state.events.some((e) => e.type === 'crush')).toBe(false);
  });

  it('압착으로 질량이 바닥나면 죽는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const small = state.clouds[0]!;
    small.pos = { x: 40, y: WORLD_SIZE / 2 };
    const big = createCloud(2, { x: 100, y: WORLD_SIZE / 2 }, small.polarity, true);
    big.mass = 124; // 흡수 직전 크기 — 순수 압착만으로 갈아낸다
    state.clouds.push(big);
    let died = false;
    for (let i = 0; i < 2000 && !died; i++) {
      simulate(state, { 2: { dir: { x: -1, y: 0 } } }, DT);
      died = state.events.some((e) => e.type === 'death' && e.cloudId === small.id);
    }
    expect(died).toBe(true);
  });
});
