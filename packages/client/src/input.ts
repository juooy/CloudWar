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
