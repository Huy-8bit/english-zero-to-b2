# Lesson "journey" mode — 2026-10-18

**Diagnosis** (A0-G012, A1-G005; all grammar lessons share the template):
- 11 explanation slides (~7,000 characters) come before the first question.
- Then 34 questions follow in 6 consecutive quiz slides of 8–10 items each.
- Wrong answers are not revisited inside the lesson, and the lesson has no goal or reward framing.

| Feature | Status | Files | Evidence / remaining work |
|---|---|---|---|
| Journey view (default for lessons with practice; exams keep their flow) | COMPLETE_AND_TESTED | `frontend/src/features/lesson-player/journey.ts`, `JourneySession.tsx`, `LessonPlayer.tsx` | Sequence: mission (goal, time, 3 stages) → 2-question pre-test → stage "Hiểu" → stage "Vận dụng" → stage "Thử thách". Both explanation stages have a quick check after at most 2 slides (unit-tested), followed by a checkpoint. In "Thử thách" every remaining question is shown one per screen with its exercise instructions. Wrong answers come back in up to 2 retry rounds, then the recap, then a finish screen with 1–3 stars (first-try accuracy), XP, time, and the items still wrong (they go to Smart Review). |
| Grading and persistence | COMPLETE_AND_TESTED | same | Grading uses the normal quiz endpoint, so XP, the journal, mistakes and focus sessions all count. Position and per-journey answers persist (resume after reload is tested). Old classic-view answers are not shown as already done. Completion uses the normal `complete` endpoint. |
| Classic slide view kept | COMPLETE_AND_TESTED | `LessonPlayer.tsx` | Toggle in both headers; `?mode=classic`; the preference is remembered. |
| Personalised AI examples (G) | NOT_STARTED | — | The learner's interests (technology, travel, work/interviews, entertainment) were noted for this; it was not implemented in this round. |

**Verification:**
- Vitest 25 passed (8 for the journey builder).
- Playwright 53/53 passed, including a full A0-G001 lesson completed in journey mode (stars, score, status) and resume plus mode switching on A0-G012.
- Mobile layout checked at Pixel 7 width: no horizontal overflow.

# Focused 4-hour study day + smart review — 2026-10-18

| Feature | Status | Files | Evidence / remaining work |
|---|---|---|---|
| Daily plan (`/today`) | COMPLETE_AND_TESTED | `backend/app/study_plan.py`, `frontend/src/features/plan/*` | For 240 min, 8 interleaved blocks: retrieval warm-up → gap review → new lesson → listening/reading → new words → second lesson → speaking/writing → final check. Short breaks follow each block, with one long break after ~2 h. No two consecutive blocks share a category (tested). Smaller goals keep the core blocks. Block progress comes from the study journal, not self-report. |
| Block timer + active breaks | COMPLETE_AND_TESTED | `features/plan/BlockTimer.tsx`, `timerStore.ts` | Header chip in the app and in lessons. When a block ends, a short celebration and a break screen with movement/20-20-20/water/breathing tips appear (survives reload). A block can optionally start a focus lock. |
| Daily quests (+XP, once per day) | COMPLETE_AND_TESTED | `study_plan.py::quests` | Finish 2 lessons; fix 10 mistakes or weak words (or 60 correct answers); 5 speaking/writing turns. |
| Smart review (`/review`) | COMPLETE_AND_TESTED | `backend/app/smart_review.py`, `frontend/src/features/flashcards/ReviewPage.tsx` | Diagnoses and reviews, in order: (1) wrong curriculum answers, re-answered in place; (2) Writing/Speaking/AI corrections — the learner types the corrected sentence and must succeed twice to master it, and the correction is hidden until answering; (3) vocabulary "gaps" session — due, unresolved wrong and weak words; (4) lessons below 60 % or due for spaced revision, plus optional AI practice for weak topics. |
| Engagement & alertness | COMPLETE_AND_TESTED | `components/Celebrate.tsx`, `vocab/session/SessionPage.tsx` | Daily ring; streak; a correct-answer combo with a milestone every 5; celebrations that respect `prefers-reduced-motion`. A fatigue cue (unit-tested) suggests a break when accuracy over the last 8 answers drops below 50 % or answers become 2× slower. |
| Assistant | COMPLETE_AND_TESTED | `assistant.py` | Receives today's plan (blocks, minutes, quests). |

**Verification:** backend 137 pytest passed; vitest 18 passed; Playwright 51/51 passed (Chrome, mobile, WebKit; axe includes `/today` and `/review`).

# Fixes after first use of focus mode — 2026-10-18

- **Lock window needed two clicks.** AppKit used the first click on a non-key window only to activate it. Fix: `LockWebView.acceptsFirstMouse → true`; secondary-screen windows can no longer take key status; the learning window regains key focus on every poll. `EnglishFocusLock --clicktest` proves it with a synthetic click on a non-key window: the fixed view receives the first click, the plain `WKWebView` control does not.
- **Assistant could not be opened while locked.** The header button toggled, so a double click (or a click counted twice) opened and then closed the panel. It now always opens; the panel closes with × or Esc.
- **Enter added a new line in the lesson "Hỏi AI" box.** New shared `ChatInput` (lesson tutor and assistant): Enter sends, Shift+Enter adds a new line, and Enter during input-method composition (Vietnamese Telex/VNI) does not send.
- **Tests:** a new Playwright project, `webkit-lock`, runs the assistant and focus specs in WebKit with the lock app's user agent. Playwright: 47/47 passed (desktop Chrome, mobile, WebKit).

# Focus mode / study lock — 2026-10-18

| Feature | Status | Files | Evidence / remaining work |
|---|---|---|---|
| Focus sessions (goals: lessons completed, study minutes) | COMPLETE_AND_TESTED | `backend/app/focus.py`, `api/focus.py`, `models.py::FocusSession`, `alembic/versions/0006_focus_sessions.py` | Progress comes from the same hooks as the study journal: lesson completion requires reaching the last slide, and minutes come from active heartbeats. Tests cover the goal logic, a max duration ≥ the time goal + 30, the 60-second cancel window, emergency unlock (60 s wait + PBKDF2-hashed PIN or phrase), the native escape and history. |
| Web UI (`/focus`, progress badge in app and lesson headers) | COMPLETE_AND_TESTED | `frontend/src/features/focus/*` | E2E covers start, badge, lesson completion unlocking, cancel and the emergency countdown. Passes axe. |
| macOS lock app (`platform/focus-lock`) | IMPLEMENTED_PARTIALLY_TESTED | `FocusLock.swift`, `install.sh`, `uninstall.sh` | Compiles with swiftc and passes `--selftest` (7 cases: lock, unlock, escape release, re-lock on a new session, brief outage, fail-open after ~30 s, outage never starts a lock). `--check` passed against the Docker server. **Not verified:** the real full-screen lock was not triggered in this session, so it would not lock the learner's screen while work was in progress. Try it once with a short session and the escape key. |

# Study journal + smarter assistant — 2026-10-18

