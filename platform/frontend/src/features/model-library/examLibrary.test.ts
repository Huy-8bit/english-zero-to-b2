import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchIndex, fetchBucket, matchesSearch, type LibraryIndex, type Sample } from "./library";
const root = path.resolve(import.meta.dirname, "../../../public/model-library-data");
const index = JSON.parse(readFileSync(path.join(root, "exam/index.json"), "utf8")) as LibraryIndex;
const samples = [...new Set(index.samples.map((s) => s.bucket))].flatMap((bucket) => (JSON.parse(readFileSync(path.join(root, bucket), "utf8")) as { samples: Sample[] }).samples);
const answer = (s: Sample) => [...s.paragraphs.map((p) => p.text), ...s.sections.flatMap((sec) => sec.questions.map((q) => q.answer))].join("\n\n");
const count = (text: string) => text.match(/\b[\w]+(?:['’-][\w]+)*\b/g)?.length ?? 0;
afterEach(() => vi.unstubAllGlobals());

describe("researched VSTEP collection", () => {
  it("contains ten independently authored briefs per part, with separate progress IDs", () => {
    expect(index.total).toBe(50);
    expect(index.groups.map((g) => g.count)).toEqual([10, 10, 10, 10, 10]);
    expect(samples).toHaveLength(50);
    expect(new Set(samples.map((s) => s.id)).size).toBe(50);
    expect(new Set(samples.map(answer)).size).toBe(50);
    const legacy = JSON.parse(readFileSync(path.join(root, "index.json"), "utf8")) as LibraryIndex;
    const oldIds = new Set(legacy.samples.map((s) => s.id));
    for (const s of samples) {
      expect(s.id).toMatch(/^exam-/);
      expect(oldIds.has(s.id)).toBe(false);
      const text = answer(s);
      expect(text).not.toMatch(/\[[^\]]+\]|undefined|TODO/);
      expect(count(text)).toBe(s.wordCount);
      expect(s.phrases).toHaveLength(3);
      s.phrases.forEach((p) => expect(p.inAnswer).toBe(text.toLowerCase().includes(p.en.toLowerCase())));
      expect(index.samples.find((entry) => entry.id === s.id)).toMatchObject({ title: s.title, wordCount: s.wordCount });
      if (s.group.startsWith("writing")) expect(count(text)).toBeGreaterThanOrEqual(s.group === "writing-task1" ? 120 : 250);
      // Reusable language is limited to functional phrases, with text and speech preserved exactly.
      const units = [...s.paragraphs.map((p) => ({ text: p.text, parts: p.parts })), ...s.sections.flatMap((sec) => sec.questions.map((q) => ({ text: q.answer, parts: q.parts })))];
      let fixed = 0;
      for (const unit of units) {
        expect(unit.parts.map((p) => p.text).join("")).toBe(unit.text);
        fixed += unit.parts.filter((p) => p.kind === "frame").reduce((n, p) => n + count(p.text), 0);
      }
      expect(fixed).toBeGreaterThan(0);
      expect(fixed).toBeLessThan(s.wordCount / 4);
    }
  });

  it("distinguishes source-adapted sample papers from original practice and verifies PDF pages", () => {
    expect(samples.filter((s) => s.provenance?.kind === "published-sample")).toHaveLength(10);
    expect(samples.filter((s) => s.provenance?.kind === "original-practice")).toHaveLength(40);
    for (const s of samples) {
      expect(s.provenance?.checkedOn).toBe("2026-11-05");
      expect(index.samples.find((entry) => entry.id === s.id)?.sourceKind).toBe(s.provenance?.kind);
      if (s.provenance?.kind === "original-practice") {
        expect(s.provenance.url).toBe("https://vstep.vnu.edu.vn/test-format/");
        expect(s.provenance.page).toBeNull();
      } else {
        expect(s.provenance?.url).toMatch(/^https:\/\/vstep\.(dthu\.edu\.vn|ufl\.udn\.vn)\//);
        const writing = s.group.startsWith("writing");
        expect(s.provenance?.page).toBe(s.provenance?.url.includes("dthu") ? writing ? 18 : 17 : writing ? 15 : 16);
      }
      expect(s.coverage!.length).toBeGreaterThanOrEqual(2);
      s.coverage!.forEach((check) => expect(answer(s)).toContain(check.evidence));
    }
    for (const g of index.groups) expect(samples.filter((s) => s.group === g.id && s.provenance?.kind === "published-sample")).toHaveLength(2);
  });

  it("answers the source-specific constraints instead of substituting a generic framework", () => {
    const get = (suffix: string) => samples.find((s) => s.id.endsWith(suffix))!;
    const hotel = get("visiting-parents");
    expect(hotel.coverage).toHaveLength(6);
    expect(answer(hotel)).toContain("hotel arranges day trips");
    expect(answer(hotel)).toContain("restaurant serves vegetarian dishes");
    expect(answer(hotel)).toContain("including breakfast for two");
    const host = get("introduce-houseguest");
    expect(answer(host)).toContain("friendly and considerate");
    expect(answer(host)).toContain("studying business at university");
    expect(answer(get("refund-reply"))).toContain("full 500,000 dong");
    const gifts = get("farewell-gift");
    expect(gifts.options).toEqual(["A camera", "An English dictionary", "A scarf"]);
    expect(gifts.selectedOption).toBe(2);
    expect(gifts.requirementsVi.join(" ")).toContain("giả định");
    expect(get("danang-hanoi").options).toEqual(["A train", "A plane", "A coach"]);
    expect(get("teen-reading").suggestedIdeas).toEqual(["Building knowledge", "Relaxing", "Exercising memory"]);
    expect(get("travel-benefits").suggestedIdeas).toEqual(["Feeling refreshed", "Supporting the economy", "Learning more about the world"]);
    expect(matchesSearch(get("weekend-receptionist"), "le tan")).toBe(true);
  });

  it("keeps speaking parts structurally distinct and varies all ten solution situations", () => {
    const choices = samples.filter((s) => s.group === "speaking-part2");
    expect(new Set(choices.map((s) => s.options.join("|"))).size).toBe(10);
    expect(new Set(choices.map((s) => s.selectedOption)).size).toBe(3);
    for (const s of samples) {
      if (s.group === "speaking-part1") {
        expect(s.paragraphs).toHaveLength(0);
        expect(s.sections).toHaveLength(2);
        s.sections.forEach((sec) => expect(sec.questions).toHaveLength(3));
      } else if (s.group === "speaking-part2") {
        expect(s.options).toHaveLength(3);
        expect(s.sections).toHaveLength(0);
      } else if (s.group === "speaking-part3") {
        expect(s.suggestedIdeas).toHaveLength(3);
        expect(s.paragraphs).toHaveLength(5);
        expect(s.sections[0].questions).toHaveLength(3);
      }
    }
  });

  it("loads the new catalogue independently and rejects stale buckets", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(index)));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchIndex(undefined, "exam")).total).toBe(50);
    expect(fetch.mock.calls[0]).toEqual(["/model-library-data/exam/index.json", { signal: undefined }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ version: "old", samples: samples.slice(0, 10) }))));
    await expect(fetchBucket("exam/writing-task1.json", index.version)).rejects.toThrow("vừa được cập nhật");
  });
});
