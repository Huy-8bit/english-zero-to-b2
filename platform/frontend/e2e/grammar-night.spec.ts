import { expect, test, type Page } from "@playwright/test";
import { resetTestDatabase } from "./database";
import { COMPACT_GRAMMAR } from "../src/features/lesson-player/compactGrammar";
import { BRIEF_QUESTIONS, questionsForBrief } from "../src/features/lesson-player/briefQuestions";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(resetTestDatabase);

/** One lesson's loop: guess → learn cards (Enter through them) → recall 3 questions → result. */
async function readLesson(page: Page) {
  const hook = page.getByTestId("night-hook");
  await hook.or(page.getByTestId("night-learn")).first().waitFor();
  if (await hook.isVisible()) {
    await page.keyboard.press("1");
    await expect(hook.getByText(/Đoán đúng|Chưa đúng — đáp án nằm trong bài/)).toBeVisible();
    await expect(hook.getByText("Giải thích")).toHaveCount(0); // a pretest: the answer stays hidden
    await page.keyboard.press("Enter");
  }
  const quiz = page.getByTestId("night-quiz");
  for (let i = 0; i < 12; i++) { // through the cards; traps are revealed one by one (Enter on a question does nothing)
    await quiz.or(page.getByTestId("night-learn")).first().waitFor();
    if (await quiz.isVisible()) break;
    await page.keyboard.press("Enter");
  }
  for (let i = 1; i <= 3; i++) {
    await expect(quiz.getByText(`Câu ${i}/3`)).toBeVisible();
    await page.keyboard.press("1"); // a key (or click) is the answer: graded at once, with the explanation
    await expect(quiz.getByRole("button", { name: /^(Câu tiếp|Xong bài)/ })).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("night-result").getByText(/Nhớ được \d\/3/)).toBeVisible();
}

test("grammar in one night: guess, learn in cards, recall; earlier lessons come back; review before sleep", async ({ page }) => {
  await page.goto("/grammar-night");
  await expect(page.getByRole("heading", { name: "Ngữ pháp 1 đêm" })).toBeVisible();
  await page.getByRole("button", { name: /Từng bài/ }).click();
  await page.getByRole("button", { name: "8 giờ", exact: true }).click();
  await expect(page.getByText("≈3:26")).toBeVisible(); // 128 lessons in 8 h minus 8 breaks of 5 min
  await page.getByRole("button", { name: "Bắt đầu đêm học" }).click();
  await expect(page).toHaveURL(/\/learn\/A0-G001\?mode=night/);
  await expect(page.getByTestId("night-flash")).toHaveCount(0); // nothing read yet
  await readLesson(page);
  await page.getByTestId("night-learn").or(page.getByTestId("night-result")).first().waitFor();
  for (const id of ["A0-G002", "A0-G003"]) {
    await page.keyboard.press("Enter"); // → next lesson, still in night mode
    await expect(page).toHaveURL(new RegExp(`/learn/${id}\\?mode=night`));
    await readLesson(page);
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn\/A0-G004\?mode=night/);
  // the 4th lesson opens with a question from an earlier one
  const flash = page.getByTestId("night-flash");
  await expect(flash.getByText(/Từ bài A0-G00[123]/)).toBeVisible();
  await flash.getByRole("button", { name: "Bỏ qua câu này" }).click();
  await page.getByRole("button", { name: "Chưa biết — vào học" }).click();
  await expect(page.getByTestId("night-learn").getByRole("button", { name: /Hiểu/ })).toBeVisible();
  await page.getByRole("button", { name: /Bỏ qua, sang A0-G005/ }).click();
  await expect(page).toHaveURL(/\/learn\/A0-G005\?mode=night/);
  await page.goto("/grammar-night");
  await expect(page.getByText(/^4\/128/)).toBeVisible();
  await expect(page.getByRole("link", { name: /A0-G004.*bỏ qua/ })).toBeVisible(); // skipped → not remembered yet
  await expect(page.getByRole("button", { name: /Học tiếp: A0-G005/ })).toBeVisible();
  await page.getByTestId("bedtime").getByRole("button", { name: "Bắt đầu ôn" }).click();
  await expect(page.getByTestId("night-review").getByText(/Từ bài A0-G00[1-3]/)).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Kết thúc đêm học" }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu đêm học" })).toBeVisible();
  await page.goto("/learn/A0-G004"); // the previous lesson mode is back
  await expect(page.getByText("Nhiệm vụ hôm nay")).toBeVisible();
});

