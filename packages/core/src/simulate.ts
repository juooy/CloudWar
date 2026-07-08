import {
  ABSORB_RATIO,
  DROPLET_RATIO,
  DROPLET_SCATTER,
  LIGHTNING_DRAIN_PER_SEC,
  MIN_MASS,
  RESPAWN_TICKS,
  SHIELD_TICKS,
  START_MASS,
  SWAP_COOLDOWN_TICKS,
  SWAP_COST_RATIO,
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
  WORLD_SIZE,
} from './constants';
import { cloudRadius, cloudSpeed, isAlive } from './cloud';
import { rand } from './rng';
import type { Cloud, GameState, Inputs, Vec2 } from './types';
import { spawnVapor } from './vapor';

/**
 * 고정 타임스텝 시뮬레이션 틱. 전달된 state를 제자리 변이하고 반환한다.
 * 외부 부수효과 없음 — 결정론은 state 내장 RNG로 보장된다.
 * 순서: events 초기화 → 타이머 → 스왑 → 이동 → 전투 → 사망 판정 → 흡수 → 스폰 → tick 증가.
 */
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  state.events = [];
  tickTimers(state);
  applySwaps(state, inputs);
  moveClouds(state, inputs, dt);
  cloudCombat(state, dt);
  applyDeaths(state);
  absorbVapors(state);
  spawnVapors(state);
  state.tick += 1;
  return state;
}

function tickTimers(state: GameState): void {
  for (const cloud of state.clouds) {
    if (cloud.swapCooldown > 0) cloud.swapCooldown -= 1;
    if (cloud.shieldTicks > 0) cloud.shieldTicks -= 1;
    if (cloud.respawnTicks > 0) {
      cloud.respawnTicks -= 1;
      if (cloud.respawnTicks === 0) respawn(state, cloud);
    }
  }
}

function applySwaps(state: GameState, inputs: Inputs): void {
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const input = inputs[cloud.id];
    if (!input?.swap || cloud.swapCooldown > 0) continue;
    cloud.polarity = cloud.polarity === 1 ? -1 : 1;
    cloud.mass *= 1 - SWAP_COST_RATIO;
    cloud.swapCooldown = SWAP_COOLDOWN_TICKS;
    state.events.push({ type: 'swap', cloudId: cloud.id, pos: { ...cloud.pos } });
  }
}

function respawn(state: GameState, cloud: Cloud): void {
  const r = cloudRadius(START_MASS);
  cloud.mass = START_MASS;
  cloud.pos = {
    x: r + rand(state) * (WORLD_SIZE - 2 * r),
    y: r + rand(state) * (WORLD_SIZE - 2 * r),
  };
  cloud.shieldTicks = SHIELD_TICKS;
  cloud.swapCooldown = 0;
  state.events.push({ type: 'respawn', cloudId: cloud.id, pos: { ...cloud.pos } });
}

function kill(state: GameState, cloud: Cloud): void {
  cloud.respawnTicks = RESPAWN_TICKS;
  state.events.push({ type: 'death', cloudId: cloud.id, pos: { ...cloud.pos } });
}

function applyDeaths(state: GameState): void {
  for (const cloud of state.clouds) {
    if (isAlive(cloud) && cloud.mass < MIN_MASS) kill(state, cloud);
  }
}

function moveClouds(state: GameState, inputs: Inputs, dt: number): void {
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const input = inputs[cloud.id];
    if (!input) continue;
    const len = Math.hypot(input.dir.x, input.dir.y);
    if (len === 0) continue;
    const speed = cloudSpeed(cloud.mass);
    cloud.pos.x += (input.dir.x / len) * speed * dt;
    cloud.pos.y += (input.dir.y / len) * speed * dt;
    clampToWorld(cloud);
  }
}

function cloudCombat(state: GameState, dt: number): void {
  const clouds = state.clouds;
  for (let i = 0; i < clouds.length; i++) {
    for (let j = i + 1; j < clouds.length; j++) {
      const a = clouds[i]!;
      const b = clouds[j]!;
      if (!isAlive(a) || !isAlive(b)) continue;
      if (a.shieldTicks > 0 || b.shieldTicks > 0) continue;
      const ra = cloudRadius(a.mass);
      const rb = cloudRadius(b.mass);
      const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
      if (dist >= ra + rb) continue;
      if (a.polarity === b.polarity) {
        samePolarityContact(state, a, b, ra, rb, dist);
      } else {
        lightningContact(state, a, b, ra, rb, dist, dt);
      }
    }
  }
}