| Feature | Status | Files | Evidence / remaining work |
|---|---|---|---|
| Study journal (`study_log`: day × lesson/module) | COMPLETE_AND_TESTED | `models.py::StudyLog`, `alembic/versions/0005_study_log.py`, `services/progress.py::log_study` | Recorded from lesson heartbeats, module heartbeats (new), quiz answers, self-assessment, lesson completion with score, vocabulary sessions and flashcards, AI practice, Writing and Speaking. A one-time backfill rebuilds older days. Day-level time from before this change cannot be split per lesson, so it is labelled `_untracked`. |
| Journal page | COMPLETE_AND_TESTED | `frontend/src/features/journal/*` | KPIs, a 14-day chart, what-if scenarios, the review plan and 30 days of entries with lesson links. Passes axe and mobile checks. |
| Personal-pace ETA + scenarios | COMPLETE_AND_TESTED (formula); accuracy depends on recorded data | `assistant.py::pace_insight`, `eta_insight` | Speed factor = actual minutes on completed lessons ÷ curriculum minutes. ETA = remaining minutes ÷ lesson minutes per week. Scenarios use the learner's own share of study time spent on lessons. Unit tests check the arithmetic. |
| Review of studied material | COMPLETE_AND_TESTED | `assistant.py::review_insight` | Lists low-score lessons, lessons due for spaced revision (2/7/21/60-day intervals per revision), weak topics, due vocabulary and open mistakes. |
| Assistant intents | COMPLETE_AND_TESTED | `assistant.py` | New: history (today, yesterday, this week, a specific day) and review. The AI receives up to 21 active journal days plus pace, ETA and review data, and is told to compute what-if schedules from them. |

**Verification:** backend 128 pytest passed; frontend 15 vitest passed; lint and build pass; Playwright 37/37 passed. Pace is averaged from the first recorded study day (at least 7 days), and estimates from fewer than 14 days of history are flagged as low confidence.

# Learning assistant — 2026-10-18

| Feature | Status | Files | Evidence / remaining work |
|---|---|---|---|
| Assistant on every page (header button + side panel) | COMPLETE_AND_TESTED | `frontend/src/features/assistant/*`, `app/Layout.tsx` | Quick questions: progress, vocabulary, completion estimate, mistakes, next steps. Free questions and data cards with links are supported. History survives reload and can be cleared. Esc closes the panel and returns focus. Full screen on mobile. |
| Deterministic insights (all numbers) | COMPLETE_AND_TESTED | `backend/app/assistant.py`, `api/assistant.py` | Covers lessons by level, recent pace, the ETA formula, vocabulary milestones, mistakes by category and topic, and ordered next steps. Tests check the ETA arithmetic, including the fallback to the weekly goal. |
| AI explanation | PARTIALLY_IMPLEMENTED | `assistant.py::Assistant.ask` | Goes through the gateway (limits, logs, cache for quick questions). Learner data is sent as DATA. Fake-provider tested only. An `OPENAI_API_KEY` is now present in `platform/.env`, but no live call was made in this session. |
| Works without AI | COMPLETE_AND_TESTED | `assistant.py::fallback_text` | Quick questions and routed free questions are answered from data when AI is disabled or failing. |

Also in this change:
- Fixed a mobile overflow on the dashboard (grids without `grid-cols-1` grew to 571 px on a 412 px phone).
- The launcher was moved into the header after a test showed a floating button covering the Reading "Nộp bài" button.
- `AISettings.api_key` is excluded from reprs, so it can no longer appear in logs or test failures.

**Verification:** backend 125 pytest passed; frontend 15 vitest passed; lint and build pass; Playwright 35/35 passed.

# Vocabulary module upgrade — 2026-10-18

Paths are relative to `platform/`. This section is updated after each phase. Earlier sections are historical.

## Phase 1 — Audit: why so few words appeared

Measured on the repository, not estimated:

| Possible cause | Finding |
|---|---|
| 1. The curriculum itself has few words | **Main cause.** All Markdown vocabulary tables together contain 927 unique headwords. 679 of them are in `07-VOCABULARY` (VOC-01–16), the rest in grammar and skills units. That is far below the 3,000–5,000 needed for A0–B2. |
| 2. Ingestion misses existing words | **Yes, partly.** `content/builder.py` turned only VOC-01–16 tables into cards (693 cards). VOC-17 (about 200 collocations written as `a · b · c` lists, plus the "dịch thẳng" mistakes table), VOC-18 (40 word families) and VOC-19 (40 confusable pairs) produced **0 cards**. Vocabulary tables in grammar and skills units (149 rows, 99 sentence patterns) were never extracted. These are now imported. Nothing that already existed was regenerated. |
| 3. Database seeded only partly | No seed existed. The database stored only SM-2 progress (`vocab_cards`), and the words came from Markdown at request time. |
| 4. Frontend display limit | No hard limit, but the page listed one VOC unit at a time (about 40 words) with no search, filter or level view. |
| 5. API returns too little | `/api/vocabulary` returned every card, so the API was not the bottleneck. |
| 6. Sync errors / duplicates | 14 duplicate headwords across units (693 cards → 679 unique), now merged into one entry each with all card ids kept. Two spelling variants were merged. |
| 7. Vocabulary not connected to other modules | **Yes.** Reading, Listening, Writing and Speaking had no link to vocabulary progress. Lesson flashcards had their own SM-2 schedule. |

## Phase 2–3 — Database, pipeline, expansion (COMPLETE_AND_TESTED for the deterministic scope)

- **Schema.** Migration `alembic/versions/0004_vocabulary_system.py` adds tables only:
  - Lexicon: `vocab_entries`, `vocab_senses`, `vocab_examples`, `vocab_collocations`, `vocab_topics`, `vocab_entry_topics`, `vocab_legacy_cards`.
  - Learner state: `vocab_progress` (VocabularyMastery, FSRS state), `vocab_review_log` (VocabularyReview), `vocab_mistakes`, `vocab_sessions` (VocabularyLearningSession), `vocab_collections`, `vocab_collection_items`, `vocab_enrichment_jobs`, `vocab_dialogues`.
  - `vocab_cards` / `vocab_reviews` are **kept unchanged**. Old SM-2 progress is copied once into FSRS progress (`app/vocabulary/lexicon.py::migrate_legacy_progress`), and the migration test proves the old row is untouched.
- **Pipeline.** `scripts/vocabulary/build_lexicon.py` is offline and deterministic. It runs Discover → dictionary Generate → Normalize → Validate → Deduplicate → Review status → Store. Sources and licences are in `backend/app/vocabulary/data/SOURCES.md`:
  - curriculum
  - CEFR-J 1.5
  - NGSL 1.2, NAWL 1.2
  - English Wiktionary via kaikki.org
  - Tatoeba English–Vietnamese pairs

  `scripts/vocabulary/fetch_sources.sh` reproduces the downloads, which are not committed.