test("an existing night follows path progress, preserves results, and notices manual undo", async ({ page, request }) => {
  await request.post("/api/progress/mark-up-to", { data: { level: "A1" } });
  const path = await (await request.get("/api/path")).json();
  const units = path.levels.flatMap((lv: { blocks: { lessons: { id: string; status: string }[] }[] }) => lv.blocks.flatMap((b) => b.lessons));
  const done = units.filter((u: { status: string }) => u.status === "completed").length;
  await page.addInitScript(() => {
    if (localStorage.getItem("em-grammar-night")) return;
    localStorage.setItem("em-grammar-night", JSON.stringify({
      start: Date.now(), hours: 8, lastBreak: Date.now(), prevMode: "journey", plan: "full",
      units: [{ id: "A1-G002", title: "Old lesson list", level: "A1" }],
      results: { "A1-G002": { correct: 3, total: 3, seconds: 200 } },
    }));
    localStorage.setItem("em-lesson-mode", JSON.stringify("night"));
  });
  await page.goto("/grammar-night");
  await expect(page.getByText(new RegExp(`^${done}/${units.length}`))).toBeVisible();
  await expect(page.getByText(`Đã hoàn thành theo lộ trình ${done} bài · đã đọc đêm nay 0 bài`)).toBeVisible();
  await expect(page.getByRole("button", { name: /Học tiếp: A2-G001/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("em-grammar-night")!));
  expect(saved.results).toEqual({ "A1-G002": { correct: 3, total: 3, seconds: 200 } });
  expect(saved.units).toHaveLength(units.length);

  // A path change made while a night is already running also changes the next lesson.
  await request.post("/api/progress/mark-up-to", { data: { unit_id: "A2-G002" } });
  await page.reload();
  await page.getByRole("button", { name: /Học tiếp: A2-G003/ }).click();
  await expect(page).toHaveURL(/\/learn\/A2-G003\?mode=night/);
  // The lesson player refreshes the path too, rather than using the stored list alone.
  await request.put("/api/progress/A2-G004", { data: { status: "completed" } });
  await page.reload();
  await page.getByRole("button", { name: "Chưa biết — vào học" }).click();
  await expect(page.getByRole("button", { name: /Bỏ qua, sang A2-G005/ })).toBeVisible();

  await request.put("/api/progress/A1-G003", { data: { status: "not_started" } });
  await page.goto("/grammar-night");
  await page.getByRole("button", { name: /Học tiếp: A1-G003/ }).click();
  await expect(page).toHaveURL(/\/learn\/A1-G003\?mode=night/);
});

test("a full night defaults to unfinished path lessons and still allows an explicit full review", async ({ page, request }) => {
  await request.post("/api/progress/mark-up-to", { data: { level: "A1" } });
  await page.goto("/grammar-night");
  await page.getByRole("button", { name: /Từng bài/ }).click();
  await page.getByRole("button", { name: "Bắt đầu đêm học" }).click();
  await expect(page).toHaveURL(/\/learn\/A2-G001\?mode=night/);
  await page.goto("/grammar-night");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Kết thúc đêm học" }).click();
  await page.getByRole("button", { name: /Từng bài/ }).click();
  await page.getByRole("button", { name: /Ôn lại tất cả/ }).click();
  await page.getByRole("button", { name: "Bắt đầu đêm học" }).click();
  await expect(page).toHaveURL(/\/learn\/A0-G001\?mode=night/);
});

test("concise night: follows A2 progress, merges comparisons, optional check, persists without XP or path writes", async ({ page, request }) => {
  await request.post("/api/progress/mark-up-to", { data: { unit_id: "A2-G002" } });
  const before = await (await request.get("/api/progress")).json();
  const stats = await (await request.get("/api/stats")).json();
  const writes: string[] = [];
  // /api/state mirrors browser state (lib/syncState): not an XP or path write
  page.on("request", (r) => { if (r.url().includes("/api/") && !r.url().includes("/api/state") && r.method() !== "GET") writes.push(r.method() + " " + r.url()); });
  await page.goto("/grammar-night");
  await expect(page.getByRole("button", { name: "3 giờ 30", exact: true })).toHaveAttribute("class", /bg-primary/);
  await page.getByRole("button", { name: "Bắt đầu đêm học" }).click();
  await expect(page).toHaveURL(/\/learn\/A2-G003\?mode=night/);
  const brief = page.getByTestId("night-brief");
  await expect(brief.getByRole("heading", { name: /Hiện tại hoàn thành: hình thức/ })).toBeVisible();
  await expect(brief.getByText(/gộp 6 bài/)).toBeVisible();
  await expect(page.getByTestId("night-hook")).toHaveCount(0);
  await page.getByRole("button", { name: "Tiếp: Khung câu và ví dụ" }).click();
  await expect(brief.getByText("I've lost my keys.", { exact: false })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("compact-night.png"), fullPage: true });
  await page.getByRole("button", { name: "Tiếp: Điểm dễ nhầm" }).click();
  await page.getByTestId("brief-self-check").getByText("Tự kiểm tra 20 giây (tùy chọn)").click();
  await expect(brief.getByText(/Vì sao khác nhau/)).toBeVisible();
  await page.getByRole("button", { name: "Đã đọc — chủ điểm tiếp" }).click();
  await expect(page).toHaveURL(/\/learn\/A1-G019\?mode=night/); // next unfinished source is A2-G008, part of the future brief
  await page.goto("/grammar-night");
  await expect(page.getByText(/đã đọc đêm nay 1 chủ điểm/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/đã đọc đêm nay 1 chủ điểm/)).toBeVisible();
  await page.goto("/learn/A2-G007?mode=night"); // an old comparison link now opens the same merged brief
  await expect(page.getByTestId("night-brief").getByRole("heading", { name: /Hiện tại hoàn thành: hình thức/ })).toBeVisible();
  expect(writes).toEqual([]);
  expect(await (await request.get("/api/progress")).json()).toEqual(before);
  const after = await (await request.get("/api/stats")).json();
  expect(after.xp_total).toBe(stats.xp_total);
  expect(after.streak).toEqual(stats.streak);
  expect(after.achievements).toEqual(stats.achievements);
});

