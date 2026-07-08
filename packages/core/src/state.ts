import { START_MASS, WORLD_SIZE } from './constants';
import type { GameState } from './types';

export function createInitialState(seed: number): GameState {
  return {
    tick: 0,
    rngState: seed | 0,
    nextEntityId: 2,
    clouds: [
      {
        id: 1,
        pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
        mass: START_MASS,
      },
    ],
    vapors: [],
  };
}
