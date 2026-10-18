"""Progress analysis and completion forecast from the learner's real day-by-day record.

Everything is computed from stored data (study_log, lesson_progress, vocabulary progress); there is no fixed weekly window:
  * pace is measured per calendar day since the first study day (2 study days out of 2 means "every day", not
    "2 days a week"); today counts only once something was studied today;
  * recent days weigh more (half-life 7 days); study frequency starts from a cautious prior (5 of 7 days, worth one
    week of data) that real data quickly outweighs;
  * time per lesson is the learner's measured time relative to the curriculum's suggested minutes, per level when a
    level has enough samples, and more cautious for levels not studied yet;
  * every estimate comes with a range (the learner's lighter vs. heavier study days) and a confidence level, and the
    result says which data is missing.
The AI only explains these numbers; it never produces them.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta

HALF_LIFE_DAYS = 7
PRIOR_ACTIVE, PRIOR_DAYS = 5, 7      # expected frequency before data: 5 of 7 days, weighted like one week of data
SLOW_PRIOR_ACTIVE = 3                # cautious bound: 3 of 7 days
DEFAULT_LESSON_SHARE = 0.7           # part of study time spent on lessons when not yet measured
RATIO_MIN, RATIO_MAX = 0.1, 4.0
WEEKDAYS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]


@dataclass
class DayRec:
    day: date
    minutes: float = 0.0             # all recorded study time
    live_minutes: float = 0.0        # time recorded by the live hooks (lessons + modules)
    lesson_minutes: float = 0.0      # live time inside lessons
    untracked_minutes: float = 0.0   # older records without per-lesson attribution (backfill)
    items: int = 0
    correct: int = 0
    completed: list[str] = field(default_factory=list)
    words_learned: int = 0

    @property
    def studied(self) -> bool:
        return self.minutes >= 1 or self.items > 0 or bool(self.completed)


@dataclass
class UnitRec:
    id: str
    level: str
    catalog_minutes: float
    spent_minutes: float = 0.0       # live time already spent on this (unfinished) lesson


@dataclass
class Sample:
    """A completed lesson with live-tracked time."""
    id: str
    level: str
    spent_minutes: float
    catalog_minutes: float
    score: float | None = None


# ------------------------------------------------------------------ helpers
def duration_vi(days: float | None) -> str:
    if days is None:
        return "chưa ước lượng được"
    if days < 1:
        return "dưới 1 ngày"
    d = math.ceil(days)
    if d <= 60:
        return f"~{d} ngày"
    if d <= 182:
        return f"~{round(d / 7)} tuần"
    return f"~{d / 30.4:.1f} tháng".replace(".", ",")


def _weight(age_days: int) -> float:
    return 0.5 ** (age_days / HALF_LIFE_DAYS)


def _wmean(pairs: list[tuple[float, float]]) -> float:
    tw = sum(w for _, w in pairs)
    return sum(v * w for v, w in pairs) / tw if tw else 0.0


def _quantile(vals: list[float], q: float) -> float:
    s = sorted(vals)
    if not s:
        return 0.0
    pos = (len(s) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def _clamp_ratio(r: float) -> float:
    return max(RATIO_MIN, min(RATIO_MAX, r))


# ------------------------------------------------------------------ speed (time per lesson)
def speed_model(samples: list[Sample], levels: list[str]) -> dict:
    """Ratio of real minutes to the curriculum's suggested minutes, overall and per level (geometric means)."""
    logs = [math.log(_clamp_ratio(s.spent_minutes / max(1.0, s.catalog_minutes))) for s in samples]
    n = len(samples)
    overall = math.exp(sum(logs) / n) if n >= 2 else None
    sampled = {s.level for s in samples}
    top = max((levels.index(lv) for lv in sampled if lv in levels), default=-1)
    by_level: dict[str, dict] = {}
    for lv in levels:
        own = [math.log(_clamp_ratio(s.spent_minutes / max(1.0, s.catalog_minutes))) for s in samples if s.level == lv]
        if len(own) >= 3:
            by_level[lv] = {"ratio": round(_clamp_ratio(math.exp(sum(own) / len(own))), 3), "samples": len(own), "basis": "measured"}
        elif overall is not None:
            # few or no samples at this level: lean on the overall speed, more cautiously for levels above those studied
            k = n / (n + 3) * (0.5 if levels.index(lv) > top else 1.0)
            by_level[lv] = {"ratio": round(_clamp_ratio(math.exp(k * math.log(overall))), 3), "samples": len(own), "basis": "extrapolated"}
        else:
            by_level[lv] = {"ratio": 1.0, "samples": len(own), "basis": "catalog"}
    return {"overall_ratio": round(overall, 3) if overall is not None else None, "samples": n, "by_level": by_level,
            "minutes_per_lesson": round(_quantile([s.spent_minutes for s in samples], 0.5), 1) if samples else None}


