import { expect, test, type Page } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

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
