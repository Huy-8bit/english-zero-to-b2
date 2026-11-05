/// <reference types="node" />
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { COMPACT_GRAMMAR, NIGHT_LATER, briefFor } from "./compactGrammar";
import { briefsUpTo, coveredNight, loadNight, markBriefs, nextNight, nightPace, recordBrief, recordNight, replanNight, startNight, withPathProgress } from "./nightPlan";

const root = resolve(process.cwd(), "../..");
const sourceIds = readdirSync(root).filter((d) => /^0[1-5]-/.test(d)).sort()
  .flatMap((d) => readdirSync(resolve(root, d, "grammar")).filter((f) => f.endsWith(".md")).sort().map((f) => f.match(/^[AB][012]-G\d+/)![0]));
const path = sourceIds.map((id) => ({ id, title: id, level: id.split("-")[0], status: "not_started" as "not_started" | "completed" }));
const T = 1_000_000;
const synced = () => withPathProgress(startNight(path, 3.5, T), path);

describe("concise one-night curriculum", () => {
  beforeEach(() => localStorage.clear());

  it("accounts for every real grammar source exactly once, with no silent omissions", () => {
    const mapped = COMPACT_GRAMMAR.flatMap((b) => b.sources);
    const accounted = [...mapped, ...NIGHT_LATER];
    expect(COMPACT_GRAMMAR).toHaveLength(29);
    expect(mapped).toHaveLength(118);
    expect(sourceIds).toHaveLength(128);
    expect(new Set(accounted).size).toBe(accounted.length);
    expect(accounted.sort()).toEqual([...sourceIds].sort());
    for (const b of COMPACT_GRAMMAR) {
      expect(b.id).toBe(b.sources[0]);
      for (const text of [b.idea, b.form, b.examples, b.trap, b.question, b.answer]) expect(text.length).toBeGreaterThan(20);
    }
    expect(briefFor("A2-G007")).toBe(briefFor("A2-G003"));
  });

  it("opens one brief for split/contrast lessons and defers production/sound work", () => {
    const s = synced();
    expect(s.units).toHaveLength(29);
    expect(nextNight(s)?.id).toBe("A0-G004");
    expect(s.units.some((u) => u.id === "A2-G007")).toBe(false);
    expect(s.units.flatMap((u) => u.sources ?? []).some((id) => NIGHT_LATER.includes(id))).toBe(false);
  });

  it("keeps partially learned groups and follows the first unfinished path lesson", () => {
    const s = startNight(path, 3.5, T);
    const progressed = path.map((u) => ({ ...u, status: u.id < "A2-G001" ? "completed" as const : "not_started" as const }));
    const updated = withPathProgress(s, progressed);
    expect(coveredNight(updated, "A1-G001")).toBe(true);
    // Articles still include A2/B2 extensions; these must not hide or jump ahead of A2-G001.
    expect(coveredNight(updated, "A0-G011")).toBe(false);
    expect(nextNight(updated)?.id).toBe("A1-G016");
    expect(nextNight(updated)?.sources).toContain("A2-G001");
    progressed.find((u) => u.id === "A1-G001")!.status = "not_started";
    expect(nextNight(withPathProgress(s, progressed))?.id).toBe("A1-G001");
  });

  it("migrates old results without treating one old lesson as the whole merged topic", () => {
    const s = startNight(path, 8, T);
    recordNight("A2-G003", { correct: 3, total: 3, seconds: 60 });
    const old = loadNight()!;
    delete old.plan;
    const migrated = withPathProgress(old, path);
    expect(migrated.results).toEqual(old.results);
    expect(migrated.start).toBe(s.start);
    expect(coveredNight(migrated, "A2-G003")).toBe(false);
    expect(migrated.units).toHaveLength(29);
  });

  it("records a brief locally, preserves all original quiz results, and rebases an expired timer", () => {
    startNight(path, 8, T);
    const old = recordNight("A2-G007", { correct: 2, total: 3, seconds: 120 })!;
    recordBrief("A2-G003");
    const s = withPathProgress(loadNight()!, path);
    expect(coveredNight(s, "A2-G003")).toBe(true);
    expect(s.results).toEqual(old.results);
    expect(nightPace(s, T).covered).toBe(1);
    const rebased = replanNight(3, T + 20 * 3_600_000)!;
    expect(rebased.results).toEqual(old.results);
    expect(rebased.compactRead).toEqual(["A2-G003"]);
    expect(rebased.paceReadBaseline).toBe(1);
    expect(nightPace(withPathProgress(rebased, path), rebased.start)).toMatchObject({ msLeft: 3 * 3_600_000, ahead: 0, read: 1 });
  });

  it("keeps an explicit full review and an explicit all-briefs review", () => {
    const full = withPathProgress(startNight(path, 8, T, "remaining", "full"), path);
    expect(full.units).toHaveLength(128);
    expect(nextNight(full)?.id).toBe("A0-G001");
    const all = withPathProgress(startNight(path, 3.5, T, "all"), path.map((u) => ({ ...u, status: "completed" })));
    expect(nightPace(all, T).covered).toBe(0);
    expect(nextNight(all)?.id).toBe("A0-G004");
  });

  it("marks topics studied elsewhere (1…n) without counting them as tonight's reading", () => {
    const s = synced();
    localStorage.setItem("em-grammar-night", JSON.stringify(s));
    const marked = markBriefs(briefsUpTo(s, 23), true)!;
    const p = nightPace(withPathProgress(marked, path), T + 60_000);
    expect(p.covered).toBe(23);
    expect(p.total).toBe(29);
    expect(Math.abs(p.ahead)).toBe(0); // studied before tonight: not "23 topics ahead"
    // continues with one of the 6 topics left (the earliest unfinished source lesson in the path goes first)
    expect(COMPACT_GRAMMAR.slice(23).map((b) => b.id)).toContain(nextNight(withPathProgress(marked, path))?.id);
    const unmarked = markBriefs([COMPACT_GRAMMAR[22].id], false)!;
    expect(nightPace(withPathProgress(unmarked, path), T + 60_000).covered).toBe(22);
  });
});
