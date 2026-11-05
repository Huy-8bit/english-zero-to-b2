import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";
import { MEMORY_DECKS, WRITING_VOCAB } from "../src/features/writing-studio/writingMemoryContent";
import { EMPTY_MEMORY, memoryTarget, startMemory, type WritingMemoryState } from "../src/features/writing-studio/writingMemoryState";
import { EMPTY_EXAM } from "../src/features/writing-studio/examWritingState";

test.beforeEach(resetTestDatabase);

test("copy, fade, hidden recall, delayed mistakes and whole frame persist without losing drafts", async ({ page }) => {
  test.setTimeout(90_000);
  const deck = MEMORY_DECKS[0];
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("em-writing-exam")) localStorage.setItem("em-writing-exam", JSON.stringify(saved));
  }, { ...EMPTY_EXAM, step: "write", drafts: { "opinion:online-learning": { parts: { intro: "Keep my old essay." }, checks: {} } } });
  await page.goto("/writing-studio?mode=exam");
  // Old-state migration opens the new course while preserving the existing draft.
  await expect(page.getByRole("heading", { name: "Thuộc khung trước. Thêm từ vựng sau." })).toBeVisible();
  await page.getByLabel("Phiên bản khung", { exact: true }).selectOption("short");
  await expect(page.getByRole("button", { name: "2. Học cụm từ (60)", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  const practice = page.getByTestId("typing-practice");
  const input = page.getByLabel("Gõ câu tiếng Anh", { exact: true });
  await expect(practice.getByTestId("typing-model")).toHaveText(deck.lines[0].en);
  await input.fill("H");
  await page.reload();
  await expect(input).toHaveValue("H");
  await page.getByRole("button", { name: "Task 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Task 1", exact: true }).click();
  await expect(input).toHaveValue("H");
  for (let stage = 0; stage < 4; stage++) {
    for (const [index, line] of deck.lines.entries()) {
      if (stage === 2 || stage === 3) await expect(practice.getByTestId("typing-model")).toHaveCount(0);
      if (stage === 2 && index === 0) {
        await practice.getByRole("button", { name: "Chưa nhớ — xem mẫu", exact: true }).click();
      }
      await input.fill(stage === 2 && index === 1 ? "Wrong phrase" : line.en);
      await input.press("Enter");
      if (stage === 2 && index === 0) await expect(practice.getByRole("status")).toContainText("Gõ đúng sau khi xem mẫu");
      if (stage === 2 && index === 1) {
        await expect(practice.getByRole("status")).toContainText("Chưa khớp");
        await page.reload();
        await expect(input).toHaveValue("Wrong phrase");
        await expect(input).toHaveAttribute("readonly", "");
      }
      await input.press("Enter");
    }
  }
  // The hinted and wrong items return after the other cards.
  for (const line of deck.lines.slice(0, 2)) {
    await expect(practice.getByText(line.vi, { exact: true })).toBeVisible();
    await expect(practice.getByTestId("typing-model")).toHaveCount(0);
    await input.fill(line.en);
    await input.press("Enter");
    await input.press("Enter");
  }
  const full = page.getByLabel("Gõ toàn bộ khung", { exact: true });
  await expect(full).toBeVisible();
  await full.fill(memoryTarget(deck.lines));
  await page.reload();
  await expect(full).toHaveValue(memoryTarget(deck.lines));
  await full.press("Enter");
  await full.press("Enter");
  await expect(page.getByText("1/20 khung đã tự gõ được", { exact: true })).toBeVisible();
  await expect(page.getByText("Lần ôn tiếp:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "3. Viết áp dụng", exact: true }).click();
  await expect(page.getByLabel("1. Mở bài", { exact: true })).toHaveValue("Keep my old essay.");
});

test("last frame unlocks vocabulary; hints do not complete whole recall; vocabulary resumes", async ({ page }) => {
  const deck = MEMORY_DECKS.at(-1)!;
  const training: WritingMemoryState = { ...EMPTY_MEMORY, format: "short", deckId: deck.id, decks: Object.fromEntries(MEMORY_DECKS.slice(0, -1).map((d) => [d.id, { passedAt: Date.now(), reviews: 1 }])) };
  training.decks[deck.id] = { reviews: 0, run: { ...startMemory(deck.lines), phase: "whole" } };
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("em-writing-exam")) localStorage.setItem("em-writing-exam", JSON.stringify(saved));
  }, { ...EMPTY_EXAM, step: "memory", training });
  await page.goto("/writing-studio?mode=exam");
  const full = page.getByLabel("Gõ toàn bộ khung", { exact: true });
  await page.getByRole("button", { name: "Chưa nhớ — xem mẫu", exact: true }).click();
  await full.fill(memoryTarget(deck.lines));
  await full.press("Enter");
  await page.getByRole("button", { name: "Che mẫu, gõ lại khung", exact: true }).click();
  await expect(page.getByText("19/20 khung đã tự gõ được", { exact: true })).toBeVisible();
  await expect(page.getByTestId("typing-model")).toHaveCount(0);
  await full.fill(memoryTarget(deck.lines));
  await full.press("Enter");
  await full.press("Enter");
  await expect(page.getByText("20/20 khung đã tự gõ được", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu học cụm từ", exact: true }).click();
  await page.getByLabel("Nhóm từ vựng", { exact: true }).selectOption("education");
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  const term = WRITING_VOCAB.find((p) => p.id === "education")!.items[0];
  await expect(page.getByTestId("typing-model")).toHaveText(term.en);
  const input = page.getByLabel("Gõ câu tiếng Anh", { exact: true });
  await input.fill("access to");
  await page.reload();
  await expect(input).toHaveValue("access to");
  await expect(page.getByLabel("Nhóm từ vựng", { exact: true })).toHaveValue("education");
  await input.fill(term.en);
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText(term.example);
});

test("typing UI is accessible on desktop and narrow screens with long answers", async ({ page }) => {
  await page.goto("/writing-studio?mode=exam");
  await page.getByRole("button", { name: "Task 2", exact: true }).click();
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  const input = page.getByLabel("Gõ câu tiếng Anh", { exact: true });
  await input.fill("incorrect answer");
  await input.press("Enter");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(input).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page }).include('[data-testid="writing-memory-course"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`typing-${width}.png`), fullPage: true });
  }
});

