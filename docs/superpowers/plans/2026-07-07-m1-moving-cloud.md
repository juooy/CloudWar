# M1 "움직이는 구름" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pnpm 모노레포 + 순수 시뮬레이션 core + Vite/Canvas 클라이언트로, 마우스로 구름 1개를 조작해 수증기를 먹고 성장하는 플레이 가능한 프로토타입을 만든다.

**Architecture:** 게임 로직은 `packages/core`의 순수 TypeScript 모듈(`simulate(state, inputs, dt)`, 시드 RNG, 의존성 0)에만 존재한다. `packages/client`는 core를 직접 구동(고정 20tick)하고 Canvas 2D로 60fps 보간 렌더링한다. 이 분리가 이후 M5 온라인 멀티에서 서버가 같은 core를 돌리는 기반이 된다.

**Tech Stack:** Node 24, pnpm workspace, TypeScript(strict), Vitest(core 테스트), Vite(클라 dev 서버), Canvas 2D.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-07-07-cloudwar-design.md` (M1 범위만 구현 — 극성/비/타일은 이번 계획에 없음)
- `packages/core`는 런타임 의존성 0. DOM·네트워크·`Math.random()`·`Date` 사용 금지 (결정론 규율). RNG는 state에 포함된 시드 RNG만 사용.
- 고정 타임스텝 20 tick/초 (`DT = 1/20`). 렌더링 보간은 클라 책임.
- 모든 밸런스 수치는 `packages/core/src/constants.ts`에만 존재 (매직 넘버 금지).
- TypeScript strict 모드, `noUncheckedIndexedAccess` 활성.
- 커밋 메시지는 한국어, 말미에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 셸은 Git Bash 기준 (Windows). 작업 디렉토리: `C:\Users\juooy\Documents\workspace\CloudWar`.

---

### Task 1: pnpm 설치 + 모노레포 스캐폴드

**Files:**
- Create: `.gitignore`
- Create: `package.json` (루트)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `pnpm install` / `pnpm test` / `pnpm typecheck`가 동작하는 워크스페이스. `@cloudwar/core` 패키지 골격 (엔트리 `src/index.ts`).

- [ ] **Step 1: pnpm 설치 확인/설치**

Run: `pnpm --version || npm install -g pnpm`
Expected: 버전 출력 (예: `10.x.x`). 설치 후에도 명령을 다시 실행해 버전이 나오는지 확인.

- [ ] **Step 2: 루트 설정 파일 작성**

`.gitignore`:
```gitignore
node_modules/
dist/
*.local
.DS_Store
```

`package.json`:
```json
{
  "name": "cloudwar",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @cloudwar/client dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: core 패키지 골격 작성**

`packages/core/package.json`:
```json
{
  "name": "@cloudwar/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"]
  },
  "include": ["src", "test"]
}
```

`packages/core/src/index.ts`:
```ts
// @cloudwar/core 공개 API. 태스크가 진행되며 export가 추가된다.
export {};
```

- [ ] **Step 4: 설치 및 검증**

Run: `pnpm install && pnpm test && pnpm typecheck`
Expected: 설치 성공, vitest가 "No test files found" 상태로 통과(`--passWithNoTests`), tsc 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json packages/core
git commit -m "chore: pnpm 모노레포 스캐폴드 + core 패키지 골격

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 시드 RNG

**Files:**
- Create: `packages/core/src/rng.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/rng.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `rand(state: { rngState: number }): number` — state의 `rngState`를 전진(변이)시키고 `[0, 1)` 값을 반환. mulberry32 알고리즘.

- [ ] **Step 1: Write the failing test**

`packages/core/test/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rand } from '../src/rng';

