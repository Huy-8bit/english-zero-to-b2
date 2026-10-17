import { expect, test, type Page } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

async function next(page: Page) {
  const h = page.locator("#slide-title");
  const before = await h.textContent();
  await page.getByRole("button", { name: /Slide tiếp theo/ }).click();
  await expect(h).not.toHaveText(before ?? "");
}

async function gotoStep(page: Page, title: RegExp) {
  for (let i = 0; i < 60; i++) {
    const h = page.locator("#slide-title");
    await expect(h).toBeVisible();
    if (title.test((await h.textContent()) ?? "")) return;
    await next(page);
  }
  throw new Error(`step ${title} not found`);
}

test.describe.configure({ mode: "serial" });

test("dashboard shows real (empty) data and links into the path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hôm nay học gì?" })).toBeVisible();
  await expect(page.getByText("0 XP", { exact: true })).toBeVisible();
  await expect(page.getByText("A0-G001 · The English Alphabet").first()).toBeVisible();
  await page.getByRole("link", { name: "Lộ trình học" }).first().click();
  await expect(page.getByRole("tab", { name: /A1/ })).toBeVisible();
  await page.getByRole("tab", { name: /A1/ }).click();
  await page.getByRole("link", { name: /A1-G011.*Imperatives/ }).click();
  await expect(page).toHaveURL(/\/learn\/A1-G011/);
  await expect(page.getByRole("heading", { level: 2, name: "Giới thiệu bài học" })).toBeVisible();
});

test("slide navigation by buttons and keyboard, quiz grading, persistence after reload", async ({ page }) => {
  await page.goto("/learn/A1-G011");
  await expect(page.getByText("1/")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { level: 2, name: "Khởi động" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { level: 2, name: "Giới thiệu bài học" })).toBeVisible();

  await gotoStep(page, /Level 1 — Recognition/);
  const q1 = page.locator('[data-item="A1-G011:L1.1"]');
  // no answer is visible before submitting
  await expect(q1.getByText("Chính xác!")).toHaveCount(0);
  await q1.getByRole("radio").nth(1).click(); // B. Close
  const q4 = page.locator('[data-item="A1-G011:L1.4"]');
  await q4.getByRole("radio").nth(0).click(); // A. Not use (wrong)
  await page.getByRole("button", { name: /Kiểm tra \(/ }).first().click();
  await expect(q1.getByText("Chính xác!")).toBeVisible();
  await expect(q4.getByText("Chưa đúng")).toBeVisible();
  await expect(q4.getByText("Đáp án")).toBeVisible();

  // Text answer: draft survives reload, then is graded
  await gotoStep(page, /Level 3 — Error Correction/);
  const t1 = page.locator('[data-item="A1-G011:L3.1"]');
  await t1.getByRole("textbox").fill("Turn off the lights when you leave.");
  const t2 = page.locator('[data-item="A1-G011:L3.2"]');
  await t2.getByRole("textbox").fill("Please do not park here, thanks.");
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: /Level 3 — Error Correction/ })).toBeVisible();
  await expect(page.locator('[data-item="A1-G011:L3.1"]').getByRole("textbox")).toHaveValue("Turn off the lights when you leave.");
  await page.getByRole("button", { name: /Kiểm tra \(/ }).first().click();
  await expect(page.locator('[data-item="A1-G011:L3.1"]').getByText("Chính xác!")).toBeVisible();
  const mis = page.locator('[data-item="A1-G011:L3.2"]');
  await expect(mis.getByText(/Chưa khớp đáp án mẫu/)).toBeVisible();
  await mis.getByRole("button", { name: "Tôi làm đúng" }).click();
  await expect(mis.getByText(/Tự đánh giá: đúng/)).toBeVisible();

  // results persist after reload
  await page.reload();
  await expect(page.locator('[data-item="A1-G011:L3.1"]').getByText("Chính xác!")).toBeVisible();
});

test("finish lesson updates dashboard and XP", async ({ page }) => {
  await page.goto("/learn/A1-G011");
  for (let i = 0; i < 60; i++) {
    const finish = page.getByRole("button", { name: /Hoàn thành bài học/ });
    if (await finish.isVisible()) break;
    await next(page);
  }
  await page.getByRole("button", { name: /Hoàn thành bài học/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/\+50 XP/)).toBeVisible();
  await dialog.getByRole("button", { name: "Về Dashboard" }).click();
  await expect(page.getByText(/Ngữ pháp 1\/128/)).toBeVisible();
  await expect(page.getByText(/^\d+ XP$/).first()).not.toHaveText("0 XP");
  // Resume shows up for in-progress lessons; completed lesson appears in progress history
  await page.goto("/progress");
  await expect(page.getByRole("link", { name: "A1-G011" }).first()).toBeVisible();
});

