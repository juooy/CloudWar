import type { GameState, Polarity, Vec2 } from '@cloudwar/core';
import {
  cloudRadius,
  isAlive,
  SWAP_COOLDOWN_TICKS,
  TICK_RATE,
  VAPOR_RADIUS,
  WORLD_SIZE,
} from '@cloudwar/core';
import type { Camera } from './camera';
import type { CloudStyle } from './cloudStyle';

const GRID_STEP = 200;

/** 극성별 구름 틴트·배지 색 */
const TINT = {
  1: { mid: 'rgba(255, 249, 235, 0.97)', edge: 'rgba(244, 224, 178, 0.95)', badge: '#c9962e', symbol: '+' },
  '-1': { mid: 'rgba(238, 244, 255, 0.97)', edge: 'rgba(198, 214, 246, 0.95)', badge: '#3b62c4', symbol: '−' },
} as const;

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
  if (player && isAlive(player)) {
    camera.follow(interpolate(player.id, player.pos, prevPositions, alpha));
  }

  // 하늘 배경
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#a5cfee');
  sky.addColorStop(1, '#7fb0d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGridAndBounds(ctx, canvas, camera);

  // 수증기
  for (const vapor of state.vapors) {
    const s = camera.worldToScreen(vapor.pos, canvas);
    if (!onScreen(s, canvas, VAPOR_RADIUS * 3)) continue;
    drawVapor(ctx, s, vapor.id, timeSec);
  }

  // 구름 (죽은 구름은 그리지 않음)
  for (const cloud of state.clouds) {
    if (!isAlive(cloud)) continue;
    const pos = interpolate(cloud.id, cloud.pos, prevPositions, alpha);
    const s = camera.worldToScreen(pos, canvas);
    drawCloud(ctx, s, cloudRadius(cloud.mass), getStyle(cloud.id), timeSec, cloud.polarity, cloud.shieldTicks > 0);
  }

  drawHud(ctx, canvas, state, playerId);
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  playerId: number,
): void {
  const player = state.clouds.find((c) => c.id === playerId);
  if (!player) return;
  const tint = TINT[player.polarity === 1 ? 1 : '-1'];
  const aliveCount = state.clouds.filter(isAlive).length;

  ctx.fillStyle = '#1e3a52';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`질량 ${Math.round(player.mass)}`, 16, 28);
  ctx.fillStyle = tint.badge;
  ctx.fillText(`극성 ${tint.symbol}`, 16, 52);
  ctx.fillStyle = '#1e3a52';
  ctx.fillText(`생존 ${aliveCount}/${state.clouds.length}`, 16, 76);

  // 스왑 쿨다운 바 (E/Space)
  const barW = 120;
  const ready = player.swapCooldown === 0;
  const frac = 1 - player.swapCooldown / SWAP_COOLDOWN_TICKS;
  ctx.fillStyle = 'rgba(30, 58, 82, 0.25)';
  ctx.fillRect(16, 88, barW, 8);
  ctx.fillStyle = ready ? '#3d7ab8' : 'rgba(61, 122, 184, 0.6)';
  ctx.fillRect(16, 88, barW * frac, 8);
  ctx.fillStyle = '#1e3a52';
  ctx.font = '12px sans-serif';
  ctx.fillText(ready ? '스왑 준비됨 (E/Space)' : '스왑 충전 중…', 16 + barW + 8, 96);

  // 플레이어 사망 오버레이
  if (!isAlive(player)) {
    const secondsLeft = Math.ceil(player.respawnTicks / TICK_RATE);
    ctx.fillStyle = 'rgba(30, 58, 82, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('격추!', canvas.width / 2, canvas.height / 2 - 16);
    ctx.font = '20px sans-serif';
    ctx.fillText(`부활까지 ${secondsLeft}초`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.textAlign = 'left';
  }
}

/** 이전 틱 위치와 현재 위치를 alpha(0~1)로 보간 */
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

/** 극성 틴트가 적용된 뭉게구름. 시작 화면 미리보기와 인게임이 공유. */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  style: CloudStyle,
  timeSec: number,
  polarity: Polarity,
  shielded: boolean,
): void {
  const tint = TINT[polarity === 1 ? 1 : '-1'];

  // 밑면 그림자
  ctx.fillStyle = 'rgba(110, 150, 190, 0.22)';
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + radius * 0.62, radius * 0.9, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 본체 — 흰색 → 극성 틴트 그라디언트
  const g = ctx.createRadialGradient(
    center.x,
    center.y - radius * 0.5,
    radius * 0.15,
    center.x,
    center.y + radius * 0.2,
    radius * 1.7,
  );
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.7, tint.mid);
  g.addColorStop(1, tint.edge);
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

  // 극성 배지 (구름 위)
  const badgeR = Math.max(9, radius * 0.18);
  const bx = center.x;
  const by = center.y - radius * 1.05;
  ctx.fillStyle = tint.badge;
  ctx.beginPath();
  ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(badgeR * 1.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tint.symbol, bx, by + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 스폰 보호막 — 점선 버블
  if (shielded) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + Math.sin(timeSec * 5) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
