# M3 "극성 전투 + 봇" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 극성(+/−) 시스템 — 같은 극성 흡수, 반대 극성 번개 소모전, 스왑 — 과 봇 7마리를 추가해 "봇 모드"를 완성한다 (게임 재미의 첫 검증 지점).

**Architecture:** 모든 전투·봇 로직은 `@cloudwar/core`에 순수 함수로 추가된다. 틱 순서는 `이벤트 초기화 → 타이머 → 스왑 → 이동 → 전투 → 사망 판정 → 수증기 흡수 → 스폰 → tick++`로 고정. 클라 이펙트는 state에 담긴 이번 틱 `events` 버퍼를 읽어 그린다 (렌더 전용, 시뮬레이션에 영향 없음). 봇 AI는 `computeBotInputs(state)` 순수 함수 — 호출자가 플레이어 입력과 병합해 simulate에 넘긴다.

**Tech Stack:** 기존과 동일 (TypeScript strict, Vitest, Vite + Canvas 2D). 새 의존성 없음.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-07-07-cloudwar-design.md` §4(극성과 전투)·§5(봇 AI). 비/타일(M2 범위)은 이번 계획에 없음.
- `packages/core`는 런타임 의존성 0. DOM·네트워크·`Math.random()`·`Date` 사용 금지 — 시드 RNG(`rand(state)`)만. **예외 없음: 봇 AI도 RNG 없이 결정적으로.**
- 모든 밸런스 수치는 `packages/core/src/constants.ts`에만 (매직 넘버 금지).
- 스펙 수치 (verbatim): 스왑 비용 = 질량의 15% + 쿨다운 10초. 흡수 배율 = 1.25배. 번개 = 초당 각자 질량의 ~8% (겹친 정도 비례). 번개 손실의 30%는 물방울로 튐. 리스폰 3초, 스폰 보호막 10초 (공격 불가·피격 불가). 봇 7마리(총 8구름).
- 틱 순서 (고정): `events 초기화 → tickTimers → applySwaps → moveClouds → cloudCombat → applyDeaths → absorbVapors → spawnVapors → tick++`.
- TypeScript strict + `noUncheckedIndexedAccess`. TDD 필수 (RED→GREEN, 테스트 온리 태스크 제외).
- 커밋 메시지는 한국어, 말미에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 셸은 Git Bash. 작업 디렉토리: `C:\Users\juooy\Documents\workspace\CloudWar`. 브랜치: feat/m3-polarity-combat (컨트롤러가 생성).

---

### Task 1: 전투 상수 · 극성 타입 · 봇 스폰

**Files:**
- Modify: `packages/core/src/constants.ts` (전투 상수 추가)
- Modify: `packages/core/src/types.ts` (전체 교체)
- Modify: `packages/core/src/state.ts` (전체 교체)
- Modify: `packages/core/test/state.test.ts` (전체 교체)

**Interfaces:**
- Consumes: 기존 `rand`, `spawnVapor`, `START_MASS`, `WORLD_SIZE`
- Produces:
  - 상수: `MIN_MASS=20`, `ABSORB_RATIO=1.25`, `SWAP_COST_RATIO=0.15`, `SWAP_COOLDOWN_TICKS=200`, `LIGHTNING_DRAIN_PER_SEC=0.08`, `DROPLET_RATIO=0.3`, `DROPLET_SCATTER=120`, `RESPAWN_TICKS=60`, `SHIELD_TICKS=200`, `BOT_COUNT=7`, `BOT_VIEW_RADIUS=900`
  - `type Polarity = 1 | -1`
  - `Cloud`에 필드 추가: `polarity: Polarity; isBot: boolean; swapCooldown: number; shieldTicks: number; respawnTicks: number` (respawnTicks 0 = 생존, >0 = 사망 카운트다운)
  - `PlayerInput`에 `swap?: boolean` 추가
  - `GameEvent { type: 'lightning'|'absorb'|'death'|'respawn'|'swap'; cloudId: number; otherId?: number; pos: Vec2 }`, `GameState`에 `events: GameEvent[]` 추가
  - `createCloud(id: number, pos: Vec2, polarity: Polarity, isBot: boolean): Cloud`
  - `createInitialState(seed: number, botCount = 0, playerPolarity: Polarity = 1): GameState` — 기존 단일 인자 호출과 하위 호환

- [ ] **Step 1: Write the failing test**

`packages/core/test/state.test.ts` (전체 교체):
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state';
import { INITIAL_VAPOR_COUNT, START_MASS, WORLD_SIZE } from '../src/constants';

describe('createInitialState', () => {
  it('월드 중앙에 시작 질량의 플레이어 구름 1개를 만든다', () => {
    const state = createInitialState(42);
    expect(state.tick).toBe(0);
    expect(state.clouds).toHaveLength(1);
    expect(state.clouds[0]).toEqual({
      id: 1,
      pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      mass: START_MASS,
      polarity: 1,
      isBot: false,
      swapCooldown: 0,
      shieldTicks: 0,
      respawnTicks: 0,
    });
    expect(state.events).toEqual([]);
  });

  it('플레이어 극성을 지정할 수 있다', () => {
    const state = createInitialState(42, 0, -1);
    expect(state.clouds[0]!.polarity).toBe(-1);
  });

  it('botCount만큼 봇 구름을 랜덤 위치·랜덤 극성으로 만든다', () => {
    const state = createInitialState(42, 7);
    expect(state.clouds).toHaveLength(8);
    const bots = state.clouds.filter((c) => c.isBot);
    expect(bots).toHaveLength(7);
    const ids = state.clouds.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
    for (const bot of bots) {
      expect([1, -1]).toContain(bot.polarity);
      expect(bot.mass).toBe(START_MASS);
      expect(bot.pos.x).toBeGreaterThanOrEqual(0);
      expect(bot.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
      expect(bot.pos.y).toBeGreaterThanOrEqual(0);
      expect(bot.pos.y).toBeLessThanOrEqual(WORLD_SIZE);
    }
  });

  it('시작부터 수증기가 맵에 깔려 있다', () => {
    const state = createInitialState(42, 7);
    expect(state.vapors).toHaveLength(INITIAL_VAPOR_COUNT);
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('같은 시드는 같은 초기 상태를 만든다 (봇 포함)', () => {
    expect(JSON.stringify(createInitialState(7, 7))).toBe(JSON.stringify(createInitialState(7, 7)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — `INITIAL_VAPOR_COUNT`는 있으나 `polarity` 필드 부재로 `toEqual` 불일치, `createInitialState(42, 7)` 인자 초과 등.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/constants.ts`의 수증기 섹션 아래에 추가:
```ts

// ─── 전투 ───
export const MIN_MASS = 20; // 이하로 떨어지면 사망. 공식(cloudRadius/cloudSpeed)의 질량 하한이기도 함
export const ABSORB_RATIO = 1.25; // 같은 극성: 이 배율 이상 크면 흡수
export const SWAP_COST_RATIO = 0.15; // 극성 스왑 비용 (질량 비율)
export const SWAP_COOLDOWN_TICKS = 200; // 10초 @ 20tick
export const LIGHTNING_DRAIN_PER_SEC = 0.08; // 완전 겹침 시 초당 자기 질량 손실 비율
export const DROPLET_RATIO = 0.3; // 번개 손실 중 물방울로 튀는 비율
export const DROPLET_SCATTER = 120; // 물방울이 흩어지는 반경 (월드 유닛)
export const RESPAWN_TICKS = 60; // 3초
export const SHIELD_TICKS = 200; // 10초 스폰 보호막

// ─── 봇 ───
export const BOT_COUNT = 7; // 봇 모드: 플레이어 1 + 봇 7 = 8구름
export const BOT_VIEW_RADIUS = 900; // 봇 시야 반경
```

`packages/core/src/types.ts` (전체 교체):
```ts
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

export type GameEventType = 'lightning' | 'absorb' | 'death' | 'respawn' | 'swap';

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
```

`packages/core/src/state.ts` (전체 교체):
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: core 테스트 전체 PASS (기존 movement/vapor/determinism 회귀 없음 — Cloud 필드가 늘었지만 toEqual을 쓰는 곳은 state.test뿐). client typecheck도 통과 (client는 Cloud 필드를 직접 나열하지 않음).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): 극성 타입·전투 상수·봇 스폰 — M3 기반

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: MIN_MASS 클램프 — 퇴화 질량 가드

**Files:**
- Modify: `packages/core/src/cloud.ts` (전체 교체)
- Modify: `packages/core/test/cloud.test.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 `MIN_MASS`
- Produces: `cloudRadius`/`cloudSpeed`가 내부에서 질량을 `MIN_MASS` 하한으로 클램프 — 0·음수 질량에도 유한값 반환 (M1 최종 리뷰 후속: `cloudSpeed(0)=Infinity` 실버그 예방). `isAlive(cloud: Cloud): boolean` 추가 (respawnTicks === 0).

- [ ] **Step 1: Write the failing test**

`packages/core/test/cloud.test.ts` (전체 교체):
```ts
import { describe, it, expect } from 'vitest';
import { cloudRadius, cloudSpeed, isAlive } from '../src/cloud';
import { RADIUS_SCALE, BASE_SPEED, START_MASS, MIN_MASS } from '../src/constants';
import { createCloud } from '../src/state';

describe('구름 공식', () => {
  it('반지름은 질량의 제곱근에 비례한다', () => {
    expect(cloudRadius(100)).toBeCloseTo(RADIUS_SCALE * 10);
    expect(cloudRadius(400)).toBeCloseTo(RADIUS_SCALE * 20);
  });

  it('기준 질량에서 속도는 BASE_SPEED다', () => {
    expect(cloudSpeed(START_MASS)).toBeCloseTo(BASE_SPEED);
  });

  it('질량이 클수록 느리다', () => {
    expect(cloudSpeed(400)).toBeLessThan(cloudSpeed(100));
    expect(cloudSpeed(100)).toBeLessThan(cloudSpeed(50));
  });

  it('퇴화 질량(0·음수)은 MIN_MASS로 클램프되어 유한값을 준다', () => {
    expect(cloudSpeed(0)).toBe(cloudSpeed(MIN_MASS));
    expect(cloudSpeed(-5)).toBe(cloudSpeed(MIN_MASS));
    expect(Number.isFinite(cloudSpeed(0))).toBe(true);
    expect(cloudRadius(0)).toBe(cloudRadius(MIN_MASS));
    expect(cloudRadius(-5)).toBe(cloudRadius(MIN_MASS));
  });
});