- **Import.** The output `backend/app/vocabulary/data/lexicon.jsonl.gz` is imported idempotently on startup. It is keyed by file hash and upserts by stable id. Entries that disappear are unpublished, never deleted, so learner progress stays valid. AI and user rows are never overwritten. Import validation rejects duplicate ids, empty meanings, invalid levels and inconsistent sense ids.
- **Actual numbers** (`data/build-report.json`):

  | Measure | Count |
  |---|---|
  | Published entries | 5,083 |
  | Unique word / phrasal-verb lemmas | 4,654 |
  | Collocations | 220 |
  | Phrases | 115 |
  | Sentence patterns | 94 |
  | Senses | 6,595 |
  | Examples | 8,736 |
  | Entries with an example | 3,948 |
  | Entries with a Vietnamese-translated example | 3,148 |

  - By level: A1 1,091 · A2 1,021 · B1 1,488 · B2 1,483 (levels are estimates).
  - By status: 872 curriculum · 4,211 sourced. "Sourced" means the meanings come from Wiktionary translation tables, the senses were chosen automatically, and **no teacher has reviewed them**.
  - All 693 curriculum card ids map to exactly one entry.
- **IPA comes from dictionaries only.**
  - 4,224 entries: Wiktionary.
  - 256 entries: curriculum IPA that agrees with Wiktionary.
  - 116 entries: multi-word phrases composed from each word's dictionary IPA.
  - 487 entries: no IPA shown.
  - 76 curriculum IPA values differ from Wiktionary even after normalising notation. The dictionary IPA is shown and the entry is flagged `ipa_curriculum_differs`.
  - 55 curriculum IPA values cannot be checked; they are hidden and flagged.
- **Topics.** All 26 required topics exist, plus a `core` topic for general words. Topics are assigned heuristically, and the evidence type is stored per entry. Coverage is thin for Internet and Social Media (12), Global Issues (16) and Climate Change (18). These need AI enrichment plus review, or manual curation.
- **Not published: 2,890 CEFR-J/NGSL/NAWL headwords** that have no Vietnamese translation in Wiktionary. They are queued as candidates for the AI enrichment stage (`app/vocabulary/enrich.py`). That stage is batched and resumable, keeps a checkpoint per batch, retries up to 3 times, never re-sends finished jobs, and needs human approval before publishing. The AI is never asked for IPA. It has been run **only with the fake provider**; no live enrichment has been done.

## Phase 5 — Spaced repetition (COMPLETE_AND_TESTED)

- **Scheduler.** `py-fsrs` 6.3.2 (open-spaced-repetition, MIT licence) with default FSRS-6 parameters, one 10-minute learning step and desired retention from settings (default 0.9). The scheduling maths is entirely the library's; nothing home-made is labelled FSRS.
- **States.** new / learning / review / relearning. "Mastered" is a product criterion, not an FSRS state: Review state, stability ≥ 21 days, ≥ 3 correct answers, and last rating Good or Easy.
- **Ratings.** Again / Hard / Good / Easy.
- **One review per word per session round.** All graded items for a word are aggregated, and the worst result wins. Words that are not yet due can still be practised; that is logged but does not move the schedule.
- **One shared schedule.** Lesson flashcards (`/api/vocabulary`, old grades 1/3/4/5) now write to the same FSRS progress as the vocabulary module. The dashboard and recommendations count FSRS progress.

## Phases 4, 6–10 — Learning modes, AI, adaptivity, integration, analytics, QA

| Feature | Status | Files | Evidence / remaining work |
|---|---|---|---|
| Mode 1 Learn New Words | COMPLETE_AND_TESTED | `backend/app/vocabulary/sessions.py`, `exercises.py`; `frontend/src/features/vocab/session/` | Teaching card is revealed step by step: word → audio → meaning → example → usage. Then a recognition item, and a recall item one word later (interleaving). The difficult-word retry round is covered by API and browser E2E. |
| Mode 2 Flashcards | COMPLETE_AND_TESTED | `session/items.tsx` | No auto-flip. Space reveals the answer; 1–4 rates Again / Hard / Good / Easy. Ratings update the real FSRS schedule. Idempotent double-submit is tested. |
| Mode 3 Type the answer | COMPLETE_AND_TESTED | `vocabulary/grading.py` | Deterministic verdicts: correct / acceptable (spelling variant, "to …", "a / b" alternatives) / spelling / wrong form (inflection or word family) / wrong meaning (another real word, with its meaning shown) / incorrect. For phrases, an AI second layer can accept valid alternatives. That layer is fake-provider tested only. |
| Mode 4 Listening / dictation | COMPLETE_AND_TESTED (fake TTS) | `api/vocabulary.py::_tts` | Audio is cached on disk, so replaying never calls TTS. The answer text is never sent to the browser; the browser-speech fallback text is released only when server TTS is disabled. Live TTS has not been verified. |
| Mode 5 Contextual | COMPLETE_AND_TESTED | `exercises.py::cloze` | Uses real example sentences. After answering, each option's meaning is shown to explain why the others don't fit. |
| Mode 6 Collocation | COMPLETE_AND_TESTED | `exercises.py::collocation` | Built from the curriculum collocations (VOC-01–15 and VOC-17). A distractor is rejected if it also forms a known collocation (e.g. "take a shower"). |
| Mode 7 Sentence builder | COMPLETE_AND_TESTED | `items.tsx::BuilderItem` | Words are added by click or Enter, reordered by drag, and Backspace removes the last word. Grading compares against the original sentence; a valid alternative word order is not recognised (limitation). |
| Mode 8 Use it yourself | PARTIALLY_IMPLEMENTED | `vocabulary/ai.py::grade_sentence` | A deterministic check that the target word is used runs before any AI call. AI grading is fake-provider tested only. When AI is unavailable, nothing is saved and the learner can self-assess. |
| Mode 9 Speed review | COMPLETE_AND_TESTED | `sessions.py` | Mixes recognition, listening choice, spelling and completion. The optional timer is only a pace guide; running out of time never marks an answer wrong. |
| Mode 10 Real situations | PARTIALLY_IMPLEMENTED | `ai.py::dialogue_*`, `DialoguePage.tsx` | Six situations. Usage of the target words is detected deterministically and recorded. Fake-provider tested only. |
| Due queue / Review Today's Words / FSRS | COMPLETE_AND_TESTED | `vocabulary/srs.py`, `api/vocab.py` | A 30-day time-travel test passes (`test_learn_new_words_full_cycle`). The lesson flashcards, the `/review` page, the dashboard and recommendations all read the same FSRS progress. |
| Adaptive difficulty | COMPLETE_AND_TESTED (rules); pedagogical effect unmeasured | `sessions.py::profile`, `plan` | Profiles are support / steady / stretch. At least 15 graded answers are needed before anything changes; "stretch" needs at least 30 answers at ≥ 85% accuracy. The profile changes the number of new words, hints, example length and the item mix. Reviews come before new words when more than 40 are due. |
| AI vocabulary tutor | PARTIALLY_IMPLEMENTED | `ai.py::tutor`, `WordPage.tsx` | Nine quick actions, word comparison and free questions. The tutor gets only the entry, the compared entry and up to two curriculum chunks, and answers are cached. Fake-provider tested only. |
| AI personalised exercises | PARTIALLY_IMPLEMENTED | `ai.py::exercises`, `sessions.py::create_ai` | Targets weak words and words the learner confuses. Validation requires exactly one blank, 3–5 distinct options, a valid answer index and a Vietnamese explanation. Fake-provider tested only. |
| Notebook / collections | COMPLETE_AND_TESTED | `service.py`, `NotebookPage.tsx` | Save, known, difficult, notes, own example, review history, search and filters. System collections: reading, listening, writing, speaking, lesson and difficult words. Templates: Work, Travel, and VSTEP (an estimate, not an official list). |
| Integration (Reading, Listening, Writing, Speaking) | COMPLETE_AND_TESTED for capture; usage is an estimate | `features/vocab/Lookup.tsx`; `ai/writing.py`, `ai/speaking.py` | Clickable lookup with lemmatisation (went → go, children → child) and an optional AI meaning-in-context. A word is saved only when the learner chooses. Writing and Speaking feedback mark studied words as "used"; a use counts as correct when no detected error overlaps the word. |
| Today's plan | COMPLETE_AND_TESTED | `sessions.py::plan`, `TodayPage.tsx` | Counts come from data and settings: new-word goal, due today, weak words, collocations, and a time estimate from the learner's median answer time. |
| Analytics | COMPLETE_AND_TESTED | `vocabulary/analytics.py`, `StatsPage.tsx` | Seen, learned (recalled), answered correctly, recalled after ≥ 1 day, used correctly and mastered are kept separate. Also shown: recall accuracy, FSRS retention estimate, progress by CEFR and by topic, collocation mastery, and use in Writing/Speaking. |
| UI | COMPLETE_AND_TESTED | `frontend/src/features/vocab/*` | Pages: overview, today, explorer, word detail, notebook, stats, dialogue, session player and summary. axe WCAG A/AA has no serious or critical violations on 6 vocabulary routes. Mobile has no horizontal overflow. Not checked: a manual screen-reader pass, or dark-mode screenshots of every page. |
| Cost rules | COMPLETE_AND_TESTED | `api/vocabulary.py` | No AI is used for flipping cards, the next word, showing meanings, cached audio, multiple-choice grading, loading data or scheduling. Every AI call goes through the existing gateway (limits, rate limit, cache, usage log). Every non-AI mode works with `AI_PROVIDER=disabled` (tested). |

