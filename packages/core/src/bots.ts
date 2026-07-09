import { ABSORB_RATIO, BOT_VIEW_RADIUS, WORLD_SIZE } from './constants';
import { isAlive } from './cloud';
import type { Cloud, GameState, Inputs, PlayerInput, Vec2 } from './types';

/**
 * 봇들의 이번 틱 입력을 계산한다. RNG 미사용 — 같은 상태면 항상 같은 결과.
 * 우선순위: 도망 > 사냥 > 채집 > 중앙 복귀.
 */
export function computeBotInputs(state: GameState): Inputs {
  const inputs: Inputs = {};
  for (const bot of state.clouds) {
    if (!bot.isBot || !isAlive(bot)) continue;
    inputs[bot.id] = botInput(state, bot);
  }
  return inputs;
}

function botInput(state: GameState, bot: Cloud): PlayerInput {
  const threat = nearestCloud(
    state,
    bot,
    (c) =>
      (c.polarity === bot.polarity && c.mass >= bot.mass * ABSORB_RATIO) ||
      (c.polarity !== bot.polarity && c.mass >= bot.mass * 2),
  );
  if (threat) return { dir: diff(threat.pos, bot.pos) }; // 위협 반대 방향

  const prey = nearestCloud(
    state,
    bot,
    (c) => c.polarity === bot.polarity && bot.mass >= c.mass * ABSORB_RATIO,
  );
  if (prey) return { dir: diff(bot.pos, prey.pos) };

  const vapor = nearestVapor(state, bot);
  if (vapor) return { dir: diff(bot.pos, vapor.pos) };

  return { dir: diff(bot.pos, { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }) };
}

/** to - from 방향 벡터 (simulate가 정규화). 영벡터면 결정적 기본값. */
function diff(from: Vec2, to: Vec2): Vec2 {
  const d = { x: to.x - from.x, y: to.y - from.y };
  if (d.x === 0 && d.y === 0) return { x: 1, y: 0 };
  return d;
}

function nearestCloud(
  state: GameState,
  bot: Cloud,
  pred: (c: Cloud) => boolean,
): Cloud | undefined {
  let best: Cloud | undefined;
  let bestDist = BOT_VIEW_RADIUS;
  for (const c of state.clouds) {
    if (c.id === bot.id || !isAlive(c) || c.shieldTicks > 0 || !pred(c)) continue;
    const dist = Math.hypot(c.pos.x - bot.pos.x, c.pos.y - bot.pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function nearestVapor(state: GameState, bot: Cloud) {
  let best;
  let bestDist = BOT_VIEW_RADIUS;
  for (const v of state.vapors) {
    const dist = Math.hypot(v.pos.x - bot.pos.x, v.pos.y - bot.pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}
