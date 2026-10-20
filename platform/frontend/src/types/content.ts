export type Status = "not_started" | "in_progress" | "completed" | "review";
export type UnitKind =
  | "grammar" | "vocabulary" | "pronunciation" | "listening" | "speaking" | "reading" | "writing"
  | "skills" | "communication" | "practice" | "exam";

export interface Unit {
  id: string;
  kind: UnitKind;
  level: string | null;
  title: string;
  title_vi: string;
  path: string;
  order: number;
  answer_path: string | null;
  prerequisites: string[];
  minutes: number | null;
  block: string | null;
  block_title: string | null;
  module: string;
  status: Status;
  score: number | null;
  best_score: number | null;
  current_step: number;
  total_steps: number | null;
}

export interface LessonDetail extends Unit {
  steps: number;
  items: number;
  prev_id: string | null;
  next_id: string | null;
}

export type ItemKind = "mc" | "tfng" | "choice" | "multi" | "text" | "order" | "long" | "speaking";

export interface QuizItem {
  id: string;
  label: string;
  kind: ItemKind;
  prompt_md: string;
  instruction_md: string;
  /** the instruction of the item's group (only the first item of a group carries instruction_md); "" = the step intro */
  group_md?: string;
  options: { key: string; text: string }[] | null;
  prefill: string | null;
  tokens: string[] | null;
  multiline: boolean;
  has_key: boolean;
}

export interface Example { en: string; vi: string; note: string; use: string }
export interface Mistake { wrong: string; right: string; cause: string; tip: string }
export interface DialogueLine { speaker: string; text: string }

export interface Step {
  id: string;
  type:
    | "intro" | "concept" | "formula" | "examples" | "comparison" | "timeline" | "mistakes" | "dialogue"
    | "passage" | "quiz" | "recap" | "vocab" | "flashcards";
  title: string;
  section: string;
  md: string;
  symbols?: Record<string, string>;
  examples?: Example[];
  mistakes?: Mistake[];
  lines?: DialogueLine[];
  tts?: string;
  checklist?: string[];
  card_ids?: string[];
  quiz_id?: string;
  intro_md?: string;
  items?: QuizItem[];
  variant?: "listening" | "reading" | "knowledge" | "task" | null;
  defer?: boolean;
  transcript?: { md: string; lines: DialogueLine[] };
  passage_md?: string;
}

export type Verdict = "correct" | "incorrect" | "mismatch" | "submitted" | "revealed";

export interface ItemResult {
  item_id: string;
  attempt_id: number;
  response: string;
  verdict: Verdict;
  auto: boolean;
  self_correct: boolean | null; ai_correct?: boolean | null;
  correct_option: string | null;
  model_md: string;
  explanation_md: string;
  review: string;
  has_key: boolean;
}

export interface Card {
  id: string;
  unit_id: string;
  word: string;
  pos: string;
  ipa: string;
  meaning: string;
  example: string;
  topic: string;
  unit_title: string;
  srs?: { due: string; interval_days: number; repetitions: number; ease: number; lapses: number } | null;
}

export interface LessonState {
  drafts?: Record<string, unknown>;
  checklist?: Record<string, boolean>;
  highlights?: Record<string, string[]>;
  examStartedAt?: number;
  examSubmitted?: boolean;
  savedAt?: number;
  journey?: JourneyState;
}

/** Position and results of the "journey" view of a lesson (see features/lesson-player/journey.ts). */
export interface JourneyState {
  pos: number;
  /** items answered during this journey (older answers from the classic view are not shown as already done) */
  done: string[];
  wrong: string[];
  retry: string[];
  retryPass: number;
  first: Record<string, boolean>;
  xp: number;
  startedAt: number;
  completed?: boolean;
  /** questions picked for the challenge stage when this journey started (kept so a reload shows the same screens) */
  challenge?: string[];
}

export interface StepsPayload {
  unit: Unit;
  steps: Step[];
  cards: Record<string, Card>;
  results: Record<string, ItemResult>;
  progress: { current_step: number; max_step: number; state: LessonState; status: Status; score: number | null } | null;
  content_version: number;
}

export interface UnitBrief { id: string; title: string; title_vi: string; kind: UnitKind; level: string | null }

export interface Achievement { key: string; title: string; description: string; earned_at: string | null }

export interface Recommendations {
  continue: (UnitBrief & { current_step: number; total_steps: number })[];
  next_lesson: UnitBrief | null;
  review_lessons: (UnitBrief & { score: number | null })[];
  skills_or_test: UnitBrief | null;
  due_cards: number;
  placement: { score: number; level: string | null } | null;
  current_level: string;
  current_level_name: string;
  placement_taken: boolean;
}

export interface Dashboard {
  user: { name: string; daily_goal_minutes: number; weekly_goal_lessons: number };
  xp: { total: number; today: number; week: number };
  streak: number;
  today: { minutes: number; items: number };
  lessons: { completed: number; total: number; grammar_completed: number; grammar_total: number; in_progress: number; review: number; week_completed: number };
  time: { total_minutes: number; week_minutes: number };
  weekly_activity: { day: string; minutes: number; items: number; cards: number }[];
  grammar_mastery: { level: string; name: string; total: number; completed: number; avg_score: number | null }[];
  vocabulary: { total_cards: number; seen: number; mature: number; due: number };
  recent_mistakes: { item_id: string; quiz_id: string; unit_id: string; unit_title: string; response: string; created_at: string }[];
  recommendations: Recommendations;
  achievements: Achievement[];
}

export interface PathLevel {
  id: string;
  name: string;
  blocks: { id: string; title: string; lessons: Unit[] }[];
  extras: Unit[];
}

export interface SearchResult {
  score: number;
  path: string;
  title: string;
  title_vi: string;
  unit_id: string | null;
  kind: string;
  level: string | null;
  heading: string | null;
  snippet: string;
}
