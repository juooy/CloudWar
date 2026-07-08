import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import { createInitialState, createCloud } from '../src/state';
import { DT, DROPLET_SCATTER, LIGHTNING_DRAIN_PER_SEC, VAPOR_MAX } from '../src/constants';

/** 반대 극성 2구름이 겹친 상태 (수증기 없음) */
function storm(massA: number, massB: number, dist: number) {
  const state = createInitialState(42);
  state.vapors = [];
  const a = state.clouds[0]!;
  a.mass = massA;
  const b = createCloud(2, { x: a.pos.x + dist, y: a.pos.y }, -1, true);
  b.mass = massB;
  state.clouds.push(b);
  return { state, a, b };
}

describe('반대 극성 — 번개 소모전', () => {
  it('접촉 중 둘 다 질량을 잃고 lightning 이벤트가 남는다', () => {
    const { state, a, b } = storm(400, 100, 10);
    simulate(state, {}, DT);
    expect(a.mass).toBeLessThan(400);
    expect(b.mass).toBeLessThan(100);
    expect(state.events.some((e) => e.type === 'lightning')).toBe(true);
  });

  it('손실은 자기 질량에 비례한다 — 큰 쪽이 절대량은 더 잃지만 비율은 같다', () => {
    const { state, a, b } = storm(400, 100, 0); // 완전 겹침 → factor 1
    simulate(state, {}, DT);
    const lossA = 400 - a.mass;
    const lossB = 100 - b.mass;
    expect(lossA).toBeCloseTo(400 * LIGHTNING_DRAIN_PER_SEC * DT);
    expect(lossB).toBeCloseTo(100 * LIGHTNING_DRAIN_PER_SEC * DT);
    expect(lossA / 400).toBeCloseTo(lossB / 100);
  });

  it('겹침이 얕으면 손실도 작다', () => {
    const deep = storm(100, 100, 0);
    const shallow = storm(100, 100, 75); // rA=rB=40, 겹침 5
    simulate(deep.state, {}, DT);
    simulate(shallow.state, {}, DT);
    const deepLoss = 100 - deep.a.mass;
    const shallowLoss = 100 - shallow.a.mass;
    expect(shallowLoss).toBeGreaterThan(0);
    expect(shallowLoss).toBeLessThan(deepLoss);
  });

  it('오래 싸우면 물방울이 중점 주변에 튄다 (VAPOR_MAX 무시)', () => {
    // 질량 300 → 반경(≈69) < DROPLET_SCATTER(120): 물방울이 구름 밖으로 튈 여지가 있다.
    // (브리프 원안은 2000/2000이었으나 반경(≈179)이 DROPLET_SCATTER보다 훨씬 커서
    //  튄 물방울이 같은 틱의 absorbVapors에 즉시 재흡수되어 100틱 내 관측 불가 — 실측 확인 후 보정)
    const { state, a, b } = storm(300, 300, 0);
    // 일반 스폰이 섞이지 않도록 캡까지 채워둔다
    while (state.vapors.length < VAPOR_MAX) {
      state.vapors.push({ id: state.nextEntityId++, pos: { x: 0, y: 0 } });
    }
    const mid = { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 };
    for (let i = 0; i < 100; i++) simulate(state, {}, DT);
    const droplets = state.vapors.filter(
      (v) => Math.hypot(v.pos.x - mid.x, v.pos.y - mid.y) <= DROPLET_SCATTER + 200,
    );
    expect(state.vapors.length).toBeGreaterThan(VAPOR_MAX);
    expect(droplets.length).toBeGreaterThan(0);
  });

  it('소모전 끝에 질량이 바닥나면 죽는다', () => {
    // 주의: 죽은 뒤 RESPAWN_TICKS 지나면 부활하므로 최종 상태가 아니라 death 이벤트 발생 여부로 검증
    const { state, b } = storm(4000, 22, 0);
    let died = false;
    for (let i = 0; i < 100 && !died; i++) {
      simulate(state, {}, DT);
      died = state.events.some((e) => e.type === 'death' && e.cloudId === b.id);
    }
    expect(died).toBe(true);
  });

  it('보호막이 있는 쌍은 번개가 치지 않는다', () => {
    const { state, a, b } = storm(400, 100, 10);
    b.shieldTicks = 100;
    simulate(state, {}, DT);
    expect(a.mass).toBe(400);
    expect(b.mass).toBe(100);
  });
});