**Verification on 2026-10-18:**
- Backend: 120 pytest passed. That includes 42 vocabulary tests covering data integrity, import idempotency, grading, the engine, every mode, notebook, integration, AI with the fake provider, enrichment and outages, plus the extended migration test.
- Frontend: 15 vitest passed; lint and production build pass.
- Playwright: 32/32 passed. That includes the required flow (A1 Daily Routine learn → recall with feedback → refresh resumes → finish → flashcard review → stats), Reading capture into the notebook, the AI tutor and Use-It grading (simulated provider), axe and mobile.

**Docker deployment — 2026-10-18.** `platform/scripts/deploy.sh` ran in this order: build → stop backend → verified backup → migrate → recreate the containers → health check through nginx.
- Backup: `platform/backups/docker-20261017T185637768640Z.tar.gz`, taken at revision 0003.
- After deployment the revision is 0004 and all 5,083 entries are imported.
- Learner data is unchanged: 75 attempts, 14 lesson-progress rows and 54 XP events.
- The learner's 3 SM-2 cards (wake up, get up, brush) are kept in `vocab_cards` and now also appear as FSRS progress, due on the same day.
- `/api/vocab/plan` responds through localhost:8080.

**Known gaps (not marked complete):**
- Live OpenAI has never been called (no key). This covers the tutor, judge, Use-It, dialogue, exercises, enrichment and TTS.
- 2,890 candidate headwords are still unpublished until AI enrichment runs and a person reviews the results.
- Thin topics (Internet and Social Media, Global Issues, Climate Change) need curation.
- The 4,211 "sourced" meanings have not been reviewed by a teacher.
- Images (dual coding) are not implemented; no licensed image source has been chosen.
- The sentence builder accepts only the original word order.
- Usage in Writing/Speaking is matched by surface form and does not disambiguate senses.

**Exact next steps:**
1. Set `OPENAI_API_KEY`, then run `python -m app.vocabulary.enrich queue --limit 40 && python -m app.vocabulary.enrich run --batches 5 --size 8`. Review the results in Stats → "Dữ liệu từ vựng".
2. Have a Vietnamese teacher review the top 1,000 A1–A2 "sourced" meanings. Approved changes should go into a curated override file read by `build_lexicon.py`.
3. Curate the thin topics.
4. Verify live TTS and the AI judge with a disposable database.

# Platform recovery report — 2026-10-17

This section supersedes the historical platform claims below. Existing uncommitted work is preserved. No curriculum files or learner records have been intentionally changed.

## A. Actual architecture

React 19 / TypeScript / Vite / TanStack Query frontend, FastAPI / SQLAlchemy / Pydantic backend. SQLite with WAL and foreign keys; Alembic revisions 0001–0003 adopt the older schema, add AI tables and persist idempotent curriculum submissions. Markdown is read from the existing curriculum by `app/content`; no demo curriculum. One local learner profile, optionally protected by `APP_ACCESS_TOKEN` (not multi-user accounts). Central OpenAI Python SDK provider uses Responses structured outputs, audio and optional Realtime; gateway adds request limits, caching and usage estimates. Tests explicitly use FakeProvider, not live OpenAI. Docker Compose serves nginx and the API with persistent SQLite/media storage.

## B. Current feature status after recovery

Paths below are relative to `platform/`. COMPLETE_AND_TESTED refers only to the listed deterministic scope; no live AI feature is certified.

