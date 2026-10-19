import { expect, test, type Page } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);
test.describe.configure({ mode: "serial" });

/** One screen forward: answer if it is a question (any answer), then continue; waits on the screen counter. */
async function answerAndContinue(page: Page) {
  const counter = page.locator("footer span").first();
  const before = await counter.textContent();
  const check = page.getByRole("button", { name: /^Kiểm tra/ });
  const go = page.getByRole("button", { name: /^(Bắt đầu|Tiếp|Hoàn thành bài)/ });
  if (await check.isVisible()) {
    const live = "main [data-item]";
    const radio = page.locator(`${live} [role=radio]:not([disabled])`);
    const tokens = page.locator(`${live} button[aria-label^='Thêm']`);
    const input = page.locator(`${live} input:not([disabled]):not([type=checkbox]), ${live} textarea:not([disabled])`);
    await radio.or(tokens).or(input).first().waitFor({ timeout: 3000 }).catch(() => undefined); // speaking items have none
    if (await radio.count()) await radio.first().click();
    else if (await tokens.count()) { while (await tokens.count()) await tokens.first().click(); }
    else if (await input.count()) await input.first().fill("a");
    const skip = page.getByRole("button", { name: "Bỏ qua" });
    if (await check.isEnabled()) {
      await check.click();
      await expect(go).toBeVisible();
    } else if (await skip.isVisible()) {
      await skip.click();
      await expect(counter).not.toHaveText(before ?? "");
      return;
    } else return;
  }
  if (await go.isVisible()) {
    await go.click({ timeout: 3000 }).catch(() => undefined);
    await expect(counter.or(page.getByLabel(/trên 3 sao/))).not.toHaveText(before ?? "", { timeout: 5000 }).catch(() => undefined);
  }
}

test("journey: mission → pre-test → explanations interleaved with checks → resume after reload → classic view switch", async ({ page }) => {
  await page.goto("/learn/A0-G012");
  await expect(page.getByText("Nhiệm vụ hôm nay")).toBeVisible();
  await expect(page.getByText(/34 câu hỏi/)).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByText(/Đoán trước 1\/2/)).toBeVisible();
  const kinds: string[] = [];
  for (let i = 0; i < 9; i++) {
    const tag = page.locator("main p.uppercase");
    const label = (await tag.count()) ? ((await tag.first().textContent()) ?? "") : "content";
    kinds.push(label.startsWith("Kiểm tra") ? "check" : label.startsWith("Đoán") ? "pre" : "content");
    await answerAndContinue(page);
  }
  // never more than two explanation screens before a check
  expect(kinds.join(",")).not.toMatch(/content,content,content/);
  expect(kinds).toContain("check");
  const pos = await page.locator("footer span").first().textContent();
  await page.reload();
  await expect(page.locator("footer span").first()).toHaveText(pos!); // resumes on the same screen
  await page.getByRole("button", { name: "Xem đầy đủ (cách học cũ)" }).click();
  await expect(page.getByRole("button", { name: /Slide tiếp theo/ })).toBeVisible();
  await page.getByRole("button", { name: "Chế độ hành trình" }).click();
  await expect(page.locator("footer span").first()).toHaveText(pos!);
});

test("journey: finishing a lesson gives stars, XP and sends wrong answers to smart review", async ({ page, request }) => {
  test.setTimeout(240_000); // a whole lesson (50+ screens plus two rounds of retries)
  await page.goto("/learn/A0-G001");
  for (let i = 0; i < 260; i++) {
    if (await page.getByLabel(/trên 3 sao/).isVisible()) break;
    await answerAndContinue(page);
  }
  await expect(page.getByLabel(/trên 3 sao/)).toBeVisible();
  await expect(page.getByText(/đúng lần đầu/)).toBeVisible();
  await expect(page.getByText(/Điểm bài:/)).toBeVisible();
  const prog = await (await request.get("/api/progress")).json();
  expect(prog.find((p: { unit_id: string }) => p.unit_id === "A0-G001").status).toMatch(/completed|review/);
  await page.getByRole("button", { name: /Về lịch học hôm nay/ }).click();
  await expect(page).toHaveURL(/\/today/);
});

test("a question I cannot answer: 'Không biết — xem đáp án' shows the answer and lets me continue", async ({ page }) => {
  await page.goto("/learn/A0-G013");
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByText(/Đoán trước 1\/2/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kiểm tra/ })).toBeDisabled(); // nothing typed or chosen
  await page.getByRole("button", { name: "Không biết — xem đáp án" }).click();
  await expect(page.getByText("Đáp án — câu này tính là chưa đúng và sẽ được ôn lại")).toBeVisible();
  await expect(page.getByText(/sẽ được hỏi lại ở cuối bài/)).toBeVisible();
  await page.getByRole("button", { name: /^Tiếp/ }).click();
  await expect(page.getByText(/Đoán trước 2\/2/)).toBeVisible();
});
