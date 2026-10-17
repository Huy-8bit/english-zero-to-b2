import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

// AI scenarios run against AI_PROVIDER=fake (deterministic, no key, no cost) — see playwright.config.ts.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("Scenario A: AI exercise from a lesson → submit → feedback → mistakes saved → survives refresh", async ({ page }) => {
  await page.goto("/learn/A1-G001");
  await page.getByRole("button", { name: "Tạo bài tập với AI" }).click();
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: "Tạo bài tập", exact: true }).click();
  await expect(page).toHaveURL(/\/ai-practice\//);
  await expect(page.getByText("AI đang ở chế độ giả lập")).toBeVisible();
  const items = page.locator("[data-question]");
  await expect(items).toHaveCount(10);
  // answers are not in the page before submitting
  await expect(page.getByText("Đáp án phù hợp")).toHaveCount(0);
  const radio = items.first().getByRole("radio").first();
  await radio.click();
  await page.reload();
  await expect(items.first().getByRole("radio").first()).toHaveAttribute("aria-checked", "true");  // autosaved
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText(/Kết quả: \d+(\.\d+)?\/10/)).toBeVisible();
  await expect(items.first().getByText("Chưa đúng", { exact: true })).toBeVisible();
  await expect(items.first().getByText("Đáp án phù hợp:")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Kết quả: \d+(\.\d+)?\/10/)).toBeVisible();  // persisted
  await page.goto("/mistakes");
  await expect(page.getByText("Bài tập AI").first()).toBeVisible();
});

test("Scenario B: Writing correction with highlights, diff, explanation and history", async ({ page }) => {
  await page.goto("/writing-studio");
  await page.getByText("Chọn đề từ giáo trình").click();
  await page.locator("details ul li button").first().click();
  await page.getByLabel("Bài viết").fill("Yesterday I go to school with my friend. We played football and ate pho together.");
  await page.reload();
  await expect(page.getByLabel("Bài viết")).toHaveValue("Yesterday I go to school with my friend. We played football and ate pho together.");
  await page.getByRole("button", { name: /Nhận góp ý AI/ }).click();
  const mark = page.locator("mark", { hasText: "Yesterday I go" });
  await expect(mark).toBeVisible();
  await expect(page.locator("ins", { hasText: "went" }).first()).toBeVisible();
  await expect(page.getByText("'Yesterday' là ngữ cảnh quá khứ").first()).toBeVisible();
  await expect(page.getByText(/không phải điểm VSTEP/)).toBeVisible();
  await page.getByLabel("Chế độ góp ý").selectOption("natural");
  await expect(page.getByLabel("Bài viết")).toBeVisible();
  await page.getByRole("button", { name: /Nhận góp ý AI/ }).click();
  await expect(page.getByText(/không phải điểm VSTEP/)).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử" }).click();
  await expect(page.getByText(/1 lỗi/).first()).toBeVisible();
});

test("Scenario C: Speaking with microphone → transcript → feedback → next question → summary", async ({ page }) => {
  await page.goto("/speaking-studio");
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByText("What do you usually do at the weekend?")).toBeVisible();
  await page.getByRole("button", { name: /Ghi âm câu trả lời/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Dừng & gửi/ }).click();
  await expect(page.getByText("Bạn nói (bản chép lời tự động)")).toBeVisible();
  await expect(page.getByText("Who do you usually spend it with?")).toBeVisible();
  await page.getByRole("button", { name: /Kết thúc & xem tổng kết/ }).click();
  await expect(page.getByText("Tổng kết phiên")).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử" }).click();
  await expect(page.getByText(/1 câu trả lời/)).toBeVisible();
});

test("Scenario D: personalized review — practice my mistakes creates a new set and records progress", async ({ page }) => {
  await page.goto("/mistakes");
  await page.getByRole("button", { name: "Luyện lỗi của tôi" }).click();
  await expect(page).toHaveURL(/\/ai-practice\//);
  const first = page.locator("[data-question]").first();
  await first.getByRole("radio").nth(1).click();  // correct option in the simulated set
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(first.getByText("Chính xác")).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("Độ thành thạo theo chủ điểm")).toBeVisible();
  await expect(page.getByRole("link", { name: "A1-G001" }).first()).toBeVisible();
});

