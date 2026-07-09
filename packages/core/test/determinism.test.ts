import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { computeBotInputs } from '../src/bots';
import { DT } from '../src/constants';
import type { GameState, Inputs } from '../src/types';

/** 틱 번호에 따라 방향·스왑이 바뀌는 스크립트 입력 (결정적) */
function scriptedInput(tick: number): Inputs {
  const angle = (tick % 40) * (Math.PI / 20);
  return { 1: { dir: { x: Math.cos(angle), y: Math.sin(angle) }, swap: tick % 97 === 0 } };
}

function step(state: GameState, tick: number): void {
  simulate(state, { ...computeBotInputs(state), ...scriptedInput(tick) }, DT);
}

describe('결정론', () => {
  it('같은 시드 + 같은 입력 → 200틱 후 상태가 완전히 동일하다 (구름 1개)', () => {
    const a = createInitialState(12345);
    const b = createInitialState(12345);
    for (let t = 0; t < 200; t++) {
      simulate(a, scriptedInput(t), DT);
      simulate(b, scriptedInput(t), DT);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('봇 7 + 전투 포함 300틱 후에도 상태가 완전히 동일하다', () => {
    const a = createInitialState(999, 7);
    const b = createInitialState(999, 7);
    for (let t = 0; t < 300; t++) {
      step(a, t);
      step(b, t);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('직렬화 왕복 후에도 결정론이 유지된다 (M5 스냅샷 복원의 핵심 가정)', () => {
    const a = createInitialState(555, 7);
    for (let t = 0; t < 100; t++) step(a, t);
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    for (let t = 100; t < 200; t++) {
      step(a, t);
      step(b, t);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('다른 시드는 다른 수증기 배치를 만든다', () => {
    const a = createInitialState(1);
    const b = createInitialState(2);
    for (let t = 0; t < 50; t++) {
      simulate(a, {}, DT);
      simulate(b, {}, DT);
    }
    expect(JSON.stringify(a.vapors)).not.toBe(JSON.stringify(b.vapors));
  });
});
