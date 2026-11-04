import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetTestDatabase } from "./database";

test.beforeEach(resetTestDatabase);

test("dark reader: comfortable type, saved settings, draft intact and normal theme restored outside study", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("em-theme", "light"));
  await page.goto("/writing-studio?mode=exam");
  await expect(page.locator("html")).toHaveAttribute("data-reader", "black");
  await page.getByRole("button", { name: "2. Viết theo khung", exact: true }).click();
  const text = page.getByLabel("1. Mở bài", { exact: true });
  await text.fill("My draft remains safe when I change the reading appearance.");
  await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trang đọc", exact: true });
  await dialog.getByRole("radio", { name: "Ấm", exact: true }).check();
  await dialog.getByRole("radio", { name: "23", exact: true }).check();
  await dialog.getByRole("radio", { name: "Rộng", exact: true }).check();
  await dialog.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reader", "warm");
  await expect(text).toHaveCSS("font-size", "23px");
  await expect(text).toHaveCSS("line-height", "48.3px");
  await expect(text).toHaveValue("My draft remains safe when I change the reading appearance.");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reader", "warm");
  await expect(text).toHaveCSS("font-size", "23px");
  await expect(text).toHaveValue("My draft remains safe when I change the reading appearance.");
  await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
  await dialog.getByRole("radio", { name: "Đen", exact: true }).check();
  await dialog.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reader", "black");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reader", "black");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(9, 11, 14)");
  // The compact header still offers navigation, including on desktop.
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-reader");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.goto("/writing-studio?mode=exam");
  await expect(page.locator("html")).toHaveAttribute("data-reader", "black");
  await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
  await dialog.getByLabel("Giao diện máy đọc sách", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-reader");
  await expect(text).toHaveValue("My draft remains safe when I change the reading appearance.");
});

test("reader palettes keep lessons legible and accessible, without page animation", async ({ page }) => {
  await page.goto("/grammar-night");
  await page.getByRole("button", { name: "Bắt đầu đêm học", exact: true }).click();
  await page.getByRole("button", { name: "Tiếp: Khung câu và ví dụ", exact: true }).click();
  const prose = page.getByTestId("night-brief").locator(".prose-em");
  await expect(prose).toHaveCSS("font-size", "19px");
  for (const [tone, label] of [["paper", "Giấy"], ["warm", "Ấm"], ["night", "Đêm"], ["black", "Đen"]]) {
    await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Trang đọc", exact: true });
    await dialog.getByRole("radio", { name: label, exact: true }).check();
    const controls = await new AxeBuilder({ page }).include('[data-testid="reader-settings"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(controls.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    await dialog.getByRole("button", { name: "Xong", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-reader", tone);
    await page.screenshot({ path: test.info().outputPath(`reader-${tone}.png`), fullPage: true });
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  }
  await page.getByRole("button", { name: "4. Trắc nghiệm (6)", exact: true }).click();
  await expect(page.getByTestId("brief-quiz")).toBeVisible();
  await expect(page.getByTestId("brief-quiz").getByRole("group").getByRole("button").first()).toHaveCSS("transition-duration", "0s");
  await page.screenshot({ path: test.info().outputPath("night-reader.png"), fullPage: true });
});

test("saved paper preference switches to black once and keeps custom reading settings and drafts", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("em-reader-settings")) return;
    localStorage.setItem("em-reader-settings", JSON.stringify({ enabled: true, tone: "paper", size: 21, font: "sans", spacing: "wide", focus: false }));
    localStorage.setItem("em-writing-draft", JSON.stringify({ text: "Keep my existing writing." }));
  });
  await page.goto("/grammar-sprint");
  await expect(page.locator("html")).toHaveAttribute("data-reader", "black");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(9, 11, 14)");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("em-reader-settings")!));
  expect(saved).toEqual({ enabled: true, tone: "black", size: 21, font: "sans", spacing: "wide", focus: false });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("em-writing-draft")!).text)).toBe("Keep my existing writing.");
  // An explicit later choice is respected; this is a one-time default change.
  await page.getByRole("button", { name: "Tùy chỉnh trang đọc", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trang đọc", exact: true });
  await dialog.getByRole("radio", { name: "Giấy", exact: true }).check();
  await dialog.getByRole("button", { name: "Xong", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reader", "paper");
});
