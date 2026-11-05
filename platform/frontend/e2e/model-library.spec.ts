import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";

test.beforeEach(resetTestDatabase);

test("Writing: all forms have ten samples, reading and bookmarks persist on server", async ({ page }) => {
  const downloads: string[] = [];
  page.on("request", (request) => { if (/model-library-data\/writing/.test(request.url())) downloads.push(request.url()); });
  await page.goto("/writing-studio?mode=exam");
  await page.getByRole("button", { name: "Đọc bài mẫu Writing" }).click();
  await expect(page.getByRole("heading", { name: "Thư viện bài mẫu", exact: true })).toBeVisible();
  const list = page.getByRole("list", { name: "Danh sách bài mẫu" });
  await expect(list.getByRole("button")).toHaveCount(10);
  for (const group of ["Writing Task 1", "Writing Task 2"]) {
    await page.getByRole("button", { name: new RegExp(group) }).click();
    await expect(page.getByRole("button", { name: new RegExp(group) })).toHaveAttribute("aria-pressed", "true");
    const form = page.getByLabel("1. Dạng bài");
    const options = await form.locator("option").evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value));
    expect(options).toHaveLength(10);
    for (const option of options) { await form.selectOption(option); await expect(form).toHaveValue(option); await expect(list.getByRole("button")).toHaveCount(10); }
  }
  expect(downloads).toHaveLength(0); // Browse the small index; answer bodies load only when opened.
  await page.getByLabel("2. Nhóm chủ đề").selectOption("technology");
  await page.getByLabel("Tìm trong 10 bài đang chọn").fill("quyen rieng tu");
  // Search may legitimately find no title: reset returns the full topic.
  await page.getByLabel("Tìm trong 10 bài đang chọn").fill("AI");
  await list.getByRole("button", { name: /AI/ }).first().click();
  await expect(page.getByRole("heading", { name: "Bài mẫu hoàn chỉnh", exact: true })).toBeVisible();
  expect(new Set(downloads).size).toBe(1);
  await page.getByRole("button", { name: "Lưu bài", exact: true }).click();
  await page.getByRole("button", { name: "Đánh dấu đã đọc", exact: true }).click();
  await page.getByRole("button", { name: "Chỉ đọc bài tiếng Anh", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nhớ ý trước, học cụm từ sau" })).toHaveCount(0);
  await expect(page.getByTestId("sample-answer-body").locator('p[lang="en"]')).toHaveCount(5);
  await expect.poll(async () => {
    const state = await (await page.request.get("/api/state")).json();
    return Object.values(state.items["em-model-library"]?.value?.items ?? {}).some((item: unknown) => (item as { read: boolean; saved: boolean }).read && (item as { saved: boolean }).saved);
  }).toBe(true);
  await page.evaluate(() => { localStorage.removeItem("em-model-library"); localStorage.removeItem("em-sync-meta"); });
  await page.reload();
  await expect(page.getByRole("button", { name: "Đã lưu bài", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Đã đọc bài", exact: true })).toHaveAttribute("aria-pressed", "true");
  const a11y = await new AxeBuilder({ page }).include('[data-testid="model-library"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("writing-library-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Danh sách 10 bài", exact: true }).click();
  await page.getByLabel("Tiến độ trong nhóm").selectOption("saved");
  await expect(list.getByRole("button")).toHaveCount(1);
});

test("Speaking has complete part-specific answers, deep links and previous/next navigation", async ({ page }) => {
  await page.goto("/speaking-studio");
  await page.getByRole("button", { name: "Đọc 150 bài mẫu" }).click();
  await page.getByRole("list", { name: "Danh sách bài mẫu" }).getByRole("button").first().click();
  await expect(page.getByTestId("sample-answer-body").getByRole("heading", { level: 4 })).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Bài trước", exact: true }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Danh sách 10 bài", exact: true }).click();
  await page.getByRole("button", { name: /Speaking Part 2/ }).click();
  await page.getByRole("list", { name: "Danh sách bài mẫu" }).getByRole("button").nth(1).click();
  await expect(page.getByText("Bài mẫu chọn phương án 2; lý do cần bám điều kiện của đề.")).toBeVisible();
  await expect(page.getByTestId("sample-answer-body")).toContainText("quiet carriage");
  await page.getByRole("button", { name: "Bài tiếp", exact: true }).first().click();
  await expect(page.getByText("Bài mẫu chọn phương án 3; lý do cần bám điều kiện của đề.")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("Bài mẫu chọn phương án 2; lý do cần bám điều kiện của đề.")).toBeVisible();
  await page.goto("/model-library?sample=speaking-part3-development-environment-10");
  await expect(page.getByRole("heading", { name: "Câu hỏi mở rộng", exact: true })).toBeVisible();
  await expect(page.getByTestId("sample-answer-body").getByRole("heading", { level: 4 })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Bài tiếp", exact: true }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Danh sách 10 bài", exact: true }).click();
  await expect(page.getByLabel("2. Nhóm chủ đề")).toHaveValue("environment");
  await expect(page.getByRole("button", { name: /Speaking Part 3/ })).toHaveAttribute("aria-pressed", "true");
});

test("failed downloads are retryable, invalid sample links recover and filters show a useful empty state", async ({ page }) => {
  let fail = true;
  await page.route("**/model-library-data/index.json", async (route) => fail ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  await page.goto("/model-library?sample=missing");
  await expect(page.getByRole("alert")).toContainText("Chưa tải được bài mẫu");
  fail = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Không tìm thấy bài trong liên kết");
  await page.getByLabel("Tiến độ trong nhóm").selectOption("saved");
  await expect(page.getByText("Chưa có bài phù hợp", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hiện đủ 10 bài", exact: true }).click();
  let failBucket = true;
  await page.route("**/model-library-data/writing-task1/**", async (route) => failBucket ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  await page.getByRole("list", { name: "Danh sách bài mẫu" }).getByRole("button").first().click();
  await expect(page.getByRole("alert")).toContainText("Chưa tải được bài mẫu");
  failBucket = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bài mẫu hoàn chỉnh" })).toBeVisible();
});


test("letter register hierarchy, reusable underlines, scaffold and paired examples preserve English and saved links", async ({ page }) => {
  await page.goto("/model-library?group=writing-task1&register=formal&type=formal-reply&topic=technology");
  await expect(page.getByRole("button", { name: /^Trang trọng/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("1. Dạng bài").locator("option")).toHaveCount(10);
  await page.getByRole("list", { name: "Danh sách bài mẫu" }).getByRole("button").first().click();
  const body = page.getByTestId("sample-answer-body");
  await expect(body).toContainText("Dear Ms Brown,");
  const fixed = body.locator('[data-frame="fixed"]');
  expect(await fixed.count()).toBeGreaterThan(10);
  expect((await fixed.allTextContents()).join(" ")).not.toMatch(/Ms Brown|Minh Nguyen|digital learning workshop/);
  await expect(fixed.first()).toHaveCSS("text-decoration-line", "underline");
  const textBefore = await body.locator('p[lang="en"]').allTextContents();
  await page.getByLabel("Gạch chân khung cần thuộc").uncheck();
  await expect(fixed).toHaveCount(0);
  expect(await body.locator('p[lang="en"]').allTextContents()).toEqual(textBefore);
  await page.getByLabel("Gạch chân khung cần thuộc").check();
  await page.getByTestId("letter-frame-guide").locator("summary").click();
  await expect(page.getByRole("heading", { name: "Khung đầy đủ của mục đích đang học" })).toBeVisible();
  await expect(page.getByTestId("letter-frame-guide")).toContainText("Yours faithfully");
  await expect(page.getByTestId("letter-frame-guide").locator("[data-frame-slot]").first()).toBeVisible();
  const a11y = await new AxeBuilder({ page }).include('[data-testid="model-library"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("formal-letter-frames.png"), fullPage: true });
  await page.getByRole("button", { name: "So sánh: bản thân mật cùng tình huống" }).click();
  await expect(body).toContainText("Hi Alex,");
  await expect(page).toHaveURL(/sample=writing-task1-reply-technology-01/);
  await page.reload();
  await expect(body).toContainText("Best wishes,");
  await page.getByRole("button", { name: "Danh sách 10 bài", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Thân mật/ })).toHaveAttribute("aria-pressed", "true");
  const form = page.getByLabel("1. Dạng bài");
  const options = await form.locator("option").evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value));
  expect(options).toHaveLength(8);
  for (const option of options) {
    await form.selectOption(option);
    await expect(form).toHaveValue(option);
    await expect(page.getByRole("list", { name: "Danh sách bài mẫu" }).getByRole("button")).toHaveCount(10);
  }
  await page.goto("/model-library?sample=writing-task1-application-work-03");
  await expect(page.getByRole("heading", { name: "Bài mẫu hoàn chỉnh" })).toBeVisible();
  await expect(body).toContainText("apply for the position of");
  await expect(body).toContainText("interview");
  await expect(page.getByRole("button", { name: /So sánh: bản thân mật/ })).toHaveCount(0);
});
