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
