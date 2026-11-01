import { beforeEach, describe, expect, it } from "vitest";
import {
  breakDue, endNight, flashbackPick, loadNight, needsReview, nextNight, nightPace, recallAnswer, recordNight, reviewPicks,
  startNight, studyMinutes, tookBreak,
} from "./nightPlan";

const units = Array.from({ length: 10 }, (_, i) => ({ id: `U${i}`, title: `Unit ${i}`, level: "A1" }));
const T0 = Date.parse("2026-10-31T22:00:00");
const MIN = 60_000;
const read = (id: string, at: number, extra = {}) => recordNight(id, { correct: 3, total: 3, seconds: 200, at, ...extra })!;

describe("grammar night", () => {
  beforeEach(() => localStorage.clear());

  it("keeps 5-minute breaks out of the study time", () => {
    expect(studyMinutes(8)).toBe(480 - 8 * 5);
    expect(studyMinutes(1)).toBe(55);
  });

  it("switches lessons to night mode and restores the previous mode at the end", () => {
    localStorage.setItem("em-lesson-mode", JSON.stringify("sprint"));
    startNight(units, 8, T0);
    expect(JSON.parse(localStorage.getItem("em-lesson-mode")!)).toBe("night");
    endNight();
    expect(JSON.parse(localStorage.getItem("em-lesson-mode")!)).toBe("sprint");
    expect(loadNight()).toBeNull();
  });

  it("goes on after the current lesson, then back to the gaps", () => {
    startNight(units, 8, T0);
    read("U0", 1);
    let s = read("U2", 2);
    expect(nextNight(s)?.id).toBe("U1");
    expect(nextNight(s, "U2")?.id).toBe("U3");
    for (const u of units.slice(3)) s = read(u.id, 3);
    expect(nextNight(s, "U9")?.id).toBe("U1");
  });

  it("asks a missed question again after 2 more lessons, then 7 more, then counts it as recovered", () => {
    startNight(units, 8, T0);
    read("U0", 1);
    recallAnswer("U1", "U1:q", false); // missed while reading U1 (not recorded yet)
    let s = read("U1", 2);
    expect(needsReview(s)).toEqual([{ ...units[1], missed: 1 }]);
    expect(flashbackPick(s, "U2")?.item).toBeUndefined(); // not due yet
    s = read("U2", 3);
    expect(flashbackPick(s, "U3", () => 0)).toEqual({ unit: "U0" }); // still not due: a question from an older lesson
    s = read("U3", 4);
    expect(flashbackPick(s, "U4")).toEqual({ unit: "U1", item: "U1:q" }); // opens U4
    s = recallAnswer("U1", "U1:q", true)!;
    expect(needsReview(s)).toEqual([]); // recalled once: off the list, asked once more later
    expect(s.recall).toEqual([{ unit: "U1", item: "U1:q", due: 4 + 8, stage: 1 }]);
    s = recallAnswer("U1", "U1:q", true)!;
    expect(s.recall).toEqual([]);
    expect(s.recovered).toBe(1);
  });

  it("opens a lesson with a question from a lesson read a while ago, and mixes lessons in a review", () => {
    startNight(units, 8, T0);
    for (let i = 0; i < 6; i++) read(`U${i}`, i + 1);
    const s = recordNight("U6", { correct: 0, total: 0, seconds: 5, skipped: true, at: 7 })!;
    // read: U0..U5 → the last two (U4, U5) are too recent, U6 was skipped
    expect(flashbackPick(s, "U7", () => 0)).toEqual({ unit: "U0" });
    expect(flashbackPick(s, "U7", () => 0.99)).toEqual({ unit: "U3" });
    const s2 = recallAnswer("U2", "U2:q", false)!;
    const picks = reviewPicks(s2, 4, 4, () => 0);
    expect(picks[0]).toEqual({ unit: "U2", item: "U2:q" }); // missed first
    expect(picks.slice(1).map((p) => p.unit).sort()).toEqual(["U3", "U4", "U5"]); // then lessons read since `since`
  });

  it("tells whether the night is ahead or behind and how long each lesson may take", () => {
    let s = startNight(units, 1, T0);
    expect(nightPace(s, T0 + 30 * MIN)).toMatchObject({ covered: 0, ahead: -5, left: 10 });
    for (const id of ["U0", "U1", "U2", "U3", "U4", "U5"]) s = read(id, T0);
    const p = nightPace(s, T0 + 30 * MIN);
    expect(p.ahead).toBe(1);
    expect(p.perLesson).toBe((30 * 60) / 4); // 30 min left, no full break interval left
    expect(p.finishAt).toBe(T0 + 30 * MIN + 5 * 4 * MIN); // 5 min per lesson so far
  });

  it("asks for a break after 50 minutes; 'later' asks again in 10", () => {
    const s = startNight(units, 8, T0);
    expect(breakDue(s, T0 + 49 * MIN)).toBe(false);
    expect(breakDue(s, T0 + 50 * MIN)).toBe(true);
    const later = tookBreak(T0 + 50 * MIN, 10)!;
    expect(breakDue(later, T0 + 59 * MIN)).toBe(false);
    expect(breakDue(later, T0 + 60 * MIN)).toBe(true);
  });
});