test("curriculum flashcards are scheduled by FSRS in the shared vocabulary progress", async ({ page, request }) => {
  await page.goto("/vocabulary/units");
  await page.getByRole("button", { name: "Flashcards" }).click();
  await page.getByRole("button", { name: "Lật thẻ" }).click();
  const reviewResponse = page.waitForResponse((r) => r.url().endsWith("/api/vocabulary/review") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Nhớ được/ }).click();
  const saved = await (await reviewResponse).json();
  expect(saved.srs.state).toBe("review");
  expect(saved.srs.algorithm).toMatch(/FSRS/);
  await expect(page.getByText("+2 XP")).toBeVisible();
  const cards = await (await request.get("/api/vocabulary")).json();
  expect(cards.cards.find((c: { id: string }) => c.id === saved.card_id).srs).toEqual(saved.srs);
  const entry = await (await request.get(`/api/vocab/entries/${saved.entry_id}`)).json();
  expect(entry.progress.state).toBe("review"); // same progress as the vocabulary module
  await page.goto("/review");
  await expect(page.getByText(/Lịch ôn dùng FSRS|FSRS/).first()).toBeVisible();
});

test("search finds Vietnamese queries and opens Learning or Reference mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Tìm trong giáo trình" }).or(page.getByLabel("Tìm trong giáo trình")).fill("câu bị động");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Passive Voice/).first()).toBeVisible();
  await page.getByRole("link", { name: "Đọc toàn văn" }).first().click();
  await expect(page.getByText("Chế độ tra cứu")).toBeVisible();
  await page.getByRole("link", { name: /Học theo từng slide/ }).click();
  await expect(page).toHaveURL(/\/learn\//);
});

test("exam mode hides answers until the whole test is submitted", async ({ page }) => {
  await page.goto("/learn/A0-EXIT-TEST");
  await gotoStep(page, /A1\. Chọn đáp án đúng/);
  await expect(page.getByText("Chế độ kiểm tra")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kiểm tra/ })).toHaveCount(0);
  await page.locator('[data-item="A0-EXIT-TEST:1"]').getByRole("radio").nth(1).click(); // B. are
  await gotoStep(page, /Nộp bài/);
  await page.getByRole("button", { name: "Nộp toàn bài" }).click();
  await expect(page.getByText(/Kết quả phần tự chấm: 1\//)).toBeVisible();
});

test("reading passage, vocabulary list and matching game render from the curriculum", async ({ page }) => {
  await page.goto("/vocabulary/units");
  await expect(page.getByText("wake up").first()).toBeVisible();
  await page.getByRole("button", { name: /Ghép nghĩa/ }).click();
  await expect(page.getByLabel("Từ tiếng Anh")).toBeVisible();
  await page.goto("/learn/L02");
  await gotoStep(page, /Task 2/);
  await expect(page.getByRole("button", { name: /Hiện transcript/ })).toBeVisible();
  await expect(page.getByText(/giọng đọc tổng hợp/).first()).toBeVisible();
});

test("next lesson restores its own slide and drafts without overwriting either lesson", async ({ page, request }) => {
  const sourceId = "A1-G015";
  const lesson = await (await request.get(`/api/lessons/${sourceId}`)).json();
  const nextId = lesson.next_id as string;
  expect(nextId).toBeTruthy();
  const target = await (await request.get(`/api/lessons/${nextId}/steps`)).json();
  const targetState = { savedAt: Date.now(), checklist: { ownLesson: true } };
  await request.put(`/api/progress/${nextId}`, { data: { current_step: 2, state: targetState } });
  await page.goto(`/learn/${sourceId}`);
  await expect(page.locator("#slide-title")).toBeVisible();
  await page.getByRole("complementary", { name: "Các slide" }).getByRole("button").last().click();
  await page.getByRole("button", { name: "Hoàn thành bài học", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Bài tiếp theo" }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${nextId}$`));
  await expect(page.locator("#slide-title")).toHaveText(target.steps[2].title);
  await page.getByRole("button", { name: /Slide tiếp theo/ }).click();
  await expect.poll(async () => (await (await request.get(`/api/lessons/${nextId}/steps`)).json()).progress.current_step).toBe(3);
  const saved = await (await request.get(`/api/lessons/${nextId}/steps`)).json();
  expect(saved.progress.state.checklist).toEqual({ ownLesson: true });
  await page.reload();
  await expect(page.locator("#slide-title")).toHaveText(target.steps[3].title);
});
