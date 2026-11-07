import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

// These tests cover the classic slide view; the journey view has its own spec (journey.spec.ts).
// learning state (lesson mode, writing exam) is kept on the server: start each test from an empty account
test.beforeEach(resetTestDatabase);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("em-lesson-mode", JSON.stringify("classic")));
});


test("mobile layout: menu, lesson player usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("button", { name: "Ngữ pháp", exact: true }).click(); // open the menu group
  await page.getByRole("link", { name: "Bài ngữ pháp", exact: true }).click();
  await expect(page).toHaveURL(/\/grammar$/);
  await expect(page.getByRole("heading", { name: "Ngữ pháp", exact: true })).toBeVisible();
  await page.goto("/learn/A0-G001");
  await page.getByRole("button", { name: /Slide tiếp theo/ }).click();
  await expect(page.getByText(/2\//)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile vocabulary: pages fit the screen and a flashcard can be rated", async ({ page }) => {
  for (const url of ["/vocabulary", "/vocabulary/explore?level=A1", "/vocabulary/word/achieve", "/vocabulary/today", "/vocabulary/stats", "/vocabulary/notebook", "/journal", "/today", "/review", "/vocabulary/sprint", "/writing-daily", "/grammar-sprint", "/grammar-night", "/writing-studio?mode=exam"]) {
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

test("mobile paper reader: large type fits memory input and lesson controls stay usable", async ({ page }) => {
  await page.goto("/writing-studio?mode=exam");
  await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Trang đọc", exact: true });
  await settings.getByRole("radio", { name: "23", exact: true }).check();
  await settings.getByRole("radio", { name: "Rộng", exact: true }).check();
  await settings.getByRole("button", { name: "Xong", exact: true }).click();
  await page.getByRole("button", { name: "1. Gõ thuộc khung", exact: true }).click();
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  const input = page.getByLabel("Gõ câu tiếng Anh", { exact: true });
  await input.fill("It is often argued that");
  await expect(input).toHaveCSS("font-size", "23px");
  expect(await input.evaluate((e) => e.clientHeight >= e.scrollHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.goto("/learn/A0-G004?mode=journey");
  await expect(page.getByText("Nhiệm vụ hôm nay", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
