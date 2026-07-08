/**
 * mulberry32 시드 RNG. state.rngState를 전진시키고 [0, 1) 값을 반환한다.
 * core 전체에서 Math.random() 대신 이것만 사용한다 (결정론 규율).
 */
export function rand(state: { rngState: number }): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
