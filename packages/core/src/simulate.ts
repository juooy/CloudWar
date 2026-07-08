import {
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
  WORLD_SIZE,
} from './constants';
import { cloudRadius, cloudSpeed } from './cloud';
import type { GameState, Inputs } from './types';
import { spawnVapor } from './vapor';

/**
 * 고정 타임스텝 시뮬레이션 틱. 전달된 state를 제자리 변이하고 반환한다.
 * 외부 부수효과 없음 — 결정론은 state 내장 RNG로 보장된다.
 * 순서: 이동 → 흡수 → 스폰 → tick 증가.
 */
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  moveClouds(state, inputs, dt);
  absorbVapors(state);
  spawnVapors(state);
  state.tick += 1;
  return state;
}

function moveClouds(state: GameState, inputs: Inputs, dt: number): void {
  for (const cloud of state.clouds) {
    const input = inputs[cloud.id];
    if (!input) continue;
    const len = Math.hypot(input.dir.x, input.dir.y);
    if (len === 0) continue;
    const speed = cloudSpeed(cloud.mass);
    cloud.pos.x += (input.dir.x / len) * speed * dt;
    cloud.pos.y += (input.dir.y / len) * speed * dt;
    const r = cloudRadius(cloud.mass);
    cloud.pos.x = Math.min(Math.max(cloud.pos.x, r), WORLD_SIZE - r);
    cloud.pos.y = Math.min(Math.max(cloud.pos.y, r), WORLD_SIZE - r);
  }
}

function absorbVapors(state: GameState): void {
  for (const cloud of state.clouds) {
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
