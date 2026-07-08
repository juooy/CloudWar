import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { cloudRadius } from '../src/cloud';
import { DT, WORLD_SIZE, START_MASS, BASE_SPEED } from '../src/constants';

describe('구름 이동', () => {
  it('입력 방향으로 speed*dt 만큼 이동한다', () => {
    const state = createInitialState(1);
    simulate(state, { 1: { dir: { x: 1, y: 0 } } }, DT);
    // START_MASS에서 속도는 BASE_SPEED(300) → 300 * 0.05 = 15
    expect(state.clouds[0]!.pos.x).toBeCloseTo(WORLD_SIZE / 2 + BASE_SPEED * DT);
    expect(state.clouds[0]!.pos.y).toBeCloseTo(WORLD_SIZE / 2);
  });

  it('대각선 입력은 정규화된다 (크기가 커도 속도 동일)', () => {
    const state = createInitialState(1);
    simulate(state, { 1: { dir: { x: 30, y: 40 } } }, DT); // 길이 50 → (0.6, 0.8)
    expect(state.clouds[0]!.pos.x).toBeCloseTo(WORLD_SIZE / 2 + BASE_SPEED * DT * 0.6);
    expect(state.clouds[0]!.pos.y).toBeCloseTo(WORLD_SIZE / 2 + BASE_SPEED * DT * 0.8);
  });

  it('입력이 없거나 영벡터면 움직이지 않는다', () => {
    const state = createInitialState(1);
    simulate(state, {}, DT);
    simulate(state, { 1: { dir: { x: 0, y: 0 } } }, DT);
    expect(state.clouds[0]!.pos).toEqual({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 });
  });

  it('월드 경계에서 반지름만큼 안쪽으로 클램프된다', () => {
    const state = createInitialState(1);
    state.clouds[0]!.pos = { x: 10, y: 10 }; // 경계 밖 근처로 강제 이동
    simulate(state, { 1: { dir: { x: -1, y: -1 } } }, DT);
    const r = cloudRadius(START_MASS);
    expect(state.clouds[0]!.pos.x).toBe(r);
    expect(state.clouds[0]!.pos.y).toBe(r);
  });

  it('틱 카운터가 증가하고 같은 state 객체를 반환한다', () => {
    const state = createInitialState(1);
    const returned = simulate(state, {}, DT);
    expect(returned).toBe(state);
    expect(state.tick).toBe(1);
  });
});