| Feature | Status | Relevant files | Remaining work |
|---|---|---|---|
| Markdown ingestion, hierarchy, answer matching | COMPLETE_AND_TESTED | backend/app/content, tests/test_content.py | Import report regenerated; seven instructional sections remain explicit content slides |
| Dashboard / path / real analytics | COMPLETE_AND_TESTED | frontend/src/features/dashboard, learning-path, progress; backend/app/api/analytics.py | Deterministic/API and browser flows pass; pedagogical mastery estimates remain estimates |
| Lesson slides / resume / full text | COMPLETE_AND_TESTED | frontend/src/features/lesson-player, reference | Route isolation, last outline button, refresh, draft ordering and full reading mode tested |
| Curriculum grading / persistence / completion | COMPLETE_AND_TESTED | backend/app/api/learning.py; frontend/src/features/quizzes; alembic/versions/0003_quiz_submissions.py | Deterministic grading, idempotent retries, XP, completion and migration tests pass; arbitrary open answers need AI/self-assessment |
| AI tutor / bounded contextual retrieval | PARTIALLY_IMPLEMENTED | backend/app/ai/tutor.py, knowledge.py; frontend/src/features/tutor | Fake-provider API + browser tests and SDK mock HTTP pass; live validation BLOCKED by absent API key |
| Exercise generation / validation / history | PARTIALLY_IMPLEMENTED | backend/app/ai/exercises.py, validators.py; frontend/src/features/ai-practice | Fake-provider API and browser tests pass; live model quality/availability unverified |
| AI semantic grading / Vietnamese feedback | PARTIALLY_IMPLEMENTED | backend/app/ai/exercises.py; frontend/src/components/ai | Malformed batches/scores rejected; retries tested; live semantic accuracy unverified |
| Writing coach / autosave / modes / history | PARTIALLY_IMPLEMENTED | backend/app/ai/writing.py; frontend/src/features/writing-studio | Fake-provider API and browser tests pass; live model quality/availability unverified |
| Speaking / recording / playback / history | PARTIALLY_IMPLEMENTED | backend/app/ai/speaking.py; frontend/src/features/speaking-studio | Server measures actual audio duration; fake-device microphone, playback and history pass; real microphone/live transcription unverified |
| Optional Realtime | IMPLEMENTED_NOT_TESTED | backend/app/ai/provider.py; frontend/src/features/speaking-studio/RealtimePanel.tsx | Live lifecycle and budget validation |
| Listening / cached audio / hidden transcript | PARTIALLY_IMPLEMENTED | backend/app/ai/studio.py; frontend/src/features/listening-studio | Fake-provider API and browser tests pass; live model quality/availability unverified |
| Reading / evidence / timer / history | PARTIALLY_IMPLEMENTED | backend/app/ai/studio.py; frontend/src/features/reading-studio | Fake-provider API and browser tests pass; live model quality/availability unverified |
| Adaptive plans / topic mastery / Mistake Notebook | PARTIALLY_IMPLEMENTED | backend/app/services/adaptive.py; frontend/src/features/mistakes | API/browser tests pass with stored attempts; long-term adaptation and independent pedagogical evaluation pending |
| Vocabulary / SM-2 | COMPLETE_AND_TESTED | backend/app/api/vocab.py; frontend/src/features/flashcards | API + browser review and persisted SM-2 schedule pass |
| Assessments / adaptive placement | PARTIALLY_IMPLEMENTED | backend/app/ai/placement.py; frontend/src/features/placement | Fake API test passes; scores remain estimates |
| Authentication / local access model | PARTIALLY_IMPLEMENTED | backend/app/api/auth.py, deps.py | Token API tests pass; Compose binds loopback by default. One local profile, no multi-user account isolation claim |
| Migrations / restart persistence | COMPLETE_AND_TESTED | backend/alembic; backend/app/database.py; tests/test_migrations.py | SQLite legacy/versioned upgrades and restart pass; PostgreSQL not tested |
| Cost controls / usage / caching | PARTIALLY_IMPLEMENTED | backend/app/ai/gateway.py, settings.py | Caps, caching and estimates tested; cross-worker reservations and crash-durable logging remain incomplete |
| Safe Markdown / mobile / keyboard / themes | PARTIALLY_IMPLEMENTED | frontend/src/components/Markdown.tsx; e2e | Sanitization, five axe routes, keyboard and mobile pass; all AI screens/themes need broader accessibility review |
| AI-unavailable local curriculum | PARTIALLY_IMPLEMENTED | backend/app/ai/provider.py; frontend/src/components/ai | Disabled-AI API tests and Docker browser lesson flow pass; fully disconnected browser has no service worker |
| Docker / setup / configuration | COMPLETE_AND_TESTED | backend/Dockerfile; frontend/nginx.conf; docker-compose.yml; .env.example; README.md | Both images built; nginx/API/lesson smoke and restart passed; production scaling remains out of scope for this local model |
| Frontend lint | COMPLETE_AND_TESTED | frontend/package.json | Oxlint correctness checks pass; React Compiler-specific advisory rules are not enabled |
| CI automation | IMPLEMENTED_NOT_TESTED | ../.github/workflows/platform.yml | Equivalent local checks pass; remote GitHub Actions run not performed |
| Live OpenAI verification | BLOCKED | backend/app/ai/provider.py; .env | OPENAI_API_KEY absent; no successful live API call or account model-access check |

### Database deployment follow-up — 2026-10-17

- Retained the existing SQLite database and pinned the existing Docker volume name `english-mastery_learning-data`; DB and media persist across image/container replacement. No PostgreSQL conversion or learner-data reset.
- Added `platform/scripts/backup-db.sh`, `restore-db.sh`, `database.py`, `db_archive.py`, and `deploy.sh`. Backups use the SQLite online API (including committed WAL), media, a manifest and SHA-256 checksums; verification checks SQLite integrity, foreign keys, migration revision and row counts. Restore validates before downtime, requires explicit replacement, snapshots the current destination first, preserves ownership, removes stale WAL/SHM, and reverses ordinary failed swaps.
- Deploy builds first, stops the API, requires a successful backup before migrations, recreates the API/nginx against the same volume, and checks health through nginx. Wrong-volume guards prevent accidental switch to a blank learner database. Fresh installation and server-transfer commands are documented in `platform/DATABASE.md`.
- Backed up both actual Docker and local development storage in ignored `platform/backups/`. Restored the real Docker archive to a separate disposable volume; all **29 table content fingerprints matched the archived source**. Tested wrapper-driven stop/restore/restart, pre-restore backup, backup with temporary API stop, and refusal without `--replace` before stopping the API.
- Ran the actual deployment script twice (including final nginx recreation/proxy check); the final pre-deploy snapshot is `platform/backups/docker-20261017T130208729958Z.tar.gz`. Compared all **29 tables after deployment: contents unchanged**, including **8 lesson progress records and 20 attempts**. `/api/health` through localhost:8080 returned healthy with 224 units.
- Validation: **78 backend tests passed** (66 existing + 12 archive/restore tests), including WAL recovery, Unicode/media round-trip, corruption/path-traversal rejection, overwrite protection, automatic pre-restore snapshot and simulated I/O failure rollback. Final targeted rerun: **12/12**. Shell syntax and Git whitespace checks passed. Docker restore test container/volume removed; real learner volume retained.
- Scope: a single-server persistent-disk SQLite deployment; no multi-instance SQLite/PostgreSQL claim. Online media copying is not transactional with DB writes; `--stop` is the documented consistent full-snapshot option. Browser-only AI drafts are not covered by database backup. No cron job or off-host backup transfer was automatically installed.

### Lesson AI chat layout follow-up — 2026-10-17

- Replaced the lesson tutor modal sheet with a non-modal right sidebar. Lesson/header/footer reserve space for chat on desktop; narrow screens use a bottom panel with lesson controls above it. Lesson navigation remains usable while chat is open, and tutor context follows the current slide.
- Chat history scrolls independently with the composer fixed below it. Closing with the button or Escape restores focus to the trigger; typing/keyboard interaction in chat does not trigger lesson shortcuts.
- Validation: frontend lint and production build passed; existing tutor/history and mobile Playwright scenarios passed (**2/2**, simulated AI). Browser checks at 1440, 1024, 768 and 390 pixels verified no overlap/horizontal overflow, lesson navigation while chat remains open, typing and closing. Desktop/mobile screenshots visually inspected.
- Rebuilt/recreated only the frontend container; backend/database untouched by deployment. The deployed nginx API health check passed at localhost:8080.

