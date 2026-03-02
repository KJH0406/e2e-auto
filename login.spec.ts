import { test, expect } from "@playwright/test"

test("로그인", async ({ page }) => {
  await page.goto("https://myworkwave.vercel.app/sign-in")

  await page
    .getByRole("textbox", { name: "이메일 주소를 입력해주세요" })
    .fill("test_auth@email.com")
  await page
    .getByRole("textbox", { name: "비밀번호를 입력해주세요" })
    .fill("qwer1234!")
  await page.getByRole("button", { name: "로그인", exact: true }).click()

  await expect(page.getByText("로그인에 성공했습니다.")).toBeVisible()

  await page.context().storageState({ path: "auth.json" })
})