test("legacy night adopts the concise path and resets time without losing saved readings", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("em-grammar-night")) return;
    localStorage.setItem("em-grammar-night", JSON.stringify({
      start: Date.now() - 48 * 3_600_000, hours: 8, lastBreak: Date.now(), prevMode: "journey",
      units: [], results: { "A2-G003": { correct: 2, total: 3, seconds: 150 } },
    }));
    localStorage.setItem("em-lesson-mode", JSON.stringify("night"));
  });
  await page.goto("/grammar-night");
  await expect(page.getByText(/Bản gọn: 29 chủ điểm từ 118 bài gốc/)).toBeVisible();
  await page.getByRole("button", { name: "Còn 3 giờ từ bây giờ", exact: true }).click();
  // A few elapsed milliseconds may already display 2h59 because the clock floors minutes.
  await expect(page.getByText(/còn (3h00|2h59) \/ 3 giờ/)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("em-grammar-night")!));
  expect(saved.results).toEqual({ "A2-G003": { correct: 2, total: 3, seconds: 150 } });
  expect(saved.units).toHaveLength(29);
  expect(saved.hours).toBe(3);
  expect(Date.now() - saved.start).toBeLessThan(10_000);
  await page.getByRole("button", { name: /Bắt đầu: A0-G004/ }).click();
  await expect(page.getByTestId("night-brief")).toBeVisible();
});