## C. Recovery baseline (historical; failures below were fixed)

- Backend: 40 passed, 1 failed (`test_file_sqlite_no_lock_between_request_and_usage_log`: cached TTS reduces expected call count).
- Frontend: 13 passed, 1 failed (`ItemCard` self-assessment test lacks QueryClientProvider after AI grading integration).
- TypeScript and production build pass.
- Dockerfile copies only `app/`, but startup needs `alembic.ini` and `alembic/`.
- LessonPlayer stays mounted between `/learn/:unitId` routes while `usePlayerState` initialization is gated by `ready`; next lesson can inherit previous lesson position/drafts.
- Tests create the default application at import; isolate environment/database before imports to avoid touching development data.
- API key presence is not proof of live API validation. No successful live call performed in this recovery session.

## D. Remaining prioritized backlog

1. **Live AI verification (blocked):** configure a valid backend key and run model-access check, tutor, generation/independent verifier, open grading, writing, transcription and TTS on a disposable learner DB. Inspect Vietnamese feedback and valid alternative answers with a teacher. Never mark these complete from fake-provider tests.
2. **Cost/concurrency hardening:** reserve budgets across in-flight calls/workers; enforce idempotency before concurrent billable AI operations; persist usage through process crashes/DB lock failures. Current limits are estimate-based checks and in-process rate queues, not a guaranteed financial hard cap.
3. **Optional Realtime:** client-enforced duration and client-reported usage are not server-enforced accounting; add session ownership, one-time finalization and server lifecycle controls before relying on its cost cap. Real WebRTC has not been exercised.
4. **Persistence/UX depth:** AI drafts currently persist in browser storage, submissions in DB; add server draft sync if cross-device resume is required. Validate interrupted real microphone sessions and Safari/mobile audio. Reading timer resets after refresh.
5. **Quality/test coverage:** independently evaluate all exercise types and question ambiguity; review AI-screen keyboard/screen-reader behavior and both themes. CI is created but not run remotely. PostgreSQL and multi-user deployment remain unverified.
6. **Optional disconnected use:** add a versioned content/service-worker cache if lessons must load without the local backend. Existing curriculum works when only AI is unavailable.

## E. Recovery batch log

### Batch 1 — core state, test isolation, startup packaging

- Fixed route reuse in LessonPlayer and AI practice/reading/listening set pages: each ID now owns its own state.
- Added next-lesson resume and similar-exercise state regressions.
- Isolated pytest default DB/media/environment and Playwright suite data. Fixed ItemCard test provider and mobile selector.
- Dockerfile now packages Alembic files.
- Executed: backend **41/41 passed**, frontend **14/14 passed** after baseline repairs. Baseline production build passed.
- Browser rerun: **17 passed, 1 failed, 4 skipped**; remaining failure is an obsolete flashcard dashboard assertion. The new next-lesson test was skipped by that serial suite and remains unverified at this point.

### Batch 2 — grading correctness and persistence (in verification)

- Incomplete/duplicate/undecided AI grading now rejects the batch without recording fabricated zero scores.
- Idempotent exercise retries target the original submission and reject IDs reused across sets.
- Listening question context is stripped on all public set routes; reading/listening evidence quote validation tightened.
- Fake/live TTS cache keys separated; numeric AI scores constrained; SDK parsing failures mapped to learner-facing errors.
- Added legacy versioned/unversioned migration and application restart tests plus regression tests for the issues above.
- Confirmed **OPENAI_API_KEY absent**; live AI tests are BLOCKED. Docker daemon is available.

### Batch 3 — audio, deployment, content audit and SDK contracts

- Server validates actual uploaded audio duration using ffprobe before any live transcription call; invalid/overlong uploads are rejected. Docker includes FFmpeg. Audio upload work runs off the event loop, and media writes reject traversal paths.
- Docker binds loopback by default; nginx accepts the backend's 8 MiB audio limit plus multipart overhead.
- Updated `.env.example` and platform README for OpenAI, per-task models, local access token, caps, costs and known limitations. Removed unused Anthropic settings.
- Model pricing is required for billable custom-model calls; user limits cannot exceed environment caps; cached tutor responses respect the AI off switch and use provider/user-specific keys.
- Added official SDK-over-mock-HTTP tests for Responses strict schema, malformed output, quota/auth errors. These are NOT live calls.
- Re-ran content import: **224 units, 3,347 steps, 5,791 items, 5,692 keyed, 1,429 deterministic closed questions, 693 cards**. Seven instructional sections remain content slides and are listed in `platform/CONTENT-IMPORT-REPORT.md`.
- Built both Docker images; verified backend health (224 units), nginx proxy, dashboard, direct lesson URL, navigation, refresh and container restart persistence using disposable containers on ports 18080/18081. Docker schema head is 0003.
- Added Oxlint correctness checks without changing TypeScript 7. ESLint/typescript-eslint rejected that existing TS version; no forced peer override or downgrade was used. Added GitHub Actions workflow, not executed remotely.

### Batch 4 — workflow correctness and retries

- New additive migration `0003_quiz_submissions.py` stores curriculum idempotency keys and result snapshots. Frontend preserves failed submission IDs through refresh; retries do not duplicate attempts/mastery/XP. Repeated identical self-assessment no longer increments mastery again.
- Fixed first-load local-user creation race and added concurrent regression.
- Fixed outline/footer overlap so the last lesson outline button is clickable.
- Reading/listening now require the requested question count, attach the actual passage for grading, and run the independent blind-answer check. Public questions do not repeat or expose the shared transcript. Reading vocabulary appears after submission.
- Added a decodable test tone for FakeProvider and browser media decoding coverage; it is not live TTS or speech.
- Added reading browser flow; fixed next-lesson and similar-set state contamination. Full browser suite: **23/23 passed** before the final writing/autosave follow-up below.
- Serial autosaves + stale timestamp rejection prevent older lesson drafts overwriting newer ones. Writing edits/mode changes reset feedback and submission IDs; stale request IDs cannot retrieve feedback for changed text. Added regression tests.
- Component suite: **15/15 passed**. Backend follow-up found one fake-provider flake with smart apostrophes in random read-aloud sentences; fake transcription now accepts printable Unicode. Final backend rerun passed (66 tests).

## F. Final verification and precise handover

