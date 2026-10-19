"""Deterministic stand-in for the OpenAI provider. ONLY used when AI_PROVIDER=fake (automated tests, E2E).

It returns schema-valid, predictable content so the full learning workflow can be tested without a key
or cost. It is not an AI and the UI shows a "simulated AI" banner whenever it is active.
`fail_next` lets tests simulate outages/quota errors.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from .provider import Usage
from .schemas import (
    AIGrade, ExerciseGeneration, GenQuestion, GradingBatch, GradingErrorItem, ListeningGeneration, ListeningSegment, MatchPair,
    PlacementReportOut, ReadingGeneration, SolvedAnswer, SolveResult, SpeakingQuestion, SpeakingSummaryOut, SpeakingTurnFeedback,
    VocabItem, WritingErrorItem, WritingFeedbackOut, WritingLevelEstimate, WritingPromptOut, CriterionScore,
)

SUBJECTS = ["She", "He", "My brother", "Lan", "The teacher", "Our neighbour", "Tom", "My mother", "The manager", "Nam",
            "This shop", "The bus", "Mai", "His father", "Linh", "The baby", "My friend", "The doctor", "Hoa", "Minh"]
VERBS = [("go", "goes", "to school"), ("watch", "watches", "TV"), ("study", "studies", "English"), ("play", "plays", "football"),
         ("work", "works", "in a bank"), ("read", "reads", "the news"), ("cook", "cooks", "dinner"), ("drink", "drinks", "coffee"),
         ("visit", "visits", "her parents"), ("open", "opens", "at 8 a.m.")]


class FakeProvider:
    name = "fake"

    def __init__(self):
        self.fail_next: Exception | None = None
        self.calls: list[str] = []
        self._answers: dict[str, str] = {}
        self._n = 0

    def _maybe_fail(self, what: str, payload: str = ""):
        self.calls.append(what)
        if "[[simulate-outage]]" in payload:  # lets browser E2E tests trigger an outage
            from .errors import AIUnavailable

            raise AIUnavailable("simulated outage")
        if self.fail_next is not None:
            exc, self.fail_next = self.fail_next, None
            raise exc

    @staticmethod
    def _usage(i: int = 400, o: int = 300) -> Usage:
        return Usage(input_tokens=i, output_tokens=o, latency_ms=5)

    # ----------------------------------------------------------------- structured
    def structured(self, *, model, instructions, input, schema, max_output_tokens):
        self._maybe_fail(schema.__name__, input)
        fn = getattr(self, f"_s_{schema.__name__}", None)
        if fn is None:
            raise NotImplementedError(schema.__name__)
        return fn(input), self._usage(len(input) // 4, 500)

    def _q(self, i: int, lesson: str, qtype: str) -> GenQuestion:
        self._n += 1
        k = self._n
        subj = SUBJECTS[k % len(SUBJECTS)]
        base, third, rest = VERBS[k % len(VERBS)]
        common = dict(instructions_vi="Chọn/điền dạng đúng của động từ.", context_passage=None, options=[], correct_option_index=None,
                      correct_answers=[], ordering_tokens=[], matching_pairs=[], answer_criteria=None,
                      explanation_vi=f"Chủ ngữ {subj} là ngôi thứ ba số ít nên động từ thêm -s/-es: {third}.",
                      wrong_option_explanations_vi=[], difficulty="normal", grammar_topic="Present Simple",
                      learning_objective="Chia động từ ngôi thứ ba số ít", related_grammar_rule="He/She/It + V(s/es)",
                      source_lesson_id=lesson, evidence_quote=None, reading_strategy_vi=None)
        if qtype == "multiple_choice":
            text = f"{subj} ___ {rest} every day. (#{k})"
            q = GenQuestion(question_type="multiple_choice", question_text=text, **{**common, "options": [base, third, f"is {base}"], "correct_option_index": 1})
            self._answers[text] = "B"
        elif qtype == "fill_blank":
            text = f"{subj} ___ ({base}) {rest} on Mondays. (#{k})"
            q = GenQuestion(question_type="fill_blank", question_text=text, **{**common, "correct_answers": [third]})
            self._answers[text] = third
        elif qtype == "sentence_ordering":
            sent = f"{subj} {third} {rest}"
            q = GenQuestion(question_type="sentence_ordering", question_text=f"Sắp xếp thành câu đúng (#{k}).",
                            **{**common, "ordering_tokens": sent.split()[::-1], "correct_answers": [sent]})
        elif qtype == "matching":
            q = GenQuestion(question_type="matching", question_text=f"Ghép chủ ngữ với động từ đúng (#{k}).",
                            **{**common, "matching_pairs": [MatchPair(left="I", right="am"), MatchPair(left="She", right="is"),
                                                            MatchPair(left="They", right="are")]})
        else:  # translation_vi_en (open, AI-graded)
            q = GenQuestion(question_type="translation_vi_en", question_text=f"Dịch: \"{subj} thường {base} mỗi ngày.\" (#{k})",
                            **{**common, "correct_answers": [f"{subj} usually {third} every day."], "answer_criteria": "third-person -s"})
        return q

    def _s_ExerciseGeneration(self, input: str) -> ExerciseGeneration:
        meta = json.loads(input.split("\n", 1)[0])
        lesson = meta["allowed_source_lesson_ids"][0]
        types = meta["question_types"] if isinstance(meta["question_types"], list) else ["multiple_choice", "fill_blank", "sentence_ordering", "translation_vi_en", "matching"]
        qs = [self._q(i, lesson, types[i % len(types)]) for i in range(int(meta["count"]))]
        # one deliberately broken question to exercise validation
        qs.append(GenQuestion(**{**qs[0].model_dump(), "question_text": qs[0].question_text + " broken", "options": ["a", "a", "b"]}))
        return ExerciseGeneration(title="Luyện tập Present Simple (AI giả lập)", learning_objectives=["Chia động từ ngôi thứ ba số ít"], questions=qs)

    def _s_SolveResult(self, input: str) -> SolveResult:
        out = []
        for line in input.splitlines():
            m = re.match(r"^(\d+)\. (.*?)(?:  [A-H]\. .*)?$", line)
            if not m:
                continue
            text = m.group(2).split(" [Context")[0].strip()
            text = re.sub(r"\s+A\. .*$", "", text)
            ans = self._answers.get(text, "?")
            out.append(SolvedAnswer(question_number=int(m.group(1)), answer=ans, is_ambiguous=False, has_error=False, note=""))
        return SolveResult(answers=out)

    def _s_GradingBatch(self, input: str) -> GradingBatch:
        res = []
        blocks = re.findall(r"(\{.*?\})\n<learner_answer n=\"(\d+)\">(.*?)</learner_answer>", input, re.S)
        for raw, n, ans in blocks:
            q = json.loads(raw)
            refs = [r.lower().strip(" .") for r in q.get("reference_answers") or []]
            good = ans.lower().strip(" .") in refs or any(r and r in ans.lower() for r in refs)
            res.append(AIGrade(question_number=int(n), correctness="correct" if good else "incorrect", score=1.0 if good else 0.0,
                               feedback_vi="Đúng rồi." if good else "Chưa đúng: chủ ngữ ngôi thứ ba số ít cần động từ thêm -s/-es.",
                               errors=[] if good else [GradingErrorItem(category="subject_verb_agreement", original=ans[:40], correction=(q.get("reference_answers") or [""])[0], explanation_vi="Thiếu -s/-es sau chủ ngữ ngôi ba số ít.")],
                               corrected_answer=None if good else (q.get("reference_answers") or [None])[0], acceptable_alternatives=[],
                               grammar_explanation_vi="He/She/It + V(s/es).", improvement_suggestion_vi="Ôn bài Present Simple.",
                               follow_up_suggestion_vi="Làm thêm 5 câu chia động từ.", confidence="high"))
        return GradingBatch(results=res)

    def _s_WritingFeedbackOut(self, input: str) -> WritingFeedbackOut:
        text = input.split("<learner_text>\n", 2)[-1].split("\n</learner_text>")[0]
        errors = []
        m = re.search(r"\b[Yy]esterday I go\b", text)
        if m:
            errors.append(WritingErrorItem(original=m.group(0), correction=m.group(0).replace("go", "went"), category="tense",
                                           explanation_vi="'Yesterday' là ngữ cảnh quá khứ nên dùng Past Simple: go → went.", severity="major"))
        fixed = text.replace("Yesterday I go", "Yesterday I went").replace("yesterday I go", "yesterday I went")
        return WritingFeedbackOut(
            overall_assessment_vi="Bài viết rõ ý, còn lỗi thì quá khứ.", estimated_level="A2", estimated_score_10=6.0,
            criteria=[CriterionScore(criterion=c, score=6.0, comment_vi="Nhận xét mẫu (AI giả lập).") for c in
                      ["task_fulfilment", "organization_coherence", "vocabulary", "grammar", "clarity_naturalness"]],
            detected_errors=errors, minimal_corrections=fixed, rewritten_version=fixed, rewrite_changes_vi=["Sửa thì quá khứ."],
            b2_upgrade_suggestions=[], vocabulary_suggestions=[], organization_feedback_vi="Có mở bài và kết bài.",
            improvement_plan_vi=["Ôn Past Simple"], practice_topics=["Past Simple"])

    def _s_WritingPromptOut(self, input: str) -> WritingPromptOut:
        return WritingPromptOut(title="My last weekend", prompt_en="Write about your last weekend.", instructions_vi="Kể về cuối tuần trước.",
                                requirements=["Where you went", "What you did", "How you felt"], word_min=80, word_max=100, suggested_minutes=15)

    def _s_SpeakingQuestion(self, input: str) -> SpeakingQuestion:
        return SpeakingQuestion(question_en="What do you usually do at the weekend?", hint_vi="Trả lời 2–3 câu với thì hiện tại đơn.",
                                useful_expressions=["I usually…", "On Saturdays, I…", "I like to…"])

    def _s_SpeakingTurnFeedback(self, input: str) -> SpeakingTurnFeedback:
        ans = input.split("<learner_answer>")[-1].split("</learner_answer>")[0]
        errs = []
        if re.search(r"\b(he|she) go\b", ans, re.I):
            errs.append(WritingErrorItem(original=re.search(r"\b(he|she) go\b", ans, re.I).group(0), correction="she goes", category="subject_verb_agreement",
                                         explanation_vi="Ngôi thứ ba số ít: go → goes.", severity="major"))
        return SpeakingTurnFeedback(relevance_vi="Câu trả lời đúng chủ đề.", grammar_feedback=errs, vocabulary_feedback_vi="Từ vựng phù hợp.",
                                    natural_expressions=["I tend to…"], improved_answer=ans.replace(" go ", " goes ") if errs else ans,
                                    completeness_vi="Câu đầy đủ chủ ngữ và động từ.", next_question_en="Who do you usually spend it with?",
                                    next_hint_vi="Nói về người bạn đi cùng.", should_end=False)

    def _s_SpeakingSummaryOut(self, input: str) -> SpeakingSummaryOut:
        return SpeakingSummaryOut(overall_vi="Bạn trả lời đúng chủ đề, cần chú ý -s ngôi thứ ba.", key_mistakes=[], useful_expressions=["I tend to…"],
                                  improved_sample_answers=["At the weekend, I usually visit my grandparents."], follow_up_practice_vi=["Luyện 5 câu với He/She"],
                                  practice_topics=["Present Simple"])

    def _studio_questions(self, questions: list[GenQuestion], input: str) -> list[GenQuestion]:
        count = int(re.search(r"(\d+) questions", input).group(1))
        result = []
        for i in range(count):
            q = questions[i % len(questions)].model_copy(deep=True)
            if i >= len(questions):
                q.question_text += f" (simulated variant {i + 1})"
            self._answers[q.question_text] = "ABCDEFGH"[q.correct_option_index or 0]
            result.append(q)
        return result

    def _s_ListeningGeneration(self, input: str) -> ListeningGeneration:
        segs = [ListeningSegment(speaker="Anna", text="Hi Ben, are you free on Saturday morning?"),
                ListeningSegment(speaker="Ben", text="Yes, I am. What do you have in mind?"),
                ListeningSegment(speaker="Anna", text="There is a new café on Hai Ba Trung Street. It opens at seven thirty."),
                ListeningSegment(speaker="Ben", text="Great. Let's meet there at eight, and I will bring my sister.")]
        base = dict(instructions_vi="Nghe và trả lời.", context_passage=None, correct_answers=[], ordering_tokens=[], matching_pairs=[],
                    answer_criteria=None, wrong_option_explanations_vi=[], difficulty="normal", grammar_topic="listening",
                    learning_objective="Nghe chi tiết", related_grammar_rule="", source_lesson_id="listening", reading_strategy_vi=None)
        qs = [
            GenQuestion(question_type="multiple_choice", question_text="What time does the café open?", options=["7:00", "7:30", "8:00"],
                        correct_option_index=1, explanation_vi="Anna nói 'It opens at seven thirty'.", evidence_quote="It opens at seven thirty", **base),
            GenQuestion(question_type="true_false", question_text="Ben will come alone.", options=["True", "False"], correct_option_index=1,
                        explanation_vi="Ben nói sẽ đưa em gái đi cùng.", evidence_quote="I will bring my sister", **base),
            GenQuestion(question_type="multiple_choice", question_text="When will they meet?", options=["Saturday at 8", "Sunday at 8", "Saturday at 7"],
                        correct_option_index=0, explanation_vi="Hai bạn hẹn sáng thứ Bảy: 'meet there at eight'.", evidence_quote="Let's meet there at eight", **base),
        ]
        return ListeningGeneration(title="Weekend plans (AI giả lập)", speakers=["Anna", "Ben"], segments=segs, questions=self._studio_questions(qs, input),
                                   vocabulary=[VocabItem(word="have in mind", meaning_vi="có ý định", example="What do you have in mind?")])

    def _s_ReadingGeneration(self, input: str) -> ReadingGeneration:
        passage = ("Many young people in Vietnam now learn English online. They say online courses are cheaper and more flexible. "
                   "However, some learners find it hard to stay motivated without a teacher. Experts suggest setting a daily goal "
                   "and practising with friends to keep going. Some schools now mix online lessons with short meetings in class, "
                   "so students can ask questions and get feedback from a real teacher.")
        base = dict(instructions_vi="Đọc và trả lời.", context_passage=None, correct_answers=[], ordering_tokens=[], matching_pairs=[],
                    answer_criteria=None, difficulty="normal", grammar_topic="main idea", learning_objective="Đọc hiểu",
                    related_grammar_rule="", source_lesson_id="reading", reading_strategy_vi="Tìm từ khóa trong câu hỏi rồi dò trong bài.")
        qs = [
            GenQuestion(question_type="multiple_choice", question_text="Why do young people choose online courses?",
                        options=["They are cheaper and more flexible", "They have better teachers", "They are required"], correct_option_index=0,
                        explanation_vi="Bài nói 'cheaper and more flexible'.", wrong_option_explanations_vi=["", "Không được nhắc.", "Không được nhắc."],
                        evidence_quote="online courses are cheaper and more flexible", **base),
            GenQuestion(question_type="true_false", question_text="All learners stay motivated easily.", options=["True", "False", "Not Given"],
                        correct_option_index=1, explanation_vi="Bài nói một số người khó giữ động lực.", wrong_option_explanations_vi=[],
                        evidence_quote="some learners find it hard to stay motivated", **base),
            GenQuestion(question_type="multiple_choice", question_text="What do experts suggest?",
                        options=["Setting a daily goal", "Studying only at night", "Stopping online study"], correct_option_index=0,
                        explanation_vi="Chuyên gia khuyên đặt mục tiêu mỗi ngày: 'Experts suggest setting a daily goal'.", wrong_option_explanations_vi=["", "Không có.", "Ngược ý."],
                        evidence_quote="Experts suggest setting a daily goal", **base),
        ]
        return ReadingGeneration(title="Learning English online (AI giả lập)", passage=passage, questions=self._studio_questions(qs, input),
                                 vocabulary=[VocabItem(word="motivated", meaning_vi="có động lực", example="Stay motivated.")])

    def _s_PlacementReportOut(self, input: str) -> PlacementReportOut:
        ids = re.findall(r"\('([AB][012]-G\d{3})'", input)
        return PlacementReportOut(estimated_level="A1", strengths_vi=["Nắm câu cơ bản"], weaknesses_vi=["Thì hiện tại đơn"],
                                  recommended_lesson_ids=ids[:3], study_priorities_vi=["Ôn Present Simple"], plan_vi=["Mỗi ngày 1 bài"])

    def _s_WritingLevelEstimate(self, input: str) -> WritingLevelEstimate:
        return WritingLevelEstimate(level="A2", rationale_vi="Câu đơn, dùng được thì quá khứ cơ bản.")

    # ----------------------------------------------------------------- vocabulary
    @staticmethod
    def _between(text: str, tag: str) -> str:
        return text.split(f"<{tag}>")[-1].split(f"</{tag}>")[0] if f"<{tag}>" in text else ""

    def _s_PronunciationExplanation(self, input: str):
        from .pronunciation import PronunciationExplanation, WordExplanation

        words = re.findall(r"^- (\S+) \(", self._between(input, "learner_text"), re.M)
        return PronunciationExplanation(words=[WordExplanation(word=w, sound_vi=f"[AI giả lập] Âm khó trong “{w}”.",
                                                               how_vi="Đọc chậm từng âm, bật rõ âm cuối.", practice=[w, f"{w} {w}"]) for w in words],
                                        summary_vi="[AI giả lập] Luyện lại các từ được đánh dấu rồi đọc lại cả câu.")

    def _s_VocabAnswerJudge(self, input: str):
        from ..vocabulary.ai_schemas import VocabAnswerJudge

        ref = re.search(r"Reference answer: ([^<\n]+)", input)
        ref_words = set((ref.group(1) if ref else "").lower().split())
        ans_words = set(self._between(input, "learner_answer").lower().split())
        ok = bool(ref_words) and len(ref_words ^ ans_words) <= 2 and len(ref_words & ans_words) >= max(1, len(ref_words) - 1)
        return VocabAnswerJudge(acceptable=ok, verdict="acceptable" if ok else "incorrect",
                                explanation_vi="Cách diễn đạt này cũng tự nhiên và đúng nghĩa." if ok else "Nghĩa chưa khớp với gợi ý tiếng Việt.")

    def _s_VocabSentenceGrade(self, input: str):
        from ..vocabulary.ai_schemas import SentenceIssue, VocabSentenceGrade

        text = self._between(input, "learner_text").strip()
        bad = "[[incorrect]]" in text or re.search(r"\b(\w+) \1\b", text.lower()) is not None
        return VocabSentenceGrade(uses_target=True, target_used_correctly=not bad, grammar_ok=not bad, natural=not bad, meaning_clear=True,
                                  verdict="incorrect" if bad else "correct",
                                  issues=[SentenceIssue(original=text[:40], correction=text[:40].replace("[[incorrect]]", "").strip(),
                                                        explanation_vi="Câu có từ lặp hoặc sai ngữ pháp.")] if bad else [],
                                  corrected_sentence=text.replace("[[incorrect]]", "").strip(), explanation_vi="Câu dùng từ đúng nghĩa và tự nhiên." if not bad else "Câu chưa đúng, xem phần sửa.",
                                  better_example="I want to achieve my goals this year.")

    def _s_VocabContextMeaning(self, input: str):
        from ..vocabulary.ai_schemas import VocabContextMeaning

        data = self._between(input, "dictionary_entry")
        try:
            d = json.loads(data)
            meaning = d["senses"][0]["meaning_vi"]
            lemma, pos = d["lemma"], d["senses"][0]["pos"] or ""
        except Exception:  # noqa: BLE001
            meaning, lemma, pos = "nghĩa theo ngữ cảnh (giả lập)", self._between(input, "learner_text"), ""
        return VocabContextMeaning(lemma=lemma, pos=pos, sense_index=0, meaning_vi_in_context=meaning,
                                   explanation_vi="Trong câu này từ được dùng với nghĩa phổ biến nhất.")

    def _s_VocabDialogueTurn(self, input: str):
        from ..vocabulary.ai_schemas import VocabDialogueTurn

        targets = [w.strip() for w in re.search(r"Target words: (.*?)</curriculum>", input, re.S).group(1).split(",") if w.strip()]
        said = self._between(input, "learner_text").lower()
        used = [t for t in targets if t.lower() in said]
        q = f"That sounds interesting! Could you tell me more about how you would {targets[0] if targets else 'do'} that?"
        return VocabDialogueTurn(reply_en=q, hint_vi=f"Thử dùng từ “{targets[0] if targets else ''}” trong câu trả lời.", target_words_used=used,
                                 corrections=[], feedback_vi="Bạn đã dùng từ mục tiêu tự nhiên." if used else "Hãy thử dùng một từ mục tiêu.",
                                 should_end=False)

    def _s_VocabExerciseSet(self, input: str):
        from ..vocabulary.ai_schemas import VocabExerciseItem, VocabExerciseSet

        raw = re.search(r"Target words: (\[.*\])\n", input, re.S)
        lemmas = []
        if raw:
            for x in json.loads(raw.group(1)):
                try:
                    lemmas.append(json.loads(x)["lemma"])
                except Exception:  # noqa: BLE001
                    pass
        items = [VocabExerciseItem(type="cloze", target_word=l, sentence=f"Every day I try to _____ something new.", sentence_vi="Mỗi ngày tôi cố gắng làm một điều mới.",
                                   options=[l, "banana", "yesterday", "purple"], answer_index=0,
                                   explanation_vi=f"“{l}” hợp nghĩa câu; các lựa chọn khác không phải động từ phù hợp.") for l in lemmas[:4]]
        return VocabExerciseSet(items=items)

    def _s_VocabEnrichmentBatch(self, input: str):
        from ..vocabulary.ai_schemas import EnrichExample, EnrichSense, VocabEnrichment, VocabEnrichmentBatch

        data = json.loads(self._between(input, "curriculum") or "[]")
        out = []
        for d in data:
            l = d["lemma"]
            out.append(VocabEnrichment(lemma=l, exists=True, senses=[EnrichSense(pos="noun", meaning_vi=f"nghĩa thử nghiệm của {l}", definition_en=f"a test sense of {l}")],
                                       cefr_estimate="B1", examples=[EnrichExample(en=f"I read about {l} yesterday.", vi=f"Hôm qua tôi đọc về {l}.")],
                                       collocations=[f"use {l}"], word_family=[], usage_vi="Dùng trong văn viết (giả lập).",
                                       common_mistake_vi="Không có lỗi phổ biến (giả lập)."))
        return VocabEnrichmentBatch(entries=out)

    # ----------------------------------------------------------------- other modalities
    def text(self, *, model, instructions, input, max_output_tokens):
        self._maybe_fail("text", input)
        if "<learner_data>" in input:  # study assistant: echo real figures so tests/E2E can check grounding
            d = json.loads(input.split("<learner_data>")[1].split("</learner_data>")[0])
            p, e, nxt = d["progress"], d["eta"], d["next"]["steps"]
            first = f" Việc nên làm tiếp: **{nxt[0]['title']}**." if nxt else ""
            weeks = f"khoảng {e['weeks']} tuần" if e.get("weeks") is not None else "chưa đủ dữ liệu"
            return (f"**[AI giả lập]** Bạn đã hoàn thành {p['lessons_completed']}/{p['lessons_total']} bài "
                    f"({p['start_level']} → {p['target_level']}); ước lượng còn {weeks}.{first}"), self._usage()
        q = input.split("<learner_text>")[-1].split("</learner_text>")[0][:80]
        return (f"**[AI giả lập]** Giải thích cho yêu cầu: _{q}_\n\n- **Present Simple (thì hiện tại đơn)**: He/She/It + V(s/es).\n"
                "- Ví dụ: *She goes to school.* — Cô ấy đi học.\n\n❓ Câu hỏi kiểm tra: *He ___ (play) football.*"), self._usage()

    def transcribe(self, *, model, audio, filename, prompt=""):
        self._maybe_fail("transcribe")
        try:
            text = audio.decode("utf-8")
            if not all(c.isprintable() or c in "\r\n\t" for c in text) or not re.search(r"[A-Za-z]", text):
                raise ValueError
        except (UnicodeDecodeError, ValueError):
            text = "I usually go to the park with my family."
        return text.strip(), Usage(audio_seconds=5.0, latency_ms=5)

    def transcribe_words(self, *, model, audio, filename):
        """Test audio is UTF-8 text: a word written "?word" is heard with low confidence (0.4)."""
        text, usage = self.transcribe(model=model, audio=audio, filename=filename)
        words = [(re.sub(r"[^A-Za-z0-9']", "", w).lower(), 0.4 if w.startswith("?") else 0.98) for w in text.split()]
        return text.replace("?", ""), [w for w in words if w[0]], usage

    def speech(self, *, model, text, voice, instructions=""):
        self._maybe_fail("speech")
        # A decodable test tone lets browsers exercise playback. It is deliberately
        # not speech; the simulated-provider banner must remain visible.
        return (Path(__file__).parent / "fixtures" / "test-tone.mp3").read_bytes(), Usage(characters=len(text), audio_seconds=len(text.split()) / 2.5, latency_ms=5)

    def realtime_secret(self, *, model, instructions, voice, ttl_seconds):
        self._maybe_fail("realtime")
        return {"value": "ek_fake_test_secret", "expires_at": int(time.time()) + ttl_seconds}

    def embed(self, *, model, texts):
        self._maybe_fail("embed")
        return [[float(len(t) % 7), 1.0, 0.5] for t in texts], Usage(input_tokens=sum(len(t) // 4 for t in texts))

    def list_models(self):
        return ["fake-model"]
