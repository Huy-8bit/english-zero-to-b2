import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";

test.beforeEach(resetTestDatabase);
test("mobile model library: topic filters, reader and next article fit the screen", async ({ page }) => {
  await page.goto("/model-library?skill=writing&group=writing-task1&type=invitation&topic=environment");
  const list = page.getByRole("list", { name: "Danh sách bài mẫu" });
  await expect(list.getByRole("button")).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("model-library-mobile-list.png"), fullPage: true });
  await list.getByRole("button").nth(2).click();
  await expect(page.getByRole("heading", { name: "Bài mẫu hoàn chỉnh" })).toBeVisible();
  await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trang đọc", exact: true });
  await dialog.getByRole("radio", { name: "23", exact: true }).check();
  await dialog.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(page.getByTestId("sample-answer-body").locator('p[lang="en"]').first()).toHaveCSS("font-size", "23px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const a11y = await new AxeBuilder({ page }).include('[data-testid="model-library"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("model-library-mobile-reader.png"), fullPage: true });
  await page.getByRole("button", { name: "Bài tiếp", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("04. Công viên trong thành phố");
});
