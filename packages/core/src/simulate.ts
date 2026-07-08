import {
  MIN_MASS,
  RESPAWN_TICKS,
  SHIELD_TICKS,
  START_MASS,
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
  WORLD_SIZE,
} from './constants';
import { cloudRadius, cloudSpeed, isAlive } from './cloud';
import { rand } from './rng';
import type { Cloud, GameState, Inputs } from './types';
import { spawnVapor } from './vapor';

/**
 * 고정 타임스텝 시뮬레이션 틱. 전달된 state를 제자리 변이하고 반환한다.
 * 외부 부수효과 없음 — 결정론은 state 내장 RNG로 보장된다.
 * 순서: events 초기화 → 타이머 → 이동 → 사망 판정 → 흡수 → 스폰 → tick 증가.
 */
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  state.events = [];
  tickTimers(state);
  moveClouds(state, inputs, dt);
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
