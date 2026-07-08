import { WORLD_SIZE } from './constants';
import { rand } from './rng';
import type { GameState } from './types';

/** 수증기 1개를 RNG 위치에 스폰한다. 초기 배치와 틱 스폰이 공유하는 유일한 경로. */
export function spawnVapor(state: GameState): void {
  state.vapors.push({
    id: state.nextEntityId++,
    pos: {
      x: rand(state) * WORLD_SIZE,
      y: rand(state) * WORLD_SIZE,
    },
  });
}
