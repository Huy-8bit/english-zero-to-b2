"""Focus mode (study lock): goals, progress from real study records, and every safety exit."""
from datetime import timedelta

from app.models import FocusSession, utcnow


def shift(app, **delta):
    """Move the active session's clocks into the past (simulates time passing)."""
    with app.state.sessionmaker() as db:
        s = db.query(FocusSession).filter_by(status="active").one()
        s.started_at = s.started_at - timedelta(**delta)
        if s.emergency_requested_at:
            s.emergency_requested_at = s.emergency_requested_at - timedelta(**delta)
        db.commit()


def finish_lesson(client, unit="A1-G011"):
    n = len(client.get(f"/api/lessons/{unit}/steps").json()["steps"])
    client.put(f"/api/progress/{unit}", json={"current_step": n - 1})
    assert client.post(f"/api/lessons/{unit}/complete").status_code == 200


def test_session_unlocks_only_when_all_goals_are_met(client):
    assert client.get("/api/focus/status").json()["locked"] is False
    assert client.post("/api/focus/start", json={"lessons": 0, "minutes": 0}).status_code == 422
    s = client.post("/api/focus/start", json={"lessons": 1, "minutes": 1}).json()
    assert s["status"] == "active" and s["max_minutes"] >= 31
    assert client.post("/api/focus/start", json={"lessons": 1}).status_code == 409  # one at a time
    assert client.get("/api/focus/status").json()["locked"]
    finish_lesson(client)  # lesson goal met, minutes not yet
    st = client.get("/api/focus/status").json()
    assert st["locked"] and st["session"]["lessons_done"] == ["A1-G011"]
    for _ in range(5):  # study time is counted from real heartbeats (15 s for the first, then the gap)
        client.post("/api/activity/heartbeat", json={"activity": "vocab"})
    with client.app.state.sessionmaker() as db:  # make the gaps count as ~70 s of study
        from app.models import User
        u = db.get(User, 1)
        u.last_heartbeat = utcnow() - timedelta(seconds=70)
        db.commit()
    client.post("/api/activity/heartbeat", json={"activity": "vocab"})
    st = client.get("/api/focus/status").json()
    assert st["locked"] is False and st["session"]["status"] == "completed" and st["session"]["minutes_done"] >= 1


def test_settings_cannot_change_during_a_session_and_pin_is_hashed(client):
    assert client.put("/api/focus/settings", json={"pin": "12"}).status_code == 422
    out = client.put("/api/focus/settings", json={"pin": "2468", "default_minutes": 45}).json()
    assert out["pin_set"] and out["default_minutes"] == 45 and "2468" not in str(out)
    client.post("/api/focus/start", json={"minutes": 30})
    assert client.put("/api/focus/settings", json={"clear_pin": True}).status_code == 409


def test_emergency_unlock_needs_wait_and_pin(client, app):
    client.put("/api/focus/settings", json={"pin": "2468"})
    client.post("/api/focus/start", json={"lessons": 3})
    assert client.post("/api/focus/emergency/confirm", json={"pin": "2468"}).status_code == 409  # must request first
    r = client.post("/api/focus/emergency/request").json()
    assert r["emergency"]["wait_seconds"] == 60
    assert client.post("/api/focus/emergency/confirm", json={"pin": "2468"}).status_code == 409  # 60 s not over
    shift(app, seconds=61)
    assert client.post("/api/focus/emergency/confirm", json={"pin": "0000"}).status_code == 403
    r = client.post("/api/focus/emergency/confirm", json={"pin": "2468"}).json()
    assert r["status"] == "emergency" and client.get("/api/focus/status").json()["locked"] is False


def test_phrase_unlock_when_no_pin(client, app):
    client.post("/api/focus/start", json={"lessons": 3})
    client.post("/api/focus/emergency/request")
    shift(app, seconds=61)
    assert client.post("/api/focus/emergency/confirm", json={"phrase": "cho tôi ra"}).status_code == 403
    assert client.post("/api/focus/emergency/confirm", json={"phrase": "Tôi muốn dừng học"}).json()["status"] == "emergency"


def test_safety_limit_cancel_window_and_native_escape(client, app):
    s = client.post("/api/focus/start", json={"minutes": 20, "max_minutes": 30}).json()
    assert s["max_minutes"] == 50  # never shorter than the time goal + 30 min
    assert client.post("/api/focus/cancel").json()["status"] == "cancelled"  # within 60 s
    client.post("/api/focus/start", json={"lessons": 2, "max_minutes": 30})
    shift(app, seconds=90)
    assert client.post("/api/focus/cancel").status_code == 409
    shift(app, minutes=30)
    st = client.get("/api/focus/status").json()
    assert st["locked"] is False and st["session"]["status"] == "expired"
    s = client.post("/api/focus/start", json={"lessons": 1}).json()
    client.post("/api/focus/emergency/native", json={"session_id": s["id"]})
    assert client.get("/api/focus/status").json()["locked"] is False
    assert sorted(h["status"] for h in client.get("/api/focus/history").json()) == ["cancelled", "emergency", "expired"]
