"""Progress forecast from real day-by-day data (app/forecast.py): no weekly window, ranges, per-level speed."""
import math
from datetime import date, timedelta

from app import forecast as F

LEVELS = ["A0", "A1", "A2", "B1", "B2"]
TODAY = date(2026, 10, 19)


def day(offset: int, minutes: float, lessons: list[str] = (), lesson_share: float = 0.8, items: int = 10, correct: int = 8) -> F.DayRec:
    return F.DayRec(day=TODAY - timedelta(days=offset), minutes=minutes, live_minutes=minutes, lesson_minutes=minutes * lesson_share,
                    items=items, correct=correct, completed=list(lessons))


def test_two_study_days_mean_daily_study_not_two_days_a_week():
    p = F.pace([day(2, 100, ["a", "b"]), day(1, 200, ["c"])], TODAY, 240)  # nothing yet today
    assert p["calendar_days"] == 2 and p["study_days"] == 2 and p["active_ratio"] == 1.0
    assert not p["studied_today"] and p["last_day"] == (TODAY - timedelta(days=1)).isoformat()
    assert 150 < p["minutes_per_study_day"] < 160  # recent day weighs a bit more than the plain mean of 150
    assert p["minutes_low"] == 100 and p["minutes_high"] == 200
    assert p["active_ratio_expected"] == round((2 + 5) / (2 + 7), 2)  # cautious prior, outweighed as data grows
    assert p["lessons_per_study_day"] == 1.5 and p["goal_percent"] == round(100 * p["minutes_per_study_day"] / 240)


def test_skipped_days_count_and_today_counts_once_studied():
    p = F.pace([day(9, 60), day(0, 60)], TODAY, 60)
    assert p["calendar_days"] == 10 and p["study_days"] == 2 and p["active_ratio"] == 0.2 and p["studied_today"]
    assert [d["minutes"] for d in p["days"]][1:-1] == [0] * 8  # gaps are visible day by day
    long = F.pace([day(i, 30) for i in range(60)], TODAY, 30)
    assert long["active_ratio_expected"] > 0.95  # sixty real days outweigh the prior
    assert long["trend"]["last_7"]["minutes_per_day"] == 30 and len(long["weekday"]) == 7


def test_speed_model_measures_levels_and_is_cautious_beyond_them():
    samples = [F.Sample(id=f"A0-{i}", level="A0", spent_minutes=15, catalog_minutes=75, score=85) for i in range(6)]
    sp = F.speed_model(samples, LEVELS)
    assert sp["overall_ratio"] == 0.2 and sp["minutes_per_lesson"] == 15
    assert sp["by_level"]["A0"] == {"ratio": 0.2, "samples": 6, "basis": "measured"}
    a1 = sp["by_level"]["A1"]
    assert a1["basis"] == "extrapolated" and 0.2 < a1["ratio"] < 1.0  # unseen, harder levels: between own speed and catalog
    assert F.speed_model([], LEVELS)["by_level"]["B2"] == {"ratio": 1.0, "samples": 0, "basis": "catalog"}


def test_forecast_range_milestones_and_scenarios():
    p = F.pace([day(i, 120, ["x"]) for i in range(10)], TODAY, 240)
    sp = F.speed_model([F.Sample(id=f"A0-{i}", level="A0", spent_minutes=30, catalog_minutes=60) for i in range(4)], LEVELS)
    remaining = [F.UnitRec(id=f"A0-{i}", level="A0", catalog_minutes=60) for i in range(3)] + \
                [F.UnitRec(id=f"A1-{i}", level="A1", catalog_minutes=60) for i in range(5)]
    e = F.forecast(p, remaining, sp, TODAY, 240, "A1")
    assert e["basis"] == "real_pace" and e["start_date"] == (TODAY + timedelta(days=1)).isoformat()  # today already studied
    assert e["range"]["fast"]["days"] <= e["days"] <= e["range"]["slow"]["days"]
    assert [m["level"] for m in e["milestones"]] == ["A0", "A1"] and e["milestones"][0]["finish_date"] <= e["milestones"][1]["finish_date"]
    assert e["milestones"][0]["speed_basis"] == "measured" and e["milestones"][1]["speed_basis"] == "extrapolated"
    share = p["lesson_share_used"]
    one_hour = next(s for s in e["scenarios"] if s["label"] == "1 giờ/ngày")
    total = 3 * 60 * sp["by_level"]["A0"]["ratio"] + 5 * 60 * sp["by_level"]["A1"]["ratio"]
    assert one_hour["days"] == math.ceil(total / (60 * share))
    goal = next(s for s in e["scenarios"] if s["kind"] == "goal")
    assert goal["days"] < e["days"] and e["goal_gain_days"] == e["days"] - goal["days"]
    level, why = F.confidence(p, sp, e["remaining_by_level"])
    assert level == "trung bình" and "A1" in why


def test_in_progress_time_is_subtracted_and_no_data_uses_goal():
    sp = F.speed_model([], LEVELS)
    fresh = F.forecast(F.pace([], TODAY, 60), [F.UnitRec(id="A0-1", level="A0", catalog_minutes=60, spent_minutes=40)], sp, TODAY, 60, "A0")
    assert fresh["basis"] == "goal" and fresh["remaining_minutes"] == 20 and fresh["start_date"] == TODAY.isoformat()
    assert F.confidence(F.pace([], TODAY, 60), sp, {})[0] == "thấp"


def test_duration_text():
    assert F.duration_vi(0.4) == "dưới 1 ngày" and F.duration_vi(12.2) == "~13 ngày"
    assert F.duration_vi(90) == "~13 tuần" and F.duration_vi(400) == "~13,2 tháng"
