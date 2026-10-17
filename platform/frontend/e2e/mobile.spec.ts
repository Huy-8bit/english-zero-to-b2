import { expect, test } from "@playwright/test";

test("mobile layout: menu, lesson player usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Ngữ pháp" }).click();
  await expect(page).toHaveURL(/\/grammar$/);
  await expect(page.getByRole("heading", { name: "Ngữ pháp", exact: true })).toBeVisible();
  await page.goto("/learn/A0-G001");
  await page.getByRole("button", { name: /Slide tiếp theo/ }).click();
  await expect(page.getByText(/2\//)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile vocabulary: pages fit the screen and a flashcard can be rated", async ({ page }) => {
  for (const url of ["/vocabulary", "/vocabulary/explore?level=A1", "/vocabulary/word/achieve", "/vocabulary/today", "/vocabulary/stats", "/vocabulary/notebook"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(1);
  }
  await page.goto("/vocabulary");
  await page.locator("button", { hasText: "Flashcards" }).first().click();
  await page.waitForURL(/\/vocabulary\/session\//);
  await page.getByRole("button", { name: /Lật thẻ/ }).click();
  await page.getByRole("button", { name: /^Nhớ/ }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("mobile assistant opens full screen and answers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  await page.getByRole("button", { name: "Tiến độ của tôi" }).click();
  await expect(page.getByText("[AI giả lập]").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Đóng trợ lý", exact: true }).click();
});
