import { describe, it, expect } from 'vitest';
import { rand } from '../src/rng';

describe('rand (시드 RNG)', () => {
  it('같은 시드는 같은 시퀀스를 만든다', () => {
    const a = { rngState: 42 };
    const b = { rngState: 42 };
    const seqA = [rand(a), rand(a), rand(a), rand(a), rand(a)];
    const seqB = [rand(b), rand(b), rand(b), rand(b), rand(b)];
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 시퀀스를 만든다', () => {
    const a = { rngState: 42 };
    const b = { rngState: 43 };
    expect(rand(a)).not.toBe(rand(b));
  });

  it('값은 항상 [0, 1) 범위다', () => {
    const s = { rngState: 7 };
    for (let i = 0; i < 1000; i++) {
      const v = rand(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('호출할 때마다 rngState가 변한다 (state 전진)', () => {
    const s = { rngState: 42 };
    rand(s);
    expect(s.rngState).not.toBe(42);
  });
});
