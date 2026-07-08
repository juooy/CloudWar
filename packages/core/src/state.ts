import { INITIAL_VAPOR_COUNT, START_MASS, WORLD_SIZE } from './constants';
import { rand } from './rng';
import type { Cloud, GameState, Polarity, Vec2 } from './types';
import { spawnVapor } from './vapor';

export function createCloud(id: number, pos: Vec2, polarity: Polarity, isBot: boolean): Cloud {
  return {
    id,
    pos,
    mass: START_MASS,
    polarity,
    isBot,
    swapCooldown: 0,
    shieldTicks: 0,
    respawnTicks: 0,
  };
}

export function createInitialState(
  seed: number,
  botCount = 0,
  playerPolarity: Polarity = 1,
): GameState {
  const state: GameState = {
    tick: 0,
    rngState: seed | 0,
    nextEntityId: 2,
    clouds: [createCloud(1, { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }, playerPolarity, false)],
    vapors: [],
    events: [],
  };
  for (let i = 0; i < botCount; i++) {
    const pos = { x: rand(state) * WORLD_SIZE, y: rand(state) * WORLD_SIZE };
    const polarity: Polarity = rand(state) < 0.5 ? 1 : -1;
    state.clouds.push(createCloud(state.nextEntityId++, pos, polarity, true));
  }
  for (let i = 0; i < INITIAL_VAPOR_COUNT; i++) spawnVapor(state);
  return state;
}
