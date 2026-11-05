import { describe, expect, it } from "vitest";
import { BUDGET_DECKS, FRAME_BUDGETS, fixedWordCount } from "./budgetWritingFrames";
import { fillFrame, frameSlots, fixedFrameText, countFixedFrameWords } from "./extendedWritingFrames";
import { memoryTarget, writingMemoryFormat, EMPTY_MEMORY, startMemory, checkMemory, typeMemory, advanceMemory } from "./writingMemoryState";
import { wordCount } from "@/lib/utils";

describe("word-budget writing frames", () => {
  it("keeps fixed text within the requested budgets, excluding filled slots", () => {
    expect(BUDGET_DECKS.filter((d) => d.task === 1)).toHaveLength(18);
    expect(BUDGET_DECKS.filter((d) => d.task === 2)).toHaveLength(10);
    for (const d of BUDGET_DECKS) {
      const [min, max] = FRAME_BUDGETS[d.task];
      expect(fixedWordCount(d), d.id).toBeGreaterThanOrEqual(min);
      expect(d.lines.every((line) => /[a-z]/i.test(line.en.replace(/\[[^\]]+\]/g, ""))), d.id).toBe(true);
      expect(fixedWordCount(d), d.id).toBeLessThanOrEqual(max);
      for (const app of d.applications) {
        const filled = fillFrame(memoryTarget(d.lines), app.values);
        expect(frameSlots(filled), `${d.id}: ${app.title}`).toEqual([]);
        expect(wordCount(filled), `${d.id}: ${app.title}`).toBeGreaterThanOrEqual(d.task === 1 ? 120 : 250);
      }
    }
  });
  it("does not count punctuation or slot names as fixed words", () => {
    expect(countFixedFrameWords("First, [idea]. Finally, [another idea].")).toBe(2);
    expect(countFixedFrameWords("I don't know [name].")).toBe(3);
  });
  it("opens the new version without modifying old attempts and honours explicit version switches", () => {
    const old = { ...EMPTY_MEMORY, format: "extended" as const, extendedDecks: { reply: { reviews: 2, passedAt: 123 } } };
    expect(writingMemoryFormat(old)).toBe("budget");
    expect(old.extendedDecks.reply.passedAt).toBe(123);
    expect(writingMemoryFormat({ ...old, frameRevision: "word-budget-v1" })).toBe("extended");
  });
  it("requires recalling the complete new wording and does not award credit for old phrases", () => {
    const deck = BUDGET_DECKS.find((d) => d.id === "opinion-agree")!;
    const run = { ...startMemory(deck.lines), phase: "whole" as const };
    expect(checkMemory(typeMemory(run, "In conclusion, I agree."), deck.lines).correct).toBe(false);
    const checked = checkMemory(typeMemory(run, fixedFrameText(memoryTarget(deck.lines))), deck.lines);
    expect(checked.correct).toBe(true);
    expect(advanceMemory(checked).phase).toBe("done");
    expect(run.jobs[0].id).toBe("budget-1");
  });
});
