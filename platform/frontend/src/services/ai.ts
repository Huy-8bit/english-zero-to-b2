/** Client for AI + adaptive-learning endpoints. The browser never sees an OpenAI key. */
import { ApiError } from "./api";

export class AIRequestError extends ApiError {
  constructor(status: number, message: string, public code: string, public retryable: boolean) {
    super(status, message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new AIRequestError(0, "Không kết nối được máy chủ. Bài làm của bạn vẫn được giữ trong trình duyệt.", "network", true);
  }
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("em-auth-required"));
  }
  if (!res.ok) {
    let body: { message?: string; detail?: unknown; code?: string; retryable?: boolean } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const msg = body.message ?? (typeof body.detail === "string" ? body.detail : `Lỗi ${res.status}`);
    throw new AIRequestError(res.status, msg, body.code ?? String(res.status), body.retryable ?? res.status >= 500);
  }
  return res.json() as Promise<T>;
}
const post = <T,>(path: string, body?: unknown) => call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T,>(path: string, body: unknown) => call<T>(path, { method: "PUT", body: JSON.stringify(body) });

export interface AIStatus {
  configured: boolean; enabled: boolean; provider: string | null; simulated: boolean; models: Record<string, string> | null;
  limits: { ai_enabled: boolean; daily_request_limit: number; monthly_budget_usd: number | null; max_audio_seconds: number; max_exercise_count: number; rate_limit_per_minute: number };
}

export interface PublicQuestion {
  id: string; position: number; qtype: string; question_text: string; options: string[]; instructions_vi: string;
  context_passage: string | null; tokens: string[] | null; left: string[] | null; right: string[] | null; level: string | null;
  difficulty: string; topic_id: string | null; learning_objective: string;
}

export interface GradeFeedback {
  correctness: string; score: number; feedback_vi?: string; errors?: { category: string; original: string; correction: string; explanation_vi: string }[];
  corrected_answer?: string | null; acceptable_alternatives?: string[]; grammar_explanation_vi?: string; improvement_suggestion_vi?: string;
  follow_up_suggestion_vi?: string; confidence?: string; needs_manual_review?: boolean; reviewable?: boolean; reviewed_by_ai?: boolean; grader?: string;
}

export interface ReviewQuestion extends PublicQuestion {
  answer_key: { correct_index: number | null; answers: string[]; pairs: { left: string; right: string }[]; criteria: string | null };
  expected_answer: string | null; explanation_vi: string; grammar_rule: string; wrong_option_explanations_vi: string[];
  evidence_quote: string | null; reading_strategy_vi: string | null; related_lesson: { id: string; title: string } | null;
  response: null | { answer: string; correctness: string; score: number; grader: string; feedback: GradeFeedback; time_ms: number | null };
}

export interface Review { submission_id: number; score: number; max_score: number; created_at: string; attempt_count: number; questions: ReviewQuestion[] }

export interface ExerciseSet {
  id: string; kind: string; title: string; lesson_id: string | null; lesson_title: string | null; topic_ids: string[]; level: string | null;
  difficulty: string; objectives: string[]; created_at: string; meta: Record<string, unknown>;
  generation: { accepted?: number; requested?: number; rejected?: number; blind_verified?: number; scope?: string };
  questions: PublicQuestion[]; review?: Review | null;
}

export interface ListeningSet extends ExerciseSet {
  audio_url: string; submitted: boolean; transcript: { speaker: string; text: string }[] | null;
  vocabulary: { word: string; meaning_vi: string; example: string }[] | null; transcript_policy: "after_submit" | "toggle";
}

export interface WritingFeedback {
  overall_assessment_vi: string; estimated_level: string; estimated_score_10: number | null;
  criteria: { criterion: string; score: number; comment_vi: string }[];
  detected_errors: { original: string; correction: string; category: string; explanation_vi: string; severity: string; span: [number, number] | null }[];
  minimal_corrections: string; rewritten_version: string; rewrite_changes_vi: string[];
  b2_upgrade_suggestions: { original: string; suggestion: string; why_vi: string }[];
  vocabulary_suggestions: { word_used: string; better_choice: string; example: string; why_vi: string }[];
  organization_feedback_vi: string; improvement_plan_vi: string[]; practice_topics: string[];
  vocab_used?: { entry_id: string; lemma: string; form: string; correct: boolean }[];
  practice_lessons: { topic: string; lesson_id: string; title: string }[]; disclaimer_vi: string;
}

