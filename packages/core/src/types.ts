export interface Vec2 {
  x: number;
  y: number;
}

export interface Cloud {
  id: number;
  pos: Vec2;
  mass: number;
}

export interface Vapor {
  id: number;
  pos: Vec2;
}

export interface PlayerInput {
  /** 이동 방향 벡터. simulate가 정규화하므로 크기는 무관. 정지는 {x:0, y:0}. */
  dir: Vec2;
}

/** cloudId → 해당 틱의 입력 */
export type Inputs = Record<number, PlayerInput | undefined>;

export interface GameState {
  tick: number;
  rngState: number;
  nextEntityId: number;
  clouds: Cloud[];
  vapors: Vapor[];
}
