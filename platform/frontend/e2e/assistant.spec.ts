import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);
test.describe.configure({ mode: "serial" });

test("assistant answers from my learning data, links to next steps and keeps history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  const panel = page.getByRole("complementary", { name: "Trợ lý học tập" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Khi nào tôi xong?" }).click();
  await expect(panel.getByText(/\[AI giả lập\] Bạn đã hoàn thành 0\/\d+ bài/)).toBeVisible();
  await expect(panel.getByText("Bài còn lại")).toBeVisible();
  await panel.getByLabel("Câu hỏi cho trợ lý").fill("Tôi nên học gì tiếp theo?");
  await panel.getByRole("button", { name: "Gửi" }).click();
  await expect(panel.getByText("Gợi ý tiếp theo").last()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  await expect(panel.getByText("Tôi nên học gì tiếp theo?")).toBeVisible(); // history is stored on the server
  const link = panel.getByRole("link", { name: /Bài mới:/ }).first();
  await link.click();
  await expect(page).toHaveURL(/\/learn\//);
});

test("assistant keyboard: Escape closes and returns focus to the launcher", async ({ page }) => {
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  await expect(page.getByLabel("Câu hỏi cho trợ lý")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Mở trợ lý học tập" })).toBeFocused();
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  await page.getByRole("button", { name: "Xóa lịch sử trò chuyện" }).click();
  await expect(page.getByText(/Hỏi về tiến độ, từ vựng/)).toBeVisible();
});
