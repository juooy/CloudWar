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
