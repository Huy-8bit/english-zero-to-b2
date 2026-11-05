import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";
import { DOMAIN_PACKS, DOMAIN_PHRASES } from "../src/features/b2-rescue/topicVocabulary";
import { emptyState, makeRun, STORAGE_KEY } from "../src/features/b2-rescue/state";

test.beforeEach(resetTestDatabase);

test("all six fields offer six priorities, twelve complete entries and searchable examples", async ({ page }) => {
  await page.goto("/b2-four-hour");
  await page.getByRole("button", { name: "6 lĩnh vực cần thiết", exact: true }).click();
  for (const pack of DOMAIN_PACKS) {
    await page.getByLabel("Lĩnh vực cần học", { exact: true }).selectOption(pack.id);
    await expect(page.getByTestId("domain-word")).toHaveCount(6);
    const first = DOMAIN_PHRASES.find((p) => p.domain === pack.id)!;
    await page.getByTestId("domain-word").first().locator("summary").click();
    await expect(page.getByTestId("domain-word").first()).toContainText(first.writing);
    await expect(page.getByTestId("domain-word").first()).toContainText(first.speaking);
    await expect(page.getByTestId("domain-word").first()).toContainText(first.trap);
    await page.getByRole("button", { name: "Đủ 12 mục", exact: true }).click();
    await expect(page.getByTestId("domain-word")).toHaveCount(12);
    await page.getByRole("button", { name: "6 mục ưu tiên", exact: true }).click();
  }
  await page.getByLabel("Lĩnh vực cần học").selectOption("economy");
  await page.getByLabel("Tìm từ trong lĩnh vực đã chọn").fill("lạm phát");
  await expect(page.getByTestId("domain-word")).toHaveCount(1);
  await expect(page.getByTestId("domain-word")).toContainText("inflation");
  await page.getByLabel("Tìm từ trong lĩnh vực đã chọn").fill("missingword");
  await expect(page.getByText(/Chưa có kết quả/)).toBeVisible();
});

test("six-item recall persists independently, reloads in place and restores on another device", async ({ page, browser }) => {
  const saved = { ...emptyState(), items: { "benefits-1": { copies: 1, clean: 2, misses: 0, lastTurn: 1, at: 1 } },
    runs: { benefits: { ...makeRun(["benefits-1"]), text: "save ti" } }, drafts: { "writing-formal": { text: "My previous letter", checks: {}, at: 1 } } };
  await page.request.put("/api/state", { data: { items: { [STORAGE_KEY]: { value: saved, ts: Date.now() } } } });
  await page.goto("/b2-four-hour");
  await page.getByRole("button", { name: "6 lĩnh vực cần thiết", exact: true }).click();
  await page.getByRole("button", { name: "Gõ nhớ 6 mục đã chọn", exact: true }).click();
  const input = page.getByLabel("Gõ cụm tiếng Anh", { exact: true });
  await input.fill("the cost");
  await page.reload();
  await expect(input).toHaveValue("the cost");
  const phrases = DOMAIN_PHRASES.filter((p) => p.domain === "economy" && p.priority);
  for (let round = 0; round < 3; round++) {
    for (const p of phrases) {
      if (round > 0) await expect(page.getByTestId("phrase-drill").getByText(p.en, { exact: true })).toHaveCount(0);
      await input.fill(p.en); await input.press("Enter"); await input.press("Enter");
    }
  }
  await expect(page.getByTestId("domain-progress")).toContainText("6/12");
  await page.getByRole("button", { name: "Về danh sách từ", exact: true }).click();
  await page.getByLabel("Ba câu của tôi", { exact: true }).fill("High inflation can put pressure on families. The cost of living matters to me.");
  await expect(page.getByTestId("domain-vocabulary").locator("u").filter({ hasText: "inflation" })).toBeVisible();
  await expect.poll(async () => {
    const response = await (await page.request.get("/api/state")).json();
    const state = response.items[STORAGE_KEY]?.value;
    return [state?.items[phrases[0].id]?.clean, state?.runs.benefits.text, state?.drafts["writing-formal"].text, state?.drafts["domain-output-economy"]?.text];
  }).toEqual([2, "save ti", "My previous letter", "High inflation can put pressure on families. The cost of living matters to me."]);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("http://localhost:5174/b2-four-hour");
  await expect(other.getByTestId("domain-progress")).toContainText("6/12");
  await expect(other.getByLabel("Ba câu của tôi", { exact: true })).toHaveValue(/High inflation/);
  await other.getByRole("button", { name: "Kết quả & từ hay quên", exact: true }).click();
  await expect(other.getByText("1/60", { exact: true })).toBeVisible();
  await expect(other.getByText("6/72", { exact: true })).toBeVisible();
  await context.close();
});

test("domain option fits the existing twenty-minute block and works on mobile", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b2-four-hour");
  await page.getByRole("button", { name: "6 lĩnh vực cần thiết", exact: true }).click();
  await page.getByRole("button", { name: "Học phần này trong chặng 20 phút", exact: true }).click();
  await expect(page.getByTestId("block-time")).toHaveText("20:00");
  await expect(page.getByTestId("total-time")).toHaveText("240:00");
  await page.getByRole("button", { name: "Bắt đầu / tiếp tục giờ", exact: true }).click();
  await page.clock.fastForward(10_000);
  await expect(page.getByTestId("block-time")).toHaveText("19:50");
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByLabel("Lĩnh vực cần học").selectOption("school");
  await page.getByTestId("domain-word").first().locator("summary").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).include('[data-testid="domain-vocabulary"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("domain-school-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Gõ nhớ 6 mục đã chọn", exact: true }).click();
  await page.getByRole("button", { name: "Để ôn sau", exact: true }).click();
  await page.getByRole("button", { name: "Về danh sách từ · giữ lượt gõ", exact: true }).click();
  await page.getByRole("button", { name: "Đổi chủ đề với cụm lõi", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Chủ đề luyện", exact: true })).toBeVisible();
  await expect(page.getByTestId("block-time")).toHaveText("19:50");
});