export interface WritingSubmission {
  id: number; prompt: Record<string, unknown>; mode: string; task_type: string; level: string; text: string; word_count: number;
  feedback: WritingFeedback; parent_id: number | null; created_at: string;
}

export interface SpeakingTurn {
  id: number; role: "ai" | "user"; text: string; audio_url: string | null; audio_seconds: number | null; created_at: string;
  feedback: Record<string, unknown> | null;
}
export type WordStatus = "ok" | "unclear" | "different" | "missing";
export interface PronWord {
  word: string; status: WordStatus; heard: string | null; confidence: number | null; ipa?: string | null; tips_vi?: string[];
  explain?: { sound_vi: string; how_vi: string; practice: string[] };
}
export interface PronunciationResult {
  attempt_id: number; reference: string; heard: string; score: number; words: PronWord[];
  counts: Record<WordStatus, number>; words_per_minute: number | null; previous_score: number | null; summary_vi: string; note_vi: string;
}
export interface PronunciationSummary {
  attempts: number; average_score: number | null; recent: { id: number; reference: string; score: number; source: string; created_at: string }[];
  hard_words: { word: string; missed: number; seen: number; ipa: string | null; tips_vi: string[] }[];
}
export interface SpeakingSession {
  id: string; mode: string; mode_label: string; topic: string; level: string; status: string; summary: Record<string, unknown> | null;
  created_at: string; ended_at: string | null; turns: SpeakingTurn[];
}

export interface Recommendation {
  topic_id: string; recommendation_type: string; priority: number; weakness_reason: string; recommended_lesson_id: string | null;
  title: string; suggested_exercise_parameters: Record<string, unknown> | null;
}

export interface TopicRow {
  topic_id: string; title: string; title_vi: string; level: string | null; kind: string | null; attempts: number; accuracy: number | null;
  recent_accuracy: number; mastery: number; label: string; mistake_categories: Record<string, number>; last_practiced: string | null;
  next_review: string | null; review_due: boolean;
}

export interface MistakeRecord {
  id: number; source_type: string; source_ref: string; question_text: string; student_answer: string; corrected_answer: string;
  error_type: string; explanation: string; topic_id: string | null; topic_title: string; frequency: number; first_seen: string;
  last_seen: string; review_status: string; correct_streak: number;
}

