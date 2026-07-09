import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { computeBotInputs } from '../src/bots';
import { DT, MIN_MASS, WORLD_SIZE } from '../src/constants';
import type { GameEventType } from '../src/types';

describe('통합 — 봇 매치 완주', () => {
  it('8구름 3000틱을 불변식 위반 없이 완주한다', () => {
    const state = createInitialState(2026, 7);
    const eventCounts = new Map<GameEventType, number>();
    for (let t = 0; t < 3000; t++) {
      const angle = (t % 60) * (Math.PI / 30);
      simulate(
        state,
        { ...computeBotInputs(state), 1: { dir: { x: Math.cos(angle), y: Math.sin(angle) }, swap: t % 173 === 0 } },
        DT,
      );
      for (const ev of state.events) {
        eventCounts.set(ev.type, (eventCounts.get(ev.type) ?? 0) + 1);
      }
      // 불변식: 구름 수 불변, 좌표·질량 유한, 생존자 질량은 MIN_MASS 이상
      expect(state.clouds).toHaveLength(8);
      for (const c of state.clouds) {
        expect(Number.isFinite(c.pos.x)).toBe(true);
        expect(Number.isFinite(c.pos.y)).toBe(true);
        expect(Number.isFinite(c.mass)).toBe(true);
        expect(c.pos.x).toBeGreaterThanOrEqual(0);
        expect(c.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
        if (c.respawnTicks === 0) expect(c.mass).toBeGreaterThanOrEqual(MIN_MASS);
      }
    }
    // 수증기 id 유일성 (전투 물방울 포함)
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 150초 동안 뭔가는 일어났어야 한다
    const total = [...eventCounts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});
