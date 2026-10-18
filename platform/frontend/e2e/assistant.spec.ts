import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);
test.describe.configure({ mode: "serial" });

test("assistant answers from my learning data, links to next steps and keeps history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  const panel = page.getByRole("complementary", { name: "Trợ lý học tập" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Bao lâu nữa tôi xong?" }).click();
  await expect(panel.getByText(/\[AI giả lập\] Bạn đã hoàn thành 0\/\d+ bài/)).toBeVisible();
  await expect(panel.getByText("Bài còn lại")).toBeVisible();
  await expect(panel.getByText("Nếu thay đổi thời gian học")).toBeVisible();
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

test("study journal records today's lesson and vocabulary; the assistant reports it", async ({ page, request }) => {
  // opening a lesson sends a study heartbeat for that lesson; answering one of its questions is recorded too
  const beat = page.waitForResponse((r) => r.url().endsWith("/api/activity/heartbeat"));
  await page.goto("/learn/A1-G001");
  await beat;
  const steps = await (await request.get("/api/lessons/A1-G001/steps")).json();
  const quiz = steps.steps.find((s: { type: string }) => s.type === "quiz");
  await request.post(`/api/quizzes/${quiz.quiz_id}/submit`, { data: { answers: { [quiz.items[0].id]: "A" } } });
  await page.goto("/vocabulary");
  await page.locator("button", { hasText: "Flashcards" }).first().click();
  await page.waitForURL(/\/vocabulary\/session\//);
  await page.getByRole("button", { name: /Lật thẻ/ }).click();
  await page.getByRole("button", { name: /^Nhớ/ }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await page.goto("/journal");
  await expect(page.getByRole("heading", { name: "Nhật ký học tập" })).toBeVisible();
  const today = page.locator("main").getByText(/A1-G001 ·/).first();
  await expect(today).toBeVisible();
  await expect(page.locator("main li").filter({ hasText: /Từ vựng.*1\/1 đúng/ })).toBeVisible();
  await page.getByRole("button", { name: "Mở trợ lý học tập" }).click();
  await page.getByRole("button", { name: "Gần đây tôi học gì?" }).click();
  await expect(page.getByRole("complementary", { name: "Trợ lý học tập" }).getByText("7 ngày qua")).toBeVisible();
});
