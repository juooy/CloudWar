import { INITIAL_VAPOR_COUNT, START_MASS, WORLD_SIZE } from './constants';
import type { GameState } from './types';
import { spawnVapor } from './vapor';

export function createInitialState(seed: number): GameState {
  const state: GameState = {
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
  for (let i = 0; i < INITIAL_VAPOR_COUNT; i++) spawnVapor(state);
  return state;
}
