import { expect, test } from "@playwright/test";
import { resetTestDatabase } from "./database";

test.beforeAll(resetTestDatabase);

test("Tôi đã học tới đây: preview, cancel, confirm, persist and undo", async ({ page, request }) => {
  await page.goto("/path");
  await page.getByRole("tab", { name: /A1/ }).click();
  await page.getByRole("button", { name: "Tôi đã học tới đây: A1-G003", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Sẽ đánh dấu hoàn thành \d+ bài/)).toBeVisible();
  expect(await (await request.get("/api/progress")).json()).toEqual([]);
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Tôi đã học tới đây: hết A1", exact: true }).click();
  await expect(dialog.getByText(/Sẽ đánh dấu hoàn thành \d+ bài/)).toBeVisible();
  await dialog.getByRole("checkbox", { name: /Bao gồm bài kỹ năng/ }).check();
  await expect(dialog.getByRole("button", { name: "Xác nhận đánh dấu" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Xác nhận đánh dấu" }).click();
  await expect(dialog).not.toBeVisible();
  const lesson = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /A1-G003/ }) });
  await expect(lesson.getByText("đánh dấu thủ công")).toBeVisible();
  await expect(lesson.getByRole("checkbox")).toBeChecked();
  expect((await (await request.get("/api/recommendations")).json()).current_level).toBe("A2");
  expect((await (await request.get("/api/dashboard")).json()).xp.total).toBe(0);
  await page.reload();
  await page.getByRole("tab", { name: /A1/ }).click();
  await expect(lesson.getByRole("checkbox")).toBeChecked();
  await lesson.getByRole("checkbox").uncheck();
  await expect(lesson.getByRole("checkbox")).not.toBeChecked();
  await expect.poll(async () => (await (await request.get("/api/recommendations")).json()).current_level).toBe("A1");
  await lesson.getByRole("checkbox").check();
  await expect.poll(async () => (await (await request.get("/api/recommendations")).json()).current_level).toBe("A2");
  await page.goto("/progress");
  await expect(page.getByRole("row").filter({ has: page.getByRole("link", { name: "A1-G003", exact: true }) })
    .getByText("đánh dấu thủ công")).toBeVisible();
});
