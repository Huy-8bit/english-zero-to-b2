# Four-hour Writing / Speaking vocabulary course

Route: `/b2-four-hour`. Open access from Vocabulary, Writing, Speaking, Exams, Writing Studio and Speaking Studio; no frame-course prerequisite.

## Editorial scope

- 60 priority chunks in six packs of ten: benefits; problems/solutions; arguments; linking; letter functions/register; spoken explanation and circumlocution.
- Every core item includes Vietnamese meaning, grammatical pattern, separate written/spoken examples, and a usage warning. The letters pack deliberately gives natural spoken equivalents instead of teaching formal letter openings as conversational English.
- 12 everyday topic groups, each with four additional collocations, a concrete essay prompt, an original short paragraph, a spoken answer and a transfer exercise. The 48 topic collocations are reference material, not another compulsory memorisation list inside the four-hour budget.
- Three full original Writing models (formal enquiry, informal suggestion, advantages/disadvantages essay), each meeting the 120/250 minimum; three Speaking practice sets. The farewell-gift situation is adapted from the publicly released DTHU sample, PDF page 17; the answer is original. Short topic paragraphs and a 70–100-word essay-paragraph exercise are explicitly not full exam responses.
- No guarantee of B2, all-topic coverage, long-term retention, official word-level certification, or official exam scores. This is an editorial selection of useful chunks and clear, ordinary language for producing relevant answers.

Sources checked 2026-11-05:

- Council of Europe, CEFR Companion Volume vocabulary descriptors: https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2018/1680787989.pdf
- ULIS VSTEP format: https://vstep.vnu.edu.vn/test-format/
- Australian Education Research Organisation, spacing and retrieval practice: https://www.edresearch.edu.au/guides-resources/practice-guides/spacing-and-retrieval-practice-guide-full-publication
- DTHU released sample: https://vstep.dthu.edu.vn/mainpage/page/27.pdf

These inform the scope and practice design, not an experimentally validated four-hour syllabus. Course text is independently authored.

## Time and progress

The 240-minute plan includes 5 minutes orientation, six 20-minute packs, two 5-minute breaks, 20 minutes transfer, 30 minutes writing, 25 minutes speaking, 25 minutes mixed recall, and 5 minutes recap. Learners can move on when a budget expires; unfinished exercises remain saved.

Each pack has a copy pass followed by two recall passes. Misses/hints are requeued; deliberate skips stay weak for the final review. Copying earns no recall credit. The two-recall metric requires separation of at least three response turns. A subsequent recall miss clears the item's current success count. Exact chunk recall accepts case/punctuation changes, I'm/I am and enquire/inquire, but is not a general English-validity grader. Output phrase recognition is explicitly literal and not a correctness score.

State key `em-b2-four-hour` mirrors to the existing database API through `safeStorage`. Independent item results, drafts and transfer exercises merge by per-entry timestamp. The active run and timer use the newest snapshot. Old Writing, vocabulary/SRS and course state remain independent. Audio stays in the tab only and is not uploaded; switching tasks revokes its URL and stops microphone tracks. Audio failure leaves notes/checklist practice available.

Study time saves every five seconds and on pause, route exit, pagehide and tab hiding. Loading the page starts paused. Each block's recorded time is capped at its budget. The page does not use time spent as proof of learning.

## Checks

`state.test.ts`: content totals, complete model lengths, 240-minute budget, copy vs recall credit, delayed repetition, hints/errors/skips, no duplicate submission on resume, time limits, matching and cross-device state merge.

`e2e/b2-rescue.spec.ts`: complete ten-phrase course, partial input and feedback restoration, real database hydration in another browser context, timer limits/navigation, separately saved topic/Writing/Speaking drafts, underlined samples, narrow layout, accessibility and microphone denial.

Run from `platform/frontend`:

```sh
npm run typecheck
npm run lint
npm test -- src/features/b2-rescue/state.test.ts src/lib/syncState.test.ts
npx playwright test e2e/b2-rescue.spec.ts --project=desktop
npm run build
```

Playwright uses its existing isolated database and ports 8001/5174, never the learner database.
