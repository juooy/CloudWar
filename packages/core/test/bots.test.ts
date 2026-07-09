import { describe, it, expect } from 'vitest';
import { computeBotInputs } from '../src/bots';
import { createInitialState, createCloud } from '../src/state';

/** dir가 target 방향인지 (내적 > 0) */
function headsToward(dir: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return dir.x * (to.x - from.x) + dir.y * (to.y - from.y) > 0;
}

function arena() {
  const state = createInitialState(42);
  state.vapors = [];
  state.clouds = []; // 플레이어 제거 — 봇만으로 구성
  return state;
}

describe('봇 AI', () => {
  it('큰 같은 극성이 가까이 있으면 반대 방향으로 도망간다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const threat = createCloud(3, { x: 2100, y: 2000 }, 1, true);
    threat.mass = 300;
    state.clouds.push(bot, threat);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, threat.pos)).toBe(false);
  });

  it('작은 같은 극성이 있으면 추격한다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    bot.mass = 300;
    const prey = createCloud(3, { x: 2300, y: 2000 }, 1, true);
    state.clouds.push(bot, prey);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, prey.pos)).toBe(true);
  });

  it('2.5배 이상 큰 반대 극성에게서는 도망간다 (스왑 없이 — 스왑하면 먹힐 극성이 된다)', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const enemy = createCloud(3, { x: 2100, y: 2000 }, -1, true);
    enemy.mass = 250;
    state.clouds.push(bot, enemy);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, enemy.pos)).toBe(false);
    expect(inputs[2]!.swap).toBeFalsy();
  });

  it('2.5배 미만의 반대 극성은 위협으로 보지 않는다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const enemy = createCloud(3, { x: 2100, y: 2000 }, -1, true);
    enemy.mass = 220; // < 250 = 2.5배
    state.clouds.push(bot, enemy);
    state.vapors = [{ id: 10, pos: { x: 2150, y: 2000 } }]; // 적과 같은 방향
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 2150, y: 2000 })).toBe(true);
  });

  it('충분히 크면(1.6배 이상) 반대 극성을 번개 사냥한다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    bot.mass = 200;
    const target = createCloud(3, { x: 2300, y: 2000 }, -1, true);
    target.mass = 100;
    state.clouds.push(bot, target);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, target.pos)).toBe(true);
  });

  it('같은 극성 포식자가 코앞이면 도망치며 긴급 스왑한다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const threat = createCloud(3, { x: 2100, y: 2000 }, 1, true); // 거리 100 < BOT_PANIC_RADIUS
    threat.mass = 300;
    state.clouds.push(bot, threat);
    const inputs = computeBotInputs(state);
    expect(inputs[2]!.swap).toBe(true);
    expect(headsToward(inputs[2]!.dir, bot.pos, threat.pos)).toBe(false);
  });

  it('스왑 쿨다운 중에는 긴급 스왑하지 않는다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    bot.swapCooldown = 50;
    const threat = createCloud(3, { x: 2100, y: 2000 }, 1, true);
    threat.mass = 300;
    state.clouds.push(bot, threat);
    const inputs = computeBotInputs(state);
    expect(inputs[2]!.swap).toBeFalsy();
  });

  it('포식자가 멀면(패닉 반경 밖) 스왑 없이 도망만 간다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const threat = createCloud(3, { x: 2500, y: 2000 }, 1, true); // 거리 500 > BOT_PANIC_RADIUS
    threat.mass = 300;
    state.clouds.push(bot, threat);
    const inputs = computeBotInputs(state);
    expect(inputs[2]!.swap).toBeFalsy();
    expect(headsToward(inputs[2]!.dir, bot.pos, threat.pos)).toBe(false);
  });

  it('위협도 사냥감도 없으면 가장 가까운 수증기로 간다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    state.clouds.push(bot);
    state.vapors = [
      { id: 10, pos: { x: 2600, y: 2000 } },
      { id: 11, pos: { x: 2100, y: 2000 } }, // 더 가까움
    ];
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 2100, y: 2000 })).toBe(true);
  });

  it('시야 밖 위협은 무시한다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 500, y: 500 }, 1, true);
    const threat = createCloud(3, { x: 3500, y: 3500 }, 1, true); // 거리 > BOT_VIEW_RADIUS
    threat.mass = 999;
    state.clouds.push(bot, threat);
    state.vapors = [{ id: 10, pos: { x: 600, y: 500 } }];
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 600, y: 500 })).toBe(true);
  });

  it('보호막 상대는 위협도 사냥감도 아니다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    bot.mass = 300;
    const shielded = createCloud(3, { x: 2100, y: 2000 }, 1, true);
    shielded.shieldTicks = 100;
    state.clouds.push(bot, shielded);
    state.vapors = [{ id: 10, pos: { x: 1500, y: 2000 } }];
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 1500, y: 2000 })).toBe(true);
  });

  it('죽은 봇과 봇이 아닌 구름에는 입력을 내지 않는다', () => {
    const state = arena();
    const player = createCloud(1, { x: 1000, y: 1000 }, 1, false);
    const deadBot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    deadBot.respawnTicks = 30;
    state.clouds.push(player, deadBot);
    const inputs = computeBotInputs(state);
    expect(inputs[1]).toBeUndefined();
    expect(inputs[2]).toBeUndefined();
  });

  it('같은 상태에서 항상 같은 입력을 낸다 (결정적)', () => {
    const state = createInitialState(42, 7);
    expect(JSON.stringify(computeBotInputs(state))).toBe(JSON.stringify(computeBotInputs(state)));
  });
});