- `cd platform/backend && .venv/bin/python -m pytest -q`: **66 passed** (API, content, schema/SDK mock HTTP, invalid AI results, audio parsing, concurrent local-profile creation, idempotent submissions, migration and restart).
- `cd platform/frontend && npm test`: **15 passed** across four files.
- `npm run lint`: passed (Oxlint correctness checks). `npm run typecheck` and `npm run build`: passed; final artifact rebuilt after the last source changes.
- `npx playwright test`: **23 passed**, desktop/mobile, five axe routes; AI backend uses **FakeProvider**, microphone is Chrome's fake device and generated test audio is a tone, not live speech.
- Content import: **224 lessons / 3,347 slides / 5,791 items / 693 cards**, seven instructional sections explicitly reported instead of dropped.
- `docker compose config --quiet`: passed. Both Docker images built; disposable nginx/backend smoke passed, schema head **0003**, local lesson refresh and container restart persistence verified. No production learner volume was used. Disposable test containers/network were stopped and removed; final images remain available locally.
- `git diff --check`: passed. No curriculum source files changed. Existing uncommitted work, including the inherited deleted tutor route and temporary debug scripts, was preserved. No commit/push performed.
- **No live OpenAI call was made: credentials are absent.** Local fake and HTTP-mock tests do not validate model availability, audio/feedback quality or official CEFR/VSTEP scoring.

**Exact next implementation target:** inspect `backend/app/ai/gateway.py` (`check`, `_run`, `flush_logs`) and `backend/app/ai/exercises.py::submit` for durable budget reservations and concurrent AI submission deduplication. Add a migration for reservations/request records, then tests using file-backed SQLite and simultaneous requests. Preserve revision 0003 and all existing student data. When credentials are supplied, perform the live checks in backlog item 1 with low limits and a disposable DB.

**Files changed in recovery, in addition to inherited AI work:** lesson/player/set route state, autosave hook and regression, writing draft/feedback handling, quiz API/client/migration, grading validators/provider/gateway/media/studio services, backend/test fixtures and new tests, browser scenarios, Docker/nginx/Compose, environment template, README, npm lint dependency/lockfile, CI workflow and this report. The original curriculum audit/history below is retained for continuity and does not override this section.

---

# Historical curriculum and implementation notes

# Implementation Status

**Cập nhật: 2026-10-17. Toàn bộ nội dung theo Curriculum Map đã được xây dựng; 128/128 cặp bài–đáp án đã đọc đối chiếu; kiểm tra tự động sạch.**

## Tổng quan đã xác minh

