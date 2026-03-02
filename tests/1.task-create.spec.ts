import { test, expect } from "@playwright/test"

test("일감 생성", async ({ page }) => {
  // 1. 프로젝트 페이지 접속
  await page.goto(
    "https://myworkwave.vercel.app/workspaces/69a51bc10030d955ff1d/projects/69a51bce0022afb2f3c2"
  )

  // 2. 일감 생성 버튼 클릭
  await page.getByRole("button", { name: "일감 생성" }).click()

  // 3. 일감 이름 입력
  await page.getByRole("textbox", { name: "일감 이름" }).fill("테스트")

  // 4. 마감일 입력 (26.03.02)
  await page.getByRole("button", { name: "날짜를 선택해주세요" }).click()
  await page.getByRole("gridcell", { name: "2" }).first().click()

  // 5. 담당자 입력 (test_user)
  await page.getByRole("combobox", { name: "담당자" }).click()
  await page.getByRole("option", { name: "T test_user" }).click()

  // 6. 상태 입력 (진행)
  await page.getByRole("combobox", { name: "상태" }).click()
  await page.getByRole("option", { name: "진행" }).click()

  // 7. 프로젝트 입력 (테스트 프로젝트)
  await page.getByRole("combobox", { name: "프로젝트" }).click()
  await page.getByRole("option", { name: "테 테스트 프로젝트" }).click()

  // 8. 생성 버튼 클릭
  await page.getByRole("button", { name: "생성" }).click()

  // 9. 일감이 생성되었습니다. 토스트 확인
  await expect(page.getByRole("status")).toContainText("일감이 생성되었습니다.")
})