def remaining_work(remaining: list[UnitRec], speed: dict) -> tuple[list[tuple[UnitRec, float]], dict]:
    """Projected minutes for each remaining lesson (in curriculum order) and a per-level summary."""
    out, by_level = [], {}
    for u in remaining:
        lv = speed["by_level"].get(u.level, {"ratio": 1.0, "basis": "catalog"})
        full = u.catalog_minutes * lv["ratio"]
        m = max(full * 0.2, full - u.spent_minutes)
        out.append((u, m))
        b = by_level.setdefault(u.level, {"lessons": 0, "minutes": 0.0, "ratio": lv["ratio"], "basis": lv["basis"]})
        b["lessons"] += 1
        b["minutes"] += m
    for b in by_level.values():
        b["minutes"] = round(b["minutes"])
    return out, by_level


# ------------------------------------------------------------------ pace (from the calendar of real study days)
def calendar(days: list[DayRec], today: date) -> list[DayRec]:
    """Every calendar day from the first study day to the last complete-or-started day (gaps filled with zeros)."""
    by_day = {d.day: d for d in days}
    studied = sorted(d.day for d in days if d.studied)
    if not studied:
        return []
    last = today if (today in by_day and by_day[today].studied) else today - timedelta(days=1)
    last = max(last, studied[0])
    n = (last - studied[0]).days + 1
    return [by_day.get(studied[0] + timedelta(days=i)) or DayRec(day=studied[0] + timedelta(days=i)) for i in range(n)]


