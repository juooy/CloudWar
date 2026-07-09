export interface Vec2 {
  x: number;
  y: number;
}

export type Polarity = 1 | -1;

export interface Cloud {
  id: number;
  pos: Vec2;
  mass: number;
  polarity: Polarity;
  isBot: boolean;
  /** 남은 스왑 쿨다운 틱. 0이면 스왑 가능 */
  swapCooldown: number;
  /** 남은 스폰 보호막 틱. >0이면 전투 상호작용 없음 */
  shieldTicks: number;
  /** 0 = 생존. >0 = 사망 상태(리스폰 카운트다운) */
  respawnTicks: number;
}

export interface Vapor {
  id: number;
  pos: Vec2;
}

export interface PlayerInput {
  /** 이동 방향 벡터. simulate가 정규화하므로 크기는 무관. 정지는 {x:0, y:0}. */
  dir: Vec2;
  /** true면 이번 틱에 극성 스왑 시도 (쿨다운 중이면 무시) */
  swap?: boolean;
}

/** cloudId → 해당 틱의 입력 */
export type Inputs = Record<number, PlayerInput | undefined>;

export type GameEventType = 'lightning' | 'absorb' | 'death' | 'respawn' | 'swap' | 'crush';

/** 직전 틱에 일어난 일 — 클라 이펙트 전용. 매 틱 초기화된다. */
export interface GameEvent {
  type: GameEventType;
  cloudId: number;
  otherId?: number;
  pos: Vec2;
}

export interface GameState {
  tick: number;
  rngState: number;
  nextEntityId: number;
  clouds: Cloud[];
  vapors: Vapor[];
  events: GameEvent[];
}
