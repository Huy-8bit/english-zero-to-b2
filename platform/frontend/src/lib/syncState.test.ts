import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrate, isSynced, mergeProgress } from "./syncState";
import { safeStorage } from "./utils";

const put = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
  .map(([, init]) => JSON.parse(String((init as RequestInit).body)).items as Record<string, { value: unknown; ts: number }>);

describe("learning state in the database", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("syncs learning progress, not device preferences or transient keys", () => {
    for (const k of ["em-grammar-night", "em-vstep-rush", "em-lesson-A1-G009", "em-lesson-mode", "em-ex-42", "em-writing-draft"]) expect(isSynced(k)).toBe(true);
    for (const k of ["em-theme", "em-tts-rate", "em-focus", "em-reader-settings", "em-quiz-pending-q1", "em-lesson-exit", "em-sync-meta"]) expect(isSynced(k)).toBe(false);
  });

  it("merges two copies of the night: readings from both, the newest answer per question", () => {
    const older = { start: 1, compactRead: ["A0-G004", "A1-G009"], briefAnswers: { q1: { correct: false, at: 5 }, q2: { correct: true, at: 9 } } };
    const newer = { start: 2, compactRead: ["B2-G022"], briefAnswers: { q1: { correct: true, at: 7 } } };
    expect(mergeProgress("em-grammar-night", older, newer)).toMatchObject({
      start: 2, compactRead: ["A0-G004", "A1-G009", "B2-G022"], briefAnswers: { q1: { correct: true, at: 7 }, q2: { correct: true, at: 9 } },
    });
  });

  it("at start-up: takes newer server copies, merges progress, uploads what only this browser has, then mirrors writes", async () => {
    // this browser: an old night (never synced), a sprint plan, a theme
    localStorage.setItem("em-grammar-night", JSON.stringify({ start: 1, compactRead: ["A0-G004"], briefAnswers: { q1: { correct: false, at: 3 } } }));
    localStorage.setItem("em-grammar-sprint", JSON.stringify({ days: 4 }));
    localStorage.setItem("em-lesson-mode", JSON.stringify("journey"));
    localStorage.setItem("em-theme", "dark");
    const server = {
      "em-grammar-night": { value: { start: 9, compactRead: ["A1-G009", "B2-G022"] }, ts: 100 },
      "em-lesson-mode": { value: "night", ts: 50 },
    };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify({ items: init?.method === "PUT" ? {} : server }), { status: 200 })));
    expect(await hydrate()).toBe(true);
    expect(JSON.parse(localStorage.getItem("em-lesson-mode")!)).toBe("night"); // server copy is newer
    const night = JSON.parse(localStorage.getItem("em-grammar-night")!);
    expect(night.start).toBe(9);
    expect(night.compactRead.sort()).toEqual(["A0-G004", "A1-G009", "B2-G022"]);
    expect(night.briefAnswers.q1).toEqual({ correct: false, at: 3 }); // this browser's answer is kept
    const sent = put()[0];
    expect(Object.keys(sent).sort()).toEqual(["em-grammar-night", "em-grammar-sprint"]); // merged night + local-only sprint; no theme
    // later writes go to the server too
    vi.useFakeTimers();
    safeStorage().set("em-vstep-rush", { items: {} });
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    expect(put().at(-1)).toMatchObject({ "em-vstep-rush": { value: { items: {} } } });
  });

  it("keeps working from the browser copy when the server cannot be reached", async () => {
    localStorage.setItem("em-grammar-sprint", JSON.stringify({ days: 3 }));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await hydrate()).toBe(false);
    expect(JSON.parse(localStorage.getItem("em-grammar-sprint")!)).toEqual({ days: 3 });
  });
});
