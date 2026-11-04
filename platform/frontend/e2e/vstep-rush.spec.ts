import { expect, test, type Page } from "@playwright/test";
import { VERBS } from "../src/features/vstep/verbs";

/** Answers whatever the session shows until the round is done; verbs typed right, phrases recalled. */
async function finishRound(page: Page) {
  for (let i = 0; i < 200; i++) {
    const shown = page.getByTestId("rush-done").or(page.getByTestId("rush-learn")).or(page.getByTestId("rush-verbs"))
      .or(page.getByTestId("rush-pick")).or(page.getByTestId("rush-recall")).or(page.getByTestId("rush-verb"));
    await shown.first().waitFor();
    if (await page.getByTestId("rush-done").isVisible()) return;
    if (await page.getByTestId("rush-verb").isVisible()) {
      const base = (await page.getByTestId("rush-verb").innerText()).split(" ·")[0].trim();
      const v = VERBS.find((x) => x.base === base)!;
      await page.getByLabel("Quá khứ", { exact: true }).fill(v.past.split("/")[0]);
      await page.getByLabel("Quá khứ phân từ").fill(v.pp.split("/")[0]);
      await page.getByLabel("Quá khứ phân từ").press("Enter");
      await expect(page.getByText(new RegExp(`^✓ ${base} –`))).toBeVisible();
      await page.keyboard.press("Enter");
    } else if (await page.getByTestId("rush-pick").isVisible()) {
      await page.keyboard.press("1");
      await page.getByRole("button", { name: /^Tiếp/ }).click();
    } else if (await page.getByTestId("rush-recall").isVisible()) {
      await page.getByLabel("Câu tiếng Anh").press("Enter");
      await page.getByRole("button", { name: /Nhớ được/ }).click();
      await page.getByRole("button", { name: /^Tiếp/ }).click();
    } else {
      await page.keyboard.press("Enter");
    }
  }
  throw new Error("round did not finish");
}

test("VSTEP rush: plan → irregular verbs drill → phrase deck; progress shows on the plan and the verb table", async ({ page }) => {
  await page.goto("/vstep-rush");
  await expect(page.getByRole("heading", { name: /Cấp tốc VSTEP B2/ })).toBeVisible();
  await expect(page.getByText("Khối 1/10 · Ngày 1")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/rush\/iv-1/);
  await expect(page.getByTestId("rush-verbs")).toBeVisible(); // read the forms first
  await finishRound(page);
  await expect(page.getByText(/Nhớ đúng 24/)).toBeVisible();
  await page.goto("/rush/w1");
  await expect(page.getByTestId("rush-learn").getByText("Dear Sir or Madam,", { exact: true })).toBeVisible();
  await finishRound(page);
  await page.goto("/vstep-rush");
  await expect(page.getByRole("button", { name: /Viết Task 1 · Thư \/ email\s*0\/36/ })).toBeVisible(); // recalled once: not learnt yet
  await page.goto("/irregular-verbs");
  await page.getByLabel("Tìm động từ").fill("went");
  await expect(page.getByRole("cell", { name: "gone" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
});
