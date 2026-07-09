// ─── 시뮬레이션 ───
export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const WORLD_SIZE = 4000;

// ─── 구름 ───
export const START_MASS = 100;
export const RADIUS_SCALE = 4; // 반지름 = RADIUS_SCALE * sqrt(질량)
export const BASE_SPEED = 300; // START_MASS일 때 월드유닛/초
export const SPEED_EXPONENT = 0.3; // 속도 = BASE_SPEED * (START_MASS/질량)^지수

// ─── 수증기 ───
export const VAPOR_MASS = 5;
export const VAPOR_MAX = 600;
export const VAPOR_SPAWN_PER_TICK = 3;
export const VAPOR_RADIUS = 6;
export const INITIAL_VAPOR_COUNT = 400; // 라운드 시작 시 맵에 깔리는 수증기

// ─── 전투 ───
export const MIN_MASS = 20; // 이하로 떨어지면 사망. 공식(cloudRadius/cloudSpeed)의 질량 하한이기도 함
export const ABSORB_RATIO = 1.25; // 같은 극성: 이 배율 이상 크면 흡수
export const SWAP_COST_RATIO = 0.15; // 극성 스왑 비용 (질량 비율)
export const SWAP_COOLDOWN_TICKS = 200; // 10초 @ 20tick
export const LIGHTNING_DRAIN_PER_SEC = 0.15; // 완전 겹침 시 초당 자기 질량 손실 비율 (플레이테스트: 0.08은 임팩트 부족)
export const DROPLET_RATIO = 0.45; // 전투 손실 중 물방울로 튀는 비율 (번개·압착 공용)
export const DROPLET_SCATTER = 160; // 물방울이 흩어지는 반경 (월드 유닛)
export const WALL_CRUSH_RATE_PER_SEC = 1.0; // 완전히 눌렸을 때(squash=반지름) 초당 질량 손실 비율
export const RESPAWN_TICKS = 60; // 3초
export const SHIELD_TICKS = 200; // 10초 스폰 보호막

// ─── 봇 ───
export const BOT_COUNT = 7; // 봇 모드: 플레이어 1 + 봇 7 = 8구름
export const BOT_VIEW_RADIUS = 900; // 봇 시야 반경
export const BOT_FLEE_OPPOSITE_RATIO = 2.5; // 반대 극성은 이 배율 이상만 위협으로 간주
export const BOT_LIGHTNING_HUNT_RATIO = 1.6; // 이 배율 이상 크면 반대 극성을 번개 사냥
export const BOT_PANIC_RADIUS = 300; // 같은 극성 포식자가 이 거리 안이면 긴급 스왑
