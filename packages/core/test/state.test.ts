import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state';
import { INITIAL_VAPOR_COUNT, START_MASS, WORLD_SIZE } from '../src/constants';

describe('createInitialState', () => {
  it('월드 중앙에 시작 질량의 플레이어 구름 1개를 만든다', () => {
    const state = createInitialState(42);
    expect(state.tick).toBe(0);
    expect(state.clouds).toHaveLength(1);
    expect(state.clouds[0]).toEqual({
      id: 1,
      pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      mass: START_MASS,
      polarity: 1,
      isBot: false,
      swapCooldown: 0,
      shieldTicks: 0,
      respawnTicks: 0,
    });
    expect(state.events).toEqual([]);
  });

  it('플레이어 극성을 지정할 수 있다', () => {
    const state = createInitialState(42, 0, -1);
    expect(state.clouds[0]!.polarity).toBe(-1);
  });

  it('botCount만큼 봇 구름을 랜덤 위치·랜덤 극성으로 만든다', () => {
    const state = createInitialState(42, 7);
    expect(state.clouds).toHaveLength(8);
    const bots = state.clouds.filter((c) => c.isBot);
    expect(bots).toHaveLength(7);
    const ids = state.clouds.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
    for (const bot of bots) {
      expect([1, -1]).toContain(bot.polarity);
      expect(bot.mass).toBe(START_MASS);
      expect(bot.pos.x).toBeGreaterThanOrEqual(0);
      expect(bot.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
      expect(bot.pos.y).toBeGreaterThanOrEqual(0);
      expect(bot.pos.y).toBeLessThanOrEqual(WORLD_SIZE);
    }
  });

  it('시작부터 수증기가 맵에 깔려 있다', () => {
    const state = createInitialState(42, 7);
    expect(state.vapors).toHaveLength(INITIAL_VAPOR_COUNT);
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('같은 시드는 같은 초기 상태를 만든다 (봇 포함)', () => {
    expect(JSON.stringify(createInitialState(7, 7))).toBe(JSON.stringify(createInitialState(7, 7)));
  });
});
