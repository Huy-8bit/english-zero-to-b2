import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

test("daily writing: translate a real sentence with a studied word, get feedback, see today's progress", async ({ page, request }) => {
  // a few studied words first (the ladder uses the learner's own words)
  const s = await (await request.post("/api/vocab/sessions", { data: { kind: "flashcards", level: "A1", size: 12 } })).json();
  for (const it of s.items) await request.post(`/api/vocab/sessions/${s.id}/answer`, { data: { item_id: it.id, rating: 3 } });

  await page.goto("/writing-daily");
  await expect(page.getByRole("heading", { name: "Luyện viết mỗi ngày" })).toBeVisible();
  await expect(page.getByText("Bậc 1. Dịch câu Việt → Anh")).toBeVisible();
  await expect(page.getByText(/Bậc 3\. Viết đoạn \d+–\d+ từ/)).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu" }).first().click();
  await page.waitForURL(/\/vocabulary\/session\/.*return=%2Fwriting-daily/);
  await expect(page.getByTestId("translate-vi")).toBeVisible();
  await expect(page.getByText(/Gợi ý: dùng/)).toBeVisible();
  await page.getByLabel("Câu dịch tiếng Anh").fill("Something completely different");
  await page.getByLabel("Câu dịch tiếng Anh").press("Enter");
  const fb = page.getByTestId("feedback");
  await expect(fb).toBeVisible();
  await expect(fb.getByText(/Câu mẫu:/)).toBeVisible();
  await page.getByRole("link", { name: "← Quay lại" }).click();
  await expect(page).toHaveURL(/\/writing-daily/);
  await expect(page.getByText("1/8")).toBeVisible();
  await expect(page.getByText("Câu dịch cần xem lại")).toBeVisible();
});
