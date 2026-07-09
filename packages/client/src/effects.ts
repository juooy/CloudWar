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