describe('isAlive', () => {
  it('respawnTicks가 0이면 생존, 양수면 사망 상태다', () => {
    const cloud = createCloud(1, { x: 0, y: 0 }, 1, false);
    expect(isAlive(cloud)).toBe(true);
    cloud.respawnTicks = 30;
    expect(isAlive(cloud)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — `isAlive` 미존재, `cloudSpeed(0)`은 Infinity라 클램프 단언 실패.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/cloud.ts` (전체 교체):
```ts
import { BASE_SPEED, MIN_MASS, RADIUS_SCALE, SPEED_EXPONENT, START_MASS } from './constants';
import type { Cloud } from './types';

/** 공식은 질량을 MIN_MASS 하한으로 클램프한다 — 전투로 질량이 0 이하가 되는 순간에도 유한값 보장 */
export function cloudRadius(mass: number): number {
  return RADIUS_SCALE * Math.sqrt(Math.max(mass, MIN_MASS));
}

export function cloudSpeed(mass: number): number {
  return BASE_SPEED * (START_MASS / Math.max(mass, MIN_MASS)) ** SPEED_EXPONENT;
}

export function isAlive(cloud: Cloud): boolean {
  return cloud.respawnTicks === 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/cloud.ts packages/core/test/cloud.test.ts
git commit -m "feat(core): MIN_MASS 클램프 + isAlive — 퇴화 질량 가드

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 라이프사이클 — 타이머·사망·리스폰·보호막·이벤트 버퍼

**Files:**
- Modify: `packages/core/src/simulate.ts` (전체 교체)
- Test: `packages/core/test/lifecycle.test.ts` (신규)

**Interfaces:**
- Consumes: Task 1 타입·상수, Task 2 `isAlive`
- Produces: simulate 틱 순서 확립 — `state.events = []` → `tickTimers`(쿨다운·보호막·리스폰 카운트다운, 0 도달 시 리스폰) → `moveClouds`(생존자만) → `applyDeaths`(mass < MIN_MASS → kill) → `absorbVapors`(생존자만) → `spawnVapors` → `tick++`. 내부 함수 `kill(state, cloud)`(respawnTicks 설정 + death 이벤트), `respawn`(랜덤 위치·START_MASS·SHIELD_TICKS·respawn 이벤트), `clampToWorld(cloud)` (moveClouds에서 추출, Task 5의 밀어내기도 사용). 모두 simulate.ts 내부 private.

- [ ] **Step 1: Write the failing test**

`packages/core/test/lifecycle.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { isAlive } from '../src/cloud';
import {
  DT,
  MIN_MASS,
  RESPAWN_TICKS,
  SHIELD_TICKS,
  START_MASS,
  VAPOR_MASS,
} from '../src/constants';

describe('사망과 리스폰', () => {
  it('질량이 MIN_MASS 미만이면 죽고 death 이벤트가 남는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS - 1;
    simulate(state, {}, DT);
    expect(isAlive(c)).toBe(false);
    expect(c.respawnTicks).toBe(RESPAWN_TICKS);
    expect(state.events.some((e) => e.type === 'death' && e.cloudId === 1)).toBe(true);
  });

  it('죽은 구름은 움직이지도 수증기를 먹지도 않는다', () => {
    const state = createInitialState(42);
    const c = state.clouds[0]!;
    c.respawnTicks = 10;
    const before = { ...c.pos };
    state.vapors = [{ id: 900, pos: { x: c.pos.x + 10, y: c.pos.y } }];
    simulate(state, { 1: { dir: { x: 1, y: 0 } } }, DT);
    expect(c.pos).toEqual(before);
    expect(state.vapors.some((v) => v.id === 900)).toBe(true);
    expect(c.mass).toBe(START_MASS);
  });

  it('RESPAWN_TICKS 후 START_MASS와 보호막을 갖고 리스폰한다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS - 1;
    simulate(state, {}, DT); // 사망
    for (let i = 0; i < RESPAWN_TICKS; i++) {
      state.vapors = []; // 랜덤 리스폰 위치의 수증기 흡수가 질량 단언을 오염시키지 않도록
      simulate(state, {}, DT);
    }
    expect(isAlive(c)).toBe(true);
    expect(c.mass).toBe(START_MASS);
    expect(c.shieldTicks).toBe(SHIELD_TICKS); // 리스폰 틱에 설정된 직후 값 (다음 틱부터 감소)
    expect(state.events.some((e) => e.type === 'respawn' && e.cloudId === 1)).toBe(true);
  });

  it('이벤트 버퍼는 매 틱 초기화된다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS - 1;
    simulate(state, {}, DT);
    expect(state.events.length).toBeGreaterThan(0);
    simulate(state, {}, DT);
    expect(state.events).toEqual([]);
  });

  it('보호막 틱은 매 틱 감소한다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.shieldTicks = 5;
    simulate(state, {}, DT);
    expect(c.shieldTicks).toBe(4);
  });

  it('보호막 중에도 수증기는 먹을 수 있다', () => {
    const state = createInitialState(42);
    const c = state.clouds[0]!;
    c.shieldTicks = 100;
    state.vapors = [{ id: 900, pos: { x: c.pos.x + 10, y: c.pos.y } }];
    simulate(state, {}, DT);
    expect(c.mass).toBe(START_MASS + VAPOR_MASS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — 사망 처리 미구현이라 `isAlive(c)`가 true, events 미초기화 등.

- [ ] **Step 3: Write implementation**

`packages/core/src/simulate.ts` (전체 교체):
```ts
import {
  MIN_MASS,
  RESPAWN_TICKS,
  SHIELD_TICKS,
  START_MASS,
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
  WORLD_SIZE,
} from './constants';
import { cloudRadius, cloudSpeed, isAlive } from './cloud';
import { rand } from './rng';
import type { Cloud, GameState, Inputs } from './types';
import { spawnVapor } from './vapor';

/**
 * 고정 타임스텝 시뮬레이션 틱. 전달된 state를 제자리 변이하고 반환한다.
 * 외부 부수효과 없음 — 결정론은 state 내장 RNG로 보장된다.
 * 순서: events 초기화 → 타이머 → 이동 → 사망 판정 → 흡수 → 스폰 → tick 증가.
 */
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  state.events = [];
  tickTimers(state);
  moveClouds(state, inputs, dt);
  applyDeaths(state);
  absorbVapors(state);
  spawnVapors(state);
  state.tick += 1;
  return state;
}

function tickTimers(state: GameState): void {
  for (const cloud of state.clouds) {
    if (cloud.swapCooldown > 0) cloud.swapCooldown -= 1;
    if (cloud.shieldTicks > 0) cloud.shieldTicks -= 1;
    if (cloud.respawnTicks > 0) {
      cloud.respawnTicks -= 1;
      if (cloud.respawnTicks === 0) respawn(state, cloud);
    }
  }
}

function respawn(state: GameState, cloud: Cloud): void {
  const r = cloudRadius(START_MASS);
  cloud.mass = START_MASS;
  cloud.pos = {
    x: r + rand(state) * (WORLD_SIZE - 2 * r),
    y: r + rand(state) * (WORLD_SIZE - 2 * r),
  };
  cloud.shieldTicks = SHIELD_TICKS;
  cloud.swapCooldown = 0;
  state.events.push({ type: 'respawn', cloudId: cloud.id, pos: { ...cloud.pos } });
}

function kill(state: GameState, cloud: Cloud): void {
  cloud.respawnTicks = RESPAWN_TICKS;
  state.events.push({ type: 'death', cloudId: cloud.id, pos: { ...cloud.pos } });
}

function applyDeaths(state: GameState): void {
  for (const cloud of state.clouds) {
    if (isAlive(cloud) && cloud.mass < MIN_MASS) kill(state, cloud);
  }
}

function moveClouds(state: GameState, inputs: Inputs, dt: number): void {
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const input = inputs[cloud.id];
    if (!input) continue;
    const len = Math.hypot(input.dir.x, input.dir.y);
    if (len === 0) continue;
    const speed = cloudSpeed(cloud.mass);
    cloud.pos.x += (input.dir.x / len) * speed * dt;
    cloud.pos.y += (input.dir.y / len) * speed * dt;
    clampToWorld(cloud);
  }
}

function clampToWorld(cloud: Cloud): void {
  const r = cloudRadius(cloud.mass);
  cloud.pos.x = Math.min(Math.max(cloud.pos.x, r), WORLD_SIZE - r);
  cloud.pos.y = Math.min(Math.max(cloud.pos.y, r), WORLD_SIZE - r);
}

function absorbVapors(state: GameState): void {
  // 경합 규칙: clouds 배열 순서가 우선권 — 두 구름 반경에 동시에 든 수증기는 앞선 구름이 먹는다
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS (기존 이동·수증기·결정론 테스트 회귀 없음).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/simulate.ts packages/core/test/lifecycle.test.ts
git commit -m "feat(core): 사망·리스폰·보호막·이벤트 버퍼 — 구름 라이프사이클

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 극성 스왑

**Files:**
- Modify: `packages/core/src/simulate.ts` (applySwaps 추가 — 아래 diff 부분만)
- Test: `packages/core/test/swap.test.ts` (신규)

**Interfaces:**
- Consumes: Task 3의 simulate 구조, `PlayerInput.swap`
- Produces: `applySwaps(state, inputs)` — 생존 + 쿨다운 0 + `input.swap`이면 극성 반전, `mass *= 1 - SWAP_COST_RATIO`, 쿨다운 `SWAP_COOLDOWN_TICKS`, swap 이벤트. simulate 순서에서 **tickTimers 다음, moveClouds 이전**에 호출.

- [ ] **Step 1: Write the failing test**

`packages/core/test/swap.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { isAlive } from '../src/cloud';
import { DT, MIN_MASS, START_MASS, SWAP_COOLDOWN_TICKS, SWAP_COST_RATIO } from '../src/constants';

describe('극성 스왑', () => {
  it('스왑하면 극성이 반전되고 질량 15%를 잃고 쿨다운이 걸린다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(-1);
    expect(c.mass).toBeCloseTo(START_MASS * (1 - SWAP_COST_RATIO));
    expect(c.swapCooldown).toBe(SWAP_COOLDOWN_TICKS);
    expect(state.events.some((e) => e.type === 'swap' && e.cloudId === 1)).toBe(true);
  });

  it('쿨다운 중에는 스왑이 무시된다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    const massAfterFirst = c.mass;
    state.vapors = []; // 직전 틱에 스폰된 수증기가 질량 단언을 오염시키지 않도록
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(-1); // 그대로
    expect(c.mass).toBe(massAfterFirst);
  });

  it('쿨다운이 끝나면 다시 스왑할 수 있다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    for (let i = 0; i < SWAP_COOLDOWN_TICKS; i++) simulate(state, {}, DT);
    expect(c.swapCooldown).toBe(0);
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(1);
  });

  it('스왑 비용으로 MIN_MASS 미만이 되면 그 틱에 죽는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.mass = MIN_MASS + 1; // 21 * 0.85 = 17.85 < 20
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(isAlive(c)).toBe(false);
  });

  it('죽은 구름은 스왑할 수 없다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const c = state.clouds[0]!;
    c.respawnTicks = 30;
    simulate(state, { 1: { dir: { x: 0, y: 0 }, swap: true } }, DT);
    expect(c.polarity).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — 스왑 미구현으로 극성이 1 그대로.

- [ ] **Step 3: Write implementation**

`packages/core/src/simulate.ts`에서 simulate 본문을 다음으로 교체:
```ts
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  state.events = [];
  tickTimers(state);
  applySwaps(state, inputs);
  moveClouds(state, inputs, dt);
  applyDeaths(state);
  absorbVapors(state);
  spawnVapors(state);
  state.tick += 1;
  return state;
}
```
그리고 tickTimers 아래에 추가:
```ts
function applySwaps(state: GameState, inputs: Inputs): void {
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const input = inputs[cloud.id];
    if (!input?.swap || cloud.swapCooldown > 0) continue;
    cloud.polarity = cloud.polarity === 1 ? -1 : 1;
    cloud.mass *= 1 - SWAP_COST_RATIO;
    cloud.swapCooldown = SWAP_COOLDOWN_TICKS;
    state.events.push({ type: 'swap', cloudId: cloud.id, pos: { ...cloud.pos } });
  }
}
```
import에 `SWAP_COOLDOWN_TICKS, SWAP_COST_RATIO` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/simulate.ts packages/core/test/swap.test.ts
git commit -m "feat(core): 극성 스왑 — 질량 15% 비용 + 10초 쿨다운

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 같은 극성 — 흡수와 밀어내기

**Files:**
- Modify: `packages/core/src/simulate.ts` (cloudCombat + samePolarityContact 추가)
- Test: `packages/core/test/combat-same.test.ts` (신규)

**Interfaces:**
- Consumes: Task 3의 kill/clampToWorld/isAlive, Task 1의 ABSORB_RATIO
- Produces: `cloudCombat(state, dt)` — simulate 순서에서 **moveClouds 다음, applyDeaths 이전**. 모든 생존 쌍(i<j, 배열 순회 순서)에 대해: 보호막 낀 쌍은 상호작용 없음; 거리 ≥ rA+rB면 스킵; 같은 극성이면 `samePolarityContact`. 흡수 규칙: `big.mass >= small.mass * ABSORB_RATIO && dist < cloudRadius(big.mass)` → big이 small 질량 전부 획득, small은 kill, absorb 이벤트. 아니면 겹침을 질량 반비례로 밀어내고 경계 클램프. Task 6이 반대 극성 분기(`lightningContact`)를 채운다 — 이 태스크에서는 반대 극성 쌍이면 아무것도 안 함(빈 분기).

- [ ] **Step 1: Write the failing test**

`packages/core/test/combat-same.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState, createCloud } from '../src/state';
import { cloudRadius, isAlive } from '../src/cloud';
import { DT } from '../src/constants';

/** 수증기 없는 2구름 상태 — 전투 규칙만 관찰 */
function duel(massA: number, massB: number, dist: number, samePolarity: boolean) {
  const state = createInitialState(42);
  state.vapors = [];
  const a = state.clouds[0]!;
  a.mass = massA;
  const b = createCloud(2, { x: a.pos.x + dist, y: a.pos.y }, samePolarity ? a.polarity : -1, true);
  b.mass = massB;
  state.clouds.push(b);
  return { state, a, b };
}

describe('같은 극성 — 흡수', () => {
  it('1.25배 이상 크고 작은 쪽 중심이 반경 안이면 통째로 흡수한다', () => {
    const { state, a, b } = duel(125, 100, 40, true); // rA=44.7, dist 40 < 44.7
    simulate(state, {}, DT);
    expect(a.mass).toBe(225);
    expect(isAlive(b)).toBe(false);
    expect(state.events.some((e) => e.type === 'absorb' && e.cloudId === 1 && e.otherId === 2)).toBe(true);
  });

  it('1.25배 미만이면 흡수하지 않고 밀어낸다', () => {
    const { state, a, b } = duel(120, 100, 30, true);
    simulate(state, {}, DT);
    expect(isAlive(a)).toBe(true);
    expect(isAlive(b)).toBe(true);
    expect(a.mass).toBe(120);
    expect(b.mass).toBe(100);
    const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    expect(dist).toBeGreaterThanOrEqual(cloudRadius(a.mass) + cloudRadius(b.mass) - 1e-9);
  });

  it('완전히 같은 위치(dist 0)에서도 결정적으로 분리된다', () => {
    const { state, a, b } = duel(100, 100, 0, true);
    simulate(state, {}, DT);
    const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    expect(dist).toBeGreaterThan(0);
  });

  it('보호막이 있는 쌍은 흡수되지 않는다', () => {
    const { state, a, b } = duel(200, 100, 10, true);
    b.shieldTicks = 100;
    simulate(state, {}, DT);
    expect(isAlive(b)).toBe(true);
    expect(a.mass).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — 흡수/밀어내기 미구현으로 질량 불변·겹침 유지.

- [ ] **Step 3: Write implementation**

`packages/core/src/simulate.ts`의 simulate 본문에서 `moveClouds(...)` 다음 줄에 `cloudCombat(state, dt);` 추가:
```ts
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  state.events = [];
  tickTimers(state);
  applySwaps(state, inputs);
  moveClouds(state, inputs, dt);
  cloudCombat(state, dt);
  applyDeaths(state);
  absorbVapors(state);
  spawnVapors(state);
  state.tick += 1;
  return state;
}
```
그리고 moveClouds 아래에 추가:
```ts
function cloudCombat(state: GameState, dt: number): void {
  const clouds = state.clouds;
  for (let i = 0; i < clouds.length; i++) {
    for (let j = i + 1; j < clouds.length; j++) {
      const a = clouds[i]!;
      const b = clouds[j]!;
      if (!isAlive(a) || !isAlive(b)) continue;
      if (a.shieldTicks > 0 || b.shieldTicks > 0) continue;
      const ra = cloudRadius(a.mass);
      const rb = cloudRadius(b.mass);
      const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
      if (dist >= ra + rb) continue;
      if (a.polarity === b.polarity) {
        samePolarityContact(state, a, b, ra, rb, dist);
      }
      // 반대 극성(번개)은 Task 6에서 채운다
    }
  }
}

function samePolarityContact(
  state: GameState,
  a: Cloud,
  b: Cloud,
  ra: number,
  rb: number,
  dist: number,
): void {
  const [big, small] = a.mass >= b.mass ? [a, b] : [b, a];
  if (big.mass >= small.mass * ABSORB_RATIO && dist < cloudRadius(big.mass)) {
    big.mass += small.mass;
    state.events.push({ type: 'absorb', cloudId: big.id, otherId: small.id, pos: { ...small.pos } });
    kill(state, small);
    return;
  }
  // 밀어내기 — 겹침을 질량 반비례로 해소 (무거운 쪽이 덜 밀림)
  const overlap = ra + rb - dist;
  let nx: number;
  let ny: number;
  if (dist > 0) {
    nx = (a.pos.x - b.pos.x) / dist;
    ny = (a.pos.y - b.pos.y) / dist;
  } else {
    nx = a.id < b.id ? -1 : 1; // 완전히 겹치면 id 기준 결정적 분리
    ny = 0;
  }
  const total = a.mass + b.mass;
  a.pos.x += nx * overlap * (b.mass / total);
  a.pos.y += ny * overlap * (b.mass / total);
  b.pos.x -= nx * overlap * (a.mass / total);
  b.pos.y -= ny * overlap * (a.mass / total);
  clampToWorld(a);
  clampToWorld(b);
}
```
import에 `ABSORB_RATIO` 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/simulate.ts packages/core/test/combat-same.test.ts
git commit -m "feat(core): 같은 극성 전투 — 1.25배 흡수와 질량 반비례 밀어내기

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 반대 극성 — 번개 소모전과 물방울

**Files:**
- Modify: `packages/core/src/simulate.ts` (lightningContact + scatterDroplets 추가)
- Test: `packages/core/test/combat-lightning.test.ts` (신규)

**Interfaces:**
- Consumes: Task 5의 cloudCombat 구조
- Produces: cloudCombat의 반대 극성 분기 → `lightningContact(state, a, b, ra, rb, dist, dt)`: 겹침 비율 `factor = min(1, overlap / min(ra, rb))`, 각자 `mass -= mass * LIGHTNING_DRAIN_PER_SEC * dt * factor`, 총 손실의 `DROPLET_RATIO`만큼 `scatterDroplets`(중점 주변 DROPLET_SCATTER 반경에 물방울=수증기 스폰, 기대값의 소수부는 RNG 확률 스폰 — 결정적), lightning 이벤트(중점). 물방울은 VAPOR_MAX 캡을 무시한다 (전투 보상 — 일반 스폰 캡과 별개, 코드 주석으로 명시).

- [ ] **Step 1: Write the failing test**

`packages/core/test/combat-lightning.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState, createCloud } from '../src/state';
import { DT, DROPLET_SCATTER, LIGHTNING_DRAIN_PER_SEC, VAPOR_MAX } from '../src/constants';

/** 반대 극성 2구름이 겹친 상태 (수증기 없음) */
function storm(massA: number, massB: number, dist: number) {
  const state = createInitialState(42);
  state.vapors = [];
  const a = state.clouds[0]!;
  a.mass = massA;
  const b = createCloud(2, { x: a.pos.x + dist, y: a.pos.y }, -1, true);
  b.mass = massB;
  state.clouds.push(b);
  return { state, a, b };
}

describe('반대 극성 — 번개 소모전', () => {
  it('접촉 중 둘 다 질량을 잃고 lightning 이벤트가 남는다', () => {
    const { state, a, b } = storm(400, 100, 10);
    simulate(state, {}, DT);
    expect(a.mass).toBeLessThan(400);
    expect(b.mass).toBeLessThan(100);
    expect(state.events.some((e) => e.type === 'lightning')).toBe(true);
  });

  it('손실은 자기 질량에 비례한다 — 큰 쪽이 절대량은 더 잃지만 비율은 같다', () => {
    const { state, a, b } = storm(400, 100, 0); // 완전 겹침 → factor 1
    simulate(state, {}, DT);
    const lossA = 400 - a.mass;
    const lossB = 100 - b.mass;
    expect(lossA).toBeCloseTo(400 * LIGHTNING_DRAIN_PER_SEC * DT);
    expect(lossB).toBeCloseTo(100 * LIGHTNING_DRAIN_PER_SEC * DT);
    expect(lossA / 400).toBeCloseTo(lossB / 100);
  });

  it('겹침이 얕으면 손실도 작다', () => {
    const deep = storm(100, 100, 0);
    const shallow = storm(100, 100, 75); // rA=rB=40, 겹침 5
    simulate(deep.state, {}, DT);
    simulate(shallow.state, {}, DT);
    const deepLoss = 100 - deep.a.mass;
    const shallowLoss = 100 - shallow.a.mass;
    expect(shallowLoss).toBeGreaterThan(0);
    expect(shallowLoss).toBeLessThan(deepLoss);
  });

  it('오래 싸우면 물방울이 중점 주변에 튄다 (VAPOR_MAX 무시)', () => {
    const { state, a, b } = storm(2000, 2000, 0);
    // 일반 스폰이 섞이지 않도록 캡까지 채워둔다
    while (state.vapors.length < VAPOR_MAX) {
      state.vapors.push({ id: state.nextEntityId++, pos: { x: 0, y: 0 } });
    }
    const mid = { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 };
    for (let i = 0; i < 100; i++) simulate(state, {}, DT);
    const droplets = state.vapors.filter(
      (v) => Math.hypot(v.pos.x - mid.x, v.pos.y - mid.y) <= DROPLET_SCATTER + 200,
    );
    expect(state.vapors.length).toBeGreaterThan(VAPOR_MAX);
    expect(droplets.length).toBeGreaterThan(0);
  });

  it('소모전 끝에 질량이 바닥나면 죽는다', () => {
    // 주의: 죽은 뒤 RESPAWN_TICKS 지나면 부활하므로 최종 상태가 아니라 death 이벤트 발생 여부로 검증
    const { state, b } = storm(4000, 22, 0);
    let died = false;
    for (let i = 0; i < 100 && !died; i++) {
      simulate(state, {}, DT);
      died = state.events.some((e) => e.type === 'death' && e.cloudId === b.id);
    }
    expect(died).toBe(true);
  });

  it('보호막이 있는 쌍은 번개가 치지 않는다', () => {
    const { state, a, b } = storm(400, 100, 10);
    b.shieldTicks = 100;
    simulate(state, {}, DT);
    expect(a.mass).toBe(400);
    expect(b.mass).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — 반대 극성 분기가 비어 있어 질량 불변.

- [ ] **Step 3: Write implementation**

`packages/core/src/simulate.ts`의 cloudCombat에서 주석 자리를 else 분기로 교체:
```ts
      if (a.polarity === b.polarity) {
        samePolarityContact(state, a, b, ra, rb, dist);
      } else {
        lightningContact(state, a, b, ra, rb, dist, dt);
      }
```
samePolarityContact 아래에 추가:
```ts
function lightningContact(
  state: GameState,
  a: Cloud,
  b: Cloud,
  ra: number,
  rb: number,
  dist: number,
  dt: number,
): void {
  const overlap = ra + rb - dist;
  const factor = Math.min(1, overlap / Math.min(ra, rb));
  const drainA = a.mass * LIGHTNING_DRAIN_PER_SEC * dt * factor;
  const drainB = b.mass * LIGHTNING_DRAIN_PER_SEC * dt * factor;
  a.mass -= drainA;
  b.mass -= drainB;
  const mid = { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 };
  scatterDroplets(state, mid, (drainA + drainB) * DROPLET_RATIO);
  state.events.push({ type: 'lightning', cloudId: a.id, otherId: b.id, pos: mid });
}

/** 번개 손실 일부를 물방울(수증기)로 흩뿌린다. VAPOR_MAX 캡 무시 — 전투 보상은 일반 스폰과 별개. */
function scatterDroplets(state: GameState, origin: Vec2, mass: number): void {
  const expected = mass / VAPOR_MASS;
  let count = Math.floor(expected);
  if (rand(state) < expected - count) count += 1; // 소수부는 확률 스폰 (시드 RNG라 결정적)
  for (let i = 0; i < count; i++) {
    const angle = rand(state) * Math.PI * 2;
    const scatter = rand(state) * DROPLET_SCATTER;
    state.vapors.push({
      id: state.nextEntityId++,
      pos: {
        x: Math.min(Math.max(origin.x + Math.cos(angle) * scatter, 0), WORLD_SIZE),
        y: Math.min(Math.max(origin.y + Math.sin(angle) * scatter, 0), WORLD_SIZE),
      },
    });
  }
}
```
import에 `DROPLET_RATIO, DROPLET_SCATTER, LIGHTNING_DRAIN_PER_SEC` 추가, `import type { ..., Vec2 } from './types';`에 Vec2 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/simulate.ts packages/core/test/combat-lightning.test.ts
git commit -m "feat(core): 반대 극성 번개 소모전 — 겹침 비례 드레인 + 물방울 30%

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 수증기 경합 규칙 고정 (테스트 온리)

**Files:**
- Test: `packages/core/test/vapor.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 3의 absorbVapors 순회 규칙
- Produces: M1 최종 리뷰 후속 항목의 공식화 — "두 생존 구름의 반경에 동시에 든 수증기는 clouds 배열의 앞선 구름이 먹는다"를 회귀 방지 테스트로 고정. 새 구현 코드 없음. 테스트가 처음부터 통과해야 정상 — 실패하면 absorbVapors 순회 순서가 바뀐 것.

- [ ] **Step 1: Write the test**

`packages/core/test/vapor.test.ts` 파일 끝에 추가:
```ts

describe('수증기 경합 규칙', () => {
  it('두 구름 반경에 동시에 들면 clouds 배열의 앞선 구름이 먹는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const a = state.clouds[0]!; // r = 40
    const b = createCloud(2, { x: a.pos.x + 50, y: a.pos.y }, a.polarity, true);
    // 같은 극성 겹침은 같은 틱에 밀어내기가 일어나 수증기가 경계 밖으로 벗어난다 —
    // 보호막으로 전투 상호작용을 끄고 순수 경합만 관찰 (보호막 중 수증기 흡수는 허용됨)
    a.shieldTicks = 100;
    b.shieldTicks = 100;
    state.clouds.push(b);
    // 두 구름 사이 — a에서 25, b에서 25 (둘 다 반경 40 안)
    state.vapors = [{ id: 900, pos: { x: a.pos.x + 25, y: a.pos.y } }];
    simulate(state, {}, DT);
    expect(a.mass).toBeGreaterThan(b.mass);
    expect(state.vapors.some((v) => v.id === 900)).toBe(false);
  });

  it('죽은 구름은 수증기를 먹지 못하고, 배열 뒤 구름이 먹는다', () => {
    const state = createInitialState(42);
    state.vapors = [];
    const a = state.clouds[0]!;
    a.respawnTicks = 30;
    const b = createCloud(2, { x: a.pos.x + 50, y: a.pos.y }, a.polarity, true);
    state.clouds.push(b);
    state.vapors = [{ id: 900, pos: { x: a.pos.x + 25, y: a.pos.y } }];
    simulate(state, {}, DT);
    expect(b.mass).toBe(START_MASS + VAPOR_MASS);
  });
});
```
파일 상단 import에 `createCloud`를 추가한다:
```ts
import { createInitialState, createCloud } from '../src/state';
```
(주의: 두 번째 테스트에서 b는 a와 50 떨어져 있고 수증기는 b에서 25 거리 — b 반경 40 안이다.)

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test`
Expected: 전체 PASS. 첫 실행에서 실패하면 absorbVapors의 순회 순서/isAlive 가드에 회귀가 있는 것 — 원인을 고친다.

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/vapor.test.ts
git commit -m "test(core): 수증기 경합 규칙 고정 — 배열 앞 구름 우선

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 봇 AI

**Files:**
- Create: `packages/core/src/bots.ts`
- Modify: `packages/core/src/index.ts` (export 추가)
- Test: `packages/core/test/bots.test.ts` (신규)

**Interfaces:**
- Consumes: Task 1~6의 타입·상수·isAlive
- Produces: `computeBotInputs(state: GameState): Inputs` — 생존 봇마다 입력 산출. **RNG 미사용, 완전 결정적.** 우선순위: ① 도망(같은 극성 & 상대 질량 ≥ 내 질량×ABSORB_RATIO, 또는 반대 극성 & 상대 질량 ≥ 내 질량×2, 시야 BOT_VIEW_RADIUS 내, 보호막 상대 제외) → ② 사냥(같은 극성 & 내 질량 ≥ 상대×ABSORB_RATIO) → ③ 채집(가장 가까운 수증기) → ④ 월드 중앙으로. 동거리 동점은 배열 앞 우선(strict <).

- [ ] **Step 1: Write the failing test**

`packages/core/test/bots.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeBotInputs } from '../src/bots';
import { createInitialState, createCloud } from '../src/state';

/** dir가 target 방향인지 (내적 > 0) */
function headsToward(dir: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return dir.x * (to.x - from.x) + dir.y * (to.y - from.y) > 0;
}

function arena() {
  const state = createInitialState(42);
  state.vapors = [];
  state.clouds = []; // 플레이어 제거 — 봇만으로 구성
  return state;
}

describe('봇 AI', () => {
  it('큰 같은 극성이 가까이 있으면 반대 방향으로 도망간다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const threat = createCloud(3, { x: 2100, y: 2000 }, 1, true);
    threat.mass = 300;
    state.clouds.push(bot, threat);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, threat.pos)).toBe(false);
  });

  it('작은 같은 극성이 있으면 추격한다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    bot.mass = 300;
    const prey = createCloud(3, { x: 2300, y: 2000 }, 1, true);
    state.clouds.push(bot, prey);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, prey.pos)).toBe(true);
  });

  it('두 배 이상 큰 반대 극성에게서는 도망간다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    const enemy = createCloud(3, { x: 2100, y: 2000 }, -1, true);
    enemy.mass = 250;
    state.clouds.push(bot, enemy);
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, enemy.pos)).toBe(false);
  });

  it('위협도 사냥감도 없으면 가장 가까운 수증기로 간다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    state.clouds.push(bot);
    state.vapors = [
      { id: 10, pos: { x: 2600, y: 2000 } },
      { id: 11, pos: { x: 2100, y: 2000 } }, // 더 가까움
    ];
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 2100, y: 2000 })).toBe(true);
  });

  it('시야 밖 위협은 무시한다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 500, y: 500 }, 1, true);
    const threat = createCloud(3, { x: 3500, y: 3500 }, 1, true); // 거리 > BOT_VIEW_RADIUS
    threat.mass = 999;
    state.clouds.push(bot, threat);
    state.vapors = [{ id: 10, pos: { x: 600, y: 500 } }];
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 600, y: 500 })).toBe(true);
  });

  it('보호막 상대는 위협도 사냥감도 아니다', () => {
    const state = arena();
    const bot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    bot.mass = 300;
    const shielded = createCloud(3, { x: 2100, y: 2000 }, 1, true);
    shielded.shieldTicks = 100;
    state.clouds.push(bot, shielded);
    state.vapors = [{ id: 10, pos: { x: 1500, y: 2000 } }];
    const inputs = computeBotInputs(state);
    expect(headsToward(inputs[2]!.dir, bot.pos, { x: 1500, y: 2000 })).toBe(true);
  });

  it('죽은 봇과 봇이 아닌 구름에는 입력을 내지 않는다', () => {
    const state = arena();
    const player = createCloud(1, { x: 1000, y: 1000 }, 1, false);
    const deadBot = createCloud(2, { x: 2000, y: 2000 }, 1, true);
    deadBot.respawnTicks = 30;
    state.clouds.push(player, deadBot);
    const inputs = computeBotInputs(state);
    expect(inputs[1]).toBeUndefined();
    expect(inputs[2]).toBeUndefined();
  });

  it('같은 상태에서 항상 같은 입력을 낸다 (결정적)', () => {
    const state = createInitialState(42, 7);
    expect(JSON.stringify(computeBotInputs(state))).toBe(JSON.stringify(computeBotInputs(state)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — `Cannot find module '../src/bots'`.

- [ ] **Step 3: Write implementation**

`packages/core/src/bots.ts`:
```ts
import { ABSORB_RATIO, BOT_VIEW_RADIUS, WORLD_SIZE } from './constants';
import { isAlive } from './cloud';
import type { Cloud, GameState, Inputs, PlayerInput, Vec2 } from './types';

/**
 * 봇들의 이번 틱 입력을 계산한다. RNG 미사용 — 같은 상태면 항상 같은 결과.
 * 우선순위: 도망 > 사냥 > 채집 > 중앙 복귀.
 */
export function computeBotInputs(state: GameState): Inputs {
  const inputs: Inputs = {};
  for (const bot of state.clouds) {
    if (!bot.isBot || !isAlive(bot)) continue;
    inputs[bot.id] = botInput(state, bot);
  }
  return inputs;
}

function botInput(state: GameState, bot: Cloud): PlayerInput {
  const threat = nearestCloud(
    state,
    bot,
    (c) =>
      (c.polarity === bot.polarity && c.mass >= bot.mass * ABSORB_RATIO) ||
      (c.polarity !== bot.polarity && c.mass >= bot.mass * 2),
  );
  if (threat) return { dir: diff(threat.pos, bot.pos) }; // 위협 반대 방향

  const prey = nearestCloud(
    state,
    bot,
    (c) => c.polarity === bot.polarity && bot.mass >= c.mass * ABSORB_RATIO,
  );
  if (prey) return { dir: diff(bot.pos, prey.pos) };

  const vapor = nearestVapor(state, bot);
  if (vapor) return { dir: diff(bot.pos, vapor.pos) };

  return { dir: diff(bot.pos, { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }) };
}

/** to - from 방향 벡터 (simulate가 정규화). 영벡터면 결정적 기본값. */
function diff(from: Vec2, to: Vec2): Vec2 {
  const d = { x: to.x - from.x, y: to.y - from.y };
  if (d.x === 0 && d.y === 0) return { x: 1, y: 0 };
  return d;
}

function nearestCloud(
  state: GameState,
  bot: Cloud,
  pred: (c: Cloud) => boolean,
): Cloud | undefined {
  let best: Cloud | undefined;
  let bestDist = BOT_VIEW_RADIUS;
  for (const c of state.clouds) {
    if (c.id === bot.id || !isAlive(c) || c.shieldTicks > 0 || !pred(c)) continue;
    const dist = Math.hypot(c.pos.x - bot.pos.x, c.pos.y - bot.pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function nearestVapor(state: GameState, bot: Cloud) {
  let best;
  let bestDist = BOT_VIEW_RADIUS;
  for (const v of state.vapors) {
    const dist = Math.hypot(v.pos.x - bot.pos.x, v.pos.y - bot.pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}
```
(주의: `diff(threat.pos, bot.pos)`는 "threat→bot" 방향 = 위협에서 멀어지는 방향이다.)

`packages/core/src/index.ts` (전체 교체):
```ts
export * from './constants';
export * from './types';
export * from './rng';
export * from './cloud';
export * from './state';
export * from './simulate';
export * from './vapor';
export * from './bots';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/bots.ts packages/core/src/index.ts packages/core/test/bots.test.ts
git commit -m "feat(core): 봇 AI — 도망/사냥/채집 결정적 상태머신

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 결정론 확장 + 직렬화 왕복 (테스트 온리)

**Files:**
- Modify: `packages/core/test/determinism.test.ts` (전체 교체)

**Interfaces:**
- Consumes: 전체 core API
- Produces: 봇 전투 포함 풀 시뮬 결정론 + 직렬화 왕복(M5 후속 항목 선반영) 회귀 방지막. 처음부터 통과해야 정상 — 실패 시 Task 1~8 어딘가에 비결정 요소(RNG 외 난수, 이터레이션 순서 등)가 있는 것이므로 BLOCKED 보고.

- [ ] **Step 1: Write the test**

`packages/core/test/determinism.test.ts` (전체 교체):
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { computeBotInputs } from '../src/bots';
import { DT } from '../src/constants';
import type { GameState, Inputs } from '../src/types';

/** 틱 번호에 따라 방향·스왑이 바뀌는 스크립트 입력 (결정적) */
function scriptedInput(tick: number): Inputs {
  const angle = (tick % 40) * (Math.PI / 20);
  return { 1: { dir: { x: Math.cos(angle), y: Math.sin(angle) }, swap: tick % 97 === 0 } };
}

function step(state: GameState, tick: number): void {
  simulate(state, { ...computeBotInputs(state), ...scriptedInput(tick) }, DT);
}

describe('결정론', () => {
  it('같은 시드 + 같은 입력 → 200틱 후 상태가 완전히 동일하다 (구름 1개)', () => {
    const a = createInitialState(12345);
    const b = createInitialState(12345);
    for (let t = 0; t < 200; t++) {
      simulate(a, scriptedInput(t), DT);
      simulate(b, scriptedInput(t), DT);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('봇 7 + 전투 포함 300틱 후에도 상태가 완전히 동일하다', () => {
    const a = createInitialState(999, 7);
    const b = createInitialState(999, 7);
    for (let t = 0; t < 300; t++) {
      step(a, t);
      step(b, t);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('직렬화 왕복 후에도 결정론이 유지된다 (M5 스냅샷 복원의 핵심 가정)', () => {
    const a = createInitialState(555, 7);
    for (let t = 0; t < 100; t++) step(a, t);
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    for (let t = 100; t < 200; t++) {
      step(a, t);
      step(b, t);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('다른 시드는 다른 수증기 배치를 만든다', () => {
    const a = createInitialState(1);
    const b = createInitialState(2);
    for (let t = 0; t < 50; t++) {
      simulate(a, {}, DT);
      simulate(b, {}, DT);
    }
    expect(JSON.stringify(a.vapors)).not.toBe(JSON.stringify(b.vapors));
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test`
Expected: 전체 PASS. 실패하면 비결정 요소가 섞인 것 — 고치지 말고 BLOCKED 보고.

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/determinism.test.ts
git commit -m "test(core): 봇 전투 결정론 + 직렬화 왕복 보증

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: 클라 부팅 — 극성 선택 · 스왑 입력 · 봇 매치

**Files:**
- Modify: `packages/client/index.html` (극성 선택 UI 추가)
- Modify: `packages/client/src/input.ts` (전체 교체 — Controls로 개명, 스왑 키)
- Modify: `packages/client/src/startScreen.ts` (극성 선택 반환)
- Modify: `packages/client/src/main.ts` (전체 교체 — 봇 매치 부팅, 입력 병합)

**Interfaces:**
- Consumes: core의 `createInitialState(seed, botCount, playerPolarity)`, `computeBotInputs`, `BOT_COUNT`, `Polarity`
- Produces:
  - `Controls` 클래스 (구 MouseInput): `currentDir(): Vec2` + `consumeSwap(): boolean` (E키 또는 Space 에지 트리거 — 눌린 뒤 첫 호출만 true)
  - `showStartScreen(): Promise<{ style: CloudStyle; polarity: Polarity }>`
  - main: `simulate(state, { ...computeBotInputs(state), [PLAYER_ID]: { dir, swap } }, DT)` — 봇 7 매치. `state.events`는 이 태스크에서 소비하지 않음 (Task 12).
  - Task 11·12가 의존할 것: main의 `render(...)` 호출 시그니처는 기존 그대로 유지 (Task 11에서 확장).

- [ ] **Step 1: index.html에 극성 선택 UI 추가**

`packages/client/index.html`에서 두 슬라이더 `<label>` 아래(버튼 div 위)에 추가:
```html
        <div class="polarity-row">
          <button id="polarity-plus" type="button" class="polarity selected">＋ 양전하</button>
          <button id="polarity-minus" type="button" class="polarity">－ 음전하</button>
        </div>
```
`<style>` 블록 끝(닫는 `</style>` 앞)에 추가:
```css
      .polarity-row {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }
      .polarity {
        flex: 1;
        border: 2px solid transparent !important;
        border-radius: 12px;
        padding: 10px 0;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      #polarity-plus {
        background: #fdf3dc;
        color: #a4770f;
      }
      #polarity-minus {
        background: #e3e9fb;
        color: #3b62c4;
      }
      #polarity-plus.selected {
        border-color: #d9a521 !important;
      }
      #polarity-minus.selected {
        border-color: #3b62c4 !important;
      }
```

- [ ] **Step 2: input.ts 전체 교체**

`packages/client/src/input.ts`:
```ts
import type { Vec2 } from '@cloudwar/core';

const DEADZONE_PX = 24;

/** 마우스 이동 방향 + 스왑 키(E/Space) 에지 트리거. */
export class Controls {
  private mouse: Vec2 | null = null;
  private swapRequested = false;

  constructor(target: HTMLElement) {
    target.addEventListener('mousemove', (e: MouseEvent) => {
      this.mouse = { x: e.clientX, y: e.clientY };
    });
    target.addEventListener('mouseleave', () => {
      this.mouse = null;
    });
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Space') this.swapRequested = true;
    });
  }

  currentDir(): Vec2 {
    if (!this.mouse) return { x: 0, y: 0 };
    const dx = this.mouse.x - window.innerWidth / 2;
    const dy = this.mouse.y - window.innerHeight / 2;
    if (Math.hypot(dx, dy) < DEADZONE_PX) return { x: 0, y: 0 };
    return { x: dx, y: dy }; // 정규화는 simulate 책임
  }

  /** 마지막 호출 이후 스왑 키가 눌렸으면 true (1회성) */
  consumeSwap(): boolean {
    const requested = this.swapRequested;
    this.swapRequested = false;
    return requested;
  }
}
```

- [ ] **Step 3: startScreen.ts 수정**

`packages/client/src/startScreen.ts`에서 import에 Polarity 추가, 반환 타입 변경, 극성 버튼 배선. 전체 교체:
```ts
import type { Polarity } from '@cloudwar/core';
import { drawCloud } from './render';
import { generateCloudStyle, randomSeed } from './cloudStyle';
import type { CloudStyle, CloudStyleParams } from './cloudStyle';

const STORAGE_KEY = 'cloudwar.cloudStyle';

export interface StartChoice {
  style: CloudStyle;
  polarity: Polarity;
}

/** 시작 화면을 띄우고, "게임 시작" 클릭 시 확정된 구름 스타일·극성으로 resolve한다. */
export function showStartScreen(): Promise<StartChoice> {
  const overlay = document.getElementById('start-screen') as HTMLDivElement;
  const preview = document.getElementById('style-preview') as HTMLCanvasElement;
  const lobesInput = document.getElementById('style-lobes') as HTMLInputElement;
  const fluffInput = document.getElementById('style-fluff') as HTMLInputElement;
  const rerollBtn = document.getElementById('style-reroll') as HTMLButtonElement;
  const startBtn = document.getElementById('start-game') as HTMLButtonElement;
  const plusBtn = document.getElementById('polarity-plus') as HTMLButtonElement;
  const minusBtn = document.getElementById('polarity-minus') as HTMLButtonElement;
  const ctx = preview.getContext('2d')!;

  const params = loadParams();
  lobesInput.value = String(params.lobeCount);
  fluffInput.value = String(params.fluff);

  let style = generateCloudStyle(params);
  let polarity: Polarity = 1;
  let running = true;

  lobesInput.addEventListener('input', () => {
    params.lobeCount = Number(lobesInput.value);
    style = generateCloudStyle(params);
  });
  fluffInput.addEventListener('input', () => {
    params.fluff = Number(fluffInput.value);
    style = generateCloudStyle(params);
  });
  rerollBtn.addEventListener('click', () => {
    params.seed = randomSeed();
    style = generateCloudStyle(params);
  });
  plusBtn.addEventListener('click', () => {
    polarity = 1;
    plusBtn.classList.add('selected');
    minusBtn.classList.remove('selected');
  });
  minusBtn.addEventListener('click', () => {
    polarity = -1;
    minusBtn.classList.add('selected');
    plusBtn.classList.remove('selected');
  });

  function drawPreview(now: number): void {
    if (!running) return;
    ctx.clearRect(0, 0, preview.width, preview.height);
    drawCloud(ctx, { x: preview.width / 2, y: preview.height / 2 + 12 }, 55, style, now / 1000, polarity, false);
    requestAnimationFrame(drawPreview);
  }
  requestAnimationFrame(drawPreview);

  return new Promise((resolve) => {
    startBtn.addEventListener(
      'click',
      () => {
        running = false;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
        } catch {
          // 저장 실패해도 게임 시작에는 지장 없음
        }
        overlay.style.display = 'none';
        resolve({ style, polarity });
      },
      { once: true },
    );
  });
}

function loadParams(): CloudStyleParams {
  const fallback: CloudStyleParams = { seed: randomSeed(), lobeCount: 5, fluff: 1 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CloudStyleParams>;
    return {
      seed: typeof parsed.seed === 'number' ? parsed.seed : fallback.seed,
      lobeCount: typeof parsed.lobeCount === 'number' ? parsed.lobeCount : fallback.lobeCount,
      fluff: typeof parsed.fluff === 'number' ? parsed.fluff : fallback.fluff,
    };
  } catch {
    return fallback;
  }
}
```
(주의: `drawCloud` 시그니처가 polarity·shield 인자를 받도록 Task 11에서 바뀐다. **Task 10과 11은 연속 커밋이며, Task 10 시점에는 아직 render.ts가 구 시그니처라 typecheck가 깨진다 — Task 10에서는 커밋 전 typecheck 대신 `pnpm --filter @cloudwar/core test`만 확인하고, Task 11 완료 시점에 클라 typecheck를 통과시킨다.** 이 예외는 이 두 태스크에만 허용된다.)

- [ ] **Step 4: main.ts 전체 교체**

`packages/client/src/main.ts`:
```ts
import { BOT_COUNT, computeBotInputs, createInitialState, simulate, DT } from '@cloudwar/core';
import type { Vec2 } from '@cloudwar/core';
import { Controls } from './input';
import { Camera } from './camera';
import { render } from './render';
import { generateCloudStyle } from './cloudStyle';
import type { CloudStyle } from './cloudStyle';
import { showStartScreen } from './startScreen';

const PLAYER_ID = 1;
const MAX_FRAME_SECONDS = 0.25; // 탭 비활성 복귀 시 시뮬 폭주 방지

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/** 구름 id → 비주얼 스타일. 플레이어는 시작 화면에서 고른 것, 봇은 id 시드로 자동 생성. */
const styleCache = new Map<number, CloudStyle>();
function getStyle(id: number): CloudStyle {
  let style = styleCache.get(id);
  if (!style) {
    style = generateCloudStyle({ seed: id * 2654435761, lobeCount: 5, fluff: 1 });
    styleCache.set(id, style);
  }
  return style;
}

async function start(): Promise<void> {
  const choice = await showStartScreen();
  styleCache.set(PLAYER_ID, choice.style);

  const state = createInitialState(Date.now() >>> 0, BOT_COUNT, choice.polarity); // 시드는 core 밖(여기)에서만 생성
  const controls = new Controls(document.body);
  const camera = new Camera();

  let prevPositions = new Map<number, Vec2>();
  let last = performance.now();
  let accumulator = 0;

  function frame(now: number): void {
    accumulator = Math.min(accumulator + (now - last) / 1000, MAX_FRAME_SECONDS);
    last = now;

    while (accumulator >= DT) {
      prevPositions = new Map(state.clouds.map((c) => [c.id, { ...c.pos }]));
      const inputs = {
        ...computeBotInputs(state),
        [PLAYER_ID]: { dir: controls.currentDir(), swap: controls.consumeSwap() },
      };
      simulate(state, inputs, DT);
      accumulator -= DT;
    }

    render(ctx, canvas, state, prevPositions, accumulator / DT, camera, PLAYER_ID, getStyle, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
void start();
```

- [ ] **Step 5: core 테스트 확인 후 커밋**

Run: `pnpm --filter @cloudwar/core test`
Expected: PASS. (클라 typecheck는 Task 11에서 render 시그니처 확장 후 통과 — 위 Step 3 주의사항 참조.)

```bash
git add packages/client
git commit -m "feat(client): 극성 선택·스왑 입력·봇 매치 부팅

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: 클라 — 극성 비주얼 · 보호막 · HUD

**Files:**
- Modify: `packages/client/src/render.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 10의 main/startScreen 호출부, core의 `SWAP_COOLDOWN_TICKS`, `RESPAWN_TICKS`, `TICK_RATE`, `isAlive`
- Produces:
  - `drawCloud(ctx, center, radius, style, timeSec, polarity: Polarity, shielded: boolean)` — 극성 틴트(+: 따뜻한 톤, −: 차가운 톤), 보호막이면 점선 버블, 구름 위 극성 배지
  - `render(...)` 기존 9개 인자 시그니처 유지 — 죽은 구름 스킵, HUD에 극성·스왑 쿨다운 바·생존 수, 플레이어 사망 시 중앙 "부활까지 N초" 오버레이

- [ ] **Step 1: render.ts 전체 교체**

`packages/client/src/render.ts`:
```ts
import type { GameState, Polarity, Vec2 } from '@cloudwar/core';
import {
  cloudRadius,
  isAlive,
  SWAP_COOLDOWN_TICKS,
  TICK_RATE,
  VAPOR_RADIUS,
  WORLD_SIZE,
} from '@cloudwar/core';
import type { Camera } from './camera';
import type { CloudStyle } from './cloudStyle';

const GRID_STEP = 200;

/** 극성별 구름 틴트·배지 색 */
const TINT = {
  1: { mid: 'rgba(255, 249, 235, 0.97)', edge: 'rgba(244, 224, 178, 0.95)', badge: '#c9962e', symbol: '+' },
  '-1': { mid: 'rgba(238, 244, 255, 0.97)', edge: 'rgba(198, 214, 246, 0.95)', badge: '#3b62c4', symbol: '−' },
} as const;

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  prevPositions: Map<number, Vec2>,
  alpha: number,
  camera: Camera,
  playerId: number,
  getStyle: (id: number) => CloudStyle,
  timeSec: number,
): void {
  const player = state.clouds.find((c) => c.id === playerId);
  if (player && isAlive(player)) {
    camera.follow(interpolate(player.id, player.pos, prevPositions, alpha));
  }

  // 하늘 배경
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#a5cfee');
  sky.addColorStop(1, '#7fb0d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGridAndBounds(ctx, canvas, camera);

  // 수증기
  for (const vapor of state.vapors) {
    const s = camera.worldToScreen(vapor.pos, canvas);
    if (!onScreen(s, canvas, VAPOR_RADIUS * 3)) continue;
    drawVapor(ctx, s, vapor.id, timeSec);
  }

  // 구름 (죽은 구름은 그리지 않음)
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const pos = interpolate(cloud.id, cloud.pos, prevPositions, alpha);
    const s = camera.worldToScreen(pos, canvas);
    drawCloud(ctx, s, cloudRadius(cloud.mass), getStyle(cloud.id), timeSec, cloud.polarity, cloud.shieldTicks > 0);
  }

  drawHud(ctx, canvas, state, playerId);
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  playerId: number,
): void {
  const player = state.clouds.find((c) => c.id === playerId);
  if (!player) return;
  const tint = TINT[player.polarity === 1 ? 1 : '-1'];
  const aliveCount = state.clouds.filter(isAlive).length;

  ctx.fillStyle = '#1e3a52';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`질량 ${Math.round(player.mass)}`, 16, 28);
  ctx.fillStyle = tint.badge;
  ctx.fillText(`극성 ${tint.symbol}`, 16, 52);
  ctx.fillStyle = '#1e3a52';
  ctx.fillText(`생존 ${aliveCount}/${state.clouds.length}`, 16, 76);

  // 스왑 쿨다운 바 (E/Space)
  const barW = 120;
  const ready = player.swapCooldown === 0;
  const frac = 1 - player.swapCooldown / SWAP_COOLDOWN_TICKS;
  ctx.fillStyle = 'rgba(30, 58, 82, 0.25)';
  ctx.fillRect(16, 88, barW, 8);
  ctx.fillStyle = ready ? '#3d7ab8' : 'rgba(61, 122, 184, 0.6)';
  ctx.fillRect(16, 88, barW * frac, 8);
  ctx.fillStyle = '#1e3a52';
  ctx.font = '12px sans-serif';
  ctx.fillText(ready ? '스왑 준비됨 (E/Space)' : '스왑 충전 중…', 16 + barW + 8, 96);

  // 플레이어 사망 오버레이
  if (!isAlive(player)) {
    const secondsLeft = Math.ceil(player.respawnTicks / TICK_RATE);
    ctx.fillStyle = 'rgba(30, 58, 82, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('격추!', canvas.width / 2, canvas.height / 2 - 16);
    ctx.font = '20px sans-serif';
    ctx.fillText(`부활까지 ${secondsLeft}초`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.textAlign = 'left';
  }
}

/** 이전 틱 위치와 현재 위치를 alpha(0~1)로 보간 */
function interpolate(id: number, curr: Vec2, prev: Map<number, Vec2>, alpha: number): Vec2 {
  const p = prev.get(id);
  if (!p) return curr;
  return { x: p.x + (curr.x - p.x) * alpha, y: p.y + (curr.y - p.y) * alpha };
}

function onScreen(s: Vec2, canvas: HTMLCanvasElement, margin: number): boolean {
  return (
    s.x > -margin && s.x < canvas.width + margin && s.y > -margin && s.y < canvas.height + margin
  );
}

function drawGridAndBounds(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camera: Camera,
): void {
  const left = camera.pos.x - canvas.width / 2;
  const top = camera.pos.y - canvas.height / 2;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let x = Math.max(0, Math.floor(left / GRID_STEP) * GRID_STEP); x <= Math.min(WORLD_SIZE, left + canvas.width); x += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(x - left, 0);
    ctx.lineTo(x - left, canvas.height);
    ctx.stroke();
  }
  for (let y = Math.max(0, Math.floor(top / GRID_STEP) * GRID_STEP); y <= Math.min(WORLD_SIZE, top + canvas.height); y += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(0, y - top);
    ctx.lineTo(canvas.width, y - top);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(30, 58, 82, 0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(-left, -top, WORLD_SIZE, WORLD_SIZE);
}

function drawVapor(ctx: CanvasRenderingContext2D, s: Vec2, id: number, timeSec: number): void {
  const bob = Math.sin(timeSec * 2 + id * 1.7) * 2;
  const r = VAPOR_RADIUS + (id % 3);
  const g = ctx.createRadialGradient(s.x, s.y + bob, 0, s.x, s.y + bob, r * 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s.x, s.y + bob, r * 2, 0, Math.PI * 2);
  ctx.fill();
}

/** 극성 틴트가 적용된 뭉게구름. 시작 화면 미리보기와 인게임이 공유. */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  style: CloudStyle,
  timeSec: number,
  polarity: Polarity,
  shielded: boolean,
): void {
  const tint = TINT[polarity === 1 ? 1 : '-1'];

  // 밑면 그림자
  ctx.fillStyle = 'rgba(110, 150, 190, 0.22)';
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + radius * 0.62, radius * 0.9, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 본체 — 흰색 → 극성 틴트 그라디언트
  const g = ctx.createRadialGradient(
    center.x,
    center.y - radius * 0.5,
    radius * 0.15,
    center.x,
    center.y + radius * 0.2,
    radius * 1.7,
  );
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.7, tint.mid);
  g.addColorStop(1, tint.edge);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (const l of style.lobes) {
    const wobble = 1 + Math.sin(timeSec * 1.6 + l.phase) * 0.05;
    const lx = center.x + l.dx * radius;
    const ly = center.y + l.dy * radius;
    const lr = Math.max(1, l.r * radius * wobble);
    ctx.moveTo(lx + lr, ly);
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  }
  ctx.fill();

  // 극성 배지 (구름 위)
  const badgeR = Math.max(9, radius * 0.18);
  const bx = center.x;
  const by = center.y - radius * 1.05;
  ctx.fillStyle = tint.badge;
  ctx.beginPath();
  ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(badgeR * 1.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tint.symbol, bx, by + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 스폰 보호막 — 점선 버블
  if (shielded) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + Math.sin(timeSec * 5) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
```

- [ ] **Step 2: typecheck 확인**

Run: `pnpm typecheck`
Expected: core·client 모두 PASS — Task 10에서 깨졌던 클라 typecheck가 여기서 복구된다.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/render.ts
git commit -m "feat(client): 극성 틴트·배지·보호막 버블·전투 HUD·사망 오버레이

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: 클라 — 이펙트 (번개·흡수·사망·스왑·화면 흔들림)

**Files:**
- Create: `packages/client/src/effects.ts`
- Modify: `packages/client/src/camera.ts` (shake offset)
- Modify: `packages/client/src/main.ts` (이벤트 소비 배선 — 아래 diff 부분만)
- Modify: `packages/client/src/render.ts` (render 마지막에 effects draw 호출은 하지 않음 — main에서 별도 호출)

**Interfaces:**
- Consumes: core의 `GameEvent`, `GameState`, Task 10 main 구조
- Produces: `EffectsManager` — `add(ev: GameEvent, state: GameState, playerId: number)`, `update(dt: number)`, `draw(ctx, canvas, camera)`, `shakeOffset(): Vec2`. main은 시뮬 스텝마다 `state.events`를 add하고, 프레임마다 update → render → draw 순으로 호출, `camera.offset = effects.shakeOffset()`.

- [ ] **Step 1: camera.ts 전체 교체**

`packages/client/src/camera.ts`:
```ts
import type { Vec2 } from '@cloudwar/core';

/** 플레이어 구름을 따라가는 카메라. offset은 화면 흔들림용 (렌더 전용). */
export class Camera {
  pos: Vec2 = { x: 0, y: 0 };
  offset: Vec2 = { x: 0, y: 0 };

  follow(target: Vec2): void {
    this.pos = { x: target.x, y: target.y };
  }

  worldToScreen(p: Vec2, canvas: HTMLCanvasElement): Vec2 {
    return {
      x: p.x - this.pos.x - this.offset.x + canvas.width / 2,
      y: p.y - this.pos.y - this.offset.y + canvas.height / 2,
    };
  }
}
```

- [ ] **Step 2: effects.ts 작성**

`packages/client/src/effects.ts`:
```ts
import type { GameEvent, GameState, Vec2 } from '@cloudwar/core';
import { cloudRadius } from '@cloudwar/core';
import type { Camera } from './camera';

interface LightningFx { kind: 'lightning'; a: Vec2; b: Vec2; jitter: number[]; ttl: number; age: number; }
interface RingFx { kind: 'ring'; pos: Vec2; color: string; maxR: number; ttl: number; age: number; }
interface PuffFx { kind: 'puff'; pos: Vec2; angles: number[]; ttl: number; age: number; }
type Fx = LightningFx | RingFx | PuffFx;

const SHAKE_DURATION = 0.25;
const SHAKE_AMP = 7;

/** state.events를 화면 이펙트로 변환·수명 관리. 렌더 전용 — 시뮬레이션에 영향 없음. */
export class EffectsManager {
  private fx: Fx[] = [];
  private shakeTime = 0;

  add(ev: GameEvent, state: GameState, playerId: number): void {
    if (ev.type === 'lightning') {
      const a = state.clouds.find((c) => c.id === ev.cloudId);
      const b = state.clouds.find((c) => c.id === ev.otherId);
      if (a && b) {
        // 볼트 지그재그 오프셋 (렌더 전용이라 Math.random 허용)
        const jitter = Array.from({ length: 4 }, () => (Math.random() - 0.5) * 40);
        this.fx.push({ kind: 'lightning', a: { ...a.pos }, b: { ...b.pos }, jitter, ttl: 0.18, age: 0 });
      }
      if (ev.cloudId === playerId || ev.otherId === playerId) this.shakeTime = SHAKE_DURATION;
    } else if (ev.type === 'absorb') {
      this.fx.push({ kind: 'ring', pos: { ...ev.pos }, color: 'rgba(255, 255, 255, 0.9)', maxR: 90, ttl: 0.4, age: 0 });
    } else if (ev.type === 'swap') {
      const c = state.clouds.find((cl) => cl.id === ev.cloudId);
      const r = c ? cloudRadius(c.mass) : 60;
      this.fx.push({ kind: 'ring', pos: { ...ev.pos }, color: 'rgba(120, 180, 255, 0.9)', maxR: r * 1.8, ttl: 0.35, age: 0 });
    } else if (ev.type === 'death') {
      const angles = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2);
      this.fx.push({ kind: 'puff', pos: { ...ev.pos }, angles, ttl: 0.6, age: 0 });
    } else if (ev.type === 'respawn' && ev.cloudId === playerId) {
      this.fx.push({ kind: 'ring', pos: { ...ev.pos }, color: 'rgba(255, 255, 255, 0.7)', maxR: 120, ttl: 0.5, age: 0 });
    }
  }

  update(dt: number): void {
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.ttl);
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
  }

  shakeOffset(): Vec2 {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const amp = SHAKE_AMP * (this.shakeTime / SHAKE_DURATION);
    const t = this.shakeTime * 60;
    return { x: Math.sin(t * 1.3) * amp, y: Math.cos(t * 1.7) * amp };
  }

  draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, camera: Camera): void {
    for (const f of this.fx) {
      const progress = f.age / f.ttl;
      if (f.kind === 'lightning') {
        const a = camera.worldToScreen(f.a, canvas);
        const b = camera.worldToScreen(f.b, canvas);
        ctx.strokeStyle = `rgba(255, 255, 160, ${1 - progress})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        for (let i = 0; i < f.jitter.length; i++) {
          const t = (i + 1) / (f.jitter.length + 1);
          const mx = a.x + (b.x - a.x) * t;
          const my = a.y + (b.y - a.y) * t + f.jitter[i]!;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (f.kind === 'ring') {
        const s = camera.worldToScreen(f.pos, canvas);
        ctx.strokeStyle = f.color.replace(/[\d.]+\)$/, `${(1 - progress) * 0.9})`);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, f.maxR * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const s = camera.worldToScreen(f.pos, canvas);
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.8})`;
        for (const angle of f.angles) {
          const d = 20 + progress * 60;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(angle) * d, s.y + Math.sin(angle) * d, 10 * (1 - progress) + 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
```

- [ ] **Step 3: main.ts 배선**

`packages/client/src/main.ts`에서:

import 블록에 추가:
```ts
import { EffectsManager } from './effects';
```
`start()` 안, `const camera = new Camera();` 다음 줄에 추가:
```ts
  const effects = new EffectsManager();
```
while 루프의 `simulate(state, inputs, DT);` 다음 줄에 추가:
```ts
      for (const ev of state.events) effects.add(ev, state, PLAYER_ID);
```
`frame` 함수에서 render 호출 부분을 다음으로 교체 (update→shake→render→draw 순서):
```ts
    effects.update((now - lastFrame) / 1000);
    camera.offset = effects.shakeOffset();
    render(ctx, canvas, state, prevPositions, accumulator / DT, camera, PLAYER_ID, getStyle, now / 1000);
    effects.draw(ctx, canvas, camera);
```
`let last = performance.now();` 아래에 프레임 시간 추적 변수 추가:
```ts
  let lastFrame = performance.now();
```
그리고 `frame` 함수 마지막(`requestAnimationFrame(frame);` 바로 앞)에:
```ts
    lastFrame = now;
```
(effects.update의 dt는 프레임 간격 — accumulator 소진과 무관하게 이펙트는 실시간으로 흐른다.)

- [ ] **Step 4: typecheck + 수동 QA**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm dev` (백그라운드) 후 브라우저/QA 도구로:
- [ ] 시작 화면에서 극성(＋/－) 선택 → 인게임 구름 틴트가 선택대로
- [ ] E 또는 Space로 스왑 → 틴트 반전 + 파란 링 + HUD 쿨다운 바 감소 시작
- [ ] 봇에게 접근: 같은 극성 큰 봇에게 먹히면 "격추! 부활까지 N초" 오버레이 → 부활 시 점선 보호막
- [ ] 반대 극성 봇과 겹치면 노란 지그재그 번개 + 화면 흔들림 + 양쪽 질량 감소
- [ ] 콘솔 에러 없음

확인 후 dev 서버 종료.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src
git commit -m "feat(client): 전투 이펙트 — 번개 볼트·흡수 링·사망 퍼프·화면 흔들림

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: M3 마무리 — 통합 시뮬 테스트 + TODOS 갱신

**Files:**
- Test: `packages/core/test/integration.test.ts` (신규)
- Modify: `TODOS.md`

**Interfaces:**
- Consumes: 전체 core API
- Produces: 8구름 봇 매치 3000틱(150초) 헤드리스 완주 불변식 테스트, TODOS의 M3 체크 + 해소된 후속 메모 정리.

- [ ] **Step 1: 통합 테스트 작성**

`packages/core/test/integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { computeBotInputs } from '../src/bots';
import { DT, MIN_MASS, WORLD_SIZE } from '../src/constants';
import type { GameEventType } from '../src/types';

describe('통합 — 봇 매치 완주', () => {
  it('8구름 3000틱을 불변식 위반 없이 완주한다', () => {
    const state = createInitialState(2026, 7);
    const eventCounts = new Map<GameEventType, number>();
    for (let t = 0; t < 3000; t++) {
      const angle = (t % 60) * (Math.PI / 30);
      simulate(
        state,
        { ...computeBotInputs(state), 1: { dir: { x: Math.cos(angle), y: Math.sin(angle) }, swap: t % 173 === 0 } },
        DT,
      );
      for (const ev of state.events) {
        eventCounts.set(ev.type, (eventCounts.get(ev.type) ?? 0) + 1);
      }
      // 불변식: 구름 수 불변, 좌표·질량 유한, 생존자 질량은 MIN_MASS 이상
      expect(state.clouds).toHaveLength(8);
      for (const c of state.clouds) {
        expect(Number.isFinite(c.pos.x)).toBe(true);
        expect(Number.isFinite(c.pos.y)).toBe(true);
        expect(Number.isFinite(c.mass)).toBe(true);
        expect(c.pos.x).toBeGreaterThanOrEqual(0);
        expect(c.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
        if (c.respawnTicks === 0) expect(c.mass).toBeGreaterThanOrEqual(MIN_MASS * 0.5);
      }
    }
    // 수증기 id 유일성 (전투 물방울 포함)
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 150초 동안 뭔가는 일어났어야 한다
    const total = [...eventCounts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});
```
(주의: 생존자 질량 하한을 `MIN_MASS * 0.5`로 느슨하게 둔 이유 — 같은 틱 안에서 번개 드레인 직후 applyDeaths 전 순간이 아니라, 틱 종료 시점엔 죽었거나 MIN_MASS 근처여야 하기 때문. 정확한 하한이 아니라 "폭주 없음" 불변식이다.)

- [ ] **Step 2: 전체 검증**

Run: `pnpm test && pnpm typecheck`
Expected: core 전체 PASS (통합 테스트 포함), 타입 에러 없음. 통합 테스트가 실패하면 해당 불변식 위반을 고치지 말고 BLOCKED 보고 (전투 수식 버그일 가능성).

- [ ] **Step 3: TODOS.md 갱신**

M3 항목을 체크로 바꾸고, 해소된 서브 불릿 2개(흡수 우선순위 — Task 7로 해소, MIN_MASS — Task 2로 해소)를 제거한다. M5의 직렬화 왕복 서브 불릿도 제거한다 (Task 9로 선반영). M3 줄은:
```markdown
- [x] M3 — 극성 전투 + 봇: 흡수/번개/스왑 + 봇 AI. 봇 모드 완성 (재미 검증 지점). ※ 플레이테스트 피드백("공격/방어를 원함")으로 M2보다 앞당김 (2026-07-08)
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/test/integration.test.ts TODOS.md
git commit -m "test(core): 봇 매치 3000틱 통합 불변식 + M3 완료 처리

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: 재미 검증 안내**

M3는 스펙이 "게임의 재미가 처음 검증되는 지점"으로 지정한 마일스톤이다. 사용자에게 `pnpm dev` 플레이를 안내하고 다음 피드백을 요청한다: 봇 난이도 체감, 스왑 심리전이 작동하는지, 번개 소모전의 긴장감, 수치 튜닝(8%/15%/1.25배) 필요 여부.
