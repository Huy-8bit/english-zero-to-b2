import { expect, test } from "@playwright/test";

test("mobile layout: menu, lesson player usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Ngữ pháp" }).click();
  await expect(page.getByRole("heading", { name: "Ngữ pháp" })).toBeVisible();
  await page.goto("/learn/A0-G001");
  await page.getByRole("button", { name: /Slide tiếp theo/ }).click();
  await expect(page.getByText(/2\//)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
