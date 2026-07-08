import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { DT } from '../src/constants';
import type { Inputs } from '../src/types';

/** 틱 번호에 따라 방향이 바뀌는 스크립트 입력 (결정적) */
function scriptedInput(tick: number): Inputs {
  const angle = (tick % 40) * (Math.PI / 20);
  return { 1: { dir: { x: Math.cos(angle), y: Math.sin(angle) } } };
}

describe('결정론', () => {
  it('같은 시드 + 같은 입력 시퀀스 → 200틱 후 상태가 완전히 동일하다', () => {
    const a = createInitialState(12345);
    const b = createInitialState(12345);
    for (let t = 0; t < 200; t++) {
      simulate(a, scriptedInput(t), DT);
      simulate(b, scriptedInput(t), DT);
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
