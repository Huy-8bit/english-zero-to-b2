import { describe, expect, it } from "vitest";
import { WRITING_FRAMES } from "./examFrames";
import { MEMORY_DECKS, WRITING_VOCAB } from "./writingMemoryContent";
import { advanceMemory, checkMemory, fadedText, hintMemory, memoryMatches, memoryTarget, recordMemory, startMemory, typeMemory, type MemoryRun } from "./writingMemoryState";
const items = MEMORY_DECKS[0].lines;
const answer = (r: MemoryRun, text: string) => checkMemory(typeMemory(r, text), items);
const finishLines = (initial = startMemory(items)) => {
  let run = initial;
  let guard = 0;
  while (run.phase === "lines" && guard++ < 300) {
    run = advanceMemory(answer(run, items.find((c) => c.id === run.jobs[run.index].id)!.en));
  }
  return run;
};

describe("writing typing course", () => {
  it("covers both tasks with unique IDs and usable contextual examples", () => {
    expect(MEMORY_DECKS.filter((d) => d.task === 1)).toHaveLength(10);
    expect(MEMORY_DECKS.filter((d) => d.task === 2)).toHaveLength(10);
    expect(new Set(MEMORY_DECKS.map((d) => d.id)).size).toBe(MEMORY_DECKS.length);
    for (const deck of MEMORY_DECKS) {
      expect(WRITING_FRAMES.some((f) => f.id === deck.frameId && f.task === deck.task)).toBe(true);
      expect(deck.lines.length).toBeGreaterThanOrEqual(7);
      expect(new Set(deck.lines.map((c) => c.id)).size).toBe(deck.lines.length);
      for (const line of deck.lines) {
        expect(line.vi.length).toBeGreaterThan(5);
        expect(line.example).toContain(line.en);
        expect(line.en).not.toMatch(/\[|\]/);
      }
    }
    expect(WRITING_VOCAB.flatMap((p) => p.items)).toHaveLength(60);
    expect(new Set(WRITING_VOCAB.flatMap((p) => p.items.map((c) => c.id))).size).toBe(60);
  });
  it("visits every card between rounds, then requires the entire frame in order", () => {
    const initial = startMemory(items);
    expect(initial.jobs.slice(0, items.length).every((j) => j.stage === 0)).toBe(true);
    expect(initial.jobs.filter((j) => j.stage >= 2)).toHaveLength(items.length * 2);
    expect(advanceMemory(initial)).toEqual(initial);
    const run = finishLines(initial);
    expect(run.phase).toBe("whole");
    const wrong = answer(run, memoryTarget([...items].reverse()));
    expect(wrong.correct).toBe(false);
    expect(advanceMemory(wrong).phase).toBe("whole");
    const correct = answer(advanceMemory(wrong), memoryTarget(items));
    expect(advanceMemory(correct).phase).toBe("done");
  });
  it("requeues failed and hinted recalls after other cards and survives reload", () => {
    let run = { ...startMemory(items), index: items.length * 2 };
    const failedJob = run.jobs[run.index];
    run = answer(run, "wrong answer");
    expect(typeMemory(run, items[0].en)).toEqual(run);
    run = advanceMemory(JSON.parse(JSON.stringify(run)));
    expect(run.jobs.at(-1)).toEqual(failedJob);
    expect(run.jobs[run.index].id).not.toBe(failedJob.id);
    const hintedJob = run.jobs[run.index];
    run = advanceMemory(answer(hintMemory(run), items[1].en));
    expect(run.jobs.at(-1)).toEqual(hintedJob);
    expect(run.mistakes).toBe(1);
    expect(finishLines(run).phase).toBe("whole");
  });
  it("does not award a full frame pass after showing the answer", () => {
    const run = finishLines();
    const hinted = answer(hintMemory(run), memoryTarget(items));
    expect(hinted.correct).toBe(true);
    const retry = advanceMemory(hinted);
    expect(retry).toMatchObject({ phase: "whole", text: "", hinted: false, checked: false });
    expect(recordMemory(undefined, retry).passedAt).toBeUndefined();
  });
  it("schedules 1/3/7-day reviews only after completed unaided runs, without duplicate credit", () => {
    const done = advanceMemory(answer(finishLines(), memoryTarget(items)));
    const first = recordMemory(undefined, done, 1000);
    const day = 86_400_000;
    expect(first).toMatchObject({ reviews: 1, dueAt: 1000 + day });
    expect(recordMemory(first, done, 2000)).toEqual(first);
    const repeat = recordMemory(recordMemory(first, startMemory(items)), done, 3000);
    expect(repeat.dueAt).toBe(first.dueAt);
    const second = recordMemory(recordMemory(repeat, startMemory(items)), done, first.dueAt!);
    expect(second.reviews).toBe(2);
    expect(second.dueAt).toBe(first.dueAt! + 3 * day);
    const third = recordMemory(recordMemory(second, startMemory(items)), done, second.dueAt!);
    expect(third.dueAt).toBe(second.dueAt! + 7 * day);
  });
  it("vocabulary finishes without an artificial whole-list essay and preserves phrase spelling", () => {
    const words = WRITING_VOCAB[0].items;
    let run = startMemory(words);
    for (let i = 0; i < words.length * 4; i++) {
      run = advanceMemory(checkMemory(typeMemory(run, words.find((w) => w.id === run.jobs[run.index].id)!.en), words), false);
    }
    expect(run.phase).toBe("done");
    expect(memoryMatches("  I’M writing TO. ", "I'm writing to")).toBe(true);
    expect(memoryMatches("I am writing", "I'm writing")).toBe(false);
    expect(fadedText("I would like to")).toBe("I w____ l___ t_");
  });
});
