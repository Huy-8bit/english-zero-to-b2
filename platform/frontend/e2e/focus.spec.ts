import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);
test.describe.configure({ mode: "serial" });

test("focus mode: set goals, lock shows progress everywhere, finishing a lesson counts, cancel within 60 s", async ({ page, request }) => {
  await page.goto("/focus");
  await expect(page.getByRole("heading", { name: "Học tập trung (khóa máy)" })).toBeVisible();
  await page.getByLabel("Số bài cần hoàn thành").fill("1");
  await page.getByLabel("Số phút học").fill("0");
  await page.getByRole("button", { name: "Bắt đầu học & khóa máy" }).click();
  await expect(page.getByText("Đang học tập trung")).toBeVisible();
  expect((await (await request.get("/api/focus/status")).json()).locked).toBe(true);
  await expect(page.getByRole("link", { name: /0\/1 bài/ })).toBeVisible(); // header badge on every page
  await page.goto("/vocabulary");
  await expect(page.getByRole("link", { name: /0\/1 bài/ })).toBeVisible();
  // complete one lesson → goal met → unlocked
  const steps = await (await request.get("/api/lessons/A0-G001/steps")).json();
  await request.put("/api/progress/A0-G001", { data: { current_step: steps.steps.length - 1 } });
  await request.post("/api/lessons/A0-G001/complete");
  await page.goto("/focus");
  await expect(page.getByText(/Buổi trước: Hoàn thành/)).toBeVisible();
  expect((await (await request.get("/api/focus/status")).json()).locked).toBe(false);
  // a session started by mistake can be cancelled in the first minute
  await page.getByRole("button", { name: "Bắt đầu học & khóa máy" }).click();
  await page.getByRole("button", { name: /Hủy \(chỉ trong 60 giây đầu\)/ }).click();
  await expect(page.getByText(/Buổi trước: Đã hủy/)).toBeVisible();
  await expect(page.getByText("Lịch sử buổi học tập trung")).toBeVisible();
});

test("focus emergency unlock starts a visible 60-second wait", async ({ page }) => {
  await page.goto("/focus");
  await page.getByRole("button", { name: "Bắt đầu học & khóa máy" }).click();
  await page.getByRole("button", { name: "Mở khóa khẩn cấp" }).click();
  await expect(page.getByText(/Mở khẩn cấp khả dụng sau/)).toBeVisible();
});
