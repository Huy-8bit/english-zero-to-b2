import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBucket, fetchIndex, loadProgress, matchesSearch, PROGRESS_KEY, selection, updateProgress, type LibraryIndex, type Sample } from "./library";
import { isReadingRoute } from "@/features/reader/readerSettings";
import { isSynced, mergeProgress } from "@/lib/syncState";

const root = path.resolve(import.meta.dirname, "../../../public/model-library-data");
const index = JSON.parse(readFileSync(path.join(root, "index.json"), "utf8")) as LibraryIndex;
const buckets = [...new Set(index.samples.map((s) => s.bucket))].map((bucket) => ({ bucket, samples: (JSON.parse(readFileSync(path.join(root, bucket), "utf8")) as { samples: Sample[] }).samples }));
const wordCount = (text: string) => text.match(/\b[\w]+(?:['’-][\w]+)*\b/g)?.length ?? 0;
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe("complete reference library", () => {
  it("contains 10 actual full answers in all 155 form/topic combinations", () => {
    expect(index.total).toBe(1550);
    expect(index.groups.map((g) => g.count)).toEqual([900, 500, 50, 50, 50]);
    expect(buckets).toHaveLength(155);
    const ids = new Set<string>();
    const answers = new Set<string>();
    for (const { bucket, samples } of buckets) {
      expect(samples.map((s) => s.number)).toEqual([1,2,3,4,5,6,7,8,9,10]);
      for (const s of samples) {
        const answer = [...s.paragraphs.map((p) => p.text), ...s.sections.flatMap((section) => section.questions.map((q) => q.answer))].join("\n\n");
        expect(answer).not.toMatch(/\[[^\]]+\]|undefined|TODO|\{[^}]+\}/);
        expect(answer.length).toBeGreaterThan(600);
        expect(wordCount(answer)).toBe(s.wordCount);
        expect(s.prompt.length).toBeGreaterThan(70);
        expect(s.phrases).toHaveLength(3);
        const units = [...s.paragraphs.map((p) => ({ text: p.text, parts: p.parts })), ...s.sections.flatMap((section) => section.questions.map((q) => ({ text: q.answer, parts: q.parts })))];
        for (const unit of units) {
          expect(unit.parts.map((p) => p.text).join("")).toBe(unit.text);
          expect(unit.parts.every((p) => p.kind === "frame" || p.kind === "detail")).toBe(true);
        }
        expect(units.some((unit) => unit.parts.some((p) => p.kind === "frame"))).toBe(true);
        if (s.register) {
          expect(s.paragraphs.every((p) => p.template?.includes("["))).toBe(true);
          const frameText = s.paragraphs.flatMap((p) => p.parts.filter((part) => part.kind === "frame").map((part) => part.text)).join(" ");
          expect(frameText).not.toMatch(/Alex|Ms Brown|Minh|Saturday|Wednesday|headphones|online university classes/);
          expect(s.paragraphs[0].text).toMatch(s.register === "formal" ? /^Dear Ms Brown,/ : /^Hi Alex,/);
          expect(s.paragraphs.at(-1)!.text).toContain(s.register === "formal" ? "Yours sincerely," : "Best wishes,");
        }
        expect(index.samples.find((entry) => entry.id === s.id)).toMatchObject({ bucket, wordCount: s.wordCount, title: s.title });
        if (s.group.startsWith("writing")) expect(s.wordCount).toBeGreaterThanOrEqual(s.group === "writing-task1" ? 120 : 250);
        if (s.group === "speaking-part1") { expect(s.sections).toHaveLength(2); expect(s.sections.flatMap((x) => x.questions)).toHaveLength(6); }
        if (s.group === "speaking-part2") { expect(s.options).toHaveLength(3); expect([0,1,2]).toContain(s.selectedOption); expect(s.paragraphs[0].text.toLowerCase()).toContain(s.options[s.selectedOption!].toLowerCase()); }
        if (s.group === "speaking-part3") { expect(s.requirementsVi).toHaveLength(3); expect(s.sections[0].questions).toHaveLength(3); }
        s.framePhrases.forEach((p) => expect(answer.toLowerCase()).toContain(p.en.toLowerCase()));
        s.phrases.forEach((p) => expect(p.inAnswer).toBe(answer.toLowerCase().includes(p.en.toLowerCase())));
        ids.add(s.id); answers.add(answer);
      }
    }
    expect(ids.size).toBe(1550); expect(answers.size).toBe(1550);
  });

  it("uses 50 different situations per form and every group/topic has the promised count", () => {
    for (const group of index.groups) for (const topic of index.topics) {
      const items = index.samples.filter((s) => s.group === group.id && s.topic === topic.id);
      expect(items).toHaveLength(group.id === "writing-task1" ? 180 : group.skill === "writing" ? 100 : 10);
      expect(new Set(items.map((s) => s.focus)).size).toBe(10);
    }
    for (const type of index.types) expect(new Set(index.samples.filter((s) => s.group === type.group && s.type === type.id).map((s) => s.focus)).size).toBe(50);
  });

  it("resolves shared sample links, invalid filters and Vietnamese searches without accents", () => {
    const sample = index.samples.at(-1)!;
    const current = selection(index, new URLSearchParams({ sample: sample.id, skill: "writing", group: "bad" }));
    expect(current.skill).toBe("speaking"); expect(current.sample).toEqual(sample); expect(current.topic.id).toBe(sample.topic);
    expect(selection(index, new URLSearchParams({ group: "bad", type: "bad", topic: "bad" })).group.id).toBe("writing-task1");
    expect(matchesSearch(index.samples[0], "lop truc tuyen")).toBe(true);
    expect(matchesSearch(index.samples[0], "online classes")).toBe(true);
    expect(matchesSearch(index.samples[0], "libraries")).toBe(false);
    expect(isReadingRoute("/model-library")).toBe(true);
  });

  it("keeps one identical reusable scaffold across 50 letters per purpose and separates register from purpose", () => {
    const letterTypes = index.types.filter((t) => t.group === "writing-task1");
    expect(letterTypes.filter((t) => t.register === "formal")).toHaveLength(10);
    expect(letterTypes.filter((t) => t.register === "informal")).toHaveLength(8);
    for (const type of letterTypes) {
      const samples = buckets.flatMap((b) => b.samples).filter((s) => s.group === "writing-task1" && s.type === type.id);
      expect(samples).toHaveLength(50);
      expect(new Set(samples.map((s) => s.paragraphs.map((p) => p.template).join("\n"))).size).toBe(1);
    }
    const formal = selection(index, new URLSearchParams({ register: "formal", type: "reply" }));
    expect(formal.register).toBe("formal");
    expect(formal.types).toHaveLength(10);
    expect(formal.types.some((t) => t.id === "formal-reply")).toBe(true);
    const legacy = selection(index, new URLSearchParams({ sample: "writing-task1-reply-education-01", register: "formal" }));
    expect(legacy.register).toBe("informal");
    expect(legacy.type.id).toBe("reply");
    const applications = buckets.flatMap((b) => b.samples).filter((s) => s.type === "application");
    expect(applications.every((s) => s.prompt.includes("paid part-time") && s.paragraphs.some((p) => p.text.includes("interview")))).toBe(true);
  });

  it("restores valid progress and merges individual readings including explicit unmarks", () => {
    expect(isSynced(PROGRESS_KEY)).toBe(true);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ items: { bad: null, wrong: { read: "yes" }, ok: { read: true, saved: false, at: 1 } } }));
    expect(loadProgress()).toEqual({ items: { ok: { read: true, saved: false, at: 1 } } });
    const first = updateProgress({ items: {} }, "one", "read", 2);
    const next = updateProgress(first, "one", "read", 3);
    expect(next.items.one.read).toBe(false);
    const merged = mergeProgress(PROGRESS_KEY, first, { items: { ...next.items, two: { read: true, saved: true, at: 4 } } });
    expect(merged).toEqual({ items: { one: { read: false, saved: false, at: 3 }, two: { read: true, saved: true, at: 4 } } });
    expect(first.items.one.read).toBe(true);
    localStorage.setItem(PROGRESS_KEY, "broken"); expect(loadProgress()).toEqual({ items: {} });
  });

  it("rejects failed downloads, HTML fallback and mismatched content versions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
    await expect(fetchIndex()).rejects.toThrow("kết nối");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>")));
    await expect(fetchIndex()).rejects.toThrow("chưa sẵn sàng");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ version: "old", samples: [] }))));
    await expect(fetchBucket("example.json", index.version)).rejects.toThrow("vừa được cập nhật");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    expect((await fetchIndex()).total).toBe(1550);
  });
});
