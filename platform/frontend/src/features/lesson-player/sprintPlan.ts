/** The learner's grammar-sprint plan (finish all grammar in N days), kept in the browser. */
import { safeStorage } from "@/lib/utils";

const KEY = "em-grammar-sprint";
export interface SprintPlan { days: number; start: string; startRemaining: number }

export function loadPlan(): SprintPlan | null {
  return safeStorage().get<SprintPlan | null>(KEY, null);
}
export function savePlan(p: SprintPlan) {
  safeStorage().set(KEY, p);
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Lessons to finish today so the remaining ones fit in the days left (today included). */
export function dailyTarget(plan: SprintPlan | null, remaining: number, doneToday: number): { target: number; dayN: number; daysLeft: number } {
  if (!plan) return { target: Math.ceil((remaining + doneToday) / 4), dayN: 1, daysLeft: 4 };
  const elapsed = Math.max(0, Math.round((Date.parse(day(new Date())) - Date.parse(plan.start)) / 86_400_000));
  const daysLeft = Math.max(1, plan.days - elapsed);
  return { target: Math.ceil((remaining + doneToday) / daysLeft), dayN: Math.min(plan.days, elapsed + 1), daysLeft };
}

const COMBO = "em-sprint-combo";
export const getCombo = () => Number(safeStorage().get<number>(COMBO, 0)) || 0;
export const setCombo = (n: number) => safeStorage().set(COMBO, n);
