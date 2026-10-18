import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);
test.describe.configure({ mode: "serial" });

test("4-hour plan: interleaved blocks, start a block with a timer, break screen after the block", async ({ page, request }) => {
  await request.put("/api/profile", { data: { daily_goal_minutes: 240 } });
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Lịch học hôm nay" })).toBeVisible();
  await expect(page.locator("li", { hasText: "Khởi động: ôn từ đến hạn" })).toBeVisible();
  await expect(page.locator("li", { hasText: "Nói / Viết với AI" })).toBeVisible();
  await expect(page.getByText(/Nghỉ dài 20 phút/).first()).toBeVisible();
  await expect(page.getByText("Nhiệm vụ hôm nay")).toBeVisible();
  // start the lesson block → goes to the lesson, header shows the block timer
  await page.locator("li", { hasText: "Bài mới (lộ trình)" }).getByRole("button", { name: /Bắt đầu/ }).click();
  await expect(page).toHaveURL(/\/learn\//);
  await expect(page.getByTitle(/Khối: Bài mới/)).toBeVisible();
  // block time is over → celebration + active-break screen (also over lessons)
  await page.evaluate(() => {
    const k = "em-block-timer";
    const v = JSON.parse(localStorage.getItem(k) || "{}");
    v.block.endsAt = Date.now() - 1000;
    localStorage.setItem(k, JSON.stringify(v));
  });
  await page.reload();
  const brk = page.getByRole("dialog", { name: "Giờ nghỉ" });
  await expect(brk).toBeVisible();
  await expect(brk.getByText(/Nghỉ (ngắn|dài)/).first()).toBeVisible();
  await brk.getByRole("button", { name: "Đóng" }).click();
  await expect(brk).toHaveCount(0);
});

test("smart review: diagnoses gaps, re-answers a wrong lesson question, vocabulary gaps return to review", async ({ page, request }) => {
  const st = await (await request.get("/api/lessons/A1-G011/steps")).json();
  const quiz = st.steps.find((s: { type: string; items: { kind: string }[] }) => s.type === "quiz" && s.items[0].kind === "mc");
  await request.post(`/api/quizzes/${quiz.quiz_id}/submit`, { data: { answers: { [quiz.items[0].id]: "Z" } } });
  const s = await (await request.post("/api/vocab/sessions", { data: { kind: "flashcards", size: 3 } })).json();
  await request.post(`/api/vocab/sessions/${s.id}/answer`, { data: { item_id: s.items[0].id, rating: 1 } });
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Ôn tập thông minh" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Câu sai trong bài/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/lần trước bạn trả lời/).first()).toBeVisible();
  await page.getByRole("tab", { name: /Từ vựng lỗ hổng/ }).click();
  await page.getByRole("button", { name: "Ôn lỗ hổng từ vựng" }).click();
  await expect(page).toHaveURL(/\/vocabulary\/session\/.*return=\/review/);
  await expect(page.getByRole("link", { name: "← Quay lại" })).toHaveAttribute("href", "/review");
});
