import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";
import { PHRASES } from "../src/features/b2-rescue/content";
import { emptyState, makeRun, STORAGE_KEY } from "../src/features/b2-rescue/state";

test.beforeEach(resetTestDatabase);

test("open from Writing; complete a ten-phrase pack with real recall and database restore", async ({ page, browser }) => {
  await page.goto("/writing");
  await page.getByRole("link", { name: /Chỉ còn 4 tiếng/ }).click();
  await expect(page).toHaveURL(/b2-four-hour/);
  await page.getByRole("button", { name: "Bắt đầu 10 cụm đầu tiên" }).click();
  const input = page.getByLabel("Gõ cụm tiếng Anh", { exact: true });
  await input.fill("save ti");
  await page.reload();
  await expect(input).toHaveValue("save ti");
  const phrases = PHRASES.filter((p) => p.pack === "benefits");
  for (let round = 0; round < 3; round++) {
    for (const phrase of phrases) {
      if (round > 0) await expect(page.getByTestId("phrase-drill").getByText(phrase.en, { exact: true })).toHaveCount(0);
      await input.fill(phrase.en);
      await input.press("Enter");
      await expect(page.getByRole("status")).toContainText(round === 0 ? "Gõ đúng" : "Đúng, không dùng gợi ý");
      await input.press("Enter");
    }
  }
  await expect(page.getByTestId("drill-finished")).toBeVisible();
  await expect.poll(async () => {
    const s = await (await page.request.get("/api/state")).json();
    return s.items[STORAGE_KEY]?.value?.items[phrases[0].id]?.clean;
  }).toBe(2);
  const other = await browser.newContext();
  const restored = await other.newPage();
  await restored.goto("http://localhost:5174/b2-four-hour");
  await expect(restored.getByTestId("drill-finished")).toBeVisible();
  await restored.getByRole("button", { name: "Kết quả & từ hay quên" }).click();
  await expect(restored.getByText("10/60", { exact: true })).toBeVisible();
  await other.close();
});

test("a hint cannot earn recall credit; unfinished feedback survives reload", async ({ page }) => {
  const seed = { ...emptyState(), block: "review", runs: { review: makeRun(PHRASES.slice(0, 10).map((p) => p.id), true) } };
  await page.request.put("/api/state", { data: { items: { [STORAGE_KEY]: { value: seed, ts: Date.now() } } } });
  await page.goto("/b2-four-hour");
  await expect(page.getByTestId("phrase-drill").getByText("save time", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Gợi ý / xem đáp án" }).click();
  await page.getByLabel("Gõ cụm tiếng Anh", { exact: true }).fill("save time");
  await page.getByRole("button", { name: "Kiểm tra ↵", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Chưa tính là tự nhớ");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Chưa tính là tự nhớ");
  await page.getByRole("button", { name: "Tiếp tục ↵", exact: true }).click();
  await expect(page.getByTestId("phrase-drill")).toContainText("giảm chi phí");
  await expect.poll(async () => {
    const s = await (await page.request.get("/api/state")).json();
    return s.items[STORAGE_KEY]?.value?.items["benefits-1"];
  }).toMatchObject({ clean: 0, misses: 1 });
});

test("clock caps a block, pauses on route exit, and resumes with no lost seconds", async ({ page }) => {
  await page.clock.install();
  await page.goto("/b2-four-hour");
  await page.getByRole("button", { name: "Bắt đầu / tiếp tục giờ" }).click();
  await page.clock.fastForward(12_000);
  await expect(page.getByTestId("block-time")).toHaveText("04:48");
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.clock.fastForward(30_000);
  await expect(page.getByTestId("block-time")).toHaveText("04:48");
  await page.getByRole("button", { name: "Bắt đầu / tiếp tục giờ" }).click();
  await page.clock.fastForward(400_000);
  await expect(page.getByTestId("block-time")).toHaveText("00:00");
  await expect(page.getByTestId("total-time")).toHaveText("235:00");
  await expect(page.getByRole("status")).toContainText("Hết thời gian chặng này");
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("benefits");
  await page.getByRole("button", { name: "Bắt đầu / tiếp tục giờ" }).click();
  await page.clock.fastForward(3000);
  await page.getByRole("link", { name: "Khung Writing đã học", exact: true }).click();
  await page.goto("/b2-four-hour");
  await expect(page.getByTestId("block-time")).toHaveText("19:57");
  await expect(page.getByRole("button", { name: "Bắt đầu / tiếp tục giờ" })).toBeEnabled();
});

test("topic transfer, writing and speaking save separately; examples underline learned phrases", async ({ page }) => {
  await page.goto("/b2-four-hour");
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("transfer");
  await page.getByLabel("Cụm còn thiếu").fill("save time");
  await page.getByRole("button", { name: "Kiểm tra câu", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đúng — đã tự điền");
  await page.getByLabel("Câu của tôi với chủ đề này").fill("Online courses help me save time because I can study at home.");
  await page.getByText("Writing · đề cụ thể & đoạn minh họa", { exact: true }).click();
  await expect(page.locator("u").filter({ hasText: "save time" }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("writing");
  await page.getByRole("textbox", { name: "Bài viết của tôi", exact: true }).fill("I am writing to enquire about your course. Please let me know if evening classes are available.");
  await page.getByLabel("Đã trả lời đúng các yêu cầu của đề", { exact: true }).check();
  await expect(page.getByText("Nhận diện 2 cụm trong bộ đã học", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Bài vận dụng", exact: true }).selectOption("informal");
  await expect(page.getByRole("textbox", { name: "Bài viết của tôi", exact: true })).toBeEmpty();
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("talk");
  await page.getByRole("button", { name: "Ghi âm để nghe lại" }).click();
  await expect(page.getByText("1s / 60s", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dừng ghi âm" }).click();
  await expect(page.getByLabel("Bản nói của tôi")).toHaveAttribute("src", /^blob:/);
  await page.getByRole("textbox", { name: "Ý chính / lời tôi đã nói", exact: true }).fill("I tend to read in the evening. It helps me reduce stress.");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Ý chính / lời tôi đã nói", exact: true })).toHaveValue(/I tend to read/);
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("writing");
  await expect(page.getByRole("textbox", { name: "Bài viết của tôi", exact: true })).toHaveValue(/enquire about your course/);
  await expect(page.getByLabel("Đã trả lời đúng các yêu cầu của đề", { exact: true })).toBeChecked();
  await expect.poll(async () => {
    const s = await (await page.request.get("/api/state")).json();
    return Object.keys(s.items[STORAGE_KEY]?.value?.drafts ?? {});
  }).toEqual(expect.arrayContaining(["topic-education", "writing-formal", "speaking-part1"]));
});

test("narrow screens, keyboard labels and recording denial remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b2-four-hour");
  await page.screenshot({ path: test.info().outputPath("b2-course-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("letters");
  await page.getByTestId("phrase-drill").scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("b2-drill-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).include('[data-testid="b2-rescue"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("combobox", { name: "Chặng hiện tại", exact: true }).selectOption("talk");
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new Error("denied"); }; });
  await page.getByRole("button", { name: "Ghi âm để nghe lại" }).click();
  await expect(page.getByRole("alert")).toContainText("Chưa dùng được micro");
  await page.getByLabel("Đã trả lời đúng câu được hỏi").check();
  await page.getByRole("button", { name: "Tra cứu 108 cụm" }).click();
  await page.getByLabel("Tìm cụm hoặc nghĩa Việt").fill("không có cụm này");
  await expect(page.getByText(/Không tìm thấy cụm phù hợp/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
