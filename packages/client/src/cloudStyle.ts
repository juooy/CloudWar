import { rand } from '@cloudwar/core';

export interface CloudLobe {
  /** 중심 대비 오프셋 (구름 반지름 배수) */
  dx: number;
  dy: number;
  /** 로브 반지름 (구름 반지름 배수) */
  r: number;
  /** 워블 애니메이션 위상 */
  phase: number;
}

export interface CloudStyle {
  lobes: CloudLobe[];
}

export interface CloudStyleParams {
  seed: number;
  /** 윗면 봉우리 개수 (3~8) */
  lobeCount: number;
  /** 봉우리 크기 배율 (0.7~1.4) */
  fluff: number;
}

/** 시드에서 결정적으로 뭉게구름 로브 배치를 만든다. 코스메틱 전용 — 시뮬레이션과 무관. */
export function generateCloudStyle(params: CloudStyleParams): CloudStyle {
  const rng = { rngState: params.seed | 0 };
  const lobes: CloudLobe[] = [
    // 넓적한 본체 3덩이
    { dx: -0.38, dy: 0.12, r: 0.72, phase: rand(rng) * Math.PI * 2 },
    { dx: 0.38, dy: 0.12, r: 0.72, phase: rand(rng) * Math.PI * 2 },
    { dx: 0, dy: 0.05, r: 0.88, phase: rand(rng) * Math.PI * 2 },
  ];
  // 윗면 봉우리 — 왼쪽(π)에서 오른쪽(0)으로 반원을 따라 배치
  for (let i = 0; i < params.lobeCount; i++) {
    const t = params.lobeCount === 1 ? 0.5 : i / (params.lobeCount - 1);
    const angle = Math.PI * (1 - t);
    const spread = 0.5 + rand(rng) * 0.2;
    lobes.push({
      dx: Math.cos(angle) * spread,
      dy: -0.25 - Math.sin(angle) * (0.2 + rand(rng) * 0.2),
      r: (0.4 + rand(rng) * 0.3) * params.fluff,
      phase: rand(rng) * Math.PI * 2,
    });
  }
  return { lobes };
}

/** 코스메틱 시드 — 클라 전용이라 Math.random 허용 (core 결정론 규율 밖) */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