function samePolarityContact(
  state: GameState,
  a: Cloud,
  b: Cloud,
  ra: number,
  rb: number,
  dist: number,
): void {
  const [big, small] = a.mass >= b.mass ? [a, b] : [b, a];
  if (big.mass >= small.mass * ABSORB_RATIO && dist < cloudRadius(big.mass)) {
    big.mass += small.mass;
    state.events.push({ type: 'absorb', cloudId: big.id, otherId: small.id, pos: { ...small.pos } });
    kill(state, small);
    return;
  }
  // 밀어내기 — 겹침을 질량 반비례로 해소 (무거운 쪽이 덜 밀림)
  const overlap = ra + rb - dist;
  let nx: number;
  let ny: number;
  if (dist > 0) {
    nx = (a.pos.x - b.pos.x) / dist;
    ny = (a.pos.y - b.pos.y) / dist;
  } else {
    nx = a.id < b.id ? -1 : 1; // 완전히 겹치면 id 기준 결정적 분리
    ny = 0;
  }
  const total = a.mass + b.mass;
  a.pos.x += nx * overlap * (b.mass / total);
  a.pos.y += ny * overlap * (b.mass / total);
  b.pos.x -= nx * overlap * (a.mass / total);
  b.pos.y -= ny * overlap * (a.mass / total);
  clampToWorld(a);
  clampToWorld(b);
}

function lightningContact(
  state: GameState,
  a: Cloud,
  b: Cloud,
  ra: number,
  rb: number,
  dist: number,
  dt: number,
): void {
  const overlap = ra + rb - dist;
  const factor = Math.min(1, overlap / Math.min(ra, rb));
  const drainA = a.mass * LIGHTNING_DRAIN_PER_SEC * dt * factor;
  const drainB = b.mass * LIGHTNING_DRAIN_PER_SEC * dt * factor;
  a.mass -= drainA;
  b.mass -= drainB;
  const mid = { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 };
  scatterDroplets(state, mid, (drainA + drainB) * DROPLET_RATIO);
  state.events.push({ type: 'lightning', cloudId: a.id, otherId: b.id, pos: mid });
}

/** 번개 손실 일부를 물방울(수증기)로 흩뿌린다. VAPOR_MAX 캡 무시 — 전투 보상은 일반 스폰과 별개. */
function scatterDroplets(state: GameState, origin: Vec2, mass: number): void {
  const expected = mass / VAPOR_MASS;
  let count = Math.floor(expected);
  if (rand(state) < expected - count) count += 1; // 소수부는 확률 스폰 (시드 RNG라 결정적)
  for (let i = 0; i < count; i++) {
    const angle = rand(state) * Math.PI * 2;
    const scatter = rand(state) * DROPLET_SCATTER;
    state.vapors.push({
      id: state.nextEntityId++,
      pos: {
        x: Math.min(Math.max(origin.x + Math.cos(angle) * scatter, 0), WORLD_SIZE),
        y: Math.min(Math.max(origin.y + Math.sin(angle) * scatter, 0), WORLD_SIZE),
      },
    });
  }
}

function clampToWorld(cloud: Cloud): void {
  const r = cloudRadius(cloud.mass);
  cloud.pos.x = Math.min(Math.max(cloud.pos.x, r), WORLD_SIZE - r);
  cloud.pos.y = Math.min(Math.max(cloud.pos.y, r), WORLD_SIZE - r);
}

function absorbVapors(state: GameState): void {
  // 경합 규칙: clouds 배열 순서가 우선권 — 두 구름 반경에 동시에 든 수증기는 앞선 구름이 먹는다
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const r = cloudRadius(cloud.mass);
    state.vapors = state.vapors.filter((vapor) => {
      const dist = Math.hypot(vapor.pos.x - cloud.pos.x, vapor.pos.y - cloud.pos.y);
      if (dist < r) {
        cloud.mass += VAPOR_MASS;
        return false;
      }
      return true;
    });
  }
}

function spawnVapors(state: GameState): void {
  for (let i = 0; i < VAPOR_SPAWN_PER_TICK; i++) {
    if (state.vapors.length >= VAPOR_MAX) return;
    spawnVapor(state);
  }
}
