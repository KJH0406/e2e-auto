import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  // 테스트 파일이 위치한 디렉토리
  testDir: "./tests",
  // 테스트 파일을 병렬로 실행 (true: 병렬, false: 순차)
  fullyParallel: false,
  // 테스트 결과 보고서 형식
  reporter: "html",
  // 테스트 실행 중 오류 발생 시 추적 정보 저장
  use: { trace: "on-first-retry" },
  // 테스트 실행 프로젝트 설정
  projects: [{ name: "Google Chrome", use: { ...devices["Desktop Chrome"] } }],
})
