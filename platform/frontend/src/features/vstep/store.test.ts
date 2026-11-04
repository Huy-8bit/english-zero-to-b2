import { beforeEach, describe, expect, it } from "vitest";
import { DECKS } from "./decks";
import { formMatches, VERBS } from "./verbs";
import { ALL_IDS, DECK_ITEMS, grade, graded, loadRush, phraseMatches, planProgress, PLAN, sessionItems, weakIds } from "./store";

describe("VSTEP rush", () => {
  beforeEach(() => localStorage.clear());

  it("has unique ids, a Vietnamese meaning for everything, and every deck in the plan", () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    expect(ALL_IDS.length).toBeGreaterThan(400);
    for (const d of DECKS) for (const i of d.items) expect(i.vi.trim()).not.toBe("");
    expect(new Set(VERBS.map((v) => v.base)).size).toBe(VERBS.length);
    const planned = new Set(PLAN.flatMap((b) => b.decks));
    for (const d of Object.keys(DECK_ITEMS)) expect(planned.has(d)).toBe(true);
  });

  it("accepts every listed form of an irregular verb", () => {
    expect(formMatches("learned", "learnt/learned")).toBe(true);
    expect(formMatches(" Learnt ", "learnt/learned")).toBe(true);
    expect(formMatches("was", "was/were")).toBe(true);
    expect(formMatches("was/were", "was/were")).toBe(true);
    expect(formMatches("goed", "went")).toBe(false);
  });

  it("matches a typed phrase regardless of case, punctuation and ellipsis", () => {
    expect(phraseMatches("i am writing to enquire about", "I am writing to enquire about …")).toBe(true);
    expect(phraseMatches("Moreover", "Furthermore, … / Moreover, …")).toBe(true);
    expect(phraseMatches("I am writing to ask about", "I am writing to enquire about …")).toBe(false);
  });

  it("moves an item up a box when recalled, back to 0 when missed; weak items come first", () => {
    const [a, b, c] = DECK_ITEMS.w1;
    let s = graded(loadRush(), a, true, 1);
    s = graded(s, a, true, 2);
    s = graded(s, b, false, 3);
    expect(s.items[a].box).toBe(2);
    expect(s.items[b]).toMatchObject({ box: 0, wrong: 1 });
    expect(weakIds(s)).toEqual([b]);
    expect(sessionItems(s, "w1").slice(0, 3)).toEqual([b, c, DECK_ITEMS.w1[3]]); // weak, then new in order; learnt a last
    expect(sessionItems(s, "w1").at(-1)).not.toBe(a);
    expect(sessionItems(s, "review")).toEqual([b]);
  });

  it("follows the plan: a block is done when 90 % of its items are learnt", () => {
    expect(planProgress(loadRush()).current.n).toBe(1);
    for (const id of DECK_ITEMS["iv-1"].slice(0, Math.ceil(DECK_ITEMS["iv-1"].length * 0.9))) { grade(id, true); grade(id, true); }
    const p = planProgress(loadRush());
    expect(p.blocks[0].complete).toBe(true);
    expect(p.current.n).toBe(2);
  });
});
