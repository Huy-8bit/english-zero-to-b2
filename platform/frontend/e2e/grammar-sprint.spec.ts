import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

test("grammar sprint: plan in days, core on one screen, 6-question check, next lesson with Enter", async ({ page }) => {
  await page.goto("/grammar-sprint");
  await expect(page.getByRole("heading", { name: "Sprint ngữ pháp" })).toBeVisible();
  await expect(page.getByText("0/128")).toBeVisible();
  await page.getByRole("button", { name: "4 ngày", exact: true }).click();
  await expect(page.getByText(/Ngày 1\/4 · hôm nay 0\/32 bài/)).toBeVisible();
  await page.getByRole("button", { name: /Bắt đầu: A0-G001/ }).click();
  await expect(page).toHaveURL(/\/learn\/A0-G001\?mode=sprint/);
  await expect(page.getByText("1 · Nắm cốt lõi (≈3 phút)")).toBeVisible();
  await page.keyboard.press("Enter"); // → 6-question check
  const check = page.getByTestId("test-out");
  await expect(check.getByText(/Câu 1\/6/)).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const radio = page.locator("main [data-item] [role=radio]:not([disabled])");
    const tokens = page.locator("main [data-item] button[aria-label^='Thêm']");
    const input = page.locator("main [data-item] input:not([disabled]), main [data-item] textarea:not([disabled])");
    await radio.or(tokens).or(input).first().waitFor({ timeout: 5000 });
    if (await radio.count()) await radio.last().click();
    else if (await tokens.count()) { while (await tokens.count()) await tokens.first().click(); }
    else await input.first().fill("zzz");
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await page.getByRole("button", { name: /^(Câu tiếp|Xem kết quả)/ }).click();
  }
  const result = page.getByTestId("sprint-result");
  await expect(result).toBeVisible();
  await expect(result.getByText(/Đúng \d\/6 câu ngay lần đầu \(cần 5\)/)).toBeVisible();
  await page.keyboard.press("Enter"); // → next lesson in sprint mode
  await expect(page).toHaveURL(/\/learn\/A0-G002\?mode=sprint/);
  await page.goto("/grammar-sprint");
  const passed = await page.getByText("1/128").isVisible();
  if (!passed) await expect(page.getByRole("link", { name: /A0-G001/ }).first()).toBeVisible(); // in "Cần học kỹ"
  // the queue continues from the lesson worked on last (A0-G002 was opened after A0-G001)
  await expect(page.getByRole("button", { name: /(Học tiếp|Bắt đầu): A0-G00[23]/ })).toBeVisible();
  // any lesson can be chosen
  await page.getByLabel("Chọn bài để học").selectOption("A2-G001");
  await expect(page).toHaveURL(/\/learn\/A2-G001\?mode=sprint/);
});

test("sprint becomes the default for grammar lessons: from the journey mission, and after choosing a plan", async ({ page }) => {
  await page.goto("/learn/A1-G006");
  await expect(page.getByText(/Học đầy đủ: ≈\d+ phút theo giáo trình/)).toBeVisible();
  await page.getByRole("button", { name: "Sprint ≈8 phút" }).last().click();
  await expect(page.getByText("📐 Công thức")).toBeVisible();
  // what the lesson is about: Vietnamese name, objectives and the main idea
  const overview = page.getByTestId("sprint-overview");
  await expect(overview.getByRole("heading", { name: "Tính từ sở hữu, đại từ sở hữu và sở hữu cách" })).toBeVisible();
  await expect(overview.getByText("Học xong bạn sẽ:")).toBeVisible();
  await expect(overview.getByText(/Ý chính: Ba cách thể hiện sở hữu/)).toBeVisible();
  await page.goto("/learn/A1-G007"); // opened like from the path: no ?mode
  await expect(page.getByText("1 · Nắm cốt lõi (≈3 phút)")).toBeVisible();
  await page.getByRole("button", { name: "Học đầy đủ", exact: true }).click(); // back to full lessons
  await expect(page.getByText("Nhiệm vụ hôm nay")).toBeVisible();
  await page.goto("/grammar-sprint");
  await page.getByRole("button", { name: "3 ngày", exact: true }).click();
  await page.goto("/learn/A1-G008");
  await expect(page.getByText("📐 Công thức")).toBeVisible();
});

test("a lesson not passed can be checked again right away; 'Học đầy đủ' leaves the sprint screen", async ({ page }) => {
  await page.goto("/learn/A1-G010?mode=sprint");
  for (let round = 0; round < 2; round++) {
    await page.getByRole("button", { name: /Đã nắm — kiểm tra 6 câu/ }).click();
    await expect(page.getByTestId("test-out").getByText(/Câu 1\/6/)).toBeVisible(); // no "once per 24 h" refusal
    await page.goto("/learn/A1-G010?mode=sprint");
  }
  await page.getByRole("link", { name: /Học đầy đủ bài này/ }).click();
  await expect(page).toHaveURL(/mode=journey/);
  await expect(page.getByText("Nhiệm vụ hôm nay")).toBeVisible();
});