Root: `english-zero-to-b2/`, Git repo private [`Huy-8bit/english-zero-to-b2`](https://github.com/Huy-8bit/english-zero-to-b2) (nhánh `main`). Có **128/128 bài ngữ pháp và đáp án**: A0 19, A1 23, A2 30, B1 26, B2 30. **128 cặp COMPLETED** (A0 19/19, A1 23/23, A2 30/30, B1 26/26, B2 30/30), **0 NEEDS_REVIEW**, **0 NOT_STARTED**. COMPLETED của một cặp không chứng nhận cả cấp độ. [Content Audit](CONTENT-AUDIT.md) là danh mục chi tiết; [Review Log](99-PROJECT/REVIEW-LOG.md) lưu căn cứ biên tập.

## Completed

- **Bài ngữ pháp A0→B2** (128 bài, mục A–N, ≥ 25 nhiệm vụ mỗi bài) và 128 file đáp án có lời giải, rubric L5 và Knowledge Check. B1/B2 có README với Mini Challenges theo khối và Skills Practice (3 unit mỗi cấp, transcript và đáp án riêng).
- **06-GRAMMAR-REFERENCE:** Master Index, so sánh thì, câu điều kiện, modal, bị động, mạo từ, giới từ, 60 lỗi thường gặp, mẫu câu, cheat sheet.
- **07-VOCABULARY:** VOC-01–VOC-19 (15 chủ đề + phrasal verbs, collocations, word families, confusable words) và đáp án.
- **08-PRONUNCIATION:** PRON-01–PRON-11 (IPA, nguyên/phụ âm, minimal pairs, trọng âm từ/câu, nối âm, dạng yếu, ngữ điệu, shadowing, lỗi của người Việt) và đáp án. Không có audio; hướng dẫn dùng từ điển/TTS.
- **09-FOUR-SKILLS:** Listening L01–L08, Speaking S01–S08, Reading R01–R09, Writing W01–W13, README từng kỹ năng và đáp án theo chương.
- **10-PRACTICE-LAB:** LAB-01–LAB-10 (drill hằng ngày, bài trộn, sửa lỗi, viết lại câu, dịch, hội thoại, thử thách nói/viết, ôn tuần/tháng) + README; đáp án/hướng dẫn.
- **11-EXAMS-AND-ASSESSMENTS:** Exit Test A0–B1, B2 Mock Test 1–2, VSTEP-style Mock Exam 1–2 (*mô phỏng định dạng, không phải đề chính thức*), Grammar Diagnostic Test, Vocabulary Assessment, Skill Evaluation Rubrics; đáp án và transcript đầy đủ.
- **13-LEARNING-TRACKER:** Progress, Error Log, Spaced Repetition, Weekly Review, Grammar Checklist, Vocabulary Tracker, Monthly Assessment, B2 Readiness Checklist.
- **Kiểm định:** đọc đối chiếu toàn bộ 128 cặp bài–đáp án (phần B–M + đáp án) và Exit Test A0–B1; batch 2026-10-17 gồm 56 cặp B1/B2 (sửa 20 bài) và 26 cặp A0/A1 (sửa nhỏ 17 bài, thêm Knowledge Check cho mọi file đáp án A0/A1). Chi tiết trong Review Log.

## In Progress

- Không có bài hoặc module nào ở trạng thái viết dở.

## Pending

1. Thử nghiệm với người học thật / giáo viên độc lập trước khi tuyên bố chất lượng sư phạm.

## Known Issues

- B2-G005 tham chiếu B2-G013 (ID đứng sau): B2 README hướng dẫn học G013 trước G005; giữ nguyên ID.
- Không có audio đóng gói. Bài nghe dùng transcript + người đọc/TTS; người học ghi điều kiện luyện (đã xem transcript hay chưa).
- Đề "VSTEP-style" chỉ mô phỏng định dạng; không quy đổi điểm chính thức. Không kết luận người học đạt B2 từ số bài đã học.
- Người kiểm định là tác giả nội dung; chưa có đánh giá độc lập.

## Validation

Chạy từ root:

```text
python3 99-PROJECT/fix_toc_anchors.py
python3 99-PROJECT/audit_content.py
python3 99-PROJECT/check_links.py
```

Kết quả 2026-10-17: 128/128 bài, 0 lỗi cấu trúc/nhãn bài–đáp án, 4.570 lượt liên kết nội bộ, **0 hỏng**, 0 anchor hỏng, 0 bảng lỗi dòng phân cách, 0 cảnh báo Mermaid theo heuristic, 0 marker TODO/TBD. 159/159 khối Mermaid render SVG thành công bằng Mermaid CLI + Chrome (chi tiết ở Review Log).

## Next Agent Instructions

Đọc file này, Curriculum Map, AUTHORING-STANDARDS, Review Log và Content Audit. Không còn bài NEEDS_REVIEW. Việc tiếp theo hợp lý là thử nghiệm với người học thật/giáo viên độc lập và sửa theo phản hồi; mỗi lần sửa cập nhật Review Log, chạy ba lệnh kiểm tra, rồi commit và push lên `origin main`.


## Interactive Learning Platform (`platform/`) — 2026-10-17

Ứng dụng web React + FastAPI đọc trực tiếp giáo trình này (không sao chép) và biến nó thành bài học theo slide có chấm điểm. Hướng dẫn chạy, kiến trúc và giới hạn: [platform/README.md](platform/README.md).

- **Đã code:**
  - Content engine nhập 224 bài (128 ngữ pháp + từ vựng, phát âm, 38 chương kỹ năng, lab, 11 đề kiểm tra, skills, giao tiếp) thành 3.347 slide và 5.791 câu bài tập, trong đó 5.692 câu ghép được đáp án và 1.429 câu tự chấm. Ngoài ra có 693 flashcard từ vựng và 51 tài liệu ở chế độ Tra cứu.
  - Các tính năng: Dashboard, Lộ trình, Lesson Player (10 kiểu slide, bàn phím, chế độ tập trung, tiếp tục bài dở), quiz engine (trắc nghiệm, T/F/NG, điền từ, sửa lỗi, sắp xếp câu, ghép, viết, nói), chế độ kiểm tra, flashcards SM-2, ghép nghĩa, nghe (TTS), đọc (tô sáng, bấm giờ), viết (đếm từ, lịch sử), nói (ghi âm, checklist), XP/streak/huy hiệu, tìm kiếm có/không dấu, Reference Mode, Gia sư AI tùy chọn.
- **Đã test:** 24 test backend (pytest), 14 test frontend (Vitest), 13 test E2E Playwright (desktop, mobile, axe a11y). Báo cáo nhập nội dung: [platform/CONTENT-IMPORT-REPORT.md](platform/CONTENT-IMPORT-REPORT.md).
- **Chưa hoàn thiện / giới hạn:**
  - Chỉ có một hồ sơ cục bộ, chưa có đăng nhập.
  - Không có audio gốc (dùng TTS); không chấm phát âm.
  - Câu trả lời mở chỉ tự chấm khi khớp biến thể trong đáp án, còn lại người học tự đánh giá.
  - Gia sư AI chưa được chạy với khóa API thật.
  - Chưa có service worker cho offline.
- **Chạy:** `cd platform && docker compose up -d --build` → <http://localhost:8080> (hoặc chạy trực tiếp: `scripts/setup.sh && scripts/dev.sh` → <http://localhost:5173>).

---

## Báo cáo trước khi tiếp quản — lưu lịch sử, không dùng làm trạng thái hiện tại

### Implementation Status (bản 2026-10-15)

> Trạng thái thực tế của dự án. File này được cập nhật trong suốt quá trình biên soạn.

**Cập nhật lần cuối:** 2026-10-15

## Giai đoạn

| Phase | Trạng thái |
|---|---|
| 1. Curriculum Design | ✅ Hoàn thành — [CURRICULUM-MAP](00-GETTING-STARTED/CURRICULUM-MAP.md) |
| 2. Repository Initialization | ✅ Hoàn thành — cấu trúc thư mục, README, ROADMAP, [AUTHORING-STANDARDS](99-PROJECT/AUTHORING-STANDARDS.md) |
| 3. Content Generation | 🔄 Đang thực hiện |
| 4. Review & Verification | 🔄 Thực hiện sau mỗi nhóm file |
| 5. Final Validation | ⏳ Chưa thực hiện |

## Tiến độ nội dung

| Hạng mục | Đã hoàn thành | Tổng kế hoạch |
|---|---|---|
| 00-GETTING-STARTED | ✅ 8/8 | 8 |
| A0 lessons + answers | ✅ 19/19 + README, Skills Practice, Exit Test | 19 |
| A1 lessons + answers | ✅ 23/23 + README, Communication, Skills Practice, Exit Test | 23 |
| A2 lessons + answers | 0 | 30 |
| B1 lessons + answers | 0 | 26 |
| B2 lessons + answers | 0 | 30 |

## Đang viết dở

- (không có)

## Hạng mục tiếp theo

- A2: 30 bài ngữ pháp + đáp án, A2-COMMUNICATION, A2-SKILLS-PRACTICE, A2-EXIT-TEST.

## Quy ước tên file đã chốt cho các module chưa viết

**07-VOCABULARY:** VOC-01-daily-life, VOC-02-family-relationships, VOC-03-education, VOC-04-work-careers, VOC-05-travel-transportation, VOC-06-food-health, VOC-07-shopping-money, VOC-08-technology, VOC-09-environment, VOC-10-society, VOC-11-communication, VOC-12-science, VOC-13-culture, VOC-14-media, VOC-15-business, VOC-16-common-phrasal-verbs, VOC-17-common-collocations, VOC-18-word-families, VOC-19-commonly-confused-words.

**08-PRONUNCIATION:** PRON-01-ipa-reference, PRON-02-vowels-consonants, PRON-03-minimal-pairs, PRON-04-word-stress, PRON-05-sentence-stress, PRON-06-connected-speech, PRON-07-linking-sounds, PRON-08-weak-forms, PRON-09-intonation, PRON-10-shadowing-practice, PRON-11-vietnamese-learner-mistakes.

**09-FOUR-SKILLS/Listening:** L01-basic-listening, L02-listening-for-keywords, L03-listening-for-main-ideas, L04-listening-for-details, L05-understanding-paraphrases, L06-note-completion, L07-concentration-exercises, L08-b1-b2-listening-practice.
**Speaking:** S01-basic-sentence-building, S02-everyday-conversations, S03-describing-people-places, S04-expressing-opinions, S05-storytelling, S06-fluency-exercises, S07-vstep-speaking, S08-speaking-evaluation-rubrics.
**Reading:** R01-reading-fundamentals, R02-skimming, R03-scanning, R04-finding-main-ideas, R05-inference, R06-paraphrase-recognition, R07-vocabulary-in-context, R08-b1-b2-reading-practice, R09-vstep-reading-strategies.
**Writing:** W01-sentence-construction, W02-paragraph-writing, W03-topic-sentences, W04-supporting-ideas, W05-cohesion-coherence, W06-email-writing, W07-essay-writing, W08-opinion-essays, W09-discussion-essays, W10-advantages-disadvantages, W11-problem-solution, W12-vstep-writing-tasks, W13-writing-evaluation-rubrics.

**10-PRACTICE-LAB:** LAB-01-daily-grammar-drills, LAB-02-mixed-grammar-exercises, LAB-03-error-correction, LAB-04-sentence-transformation, LAB-05-translation-practice, LAB-06-real-life-dialogues, LAB-07-speaking-challenges, LAB-08-writing-challenges, LAB-09-weekly-review, LAB-10-monthly-review.

**11-EXAMS:** A0/A1/A2/B1-EXIT-TEST, B2-MOCK-TEST-1, B2-MOCK-TEST-2, VSTEP-STYLE-MOCK-EXAM-1, VSTEP-STYLE-MOCK-EXAM-2, GRAMMAR-DIAGNOSTIC-TEST, VOCABULARY-ASSESSMENT, SKILL-EVALUATION-RUBRICS.