test("extended frames keep short-course progress and let learners reuse/edit the same frame across topics", async ({ page }) => {
  const oldRun = { ...startMemory(MEMORY_DECKS[0].lines), text: "My unfinished old phrase" };
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("em-writing-exam")) localStorage.setItem("em-writing-exam", JSON.stringify(saved));
  }, { ...EMPTY_EXAM, step: "memory", training: { ...EMPTY_MEMORY, decks: { reply: { run: oldRun, reviews: 0 } } } });
  await page.goto("/writing-studio?mode=exam");
  const format = page.getByLabel("Phiên bản khung", { exact: true });
  await expect(format).toHaveValue("extended");
  await expect(page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true })).toBeVisible();
  await format.selectOption("short");
  await expect(page.getByLabel("Gõ câu tiếng Anh", { exact: true })).toHaveValue("My unfinished old phrase");
  await format.selectOption("extended");
  const panel = page.getByTestId("frame-applications");
  await panel.getByText("Cùng một khung, đổi sang 2 chủ đề", { exact: true }).click();
  await expect(panel.getByTestId("filled-frame")).toContainText("visiting my city");
  await panel.getByLabel("Chủ đề minh họa", { exact: true }).selectOption("1");
  await expect(panel.getByTestId("filled-frame")).toContainText("my English course");
  await expect(panel.getByTestId("filled-frame")).not.toContainText("visiting my city");
  await panel.getByLabel("Đổi ý của tôi — có gợi ý sẵn", { exact: true }).check();
  await panel.getByLabel("Thay ý: topic", { exact: true }).fill("my evening class");
  await expect(panel.getByTestId("filled-frame")).toContainText("my evening class");
  await page.reload();
  await panel.getByText("Cùng một khung, đổi sang 2 chủ đề", { exact: true }).click();
  await expect(panel.getByLabel("Chủ đề minh họa", { exact: true })).toHaveValue("1");
  await expect(panel.getByTestId("filled-frame")).toContainText("my evening class");
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  const input = page.getByLabel("Gõ câu tiếng Anh", { exact: true });
  // The learner need not memorise or type slot names.
  await input.fill("Hi,");
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText("Gõ đúng");
  await input.press("Enter");
  await expect(page.getByTestId("typing-model")).toContainText("It was lovely to hear from you");
  await format.selectOption("short");
  await expect(input).toHaveValue("My unfinished old phrase");
});

test("extended whole-frame recall ignores slots, keeps credit separate, and examples fit mobile", async ({ page }) => {
  const { extendWritingDecks, fixedFrameText } = await import("../src/features/writing-studio/extendedWritingFrames");
  const deck = extendWritingDecks(MEMORY_DECKS).find((d) => d.id === "opinion-agree")!;
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("em-writing-exam")) localStorage.setItem("em-writing-exam", JSON.stringify(saved));
  }, { ...EMPTY_EXAM, step: "memory", training: { ...EMPTY_MEMORY, deckId: deck.id, extendedDecks: { [deck.id]: { reviews: 0, run: { ...startMemory(deck.lines), phase: "whole" } } } } });
  await page.goto("/writing-studio?mode=exam");
  await expect(page.getByTestId("typing-model")).toHaveCount(0);
  const input = page.getByLabel("Gõ toàn bộ khung", { exact: true });
  await input.fill(fixedFrameText(memoryTarget(deck.lines)));
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText("nhớ đúng thứ tự cả khung");
  await input.press("Enter");
  await expect(page.getByText("1/20 khung đã tự gõ được", { exact: true })).toBeVisible();
  await page.getByLabel("Phiên bản khung", { exact: true }).selectOption("short");
  await expect(page.getByText("0/20 khung đã tự gõ được", { exact: true })).toBeVisible();
  await page.getByLabel("Phiên bản khung", { exact: true }).selectOption("extended");
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByTestId("frame-applications");
  await panel.getByText("Cùng một khung, đổi sang 2 chủ đề", { exact: true }).click();
  await panel.getByLabel("Chủ đề minh họa", { exact: true }).selectOption("1");
  await expect(panel.getByTestId("filled-frame")).toContainText("bus services");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  const result = await new AxeBuilder({ page }).include('[data-testid="frame-applications"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("extended-writing-mobile.png"), fullPage: true });
});
