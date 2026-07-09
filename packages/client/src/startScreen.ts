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
