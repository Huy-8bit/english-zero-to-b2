import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated WCAG checks (serious/critical) on the main screens. Not a substitute for manual testing.
for (const [name, url] of [
  ["dashboard", "/"], ["learning path", "/path"], ["lesson player", "/learn/A1-G001"], ["vocabulary", "/vocabulary"],
  ["vocabulary explorer", "/vocabulary/explore?level=A1"], ["vocabulary word", "/vocabulary/word/achieve"], ["vocabulary today", "/vocabulary/today"],
  ["vocabulary stats", "/vocabulary/stats"], ["vocabulary notebook", "/vocabulary/notebook"],
  ["reference", "/reference?path=06-GRAMMAR-REFERENCE/ALL-TENSES-COMPARISON.md"],
] as const) {
  test(`a11y: ${name}`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
