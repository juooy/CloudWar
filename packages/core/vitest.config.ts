import { defineConfig } from 'vitest/config';

// 통합 테스트(3000틱 봇 매치)는 vitest 기본 5000ms 타임아웃을 넘길 수 있어 여유를 둔다.
export default defineConfig({
  test: {
    testTimeout: 15000,
  },
});