export const ai = {
  status: () => call<AIStatus>("/api/ai/status"),
  usage: (days = 30) => call<{
    summary: { today_requests: number; today_cost: number; month_requests: number; month_cost: number }; limits: AIStatus["limits"];
    totals: { requests: number; input_tokens: number; output_tokens: number; cost_usd: number };
    by_feature: { feature: string; requests: number; cached: number; errors: number; input_tokens: number; output_tokens: number; cost_usd: number }[];
    by_day: { day: string; requests: number; cost_usd: number }[]; pricing_note: string;
  }>(`/api/ai/usage?days=${days}`),
  checkModels: () => call<{ models: Record<string, { model: string; available: boolean }> }>("/api/ai/models/check"),
  settings: () => call<{ target_level: string; explanation_language: string; ai_enabled: boolean; daily_request_limit: number | null; monthly_budget_usd: number | null; max_audio_seconds: number | null; max_exercise_count: number | null; placement: { level: string; date: string } | null }>("/api/learning/settings"),
  saveSettings: (body: Record<string, unknown>) => put<unknown>("/api/learning/settings", body),

  tutor: (body: { unit_id: string; action: string; message?: string; step_index?: number; item_id?: string }) =>
    post<{ answer: string; sources: { lesson_id: string | null; section_title: string; source_path: string }[] }>("/api/ai/tutor/chat", body),
  tutorHistory: (unit: string) => call<{ messages: { role: string; action: string; content: string; created_at: string; sources: { section_title: string; source_path: string }[] }[] }>(`/api/ai/tutor/history?unit_id=${encodeURIComponent(unit)}`),

  generate: (body: { lesson_id?: string | null; scope: string; count: number; difficulty: string; question_types: string[]; focus?: string[] }) =>
    post<ExerciseSet>("/api/ai/exercises/generate", body),
  similar: (id: string) => post<ExerciseSet>(`/api/ai/exercises/${id}/similar`),
  exercise: (id: string) => call<ExerciseSet>(`/api/exercises/${id}`),
  exercises: (kind?: string) => call<{ sets: { id: string; kind: string; title: string; lesson_id: string | null; lesson_title: string | null; level: string | null; difficulty: string; questions: number; created_at: string; attempts: number; best_score: number | null; last_score: number | null }[] }>(`/api/exercises${kind ? `?kind=${kind}` : ""}`),
  submit: (id: string, body: { answers: Record<string, unknown>; times_ms?: Record<string, number>; client_submission_id: string }) =>
    post<Review>(`/api/exercises/${id}/submit`, body),
  regrade: (setId: string, qid: string) => post<Review>(`/api/exercises/${setId}/questions/${qid}/regrade`),
  followUp: (body: { target_type: "question" | "attempt"; target_id: string; action: string }) =>
    post<{ id: number; action: string; content: string; created_at: string }>("/api/ai/feedback", body),
  followUps: (type: string, id: string) => call<{ messages: { id: number; action: string; content: string; created_at: string }[] }>(`/api/ai/feedback?target_type=${type}&target_id=${encodeURIComponent(id)}`),
  gradeAttempt: (attemptId: number) => post<GradeFeedback>(`/api/ai/grade-attempt/${attemptId}`),
  attemptGrade: (attemptId: number) => call<{ result: GradeFeedback | null }>(`/api/ai/grade-attempt/${attemptId}`),

  writingOptions: () => call<{ task_types: Record<string, string>; modes: Record<string, string>; curriculum_prompts: { id: string; unit_id: string; unit_title: string; level: string | null; title: string; prompt_md: string; word_min: number | null; word_max: number | null }[] }>("/api/writing-studio/options"),
  writingPrompt: (body: { level: string; task_type: string; topic: string }) => post<Record<string, unknown>>("/api/ai/writing/generate-prompt", body),
  evaluateWriting: (body: { text: string; prompt: Record<string, unknown>; mode: string; task_type: string; level: string; client_submission_id: string; parent_id?: number | null }) =>
    post<WritingSubmission>("/api/ai/writing/evaluate", body),
  writingHistory: () => call<{ submissions: WritingSubmission[]; stats: { submissions: number; error_categories: Record<string, number>; timeline: { id: number; date: string; words: number; errors: number; errors_per_100: number; score: number | null; level: string | null }[] } }>("/api/writing/history"),
  deleteWriting: (id: number) => call<unknown>(`/api/writing/history/${id}`, { method: "DELETE" }),

  speakingOptions: () => call<{ modes: Record<string, string>; roleplays: Record<string, string>; max_audio_seconds: number; realtime_max_seconds: number; store_user_audio: boolean }>("/api/speaking-studio/options"),
  startSpeaking: (body: { mode: string; topic: string; level: string }) => post<SpeakingSession>("/api/ai/speaking/session", body),
  answerSpeaking: (id: string, audio: Blob, seconds: number, clientTurnId: string) => {
    const fd = new FormData();
    fd.append("audio", audio, `answer.${audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "m4a" : "webm"}`);
    fd.append("seconds", String(seconds));
    fd.append("client_turn_id", clientTurnId);
    return call<SpeakingSession>(`/api/ai/speaking/session/${id}/answer`, { method: "POST", body: fd });
  },
  /** Read a sentence or a word aloud → word-by-word pronunciation check. */
  assessPronunciation: (audio: Blob, reference: string, opts: { seconds?: number; source?: string; sourceRef?: string; level?: string } = {}) => {
    const fd = new FormData();
    fd.append("audio", audio, `read.${audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "m4a" : "webm"}`);
    fd.append("reference", reference);
    fd.append("source", opts.source ?? "practice");
    if (opts.sourceRef) fd.append("source_ref", opts.sourceRef);
    if (opts.seconds) fd.append("seconds", String(opts.seconds));
    fd.append("level", opts.level ?? "A1");
    return call<PronunciationResult>("/api/pronunciation/assess", { method: "POST", body: fd });
  },
  pronunciationSummary: () => call<PronunciationSummary>("/api/pronunciation/summary"),
  endSpeaking: (id: string) => post<SpeakingSession>(`/api/ai/speaking/session/${id}/end`),
  speakingSessions: () => call<{ sessions: { id: string; mode: string; topic: string; level: string; status: string; answers: number; created_at: string }[] }>("/api/speaking/sessions"),
  speakingSession: (id: string) => call<SpeakingSession>(`/api/speaking/sessions/${id}`),
  deleteSpeaking: (id: string) => call<unknown>(`/api/speaking/sessions/${id}`, { method: "DELETE" }),
  realtime: (body: { mode: string; topic: string; level: string }) => post<{ client_secret: string; expires_at: number; model: string; max_seconds: number; calls_url: string }>("/api/ai/speaking/realtime-session", body),
  realtimeEnd: (seconds: number) => post<unknown>("/api/ai/speaking/realtime-session/end", { seconds }),

  generateListening: (body: Record<string, unknown>) => post<ListeningSet>("/api/ai/listening/generate", body),
  listening: (id: string, reveal = false) => call<ListeningSet>(`/api/listening/${id}${reveal ? "?reveal_transcript=true" : ""}`),
  submitListening: (id: string, body: { answers: Record<string, unknown>; times_ms?: Record<string, number>; client_submission_id: string }) =>
    post<ListeningSet & { review: Review }>(`/api/listening/${id}/submit`, body),
  generateReading: (body: Record<string, unknown>) => post<ExerciseSet>("/api/ai/reading/generate", body),
  readingAnalytics: () => call<{ total: number; by_type: { type: string; answered: number; accuracy: number; avg_seconds: number | null }[] }>("/api/reading/analytics"),

  placementStart: (include_writing: boolean) => post<PlacementState>("/api/placement/start", { include_writing }),
  placement: (id: string) => call<PlacementState>(`/api/placement/${id}`),
  placementAnswer: (id: string, item_id: string, answer: string) => post<PlacementState>(`/api/placement/${id}/answer`, { item_id, answer }),
  placements: () => call<{ sessions: { id: string; created_at: string; finished: boolean; overall: string | null }[] }>("/api/placement"),

  plan: () => call<{ plan: Recommendation[]; ai_enabled: boolean }>("/api/learning/recommendations"),
  weaknesses: () => call<{ weak_topics: TopicRow[]; topics: TopicRow[] }>("/api/learning/weaknesses"),
  mistakes: () => call<{ records: MistakeRecord[]; by_category: Record<string, number>; by_topic: { topic_id: string; title: string; open: number; mastered: number; frequency: number }[]; open_count: number }>("/api/learning/mistakes"),
  reviewSession: (scope: "mistakes" | "weak", count = 10) => post<ExerciseSet>("/api/learning/review-session", { scope, count }),
  deleteHistory: (what: "writing" | "speaking" | "all") => call<{ deleted: number }>(`/api/privacy/practice-history?what=${what}`, { method: "DELETE" }),

  authStatus: () => call<{ required: boolean; authenticated: boolean }>("/api/auth/status"),
  login: (token: string) => post<{ authenticated: boolean }>("/api/auth/login", { token }),
};