def pace(days: list[DayRec], today: date, goal_minutes: int) -> dict:
    cal = calendar(days, today)
    if not cal:
        return {"has_data": False, "calendar_days": 0, "study_days": 0, "goal_minutes": goal_minutes, "days": []}
    last = cal[-1].day
    study = [d for d in cal if d.studied]
    n_cal, n_study = len(cal), len(study)
    mins = [d.minutes for d in study]
    m_exp = _wmean([(d.minutes, _weight((last - d.day).days)) for d in study])
    if n_study >= 4:
        m_low, m_high = _quantile(mins, 0.25), _quantile(mins, 0.75)
    else:
        m_low, m_high = min(mins), max(mins)
    f_obs = n_study / n_cal
    f_exp = (n_study + PRIOR_ACTIVE) / (n_cal + PRIOR_DAYS)
    f_slow = (n_study + SLOW_PRIOR_ACTIVE) / (n_cal + PRIOR_DAYS)
    recent = [d for d in cal if (last - d.day).days < 28]
    live = sum(d.live_minutes for d in recent)
    share = sum(d.lesson_minutes for d in recent) / live if live >= 30 else None
    items = sum(d.items for d in cal)
    correct = sum(d.correct for d in cal)
    completed = [k for d in cal for k in d.completed]
    trend = None
    if n_cal >= 14:
        a = [d for d in cal if (last - d.day).days < 7]
        b = [d for d in cal if 7 <= (last - d.day).days < 14]
        acc = lambda ds: round(100 * sum(d.correct for d in ds) / sum(d.items for d in ds)) if sum(d.items for d in ds) else None
        trend = {"last_7": {"minutes_per_day": round(sum(d.minutes for d in a) / 7), "study_days": sum(1 for d in a if d.studied),
                            "lessons": sum(len(d.completed) for d in a), "accuracy": acc(a)},
                 "previous_7": {"minutes_per_day": round(sum(d.minutes for d in b) / 7), "study_days": sum(1 for d in b if d.studied),
                                "lessons": sum(len(d.completed) for d in b), "accuracy": acc(b)}}
    weekday = None
    if n_cal >= 14:
        buckets: dict[int, list[float]] = {}
        for d in cal:
            buckets.setdefault(d.day.weekday(), []).append(d.minutes)
        weekday = [{"weekday": WEEKDAYS_VI[i], "avg_minutes": round(sum(v) / len(v)), "study_rate": round(sum(1 for x in v if x >= 1) / len(v), 2)}
                   for i, v in sorted(buckets.items())]
    return {
        "has_data": True, "first_day": cal[0].day.isoformat(), "last_day": last.isoformat(), "studied_today": last == today,
        "calendar_days": n_cal, "study_days": n_study, "active_ratio": round(f_obs, 2), "active_ratio_expected": round(f_exp, 2),
        "active_ratio_slow": round(f_slow, 2),
        "minutes_total": round(sum(d.minutes for d in cal)), "minutes_per_study_day": round(m_exp),
        "minutes_per_study_day_median": round(_quantile(mins, 0.5)), "minutes_low": round(m_low), "minutes_high": round(m_high),
        "minutes_best_day": round(max(mins)), "minutes_per_calendar_day": round(sum(d.minutes for d in cal) / n_cal),
        "lessons_completed": len(completed), "lessons_per_study_day": round(len(completed) / n_study, 1),
        "lesson_share": round(share, 2) if share is not None else None,
        "lesson_share_used": round(share if share is not None else DEFAULT_LESSON_SHARE, 2),
        "accuracy": round(100 * correct / items) if items else None, "items": items,
        "goal_minutes": goal_minutes, "goal_days_met": sum(1 for d in study if d.minutes >= goal_minutes),
        "goal_percent": round(100 * round(m_exp) / goal_minutes) if goal_minutes else None,
        "untracked_minutes": round(sum(d.untracked_minutes for d in cal)),
        "words_learned": sum(d.words_learned for d in cal),
        "trend": trend, "weekday": weekday,
        "days": [{"date": d.day.isoformat(), "weekday": WEEKDAYS_VI[d.day.weekday()], "minutes": round(d.minutes),
                  "lessons_completed": len(d.completed), "accuracy": round(100 * d.correct / d.items) if d.items else None,
                  "goal_met": d.minutes >= goal_minutes} for d in cal],
    }


# ------------------------------------------------------------------ forecast
def _finish(start: date, minutes: float, per_day: float) -> tuple[float, str]:
    days = minutes / per_day
    return days, (start + timedelta(days=max(0, math.ceil(days) - 1))).isoformat()


