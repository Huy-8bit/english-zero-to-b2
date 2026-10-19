import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

// Chrome runs with a fake microphone; the fake AI provider "hears" a fixed sentence for any recording:
// "I usually go to the park with my family."
const HEARD = "I usually go to the park with my family.";

test("pronunciation: read aloud, see each word checked, fix a word, AI voice for listening", async ({ page }) => {
  await page.goto("/speaking-studio");
  await page.getByRole("button", { name: "Phát âm" }).click();
  const box = page.getByLabel("Câu cần đọc");
  await expect(box).toHaveValue(/I think these three things/);
  // listening uses the AI voice endpoint
  const tts = page.waitForResponse((r) => r.url().endsWith("/api/tts") && r.status() === 200);
  await page.getByRole("button", { name: "Nghe mẫu" }).click();
  await tts;

  // a sentence the recogniser hears differently → words flagged with dictionary IPA and a fix
  await page.getByRole("button", { name: "Ghi âm & chấm" }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Dừng/ }).click();
  const fb = page.getByTestId("pronunciation");
  await expect(fb).toBeVisible();
  await expect(fb.getByText(/Độ rõ: \d+%/)).toBeVisible();
  const fixes = fb.getByTestId("word-fix");
  await expect(fixes.first()).toBeVisible();
  await expect(fixes.filter({ hasText: "think" }).getByText(/θ/).first()).toBeVisible(); // dictionary IPA / th tip
  await expect(fixes.first().getByRole("button", { name: "Đọc lại từ này" })).toBeVisible();

  // the sentence the recogniser hears exactly → everything clear
  await box.fill(HEARD);
  await page.getByRole("button", { name: "Ghi âm & chấm" }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Dừng/ }).click();
  await expect(page.getByText("Độ rõ: 100%")).toBeVisible();
  await expect(page.getByText(/Máy nghe rõ tất cả các từ/)).toBeVisible();
  await expect(page.getByText(/lần đọc · độ rõ trung bình/)).toBeVisible();
});
