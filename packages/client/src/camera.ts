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
