import { expect, test, type Page } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);
test.describe.configure({ mode: "serial" });

/** What the learner saw on teaching cards: word ⇄ meaning (used to answer the later questions honestly). */
const seen = new Map<string, string>();

async function pos(page: Page) {
  const [a, b] = ((await page.getByTestId("session-pos").textContent()) ?? "0/0").split("/").map(Number);
  return { at: a, total: b };
}

async function answerCurrent(page: Page, opts: { wrongWord?: string } = {}) {
  const item = page.locator("[data-testid^=item-]");
  await expect(item).toBeVisible();
  const kind = (await item.getAttribute("data-testid"))!.replace("item-", "");
  if (kind === "learn") {
    const word = (await page.getByTestId("learn-word").textContent())!.trim();
    await page.keyboard.press("Enter");
    const meaning = (await page.getByTestId("learn-meaning").textContent())!.trim();
    seen.set(word, meaning);
    for (let i = 0; i < 4 && (await page.getByTestId("learn-word").count()) && (await page.getByTestId("learn-word").textContent())?.trim() === word; i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
    }
    return { kind, correct: null as boolean | null };
  }
  if (kind === "mc_meaning") {
    const word = (await page.getByTestId("choice-title").textContent())!.replace(/\(.*\)$/, "").trim();
    const meaning = seen.get(word)!;
    await page.getByRole("button").filter({ hasText: meaning.slice(0, 20) }).first().click();
  } else if (kind === "mc_word") {
    const meaning = (await page.getByTestId("choice-title").textContent())!.trim();
    const word = [...seen].find(([, m]) => meaning.startsWith(m.slice(0, 15)))![0];
    await page.getByRole("button", { name: new RegExp(`^\\d${word}$`) }).click();
  } else if (kind === "type_word") {
    const meaning = (await page.getByTestId("type-meaning").textContent())!.trim();
    const word = [...seen].find(([, m]) => m === meaning)![0];
    await page.getByLabel("Câu trả lời tiếng Anh").fill(opts.wrongWord === word ? "zzzz" : word.replace(/\s*\(.*\)/, ""));
    await page.getByRole("button", { name: "Kiểm tra" }).click();
  } else if (kind === "flashcard") {
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /^Nhớ/ }).click();
  } else {
    await page.locator("[data-testid^=item-] button:has(kbd)").first().click();
  }
  const fb = page.getByTestId("feedback");
  await expect(fb).toBeVisible();
  const correct = !(await fb.getByText(/Chưa đúng|Sai nghĩa|Quên/).count());
  return { kind, correct };
}

test("A1 Daily Routine: learn → recall with feedback → refresh mid-session → finish → flashcard review → stats", async ({ page }) => {
  await page.goto("/vocabulary");
  await expect(page.getByRole("heading", { name: "Từ vựng" })).toBeVisible();
  await page.goto("/vocabulary/explore?topic=daily-routine&level=A1");
  await page.getByRole("button", { name: "Học từ mới trong bộ lọc này" }).click();
  await page.waitForURL(/\/vocabulary\/session\//);
  const { total } = await pos(page);
  expect(total).toBeGreaterThanOrEqual(15);

  let wrongWord: string | undefined;
  let refreshed = false;
  let sawCorrectFeedback = false;
  for (let guard = 0; guard < 60; guard++) {
    await expect(page.getByTestId("summary-title").or(page.locator("[data-testid^=item-]"))).toBeVisible();
    if (await page.getByTestId("summary-title").count()) break;
    const r = await answerCurrent(page, { wrongWord });
    if (r.kind === "learn" && !wrongWord && seen.size === 2) wrongWord = [...seen.keys()][0]; // forget one word on purpose
    if (r.correct) sawCorrectFeedback = true;
    if (r.kind !== "learn") {
      if (!refreshed && (await pos(page)).at >= 6) {
        // progress is saved on the server: reload and continue from the same question
        const before = await pos(page);
        await page.reload();
        await expect(page.locator("[data-testid^=item-]")).toBeVisible();
        expect((await pos(page)).at).toBe(before.at + 1); // resumes at the first unanswered question
        refreshed = true;
        continue;
      }
      await page.getByRole("button", { name: /Tiếp tục|Xem tổng kết/ }).click();
    }
  }
  expect(refreshed && sawCorrectFeedback).toBeTruthy();
  await expect(page.getByTestId("summary-title")).toBeVisible();
  await expect(page.getByText("Từ còn khó")).toBeVisible(); // the forgotten word was retried and is listed
  await expect(page.getByText(/từ đã được xếp lịch \(FSRS\)/)).toBeVisible();

  // previously learned words come back in flashcard review; ratings update the real schedule
  await page.goto("/vocabulary");
  await expect(page.getByText(/Tiếp tục:/)).toHaveCount(0);
  await page.locator("button", { hasText: "Flashcards" }).first().click();
  await page.waitForURL(/\/vocabulary\/session\//);
  await expect(page.getByTestId("card-word")).toBeVisible();
  const learnedWords = [...seen.keys()];
  expect(learnedWords).toContain((await page.getByTestId("card-word").textContent())!.trim());
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /^Nhớ/ }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  // not-yet-due words are practised without moving their FSRS schedule; due/new words show the next review time
  await expect(page.getByText(/Lịch ôn tiếp|Luyện thêm — không đổi lịch ôn/).first()).toBeVisible();

  await page.goto("/vocabulary/stats");
  const learnedRow = page.locator("div", { has: page.getByText("Đã học", { exact: true }) }).last();
  await expect(learnedRow).toContainText(/[1-9]/);
});

test("reading lookup saves a word into the shared notebook and review schedule", async ({ page }) => {
  await page.goto("/reading-studio");
  await page.getByRole("button", { name: /Tạo bài đọc/ }).click();
  await page.waitForURL(/\/reading-studio\//);
  const word = page.locator("[role=button]", { hasText: /^[A-Za-z]{5,}$/ }).first();
  const text = (await word.textContent())!.trim();
  await word.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Thêm vào sổ từ" }).click();
  await expect(dialog.getByRole("button", { name: "Đã lưu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/vocabulary/notebook");
  await page.getByRole("button", { name: /Từ trong bài đọc/ }).click();
  await expect(page.locator("main")).toContainText(new RegExp(text.slice(0, 4), "i"));
});

test("AI vocabulary tutor and Use-It-Yourself grading (simulated provider)", async ({ page }) => {
  await page.goto("/vocabulary/word/achieve");
  await page.getByRole("button", { name: "Giải thích từ này" }).click();
  await expect(page.getByText("[AI giả lập]").first()).toBeVisible();
  await page.goto("/vocabulary");
  await page.locator("button", { hasText: "Tự đặt câu" }).first().click();
  await page.waitForURL(/\/vocabulary\/session\//);
  const word = (await page.locator("[data-testid=item-use_it] p.text-3xl").textContent())!.replace(/\s*\(.*\)/, "").trim();
  await page.getByLabel("Câu của bạn").fill(`I think ${word} is important every day.`);
  await page.getByRole("button", { name: "Nhờ AI chấm" }).click();
  await expect(page.getByTestId("feedback")).toContainText("Chính xác");
  await expect(page.getByTestId("feedback")).toContainText("Câu dùng từ đúng nghĩa");
});
