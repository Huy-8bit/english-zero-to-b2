import { describe, expect, it } from "vitest";
import { fatigueSignal } from "./SessionPage";

const run = (n: number, ok: (i: number) => boolean, ms: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ ok: ok(i), ms: ms(i) }));

describe("fatigueSignal", () => {
  it("stays quiet with too little data or steady performance", () => {
    expect(fatigueSignal(run(8, () => false, () => 3000))).toBeNull();
    expect(fatigueSignal(run(20, (i) => i % 5 !== 0, () => 4000))).toBeNull();
  });
  it("flags falling accuracy", () => {
    expect(fatigueSignal(run(16, (i) => i < 8, () => 4000))).toMatch(/chính xác đang giảm/);
  });
  it("flags answers getting much slower", () => {
    expect(fatigueSignal(run(16, () => true, (i) => (i < 8 ? 3000 : 12000)))).toMatch(/chậm dần/);
  });
});
