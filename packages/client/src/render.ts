import type { GameState, Vec2 } from '@cloudwar/core';
import { cloudRadius, VAPOR_RADIUS, WORLD_SIZE } from '@cloudwar/core';
import type { Camera } from './camera';
import type { CloudStyle } from './cloudStyle';

const GRID_STEP = 200;

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
  if (player) {
    camera.follow(interpolate(player.id, player.pos, prevPositions, alpha));
  }

  // 하늘 배경 — 위가 밝고 아래로 살짝 짙어지는 그라디언트
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#a5cfee');
  sky.addColorStop(1, '#7fb0d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGridAndBounds(ctx, canvas, camera);

  // 수증기 — 몽글한 퍼프가 살랑거림
  for (const vapor of state.vapors) {
    const s = camera.worldToScreen(vapor.pos, canvas);
    if (!onScreen(s, canvas, VAPOR_RADIUS * 3)) continue;
    drawVapor(ctx, s, vapor.id, timeSec);
  }

  // 구름
  for (const cloud of state.clouds) {
    const pos = interpolate(cloud.id, cloud.pos, prevPositions, alpha);
    drawCloud(ctx, camera.worldToScreen(pos, canvas), cloudRadius(cloud.mass), getStyle(cloud.id), timeSec);
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

/** 스타일 로브를 겹쳐 뭉게구름을 그린다. 시작 화면 미리보기와 인게임이 공유. */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  style: CloudStyle,
  timeSec: number,
): void {
  // 밑면 그림자 — 은은한 입체감
  ctx.fillStyle = 'rgba(110, 150, 190, 0.22)';
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + radius * 0.62, radius * 0.9, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 본체 — 위가 하얗고 아래가 살짝 푸른 그라디언트, 로브마다 느리게 워블
  const g = ctx.createRadialGradient(
    center.x,
    center.y - radius * 0.5,
    radius * 0.15,
    center.x,
    center.y + radius * 0.2,
    radius * 1.7,
  );
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.7, 'rgba(245, 250, 255, 0.97)');
  g.addColorStop(1, 'rgba(205, 224, 242, 0.95)');
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
}