def forecast(p: dict, remaining: list[UnitRec], speed: dict, today: date, goal_minutes: int, target_level: str) -> dict:
    work, by_level = remaining_work(remaining, speed)
    total = sum(m for _, m in work)
    share = p.get("lesson_share_used", DEFAULT_LESSON_SHARE)
    start = today + timedelta(days=1) if p.get("studied_today") else today
    out = {"target_level": target_level, "remaining_lessons": len(remaining), "remaining_minutes": round(total),
           "remaining_hours": round(total / 60, 1), "remaining_by_level": by_level, "lesson_share_of_study_time": share,
           "start_date": start.isoformat(),
           "speed_basis_vi": ("thời gian thực tế bạn làm mỗi bài" if speed["overall_ratio"] is not None else "thời lượng gợi ý của giáo trình (chưa đủ dữ liệu tốc độ)")}

    def scenario(label: str, per_day: float, days_per_week: int, kind: str) -> dict | None:
        cap = per_day * share * days_per_week / 7
        if cap < 1:
            return None
        d, fin = _finish(start, total, cap)
        return {"label": label, "kind": kind, "minutes_per_day": round(per_day), "days_per_week": days_per_week, "days": math.ceil(d),
                "weeks": math.ceil(d / 7), "months": round(d / 30.4, 1), "finish_date": fin, "duration_vi": duration_vi(d)}

    if p.get("has_data"):
        caps = {"expected": p["minutes_per_study_day"] * share * p["active_ratio_expected"],
                "slow": p["minutes_low"] * share * p["active_ratio_slow"],
                "fast": p["minutes_high"] * share * max(p["active_ratio"], p["active_ratio_expected"])}
        out["basis"] = "real_pace"
        out["basis_vi"] = (f"nhịp thực tế: {p['minutes_per_study_day']} phút mỗi ngày học, học {p['study_days']}/{p['calendar_days']} ngày "
                           f"(tính tiếp với khoảng {round(p['active_ratio_expected'] * 7, 1)} ngày/tuần), {round(share * 100)}% thời gian cho bài học")
    else:
        caps = {"expected": goal_minutes * share, "slow": goal_minutes * share * 0.5, "fast": goal_minutes * share}
        out["basis"] = "goal"
        out["basis_vi"] = f"chưa có dữ liệu học — tính theo mục tiêu {goal_minutes} phút/ngày"
    caps = {k: max(1.0, v) for k, v in caps.items()}
    out["lesson_minutes_per_day"] = {k: round(v) for k, v in caps.items()}
    d, fin = _finish(start, total, caps["expected"])
    out |= {"days": math.ceil(d), "weeks": math.ceil(d / 7), "finish_date": fin, "duration_vi": duration_vi(d)}
    rng = {}
    for k in ("fast", "slow"):
        dk, fk = _finish(start, total, caps[k])
        rng[k] = {"days": math.ceil(dk), "finish_date": fk, "duration_vi": duration_vi(dk)}
    out["range"] = rng
    # milestones: the day each level of the route would be finished at the expected pace
    cum, ms = 0.0, {}
    for u, m in work:
        cum += m
        ms[u.level] = cum
    out["milestones"] = [{"level": lv, "lessons": by_level[lv]["lessons"], "hours": round(by_level[lv]["minutes"] / 60, 1),
                          "finish_date": _finish(start, c, caps["expected"])[1], "days": math.ceil(c / caps["expected"]),
                          "speed_basis": by_level[lv]["basis"]} for lv, c in ms.items()]
    # cross-check that ignores lesson length: lessons finished per study day
    if p.get("has_data") and p["lessons_completed"] >= 3:
        per_day = p["lessons_per_study_day"] * p["active_ratio_expected"]
        out["count_check"] = {"lessons_per_study_day": p["lessons_per_study_day"], "days": math.ceil(len(remaining) / per_day) if per_day else None,
                              "note_vi": "Chỉ đếm số bài (bỏ qua việc bài ở cấp cao dài hơn) — dùng để đối chiếu."}
    scen = []
    if p.get("has_data"):
        scen.append(scenario(f"Học {p['minutes_per_study_day']} phút mọi ngày", p["minutes_per_study_day"], 7, "current_daily"))
    seen = set()
    for label, mpd, dpw, kind in [(f"Mục tiêu {goal_minutes} phút/ngày", goal_minutes, 7, "goal"), ("2 giờ/ngày", 120, 7, "what_if"),
                                  ("1 giờ/ngày", 60, 7, "what_if"), ("1 giờ/ngày, 5 ngày/tuần", 60, 5, "what_if"), ("30 phút/ngày", 30, 7, "what_if")]:
        if (mpd, dpw) in seen or (kind == "what_if" and mpd == goal_minutes and dpw == 7):
            continue
        seen.add((mpd, dpw))
        scen.append(scenario(label, mpd, dpw, kind))
    out["scenarios"] = [s for s in scen if s]
    goal_s = next((s for s in out["scenarios"] if s["kind"] == "goal"), None)
    out["goal_gain_days"] = (out["days"] - goal_s["days"]) if goal_s else None
    return out


def confidence(p: dict, speed: dict, by_level: dict) -> tuple[str, str]:
    if not p.get("has_data"):
        return "thấp", "Chưa có ngày học nào được ghi lại."
    reasons = []
    if p["calendar_days"] < 7:
        reasons.append(f"mới có {p['calendar_days']} ngày dữ liệu")
    if speed["samples"] < 3:
        reasons.append("chưa đủ 3 bài có đo thời gian")
    extrap = [lv for lv, b in by_level.items() if b["basis"] != "measured"]
    if extrap:
        reasons.append(f"chưa học tới {', '.join(extrap)} nên tốc độ ở các cấp này là suy ra")
    level = "thấp" if (p["calendar_days"] < 7 or speed["samples"] < 3) else "trung bình" if (p["calendar_days"] < 21 or extrap) else "khá"
    text = "; ".join(reasons)
    return level, (text[:1].upper() + text[1:] + "." if reasons else "Đủ dữ liệu nhiều tuần và nhiều bài có đo thời gian.")


