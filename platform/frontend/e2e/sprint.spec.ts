import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

test("intensive vocabulary: 100 words/day in batches of 10 — triage known words, learn the batch with a memory hint", async ({ page }) => {
  await page.goto("/vocabulary/sprint");
  await expect(page.getByRole("heading", { name: "Học cấp tốc" })).toBeVisible();
  await page.getByRole("button", { name: "100 từ", exact: true }).click();
  await expect(page.getByText("/ 100 từ")).toBeVisible();
  await expect(page.getByText(/Đợt 1\/10/)).toBeVisible();
  await expect(page.getByText("Lịch ôn 7 ngày tới")).toBeVisible();
  // triage: one word is already known → it is skipped
  const words = page.locator("main ul li").filter({ has: page.getByRole("button", { name: /Biết rồi/ }) });
  await expect(words).toHaveCount(15);
  await words.first().getByRole("button", { name: /Biết rồi/ }).click();
  await expect(page.getByText("1 từ đã biết sẽ được bỏ qua")).toBeVisible();
  await page.getByRole("button", { name: /Học đợt này \(10 từ\)/ }).click();
  await page.waitForURL(/\/vocabulary\/session\/.*return=%2Fvocabulary%2Fsprint/);
  await expect(page.getByTestId("learn-word")).toBeVisible();
  await page.keyboard.press("Enter"); // show the meaning
  await page.getByRole("button", { name: "Mẹo nhớ (AI)" }).click();
  await expect(page.getByText("Mẹo nhớ (AI gợi ý)")).toBeVisible();
  // back on the sprint page the known word is gone from the next batch
  await page.getByRole("link", { name: "← Quay lại" }).click();
  await expect(page).toHaveURL(/\/vocabulary\/sprint/);
});