test("Scenario E: AI outage → friendly error, answers kept, no score recorded, retry works", async ({ page }) => {
  await page.goto("/ai-practice");
  await page.locator("select").first().selectOption("A1-G001");
  await page.getByRole("button", { name: "Dịch Việt → Anh" }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Tạo bài tập", exact: true }).click();
  await expect(page).toHaveURL(/\/ai-practice\//);
  const box = page.locator("[data-question]").first().getByRole("textbox");
  await box.fill("[[simulate-outage]]");
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText("Không hoàn thành được yêu cầu AI")).toBeVisible();
  await expect(page.getByText(/chưa bị mất/)).toBeVisible();
  await expect(box).toHaveValue("[[simulate-outage]]");  // nothing lost
  await expect(page.getByText(/Kết quả:/)).toHaveCount(0);  // no fake score
  await box.fill("She usually goes every day.");
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText(/Kết quả:/)).toBeVisible();
  // curriculum lessons keep working regardless of AI
  await page.goto("/learn/A1-G011");
  await expect(page.getByRole("heading", { level: 2, name: "Giới thiệu bài học" })).toBeVisible();
});

test("AI tutor answers in the lesson sidebar and keeps history", async ({ page }) => {
  await page.goto("/learn/A1-G001");
  await page.getByRole("button", { name: "Hỏi AI về bài này" }).click();
  await page.getByLabel("Câu hỏi cho gia sư").fill("Tại sao She goes mà I go?");
  await page.getByRole("button", { name: "Gửi" }).click();
  await expect(page.getByText(/Câu hỏi kiểm tra/).last()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Hỏi AI về bài này" }).click();
  await expect(page.getByText("Tại sao She goes mà I go?", { exact: true }).first()).toBeVisible();
});

test("Listening: transcript hidden in test mode until submission; replay uses cached audio", async ({ page }) => {
  await page.goto("/listening-studio");
  await page.locator("label", { hasText: "Chế độ" }).locator("select").selectOption("test");
  await page.getByRole("button", { name: "Tạo bài nghe" }).click();
  await expect(page).toHaveURL(/\/listening-studio\//);
  await expect(page.getByText("Transcript", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Hiện transcript/ })).toHaveCount(0);
  await expect.poll(() => page.locator("audio").first().evaluate((audio: HTMLAudioElement) => audio.readyState)).toBeGreaterThanOrEqual(1);
  await page.locator("audio").first().evaluate(async (audio: HTMLAudioElement) => { await audio.play(); audio.pause(); audio.currentTime = 0; });
  const qs = page.locator("[data-question]");
  for (let i = 0; i < (await qs.count()); i++) await qs.nth(i).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText("Transcript", { exact: true })).toBeVisible();
  await expect(page.getByText("It opens at seven thirty.")).toBeVisible();
});

test("similar exercise set starts without the previous set's feedback or answers", async ({ page }) => {
  await page.goto("/ai-practice");
  await page.locator("select").first().selectOption("A1-G001");
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Tạo bài tập", exact: true }).click();
  const first = page.locator("[data-question]").first();
  await first.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText(/Kết quả:/)).toBeVisible();
  const oldUrl = page.url();
  await page.getByRole("button", { name: "Tạo bộ bài tương tự" }).click();
  await expect(page).not.toHaveURL(oldUrl);
  await expect(page.getByRole("button", { name: "Nộp bài" })).toBeVisible();
  await expect(page.getByText(/Kết quả:/)).toHaveCount(0);
  await expect(page.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
});


test("Reading: passage, evidence feedback and history survive refresh", async ({ page }) => {
  await page.goto("/reading-studio");
  await page.getByRole("button", { name: "Tạo bài đọc" }).click();
  await expect(page).toHaveURL(/\/reading-studio\//);
  await expect(page.getByText(/Many young people in Vietnam/).first()).toBeVisible();
  const questions = page.locator("[data-question]");
  await expect(questions).toHaveCount(5);
  for (let i = 0; i < 5; i++) await questions.nth(i).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText(/Kết quả:/)).toBeVisible();
  await expect(page.locator("mark[title='Căn cứ cho đáp án']").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Kết quả:/)).toBeVisible();
  await page.getByRole("link", { name: "← Reading Studio" }).click();
  await expect(page.getByRole("link", { name: /Learning English online/ })).toBeVisible();
});