test("finishing the last concise topic offers speaking and writing", async ({ page }) => {
  await page.addInitScript((read) => {
    localStorage.setItem("em-grammar-night", JSON.stringify({
      start: Date.now(), hours: 3.5, lastBreak: Date.now(), prevMode: "journey", plan: "compact",
      units: [], results: {}, compactRead: read,
    }));
  }, COMPACT_GRAMMAR.slice(0, -1).map((b) => b.id));
  await page.goto(`/learn/${COMPACT_GRAMMAR.at(-1)!.id}?mode=night`);
  await expect(page.getByTestId("night-brief")).toBeVisible();
  await page.getByRole("button", { name: "Tiếp: Khung câu và ví dụ" }).click();
  await page.getByRole("button", { name: "Tiếp: Điểm dễ nhầm" }).click();
  await page.getByRole("button", { name: "Đã đọc — xem tổng kết" }).click();
  await expect(page).toHaveURL(/\/grammar-night$/);
  await expect(page.getByText(/^29\/29/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Luyện nói", exact: true })).toHaveAttribute("href", "/speaking");
  await expect(page.getByRole("link", { name: "Luyện viết", exact: true })).toHaveAttribute("href", "/writing");
});

test("brief MCQs: six checks, immediate explanation, refresh, retry misses and review without XP or path writes", async ({ page, request }) => {
  const before = await (await request.get("/api/progress")).json();
  const stats = await (await request.get("/api/stats")).json();
  const writes: string[] = [];
  // /api/state mirrors browser state (lib/syncState): not an XP or path write
  page.on("request", (r) => { if (r.url().includes("/api/") && !r.url().includes("/api/state") && r.method() !== "GET") writes.push(r.method() + " " + r.url()); });
  await page.goto("/grammar-night");
  await page.getByRole("button", { name: "Bắt đầu đêm học" }).click();
  await page.getByRole("button", { name: "4. Trắc nghiệm (6)", exact: true }).click();
  const questions = questionsForBrief(COMPACT_GRAMMAR[0].id);
  const quiz = page.getByTestId("brief-quiz");
  await expect(quiz.getByText("Câu 1/6", { exact: true })).toBeVisible();
  await expect(quiz.getByRole("status")).toHaveCount(0);
  await page.keyboard.press(String((questions[0].correct + 1) % 4 + 1));
  await expect(quiz.getByRole("status").getByText(questions[0].explanation)).toBeVisible();
  await page.reload();
  await expect(quiz.getByText("Câu 1/6", { exact: true })).toBeVisible();
  await expect(quiz.getByRole("status").getByText(questions[0].explanation)).toBeVisible();
  await expect(quiz.getByRole("group").getByRole("button").first()).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(quiz.getByText("Câu 2/6", { exact: true })).toBeVisible();
  for (const q of questions.slice(1)) {
    await quiz.getByRole("group").getByRole("button").nth(q.correct).click();
    await quiz.getByRole("button", { name: /^(Câu tiếp|Xem kết quả)$/ }).click();
  }
  const result = page.getByTestId("brief-quiz-result");
  await expect(result.getByRole("heading", { name: "Đúng 5/6 câu trong lượt này" })).toBeVisible();
  await result.getByRole("button", { name: "Ôn 1 câu sai", exact: true }).click();
  await expect(quiz.getByText("Câu 1/1", { exact: true })).toBeVisible();
  await quiz.getByRole("group").getByRole("button").nth(questions[0].correct).click();
  await quiz.getByRole("button", { name: "Xem kết quả", exact: true }).click();
  await expect(result.getByRole("heading", { name: "Đúng 1/1 câu trong lượt này" })).toBeVisible();
  await result.getByRole("button", { name: "Đã học — chủ điểm tiếp", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/A0-G010\?mode=night/);
  await page.goto(`/learn/${questions[0].brief}?mode=night`);
  // Create another miss, then retrieve it from the shared overview queue.
  await page.getByRole("button", { name: "4. Trắc nghiệm (6)", exact: true }).click();
  await quiz.getByRole("group").getByRole("button").nth((questions[0].correct + 1) % 4).click();
  await quiz.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByRole("button", { name: "Thoát về trang đêm học", exact: true }).click();
  const overview = page.getByTestId("brief-practice-overview");
  await overview.getByRole("button", { name: "Ôn câu sai (1)", exact: true }).click();
  await expect(quiz.getByText(questions[0].prompt, { exact: true })).toBeVisible();
  const a11y = await new AxeBuilder({ page }).include('[data-testid="brief-quiz"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await quiz.getByRole("group").getByRole("button").nth(questions[0].correct).click();
  await quiz.getByRole("button", { name: "Xem kết quả", exact: true }).click();
  await expect(overview.getByRole("button", { name: "Ôn câu sai (0)", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
  expect(await (await request.get("/api/progress")).json()).toEqual(before);
  const after = await (await request.get("/api/stats")).json();
  expect(after.xp_total).toBe(stats.xp_total);
  expect(after.streak).toEqual(stats.streak);
  expect(after.achievements).toEqual(stats.achievements);
});

test("mixed brief review uses studied topics, keeps feedback after refresh and leaves reading history intact", async ({ page }) => {
  const topics = COMPACT_GRAMMAR.slice(0, 2).map((b) => b.id);
  const miss = questionsForBrief(topics[0])[0];
  await page.addInitScript(({ topics, miss }) => {
    if (localStorage.getItem("em-grammar-night")) return;
    localStorage.setItem("em-grammar-night", JSON.stringify({
      start: Date.now(), hours: 3.5, lastBreak: Date.now(), prevMode: "journey", plan: "compact",
      units: [], results: { "A1-G001": { correct: 2, total: 3, seconds: 120 } }, compactRead: topics,
      briefAnswers: { [miss.id]: { correct: false, choice: (miss.correct + 1) % 4, attempts: 1, at: Date.now() } },
    }));
  }, { topics, miss });
  await page.goto("/grammar-night");
  await page.getByTestId("brief-practice-overview").getByRole("button", { name: "Ôn trộn 12 câu", exact: true }).click();
  const quiz = page.getByTestId("brief-quiz");
  await expect(quiz.getByText(miss.prompt, { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("em-grammar-night")!));
  expect(saved.briefQuiz.ids).toHaveLength(12);
  expect(new Set(saved.briefQuiz.ids).size).toBe(12);
  expect(new Set(saved.briefQuiz.ids.map((id: string) => BRIEF_QUESTIONS.find((q) => q.id === id)!.brief))).toEqual(new Set(topics));
  await quiz.getByRole("group").getByRole("button").nth(miss.correct).click();
  await page.reload();
  await expect(quiz.getByRole("status").getByText(miss.explanation)).toBeVisible();
  await quiz.getByRole("button", { name: "Câu tiếp", exact: true }).click();
  await expect(quiz.getByText("Câu 2/12", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("brief-mixed-review.png"), fullPage: true });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("em-grammar-night")!));
  expect(after.compactRead).toEqual(topics);
  expect(after.results).toEqual(saved.results);
});

test("topics studied in another browser: mark 1–23 when starting, the overview shows 23/29 and one can be unmarked", async ({ page }) => {
  await page.goto("/grammar-night");
  await page.getByLabel("Đã học trước đến chủ điểm").selectOption("23");
  await page.getByRole("button", { name: "Bắt đầu đêm học" }).click();
  await expect(page).toHaveURL(/\/learn\/.+\?mode=night/);
  await page.goto("/grammar-night");
  await expect(page.getByText(/^23\/29/)).toBeVisible();
  await expect(page.getByText("Đúng nhịp", { exact: false }).first()).toBeVisible(); // earlier study is not "ahead of plan"
  await page.getByRole("button", { name: "Bỏ dấu đã học" }).first().click();
  await expect(page.getByText(/^22\/29/)).toBeVisible();
  await page.getByLabel("Đánh dấu đã học đến chủ điểm").selectOption("23");
  await page.getByRole("button", { name: "Đánh dấu 1–23" }).click();
  await expect(page.getByText(/^23\/29/)).toBeVisible();
});