def observations(p: dict, speed: dict, samples: list[Sample], eta: dict, low_scores: list[tuple[str, float]]) -> list[str]:
    """Plain-language findings, each computed from the data above."""
    if not p.get("has_data"):
        return ["Chưa có ngày học nào được ghi lại — hãy học một bài để hệ thống bắt đầu đo nhịp học của bạn."]
    out = [f"Từ {p['first_day'][8:10]}/{p['first_day'][5:7]} bạn học {p['study_days']}/{p['calendar_days']} ngày, trung bình "
           f"{p['minutes_per_study_day']} phút mỗi ngày học (ngày nhiều nhất {p['minutes_best_day']} phút)."]
    if p["goal_minutes"]:
        out.append(f"Mục tiêu {p['goal_minutes']} phút/ngày: đạt {p['goal_days_met']}/{p['study_days']} ngày, trung bình bằng {p['goal_percent']}% mục tiêu.")
    if speed["overall_ratio"] is not None:
        scored = [s.score for s in samples if s.score is not None]
        avg = round(sum(scored) / len(scored)) if scored else None
        txt = (f"Mỗi bài bạn mất khoảng {speed['minutes_per_lesson']} phút, bằng ×{speed['overall_ratio']} thời lượng gợi ý "
               f"(đo trên {speed['samples']} bài)")
        if avg is not None:
            txt += f", điểm trung bình {avg}%"
            if speed["overall_ratio"] < 0.5 and avg >= 80:
                txt += " — nhanh mà vẫn chính xác"
            elif speed["overall_ratio"] < 0.5 and avg < 70:
                txt += " — có thể đang làm quá nhanh, nên đọc kỹ phần giải thích"
        out.append(txt + ".")
    if p["lessons_completed"]:
        out.append(f"Bạn hoàn thành trung bình {p['lessons_per_study_day']} bài mỗi ngày học.")
    if low_scores:
        out.append("Bài điểm dưới 70% nên ôn lại: " + ", ".join(f"{k} ({math.floor(s)}%)" for k, s in low_scores[:5]) + ".")
    t = p.get("trend")
    if t:
        a, b = t["last_7"], t["previous_7"]
        diff = a["minutes_per_day"] - b["minutes_per_day"]
        out.append(f"7 ngày gần nhất: {a['minutes_per_day']} phút/ngày ({'+' if diff >= 0 else ''}{diff} so với 7 ngày trước), "
                   f"{a['lessons']} bài" + (f", đúng {a['accuracy']}%" if a["accuracy"] is not None else "") + ".")
    if p.get("weekday"):
        best = max(p["weekday"], key=lambda w: w["avg_minutes"])
        worst = min(p["weekday"], key=lambda w: w["avg_minutes"])
        if best["avg_minutes"] - worst["avg_minutes"] >= 30:
            out.append(f"Bạn học nhiều nhất vào {best['weekday']} (~{best['avg_minutes']} phút), ít nhất vào {worst['weekday']} (~{worst['avg_minutes']} phút).")
    if eta.get("goal_gain_days") and eta["goal_gain_days"] > 0:
        g = next(s for s in eta["scenarios"] if s["kind"] == "goal")
        out.append(f"Nếu học đủ {p['goal_minutes']} phút mỗi ngày, bạn xong sớm hơn khoảng {eta['goal_gain_days']} ngày (khoảng {g['finish_date'][8:10]}/{g['finish_date'][5:7]}/{g['finish_date'][:4]}).")
    extrap = [m["level"] for m in eta.get("milestones", []) if m["speed_basis"] != "measured"]
    measured = [lv for lv, b in speed["by_level"].items() if b["basis"] == "measured"]
    if extrap and measured:
        out.append(f"Tốc độ đo được ở {', '.join(measured)}; các cấp {', '.join(extrap)} được ước lượng thận trọng hơn (bài khó hơn) "
                   "và sẽ chính xác dần khi bạn học tới.")
    if p["untracked_minutes"]:
        out.append(f"{p['untracked_minutes']} phút là dữ liệu cũ chưa gắn với bài cụ thể — vẫn tính vào nhịp học, không tính vào tốc độ mỗi bài.")
    return out
