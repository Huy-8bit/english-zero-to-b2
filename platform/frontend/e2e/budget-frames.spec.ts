import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";
import { BUDGET_DECKS, fixedWordCount, FRAME_REVISION } from "../src/features/writing-studio/budgetWritingFrames";
import { MEMORY_DECKS } from "../src/features/writing-studio/writingMemoryContent";
import { EMPTY_MEMORY, memoryTarget, startMemory } from "../src/features/writing-studio/writingMemoryState";
import { EMPTY_EXAM } from "../src/features/writing-studio/examWritingState";
import { fixedFrameText } from "../src/features/writing-studio/extendedWritingFrames";
test.beforeEach(resetTestDatabase);

test("all 28 default frames show their real fixed word count and preserve old attempts", async ({ page }) => {
  const oldRun = { ...startMemory(MEMORY_DECKS[0].lines), text: "My old unfinished attempt" };
  await page.addInitScript((saved) => { if (!localStorage.getItem("em-writing-exam")) localStorage.setItem("em-writing-exam", JSON.stringify(saved)); }, {
    ...EMPTY_EXAM, step: "memory", training: { ...EMPTY_MEMORY, format: "extended", decks: { reply: { reviews: 0, run: oldRun } }, extendedDecks: { reply: { reviews: 3, passedAt: 123 } } },
  });
  await page.goto("/writing-studio?mode=exam");
  await expect(page.getByLabel("Phiên bản khung", { exact: true })).toHaveValue("budget");
  await expect(page.getByText("0/28 khung đã tự gõ được", { exact: true })).toBeVisible();
  for (const task of [1, 2]) {
    await page.getByRole("button", { name: `Task ${task}`, exact: true }).click();
    for (const deck of BUDGET_DECKS.filter((d) => d.task === task)) {
      await page.getByRole("navigation", { name: "Các dạng Writing" }).getByRole("button", { name: new RegExp(deck.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$" ) }).click();
      await expect(page.getByTestId("frame-budget")).toContainText(`${fixedWordCount(deck)} từ cố định`);
    }
  }
  await page.getByRole("button", { name: "Task 1", exact: true }).click();
  await page.getByLabel("Phiên bản khung", { exact: true }).selectOption("short");
  await expect(page.getByLabel("Gõ câu tiếng Anh", { exact: true })).toHaveValue("My old unfinished attempt");
  await page.getByLabel("Phiên bản khung", { exact: true }).selectOption("budget");
  const applications = page.getByTestId("frame-applications");
  await applications.locator("summary").first().click();
  await applications.getByLabel("Đổi ý của tôi — có gợi ý sẵn", { exact: true }).check();
  await applications.getByLabel("Thay ý: topic", { exact: true }).fill("my new course");
  await page.reload();
  await applications.locator("summary").first().click();
  await expect(applications.getByTestId("filled-frame")).toContainText("my new course");
  await expect.poll(async () => {
    const state = await (await page.request.get("/api/state")).json();
    const training = state.items["em-writing-exam"]?.value?.training;
    return [training?.budgetApplications?.reply?.values?.topic, training?.extendedDecks?.reply?.reviews, training?.decks?.reply?.run?.text];
  }).toEqual(["my new course", 3, "My old unfinished attempt"]);
});

test("library uses the same long frame and opens the matching Task 2 typing course", async ({ page }) => {
  const deck = BUDGET_DECKS.find((d) => d.id === "advantages")!;
  await page.goto("/model-library?sample=exam-writing-task2-tourism-communities");
  const guide = page.getByTestId("budget-frame-guide");
  await guide.locator("summary").click();
  await expect(guide).toContainText(`${fixedWordCount(deck)} từ tiếng Anh cố định`);
  await expect(guide.locator('[data-frame="fixed"]').first()).toHaveCSS("text-decoration-line", "underline");
  await guide.getByRole("link", { name: "Gõ thuộc đúng khung này →" }).click();
  await expect(page.getByRole("button", { name: "Task 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("frame-budget")).toContainText(`${fixedWordCount(deck)} từ cố định`);
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  await expect(page.getByTestId("typing-model")).toHaveText(deck.lines[0].en);
  const input = page.getByLabel("Gõ câu tiếng Anh", { exact: true });
  await input.fill("There are both advantages");
  await page.reload();
  await expect(input).toHaveValue("There are both advantages");
  await input.fill(fixedFrameText(deck.lines[0].en));
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText("Gõ đúng");
});

test("new whole-frame credit is separate; formal letters and long templates fit narrow screens", async ({ page }) => {
  const deck = BUDGET_DECKS.find((d) => d.id === "formal-reply")!;
  await page.addInitScript((saved) => { if (!localStorage.getItem("em-writing-exam")) localStorage.setItem("em-writing-exam", JSON.stringify(saved)); }, {
    ...EMPTY_EXAM, step: "memory", training: { ...EMPTY_MEMORY, frameRevision: FRAME_REVISION, format: "budget", deckId: deck.id, budgetDecks: { [deck.id]: { reviews: 0, run: { ...startMemory(deck.lines), phase: "whole" } } } },
  });
  await page.goto("/writing-studio?mode=exam");
  const input = page.getByLabel("Gõ toàn bộ khung", { exact: true });
  await input.fill(fixedFrameText(memoryTarget(deck.lines)));
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText("nhớ đúng thứ tự cả khung");
  await input.press("Enter");
  await expect(page.getByText("1/28 khung đã tự gõ được", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("frame-applications").locator("summary").first().click();
  await expect(page.getByTestId("filled-frame")).toContainText("Dear Ms Brown");
  await expect(page.getByTestId("filled-frame")).toContainText("Yours sincerely");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const result = await new AxeBuilder({ page }).include('[data-testid="writing-memory-course"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.getByTestId("frame-budget").scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("budget-letter-mobile.png") });
  await page.getByRole("button", { name: "Task 2", exact: true }).click();
  await page.getByTestId("frame-applications").locator("summary").first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByTestId("filled-frame").scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("budget-essay-mobile.png") });
});
