import { WORLD_SIZE } from './constants';
import { cloudRadius, cloudSpeed } from './cloud';
import type { GameState, Inputs } from './types';

/**
 * 고정 타임스텝 시뮬레이션 틱. 전달된 state를 제자리 변이하고 반환한다.
 * 외부 부수효과 없음 — 결정론은 state 내장 RNG로 보장된다.
 */
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  moveClouds(state, inputs, dt);
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
