import { describe, expect, it } from "vitest";
import { PHRASES, PACKS } from "./content";
import { TOPICS, WRITING_TASKS } from "./topics";
import { addSeconds, emptyState, makeRun, markAnswer, matches, nextPrompt, PLAN, phraseHits, restoreState, reviewIds, stats, TOTAL_SECONDS, usedSeconds, type RescueState } from "./state";
import { isSynced, mergeProgress } from "@/lib/syncState";
import { wordCount } from "@/lib/utils";

describe("four-hour vocabulary content and schedule", () => {
  it("budgets exactly four hours including breaks, with six manageable ten-phrase packs", () => {
    expect(TOTAL_SECONDS).toBe(4 * 60 * 60);
    expect(PLAN.filter((b) => b.kind === "break").reduce((sum, b) => sum + b.minutes, 0)).toBe(10);
    expect(PHRASES).toHaveLength(60);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(60);
    expect(new Set(PHRASES.map((p) => p.en)).size).toBe(60);
    for (const pack of PACKS) expect(PHRASES.filter((p) => p.pack === pack.id)).toHaveLength(10);
    for (const p of PHRASES) for (const field of [p.vi, p.pattern, p.writing, p.speaking, p.trap]) expect(field.trim().length).toBeGreaterThan(0);
    expect(TOPICS).toHaveLength(12);
    expect(TOPICS.flatMap((t) => t.words)).toHaveLength(48);
    for (const topic of TOPICS) expect(PHRASES.some((p) => p.en === topic.answer)).toBe(true);
    for (const task of WRITING_TASKS) expect(wordCount(task.model)).toBeGreaterThanOrEqual(task.target);
  });
  it("does not count merely copying as recall; two separated passes do count", () => {
    let s: RescueState = { ...emptyState(), runs: { test: makeRun(PHRASES.slice(0, 10).map((p) => p.id)) } };
    let i = 0;
    while (s.runs.test.queue.length) {
      const prompt = s.runs.test.queue[0];
      s.runs.test.text = PHRASES.find((p) => p.id === prompt.id)!.en;
      s = markAnswer(s, "test", i++);
      if (i <= 10) expect(stats(s).recalled).toBe(0);
      s = nextPrompt(s, "test");
    }
    expect(i).toBe(30);
    expect(stats(s)).toEqual({ seen: 10, recalled: 10, weak: 0 });
  });
  it("requeues mistakes and hints without credit; reload cannot submit feedback twice", () => {
    let s: RescueState = { ...emptyState(), runs: { test: makeRun(PHRASES.slice(0, 4).map((p) => p.id), true) } };
    s.runs.test.text = "saving times";
    s = markAnswer(s, "test", 1);
    expect(s.items[PHRASES[0].id]).toMatchObject({ clean: 0, misses: 1 });
    expect(markAnswer(restoreState(s), "test", 2)).toEqual(s);
    s = nextPrompt(s, "test");
    expect(s.runs.test.queue.at(-1)?.id).toBe(PHRASES[0].id);
    s.runs.test.text = PHRASES[1].en; s.runs.test.hinted = true;
    s = markAnswer(s, "test", 3);
    expect(s.runs.test.feedback).toBe("retry");
    expect(s.items[PHRASES[1].id].clean).toBe(0);
    expect(reviewIds(s)[0]).toBe(PHRASES[0].id);
  });
  it("does not give two-pass credit for immediate repeat; skipping remains weak", () => {
    let s: RescueState = { ...emptyState(), runs: { test: makeRun([PHRASES[0].id], true) } };
    s.runs.test.text = "save time"; s = markAnswer(s, "test"); s = nextPrompt(s, "test");
    s.runs.test.text = "save time"; s = markAnswer(s, "test");
    expect(stats(s).recalled).toBe(0);
    s = nextPrompt(s, "test", true);
    expect(stats(s).weak).toBe(1);
    expect(s.runs.test.queue).toHaveLength(0);
  });
  it("allows punctuation/case variants but rejects altered word forms", () => {
    expect(matches(" SAVE TIME! ", "save time")).toBe(true);
    expect(matches("I'm writing to inquire about", "I am writing to enquire about")).toBe(true);
    expect(matches("saving time", "save time")).toBe(false);
    expect(phraseHits("In my opinion, we can save time.").map((p) => p.en)).toEqual(["save time", "in my opinion"]);
    expect(phraseHits("Howeverless")).toHaveLength(0);
  });
  it("clamps time at each block limit and keeps independent work when two devices merge", () => {
    let s = addSeconds(emptyState(), "benefits", 5000);
    s = addSeconds(s, "start", -20);
    expect(s.seconds.benefits).toBe(1200);
    expect(usedSeconds(s)).toBe(1200);
    expect(isSynced("em-b2-four-hour")).toBe(true);
    expect(mergeProgress("em-b2-four-hour", { turn: 40, items: { a: { clean: 1, at: 10 } }, drafts: { formal: { text: "older draft", at: 20 } } },
      { turn: 30, block: "talk", items: { a: { clean: 2, at: 30 } }, drafts: { essay: { text: "other device", at: 40 } } })).toMatchObject({ turn: 40, block: "talk", items: { a: { clean: 2 } }, drafts: { formal: { text: "older draft" }, essay: { text: "other device" } } });
  });
});
