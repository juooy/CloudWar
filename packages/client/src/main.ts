import { BOT_COUNT, computeBotInputs, createInitialState, simulate, DT } from '@cloudwar/core';
import type { Vec2 } from '@cloudwar/core';
import { Controls } from './input';
import { Camera } from './camera';
import { render } from './render';
import { EffectsManager } from './effects';
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
  const effects = new EffectsManager();

  let prevPositions = new Map<number, Vec2>();
  let last = performance.now();
  let lastFrame = performance.now();
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
      for (const ev of state.events) effects.add(ev, state, PLAYER_ID);
      accumulator -= DT;
    }

    effects.update((now - lastFrame) / 1000);
    camera.offset = effects.shakeOffset();
    render(ctx, canvas, state, prevPositions, accumulator / DT, camera, PLAYER_ID, getStyle, now / 1000);
    effects.draw(ctx, canvas, camera);
    lastFrame = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
void start();
