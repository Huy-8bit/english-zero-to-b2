import { describe, expect, it } from "vitest";
import { MEMORY_DECKS } from "./writingMemoryContent";
import { extendWritingDecks, fillFrame, fixedFrameText, frameSlots } from "./extendedWritingFrames";
import { advanceMemory, checkMemory, fadedText, memoryMatches, memoryTarget, startMemory, typeMemory } from "./writingMemoryState";
import { wordCount } from "@/lib/utils";
const decks = extendWritingDecks(MEMORY_DECKS);

describe("expanded reusable Writing frames", () => {
  it("provides substantially more fixed language and two fully filled topic examples for every form", () => {
    expect(decks).toHaveLength(20);
    expect(decks.flatMap((d) => d.applications)).toHaveLength(40);
    for (const [index, deck] of decks.entries()) {
      const template = memoryTarget(deck.lines);
      const fixedWords = wordCount(fixedFrameText(template));
      expect(fixedWords, deck.id).toBeGreaterThan(wordCount(memoryTarget(MEMORY_DECKS[index].lines)) + 25);
      expect(fixedWords, deck.id).toBeGreaterThanOrEqual(60);
      expect(new Set(deck.lines.map((c) => c.id)).size).toBe(deck.lines.length);
      for (const app of deck.applications) {
        for (const slot of frameSlots(template)) expect(app.values[slot], `${deck.id} / ${app.title} / ${slot}`).toBeTruthy();
        const filled = fillFrame(template, app.values);
        expect(frameSlots(filled), `${deck.id} / ${app.title}`).toEqual([]);
        expect(wordCount(filled)).toBeGreaterThan(fixedWords);
        expect(wordCount(filled), `${deck.id} / ${app.title}`).toBeGreaterThanOrEqual(deck.task === 1 ? 120 : 250);
        // The reusable text really is identical when a topic changes.
        let offset = 0;
        for (const fixed of template.split(/\[[^\]]+\]/)) {
          const found = filled.indexOf(fixed, offset);
          expect(found, `${deck.id}: ${fixed}`).toBeGreaterThanOrEqual(offset);
          offset = found + fixed.length;
        }
      }
    }
  });
  it("uses different recipient/sender placeholders and keeps blank edits visible", () => {
    const reply = decks[0];
    const text = fillFrame(memoryTarget(reply.lines), reply.applications[0].values);
    expect(text).toContain("Hi Tom,");
    expect(text).toContain("Best wishes,\nMinh");
    expect(fillFrame("About [topic].", { topic: "  " })).toBe("About [topic].");
    expect(fillFrame("About [topic].", {})).toBe("About [topic].");
  });
  it("trains words on both sides of slots, accepts omitted slot labels, but still catches missing fixed words", () => {
    const template = "First, [idea]. This would help people [action] in their daily lives.";
    expect(memoryMatches("First. This would help people in their daily lives.", template)).toBe(true);
    expect(memoryMatches("First, [ý của tôi]. This would help people [việc làm] in their daily lives.", template)).toBe(true);
    expect(memoryMatches("First. This would help people.", template)).toBe(false);
    expect(memoryMatches("First. This would helped people in their daily lives.", template)).toBe(false);
    expect(fadedText("This helps [people] save time.")).toBe("T___ h____ [people] s___ t___.");
  });
  it("requires the whole extended scaffold in order and does not award credit for merely reading a filled example", () => {
    const deck = decks.find((d) => d.id === "opinion-agree")!;
    let run = { ...startMemory(deck.lines), phase: "whole" as const };
    const full = memoryTarget(deck.lines);
    const fixed = fixedFrameText(full);
    const checked = checkMemory(typeMemory(run, fixed), deck.lines);
    expect(checked.correct).toBe(true);
    expect(advanceMemory(checked).phase).toBe("done");
    const wrongOrder = fixedFrameText(memoryTarget([...deck.lines].reverse()));
    expect(checkMemory(typeMemory(run, wrongOrder), deck.lines).correct).toBe(false);
    // This drill checks the scaffold only. Filled examples are reviewed/edited in the application panel.
    expect(checkMemory(typeMemory(run, fillFrame(full, deck.applications[0].values)), deck.lines).correct).toBe(false);
    run = JSON.parse(JSON.stringify(run));
    expect(run.jobs[0].id).toBe("extended-1");
    expect(startMemory(MEMORY_DECKS[0].lines).jobs[0].id).toBe("line-1");
  });
});
