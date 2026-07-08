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
