import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";
import { WRITING_FRAMES } from "../src/features/writing-studio/examFrames";

test.beforeEach(resetTestDatabase);

test("exam writing: frame, model, topic-specific drafts survive refresh without replacing the Studio draft", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("em-writing-draft")) localStorage.setItem("em-writing-draft", JSON.stringify({
      prompt: null, text: "My existing Studio draft must stay here.", taskType: "paragraph", level: "A1", mode: "minimal", clientId: "saved-studio-draft", parentId: null,
    }));
  });
  await page.goto("/writing");
  await page.getByRole("link", { name: /Ôn thi Writing theo khung/ }).click();
  await expect(page).toHaveURL(/\/writing-studio\?mode=exam$/);
  await expect(page.getByRole("heading", { name: "Ôn thi Writing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tra cứu khung", exact: true }).click();
  await page.getByLabel("Khung bài", { exact: true }).selectOption("opinion");
  await expect(page.getByText("Bố cục cần nhớ", { exact: true })).toBeVisible();
  await page.getByText("Xem bài mẫu và vai trò từng đoạn", { exact: true }).click();
  await expect(page.getByText(WRITING_FRAMES.find((f) => f.id === "opinion")!.sections[0].example, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "3. Viết áp dụng", exact: true }).click();
  await page.getByRole("button", { name: "Dùng khung đoạn 1", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /chỗ trong ngoặc vuông/ })).toBeVisible();
  const intro = page.getByLabel("1. Mở bài", { exact: true });
  await intro.fill("I believe that online learning should support classroom lessons.");
  await expect(page.getByRole("button", { name: "Dùng khung đoạn 1", exact: true })).toBeDisabled();
  await page.getByLabel("Chủ đề luyện", { exact: true }).selectOption("public-transport");
  await expect(intro).toHaveValue("");
  await intro.fill("Cities should invest in reliable buses because everyone needs to travel.");
  await page.reload();
  await expect(page.getByLabel("Chủ đề luyện", { exact: true })).toHaveValue("public-transport");
  await expect(intro).toHaveValue("Cities should invest in reliable buses because everyone needs to travel.");
  await page.getByLabel("Chủ đề luyện", { exact: true }).selectOption("online-learning");
  await expect(intro).toHaveValue("I believe that online learning should support classroom lessons.");
  await page.getByLabel("Ẩn khung khi tự viết", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Dùng khung đoạn 1", exact: true })).toHaveCount(0);
  await expect(intro).toHaveValue("I believe that online learning should support classroom lessons.");
  await page.getByText("Xem bài đã ghép", { exact: true }).click();
  await expect(page.getByLabel("Bài viết đã ghép", { exact: true })).toHaveValue("I believe that online learning should support classroom lessons.");
  await page.getByRole("button", { name: "Viết bài", exact: true }).click();
  await expect(page.getByLabel("Bài viết", { exact: true })).toHaveValue("My existing Studio draft must stay here.");
  await page.getByRole("button", { name: "Ôn thi theo khung", exact: true }).click();
  await expect(intro).toHaveValue("I believe that online learning should support classroom lessons.");
});

test("exam frames work without AI and are accessible in view, writing and memory modes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/ai/status", (r) => r.fulfill({ json: { enabled: false, configured: false, simulated: false } }));
  const writes: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/") && r.method() !== "GET") writes.push(r.method() + " " + r.url()); });
  await page.goto("/writing-studio?mode=exam");
  await page.getByRole("button", { name: "Tra cứu khung", exact: true }).click();
  await page.getByLabel("Khung bài", { exact: true }).selectOption("formal-email");
  await expect(page.getByText("Bố cục cần nhớ", { exact: true })).toBeVisible();
  for (const name of ["Tra cứu khung", "3. Viết áp dụng", "1. Gõ thuộc khung"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const result = await new AxeBuilder({ page }).include('[data-testid="writing-exam"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  }
  await page.getByRole("button", { name: "Bắt đầu gõ từng câu", exact: true }).click();
  await expect(page.getByTestId("typing-practice")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("writing-frame-memory.png"), fullPage: true });
  expect(writes.filter((r) => !r.endsWith("/api/activity/heartbeat") && !r.endsWith("/api/state"))).toEqual([]);
});