export interface PlacementState {
  session_id: string; done: boolean;
  section?: string; progress?: { answered: number; section: string };
  question?: { id: string; kind: string; prompt_md: string; instruction_md?: string; options?: { key: string; text: string }[] | null; passage_md?: string | null };
  result?: { skills: Record<string, string | null>; overall: string; writing: { level: string; rationale_vi: string } | null;
    report: { estimated_level: string; strengths_vi: string[]; weaknesses_vi: string[]; recommended_lesson_ids: string[]; study_priorities_vi: string[]; plan_vi: string[] };
    notes: string[]; answered: number; correct: number; disclaimer_vi: string };
  review?: { section: string; item: string; level: string; answer: string; correct: boolean; prompt: string; correct_option: string | null }[];
}

export const ERROR_LABELS: Record<string, string> = {
  tense: "Thì", subject_verb_agreement: "Hòa hợp chủ–vị", article: "Mạo từ", preposition: "Giới từ", word_form: "Dạng từ",
  word_order: "Trật tự từ", vocabulary: "Từ vựng", collocation: "Kết hợp từ", sentence_structure: "Cấu trúc câu", cohesion: "Liên kết",
  spelling: "Chính tả", punctuation: "Dấu câu", meaning: "Nghĩa", other: "Khác",
};

export const QTYPE_LABELS: Record<string, string> = {
  multiple_choice: "Trắc nghiệm", true_false: "Đúng/Sai", fill_blank: "Điền từ", verb_conjugation: "Chia động từ", error_correction: "Sửa lỗi",
  sentence_transformation: "Viết lại câu", sentence_ordering: "Sắp xếp câu", matching: "Ghép", translation_vi_en: "Dịch Việt → Anh",
  translation_en_vi: "Dịch Anh → Việt", short_answer: "Trả lời ngắn", sentence_writing: "Viết câu", reading_comprehension: "Đọc hiểu",
  listening_comprehension: "Nghe hiểu", contextual_grammar: "Ngữ pháp trong ngữ cảnh",
};

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