describe('rand (시드 RNG)', () => {
  it('같은 시드는 같은 시퀀스를 만든다', () => {
    const a = { rngState: 42 };
    const b = { rngState: 42 };
    const seqA = [rand(a), rand(a), rand(a), rand(a), rand(a)];
    const seqB = [rand(b), rand(b), rand(b), rand(b), rand(b)];
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 시퀀스를 만든다', () => {
    const a = { rngState: 42 };
    const b = { rngState: 43 };
    expect(rand(a)).not.toBe(rand(b));
  });

  it('값은 항상 [0, 1) 범위다', () => {
    const s = { rngState: 7 };
    for (let i = 0; i < 1000; i++) {
      const v = rand(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('호출할 때마다 rngState가 변한다 (state 전진)', () => {
    const s = { rngState: 42 };
    rand(s);
    expect(s.rngState).not.toBe(42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — `Cannot find module '../src/rng'` 또는 유사 에러.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/rng.ts`:
```ts
/**
 * mulberry32 시드 RNG. state.rngState를 전진시키고 [0, 1) 값을 반환한다.
 * core 전체에서 Math.random() 대신 이것만 사용한다 (결정론 규율).
 */
export function rand(state: { rngState: number }): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

`packages/core/src/index.ts` (전체 교체):
```ts
export * from './rng';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 4개 테스트 PASS, 타입 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rng.ts packages/core/src/index.ts packages/core/test/rng.test.ts
git commit -m "feat(core): mulberry32 시드 RNG — 결정론 시뮬레이션 기반

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 타입 · 상수 · 구름 공식 · 초기 상태

**Files:**
- Create: `packages/core/src/constants.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/cloud.ts`
- Create: `packages/core/src/state.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/cloud.test.ts`
- Test: `packages/core/test/state.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - 상수: `TICK_RATE=20`, `DT=1/20`, `WORLD_SIZE=4000`, `START_MASS=100`, `VAPOR_MASS=5`, `VAPOR_MAX=200`, `VAPOR_SPAWN_PER_TICK=1`, `VAPOR_RADIUS=6`, `RADIUS_SCALE=4`, `BASE_SPEED=300`, `SPEED_EXPONENT=0.3`
  - 타입: `Vec2 {x,y}`, `Cloud {id, pos, mass}`, `Vapor {id, pos}`, `PlayerInput {dir: Vec2}`, `Inputs = Record<number, PlayerInput | undefined>`, `GameState {tick, rngState, nextEntityId, clouds, vapors}`
  - `cloudRadius(mass: number): number` — `RADIUS_SCALE * sqrt(mass)`
  - `cloudSpeed(mass: number): number` — `BASE_SPEED * (START_MASS / mass) ** SPEED_EXPONENT`
  - `createInitialState(seed: number): GameState` — 월드 중앙에 질량 `START_MASS`의 구름(id=1) 1개, 수증기 없음, `nextEntityId=2`

- [ ] **Step 1: Write the failing tests**

`packages/core/test/cloud.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cloudRadius, cloudSpeed } from '../src/cloud';
import { RADIUS_SCALE, BASE_SPEED, START_MASS } from '../src/constants';

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
});
```

`packages/core/test/state.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state';
import { START_MASS, WORLD_SIZE } from '../src/constants';

describe('createInitialState', () => {
  it('월드 중앙에 시작 질량의 구름 1개를 만든다', () => {
    const state = createInitialState(42);
    expect(state.tick).toBe(0);
    expect(state.rngState).toBe(42);
    expect(state.clouds).toHaveLength(1);
    expect(state.clouds[0]).toEqual({
      id: 1,
      pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      mass: START_MASS,
    });
    expect(state.vapors).toHaveLength(0);
    expect(state.nextEntityId).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — `Cannot find module '../src/cloud'` 등.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/constants.ts`:
```ts
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
```

`packages/core/src/types.ts`:
```ts
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
```

`packages/core/src/cloud.ts`:
```ts
import { BASE_SPEED, RADIUS_SCALE, SPEED_EXPONENT, START_MASS } from './constants';

export function cloudRadius(mass: number): number {
  return RADIUS_SCALE * Math.sqrt(mass);
}

export function cloudSpeed(mass: number): number {
  return BASE_SPEED * (START_MASS / mass) ** SPEED_EXPONENT;
}
```

`packages/core/src/state.ts`:
```ts
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
```

`packages/core/src/index.ts` (전체 교체):
```ts
export * from './constants';
export * from './types';
export * from './rng';
export * from './cloud';
export * from './state';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS, 타입 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): 게임 타입·상수·구름 공식·초기 상태

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: simulate — 구름 이동

**Files:**
- Create: `packages/core/src/simulate.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/movement.test.ts`

**Interfaces:**
- Consumes: Task 3의 타입·상수·`cloudRadius`/`cloudSpeed`/`createInitialState`
- Produces: `simulate(state: GameState, inputs: Inputs, dt: number): GameState` — 전달된 state를 **제자리 변이**하고 같은 객체를 반환. 외부 I/O 없음(순수성은 "외부 부수효과 없음 + state 내장 RNG"로 정의). 이 태스크 범위: 입력 방향 정규화 이동, 월드 경계 클램프, `tick` 증가.

- [ ] **Step 1: Write the failing test**

`packages/core/test/movement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { cloudRadius } from '../src/cloud';
import { DT, WORLD_SIZE, START_MASS, BASE_SPEED } from '../src/constants';

describe('구름 이동', () => {
  it('입력 방향으로 speed*dt 만큼 이동한다', () => {
    const state = createInitialState(1);
    simulate(state, { 1: { dir: { x: 1, y: 0 } } }, DT);
    // START_MASS에서 속도는 BASE_SPEED(300) → 300 * 0.05 = 15
    expect(state.clouds[0]!.pos.x).toBeCloseTo(WORLD_SIZE / 2 + BASE_SPEED * DT);
    expect(state.clouds[0]!.pos.y).toBeCloseTo(WORLD_SIZE / 2);
  });

  it('대각선 입력은 정규화된다 (크기가 커도 속도 동일)', () => {
    const state = createInitialState(1);
    simulate(state, { 1: { dir: { x: 30, y: 40 } } }, DT); // 길이 50 → (0.6, 0.8)
    expect(state.clouds[0]!.pos.x).toBeCloseTo(WORLD_SIZE / 2 + BASE_SPEED * DT * 0.6);
    expect(state.clouds[0]!.pos.y).toBeCloseTo(WORLD_SIZE / 2 + BASE_SPEED * DT * 0.8);
  });

  it('입력이 없거나 영벡터면 움직이지 않는다', () => {
    const state = createInitialState(1);
    simulate(state, {}, DT);
    simulate(state, { 1: { dir: { x: 0, y: 0 } } }, DT);
    expect(state.clouds[0]!.pos).toEqual({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 });
  });

  it('월드 경계에서 반지름만큼 안쪽으로 클램프된다', () => {
    const state = createInitialState(1);
    state.clouds[0]!.pos = { x: 10, y: 10 }; // 경계 밖 근처로 강제 이동
    simulate(state, { 1: { dir: { x: -1, y: -1 } } }, DT);
    const r = cloudRadius(START_MASS);
    expect(state.clouds[0]!.pos.x).toBe(r);
    expect(state.clouds[0]!.pos.y).toBe(r);
  });

  it('틱 카운터가 증가하고 같은 state 객체를 반환한다', () => {
    const state = createInitialState(1);
    const returned = simulate(state, {}, DT);
    expect(returned).toBe(state);
    expect(state.tick).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — `Cannot find module '../src/simulate'`.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/simulate.ts`:
```ts
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
```

`packages/core/src/index.ts` (전체 교체):
```ts
export * from './constants';
export * from './types';
export * from './rng';
export * from './cloud';
export * from './state';
export * from './simulate';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): simulate 틱 — 입력 정규화 이동과 월드 경계 클램프

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: simulate — 수증기 스폰과 흡수

**Files:**
- Modify: `packages/core/src/simulate.ts`
- Test: `packages/core/test/vapor.test.ts`

**Interfaces:**
- Consumes: Task 4의 `simulate`, Task 2의 `rand`, Task 3의 상수·타입
- Produces: `simulate`가 매 틱 (1) 구름 중심-수증기 중심 거리 < 구름 반지름이면 흡수(수증기 제거, 질량 `+VAPOR_MASS`), (2) `VAPOR_MAX` 미만이면 `VAPOR_SPAWN_PER_TICK`개를 RNG 위치에 스폰. 처리 순서: 이동 → 흡수 → 스폰 → tick 증가.

- [ ] **Step 1: Write the failing test**

`packages/core/test/vapor.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import {
  DT,
  WORLD_SIZE,
  START_MASS,
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
} from '../src/constants';

describe('수증기 스폰', () => {
  it('틱마다 VAPOR_SPAWN_PER_TICK개씩 VAPOR_MAX까지 스폰된다', () => {
    const state = createInitialState(42);
    simulate(state, {}, DT);
    expect(state.vapors).toHaveLength(VAPOR_SPAWN_PER_TICK);
    for (let i = 0; i < VAPOR_MAX * 2; i++) simulate(state, {}, DT);
    expect(state.vapors.length).toBeLessThanOrEqual(VAPOR_MAX);
  });

  it('스폰 위치는 월드 범위 안이다', () => {
    const state = createInitialState(42);
    for (let i = 0; i < 100; i++) simulate(state, {}, DT);
    for (const v of state.vapors) {
      expect(v.pos.x).toBeGreaterThanOrEqual(0);
      expect(v.pos.x).toBeLessThanOrEqual(WORLD_SIZE);
      expect(v.pos.y).toBeGreaterThanOrEqual(0);
      expect(v.pos.y).toBeLessThanOrEqual(WORLD_SIZE);
    }
  });

  it('수증기 id는 중복되지 않는다', () => {
    const state = createInitialState(42);
    for (let i = 0; i < 50; i++) simulate(state, {}, DT);
    const ids = state.vapors.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('수증기 흡수', () => {
  it('구름 반지름 안의 수증기는 흡수되어 질량이 늘어난다', () => {
    const state = createInitialState(42);
    const c = state.clouds[0]!;
    // 반지름(40) 안쪽과 바깥쪽에 수증기를 수동 배치
    state.vapors = [
      { id: 100, pos: { x: c.pos.x + 30, y: c.pos.y } }, // 거리 30 < 40 → 흡수
      { id: 101, pos: { x: c.pos.x + 100, y: c.pos.y } }, // 거리 100 → 유지
    ];
    simulate(state, {}, DT);
    expect(c.mass).toBe(START_MASS + VAPOR_MASS);
    expect(state.vapors.some((v) => v.id === 100)).toBe(false);
    expect(state.vapors.some((v) => v.id === 101)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cloudwar/core test`
Expected: FAIL — 스폰/흡수 미구현으로 `vapors` 길이 0 등 단언 실패.

- [ ] **Step 3: Write implementation**

`packages/core/src/simulate.ts` (전체 교체):
```ts
import {
  VAPOR_MASS,
  VAPOR_MAX,
  VAPOR_SPAWN_PER_TICK,
  WORLD_SIZE,
} from './constants';
import { cloudRadius, cloudSpeed } from './cloud';
import { rand } from './rng';
import type { GameState, Inputs } from './types';

/**
 * 고정 타임스텝 시뮬레이션 틱. 전달된 state를 제자리 변이하고 반환한다.
 * 외부 부수효과 없음 — 결정론은 state 내장 RNG로 보장된다.
 * 순서: 이동 → 흡수 → 스폰 → tick 증가.
 */
export function simulate(state: GameState, inputs: Inputs, dt: number): GameState {
  moveClouds(state, inputs, dt);
  absorbVapors(state);
  spawnVapors(state);
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

function absorbVapors(state: GameState): void {
  for (const cloud of state.clouds) {
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
    state.vapors.push({
      id: state.nextEntityId++,
      pos: {
        x: rand(state) * WORLD_SIZE,
        y: rand(state) * WORLD_SIZE,
      },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cloudwar/core test && pnpm typecheck`
Expected: 전체 PASS (기존 이동 테스트 포함 — 회귀 없음 확인).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/simulate.ts packages/core/test/vapor.test.ts
git commit -m "feat(core): 수증기 스폰·흡수 — 성장 루프 완성

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 결정론 보증 테스트

**Files:**
- Test: `packages/core/test/determinism.test.ts`

**Interfaces:**
- Consumes: Task 5까지의 전체 core API
- Produces: 회귀 방지막 — 이후 M2~M5에서 core를 고칠 때 결정론이 깨지면 이 테스트가 잡는다. 새 코드 없음(테스트 온리 태스크).

- [ ] **Step 1: Write the test**

`packages/core/test/determinism.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState } from '../src/state';
import { DT } from '../src/constants';
import type { Inputs } from '../src/types';

/** 틱 번호에 따라 방향이 바뀌는 스크립트 입력 (결정적) */
function scriptedInput(tick: number): Inputs {
  const angle = (tick % 40) * (Math.PI / 20);
  return { 1: { dir: { x: Math.cos(angle), y: Math.sin(angle) } } };
}

describe('결정론', () => {
  it('같은 시드 + 같은 입력 시퀀스 → 200틱 후 상태가 완전히 동일하다', () => {
    const a = createInitialState(12345);
    const b = createInitialState(12345);
    for (let t = 0; t < 200; t++) {
      simulate(a, scriptedInput(t), DT);
      simulate(b, scriptedInput(t), DT);
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
Expected: 전체 PASS. (이 테스트는 처음부터 통과해야 정상 — 실패하면 Task 2~5에 비결정 요소가 섞인 것이므로 원인을 고친다.)

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/determinism.test.ts
git commit -m "test(core): 결정론 보증 테스트 — 시드+입력 동일 시 상태 동일

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 클라이언트 스캐폴드 (Vite + Canvas)

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/index.html`
- Create: `packages/client/src/main.ts`

**Interfaces:**
- Consumes: `@cloudwar/core` (workspace 링크 — 아직 사용 안 함, 링크만 확인)
- Produces: `pnpm dev`로 뜨는 전체 화면 캔버스 (하늘색 배경). Task 8이 이 골격 위에 게임 루프를 얹는다. `main.ts`는 Task 8에서 전체 교체된다.

- [ ] **Step 1: 클라 패키지 작성**

`packages/client/package.json`:
```json
{
  "name": "@cloudwar/client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@cloudwar/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vite": "^7.0.0"
  }
}
```

`packages/client/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`packages/client/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CloudWar</title>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        overflow: hidden;
        background: #87b5d8;
      }
      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`packages/client/src/main.ts`:
```ts
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

ctx.fillStyle = '#87b5d8';
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

- [ ] **Step 2: 설치 및 dev 서버 확인**

Run: `pnpm install`
Expected: `@cloudwar/core`가 client에 workspace 링크됨. esbuild 빌드 스크립트 경고가 나오면 `pnpm approve-builds`로 esbuild를 승인하고 다시 `pnpm install`.

Run: `pnpm dev` (백그라운드 실행) 후 `http://localhost:5173` 접속
Expected: 하늘색 전체 화면 캔버스. 콘솔 에러 없음. 확인 후 dev 서버 종료.

- [ ] **Step 3: typecheck 확인**

Run: `pnpm typecheck`
Expected: core·client 모두 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add packages/client pnpm-lock.yaml
git commit -m "chore(client): Vite + Canvas 클라이언트 스캐폴드

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 게임 루프 — 입력·카메라·렌더

**Files:**
- Create: `packages/client/src/input.ts`
- Create: `packages/client/src/camera.ts`
- Create: `packages/client/src/render.ts`
- Modify: `packages/client/src/main.ts` (전체 교체)

**Interfaces:**
- Consumes: core의 `createInitialState`, `simulate`, `cloudRadius`, `DT`, `WORLD_SIZE`, `VAPOR_RADIUS`, 타입 `GameState`/`Vec2`
- Produces: 플레이 가능한 M1 — 마우스 방향으로 구름 이동, 수증기 흡수·성장, 카메라 추적, 질량 HUD. (클라 코드는 유닛 테스트 대상이 아님 — 수동 QA로 검증. 로직은 전부 core에 있고 core는 테스트됨.)

- [ ] **Step 1: 입력 모듈 작성**

`packages/client/src/input.ts`:
```ts
import type { Vec2 } from '@cloudwar/core';

const DEADZONE_PX = 24;

/** 마우스 위치 → 화면 중앙 기준 이동 방향. 창 밖이거나 데드존 안이면 {0,0}. */
export class MouseInput {
  private mouse: Vec2 | null = null;

  constructor(target: HTMLElement) {
    target.addEventListener('mousemove', (e: MouseEvent) => {
      this.mouse = { x: e.clientX, y: e.clientY };
    });
    target.addEventListener('mouseleave', () => {
      this.mouse = null;
    });
  }

  currentDir(): Vec2 {
    if (!this.mouse) return { x: 0, y: 0 };
    const dx = this.mouse.x - window.innerWidth / 2;
    const dy = this.mouse.y - window.innerHeight / 2;
    if (Math.hypot(dx, dy) < DEADZONE_PX) return { x: 0, y: 0 };
    return { x: dx, y: dy }; // 정규화는 simulate 책임
  }
}
```

- [ ] **Step 2: 카메라 모듈 작성**

`packages/client/src/camera.ts`:
```ts
import type { Vec2 } from '@cloudwar/core';

/** 플레이어 구름을 따라가는 카메라. 줌 없음(M1). */
export class Camera {
  pos: Vec2 = { x: 0, y: 0 };

  follow(target: Vec2): void {
    this.pos = { x: target.x, y: target.y };
  }

  worldToScreen(p: Vec2, canvas: HTMLCanvasElement): Vec2 {
    return {
      x: p.x - this.pos.x + canvas.width / 2,
      y: p.y - this.pos.y + canvas.height / 2,
    };
  }
}
```

- [ ] **Step 3: 렌더 모듈 작성**

`packages/client/src/render.ts`:
```ts
import type { GameState, Vec2 } from '@cloudwar/core';
import { cloudRadius, VAPOR_RADIUS, WORLD_SIZE } from '@cloudwar/core';
import type { Camera } from './camera';

const GRID_STEP = 200;

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  prevPositions: Map<number, Vec2>,
  alpha: number,
  camera: Camera,
  playerId: number,
): void {
  const player = state.clouds.find((c) => c.id === playerId);
  if (player) {
    camera.follow(interpolate(player.id, player.pos, prevPositions, alpha));
  }

  // 하늘 배경
  ctx.fillStyle = '#87b5d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGridAndBounds(ctx, canvas, camera);

  // 수증기
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  for (const vapor of state.vapors) {
    const s = camera.worldToScreen(vapor.pos, canvas);
    if (!onScreen(s, canvas, VAPOR_RADIUS * 2)) continue;
    ctx.beginPath();
    ctx.arc(s.x, s.y, VAPOR_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // 구름
  for (const cloud of state.clouds) {
    const pos = interpolate(cloud.id, cloud.pos, prevPositions, alpha);
    drawCloud(ctx, camera.worldToScreen(pos, canvas), cloudRadius(cloud.mass));
  }

  // HUD
  if (player) {
    ctx.fillStyle = '#1e3a52';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`질량 ${Math.round(player.mass)}`, 16, 28);
  }
}

/** 이전 틱 위치와 현재 위치를 alpha(0~1)로 보간 — 20tick 시뮬을 60fps처럼 보이게 */
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

  // 월드 경계
  ctx.strokeStyle = 'rgba(30, 58, 82, 0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(-left, -top, WORLD_SIZE, WORLD_SIZE);
}

/** 원 4개를 겹쳐 뭉게구름 실루엣을 만든다 */
function drawCloud(ctx: CanvasRenderingContext2D, center: Vec2, radius: number): void {
  const lobes = [
    { dx: 0, dy: 0.1, r: 1 },
    { dx: -0.55, dy: -0.2, r: 0.65 },
    { dx: 0.55, dy: -0.2, r: 0.65 },
    { dx: 0, dy: -0.4, r: 0.7 },
  ];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  for (const l of lobes) {
    ctx.moveTo(center.x + l.dx * radius + l.r * radius, center.y + l.dy * radius);
    ctx.arc(center.x + l.dx * radius, center.y + l.dy * radius, l.r * radius, 0, Math.PI * 2);
  }
  ctx.fill();
}
```

- [ ] **Step 4: 게임 루프 작성**

`packages/client/src/main.ts` (전체 교체):
```ts
import { createInitialState, simulate, DT } from '@cloudwar/core';
import type { Vec2 } from '@cloudwar/core';
import { MouseInput } from './input';
import { Camera } from './camera';
import { render } from './render';

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

const state = createInitialState(Date.now() >>> 0); // 시드는 core 밖(여기)에서만 생성
const input = new MouseInput(document.body);
const camera = new Camera();

let prevPositions = new Map<number, Vec2>();
let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  accumulator = Math.min(accumulator + (now - last) / 1000, MAX_FRAME_SECONDS);
  last = now;

  while (accumulator >= DT) {
    prevPositions = new Map(state.clouds.map((c) => [c.id, { ...c.pos }]));
    simulate(state, { [PLAYER_ID]: { dir: input.currentDir() } }, DT);
    accumulator -= DT;
  }

  render(ctx, canvas, state, prevPositions, accumulator / DT, camera, PLAYER_ID);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 5: typecheck 및 수동 QA**

Run: `pnpm typecheck`
Expected: 에러 없음.

Run: `pnpm dev` (백그라운드) 후 `http://localhost:5173` 접속. 수동 체크리스트:
- [ ] 구름이 마우스 방향으로 움직인다 (마우스가 화면 중앙 근처면 정지)
- [ ] 수증기(작은 흰 점)가 맵에 점점 늘어난다
- [ ] 수증기에 닿으면 사라지고 HUD 질량이 5씩 증가한다
- [ ] 질량이 커지면 구름이 커지고 눈에 띄게 느려진다
- [ ] 월드 경계(진한 테두리) 밖으로 나갈 수 없다
- [ ] 움직임이 부드럽다 (20tick 덜컥임이 보이면 보간 버그)

가능하면 브라우저 QA 도구(/qa 또는 /browse 스킬)로 스크린샷을 찍어 확인한다. 확인 후 dev 서버 종료.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src
git commit -m "feat(client): 게임 루프 — 마우스 조작·카메라 추적·구름 렌더·보간

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: M1 마무리 — 전체 검증 + TODOS 갱신

**Files:**
- Modify: `TODOS.md`

**Interfaces:**
- Consumes: Task 1~8 전체
- Produces: M1 완료 처리된 TODOS.md, 전체 그린 상태의 리포

- [ ] **Step 1: 전체 검증**

Run: `pnpm test && pnpm typecheck`
Expected: core 테스트 전체 PASS, 타입 에러 없음.

- [ ] **Step 2: TODOS.md 갱신**

`TODOS.md`의 M1 항목을 체크로 변경:
```markdown
- [x] M1 — 움직이는 구름: 모노레포 셋업 + core 골격 + 클라 렌더. 구름 1개 조작, 수증기 먹고 성장. "조작감이 재밌는가" 판단.
```
(항목을 "## 완료" 섹션으로 옮기지 말고 체크만 — 순서가 로드맵 역할을 하므로 유지)

- [ ] **Step 3: Commit**

```bash
git add TODOS.md
git commit -m "docs: M1 완료 — 움직이는 구름

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 조작감 보고**

사용자에게 `pnpm dev`로 직접 플레이해볼 것을 안내한다. M1의 목적은 "조작감이 재밌는가" 판단이므로, 사용자 피드백(속도감·크기 체감·수증기 밀도)을 받아 `constants.ts` 튜닝 여부를 결정한 뒤 M2로 넘어간다.
