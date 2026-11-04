import { describe, expect, it } from "vitest";
import { wordCount } from "@/lib/utils";
import { assembleWriting, frameDraftKey, normalizeRecall, unfilledSlots, WRITING_FRAMES } from "./examFrames";
import { checkRecall, freshRecall, nextRecall, revealRecall, updateRecallText } from "./examWritingState";

const frame = WRITING_FRAMES.find((f) => f.id === "opinion")!;

describe("exam writing frames", () => {
  it("includes six distinct frames, 18 appropriate topics, and complete worked examples", () => {
    expect(WRITING_FRAMES).toHaveLength(6);
    expect(new Set(WRITING_FRAMES.map((f) => f.id)).size).toBe(6);
    expect(WRITING_FRAMES.flatMap((f) => f.topics)).toHaveLength(18);
    expect(WRITING_FRAMES.flatMap((f) => f.cues)).toHaveLength(44);
    for (const f of WRITING_FRAMES) {
      expect(f.topics).toHaveLength(3);
      expect(new Set(f.topics.map((t) => t.id)).size).toBe(3);
      expect(wordCount(f.sections.map((s) => s.example).join("\n\n"))).toBeGreaterThanOrEqual(f.wordMin);
      for (const t of f.topics) { expect(t.requirements.length).toBeGreaterThanOrEqual(2); expect(t.ideas.length).toBeGreaterThanOrEqual(3); }
      for (const cue of f.cues) {
        const part = f.sections.find((s) => s.id === cue.section)!;
        expect(part).toBeDefined();
        expect(normalizeRecall(part.pattern)).toContain(normalizeRecall(cue.answer));
      }
    }
  });

  it("assembles paragraphs in frame order and detects untouched scaffold slots", () => {
    const parts = { conclusion: "A conclusion.", intro: "My introduction.", reason2: "Reason two.", unrelated: "Never include me." };
    expect(assembleWriting(frame, parts)).toBe("My introduction.\n\nReason two.\n\nA conclusion.");
    expect(unfilledSlots(frame.sections[0].pattern).length).toBeGreaterThan(0);
    expect(unfilledSlots("My own complete paragraph.")).toEqual([]);
    expect(frameDraftKey("opinion", "online-learning")).not.toBe(frameDraftKey("opinion", "public-transport"));
    expect(frameDraftKey("opinion", "course")).not.toBe(frameDraftKey("formal-email", "course"));
  });

  it("accepts case, punctuation, whitespace and curly-apostrophe differences", () => {
    expect(normalizeRecall("  I’M  writing to. ")).toBe(normalizeRecall("I'm writing to"));
    expect(normalizeRecall("In conclusion," )).toBe(normalizeRecall("IN CONCLUSION"));
    expect(normalizeRecall("I believe that")).not.toBe(normalizeRecall("I believed that"));
  });
});

describe("frame memory practice", () => {
  it("requires a committed answer before advancing and counts unaided correct recall", () => {
    let run = freshRecall(frame);
    expect(nextRecall(run)).toEqual(run);
    run = checkRecall(frame, updateRecallText(run, frame.cues[0].answer.toUpperCase() + "."));
    expect(run.answers[frame.cues[0].id]).toMatchObject({ checked: true, correct: true, hinted: false });
    expect(nextRecall(run).index).toBe(1);
  });

  it("keeps revealed answers distinct from unaided recall after serialisation", () => {
    let run = revealRecall(freshRecall(frame));
    run = JSON.parse(JSON.stringify(run));
    run = checkRecall(frame, updateRecallText(run, frame.cues[0].answer));
    expect(run.answers[frame.cues[0].id]).toMatchObject({ correct: true, hinted: true });
  });

  it("preserves a checked wrong answer and allows an explicit fresh retry", () => {
    let run = checkRecall(frame, updateRecallText(freshRecall(frame), "Wrong phrase"));
    const checked = run;
    run = updateRecallText(run, frame.cues[0].answer);
    expect(run).toEqual(checked);
    expect(run.answers[frame.cues[0].id]).toMatchObject({ correct: false, hinted: true });
    const retry = checkRecall(frame, updateRecallText(freshRecall(frame, [frame.cues[0].id]), frame.cues[0].answer));
    expect(retry.answers[frame.cues[0].id]).toMatchObject({ correct: true, hinted: false });
    expect(nextRecall(nextRecall(retry)).index).toBe(1);
  });
});
