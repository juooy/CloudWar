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
export const VAPOR_MAX = 200;
export const VAPOR_SPAWN_PER_TICK = 1;
export const VAPOR_RADIUS = 6;
