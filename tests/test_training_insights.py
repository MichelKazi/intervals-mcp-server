"""Tests for the polars-based training analytics engine."""

import asyncio
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.tools.aerobic_development import get_aerobic_development
from intervals_mcp_server.tools.fatigue_risk import get_fatigue_risk
from intervals_mcp_server.tools.power_progression import get_power_progression
from intervals_mcp_server.tools.recovery_patterns import get_recovery_patterns
from intervals_mcp_server.tools.training_insights import get_training_insights


def _make_activities(n=20, base_load=80):
    """Generate fake activity dicts spanning multiple weeks."""
    from datetime import datetime, timedelta

    acts = []
    start = datetime(2024, 3, 1)
    for i in range(n):
        d = start + timedelta(days=i * 2)
        acts.append({
            "id": f"a{i}",
            "start_date_local": d.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride" if i % 3 != 0 else "Run",
            "name": f"Activity {i}",
            "moving_time": 3600 + i * 120,
            "distance": 30000 + i * 1000,
            "icu_training_load": base_load + i * 3,
            "icu_average_watts": 200 + i * 2,
            "average_heartrate": 140 + (i % 5),
            "icu_efficiency_factor": 1.4 + i * 0.01,
            "decoupling": 3.0 + (i % 4) * 0.5,
        })
    return acts


def _make_wellness(n=28):
    """Generate fake wellness dicts."""
    from datetime import datetime, timedelta

    entries = []
    start = datetime(2024, 3, 1)
    for i in range(n):
        d = start + timedelta(days=i)
        entries.append({
            "id": d.strftime("%Y-%m-%d"),
            "ctl": 60 + i * 0.5,
            "atl": 55 + i * 0.7,
            "rampRate": 0.5,
            "hrv": 45 + (i % 7),
            "restingHR": 52 + (i % 3),
            "sleepSecs": 25200 + i * 300,
            "sleepQuality": 2,
            "weight": 72.0,
            "soreness": 3,
            "fatigue": 4,
            "stress": 3,
            "mood": 7,
            "motivation": 8,
        })
    return entries


def test_activities_frame():
    acts = _make_activities(10)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    assert len(df) == 10
    assert "load" in df.columns
    assert "date" in df.columns
    assert df["load"].sum() > 0


def test_wellness_frame():
    well = _make_wellness(14)
    analytics = TrainingAnalytics()
    df = analytics.wellness_frame(well)
    assert len(df) == 14
    assert "ctl" in df.columns
    assert "hrv" in df.columns


def test_load_trend():
    acts = _make_activities(30, base_load=60)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    trend = analytics.load_trend(df, weeks=6)
    assert "weeks" in trend
    assert len(trend["weeks"]) > 0
    assert trend["current_load"] > 0


def test_efficiency_trend():
    acts = _make_activities(20)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    eff = analytics.efficiency_trend(df, weeks=6)
    assert "weeks" in eff
    assert len(eff["weeks"]) > 0
    assert eff["trend_pct"] is not None


def test_wellness_trends():
    well = _make_wellness(28)
    analytics = TrainingAnalytics()
    wf = analytics.wellness_frame(well)
    trends = analytics.wellness_trends(wf, days=28)
    assert "hrv" in trends
    assert "resting_hr" in trends
    assert "tsb" in trends
    assert trends["hrv"]["current"] > 0


def test_standout_efforts():
    acts = _make_activities(20, base_load=60)
    # Add one outlier
    acts.append({
        "id": "outlier",
        "start_date_local": "2024-03-30T08:00:00",
        "type": "Ride",
        "name": "Big Effort",
        "moving_time": 14400,
        "distance": 120000,
        "icu_training_load": 350,
        "icu_average_watts": 280,
        "average_heartrate": 155,
    })
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    standouts = analytics.standout_efforts(df, days=60)
    assert len(standouts) > 0
    assert any(s["name"] == "Big Effort" for s in standouts)


def test_sport_distribution():
    acts = _make_activities(15)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    dist = analytics.sport_distribution(df)
    assert len(dist) == 2  # Ride + Run
    types = [d["type"] for d in dist]
    assert "Ride" in types
    assert "Run" in types


def test_get_training_insights_tool(monkeypatch):
    """Integration test: the MCP tool returns formatted output."""
    acts = _make_activities(20)
    well = _make_wellness(28)

    async def fake_request(*_args, **kwargs):
        url = kwargs.get("url", _args[0] if _args else "")
        if "wellness" in url:
            return well
        return acts

    monkeypatch.setattr("intervals_mcp_server.tools.training_insights.make_intervals_request", fake_request)

    result = asyncio.run(get_training_insights(athlete_id="i1", period="6w"))
    assert "Training Insights" in result
    assert "Load Progression:" in result
    assert "Aerobic Efficiency:" in result
    assert "Wellness Signals:" in result
    assert "Sport Mix:" in result


def test_fatigue_risk():
    """Test ACWR computation with enough data."""
    acts = _make_activities(40, base_load=70)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    risk = analytics.fatigue_risk(df)
    assert risk["current_acwr"] is not None
    assert risk["risk_band"] in ("undertrained", "sweet spot", "caution", "danger")
    assert len(risk["days"]) > 0


def test_fatigue_risk_insufficient_data():
    """Test ACWR with too little data."""
    acts = _make_activities(3, base_load=70)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    risk = analytics.fatigue_risk(df)
    assert risk["risk_band"] == "insufficient data"


def test_fatigue_risk_tool(monkeypatch):
    """Integration test for the fatigue risk tool."""
    acts = _make_activities(40, base_load=70)

    async def fake_request(*_args, **_kwargs):
        return acts

    monkeypatch.setattr("intervals_mcp_server.tools.fatigue_risk.make_intervals_request", fake_request)

    result = asyncio.run(get_fatigue_risk(athlete_id="i1"))
    assert "Fatigue Risk Assessment" in result
    assert "ACWR" in result


def test_power_curve_progression():
    """Test power curve comparison."""
    recent = [None] * 3601
    baseline = [None] * 3601
    # Fill key durations
    for secs, recent_w, baseline_w in [(5, 900, 950), (60, 400, 420), (300, 300, 310), (1200, 270, 280), (3600, 240, 250)]:
        recent[secs] = recent_w
        baseline[secs] = baseline_w

    analytics = TrainingAnalytics()
    result = analytics.power_curve_progression(recent, baseline)
    assert "comparisons" in result
    assert len(result["comparisons"]) >= 4
    assert result["profile"] in ("sprinter/neuromuscular", "puncheur/anaerobic", "time trialist/aerobic", "all-rounder")
    # Check pct_of_best is computed
    for c in result["comparisons"]:
        if c.get("pct_of_best"):
            assert 80 < c["pct_of_best"] < 100


def test_power_progression_tool(monkeypatch):
    """Integration test for the power progression tool."""
    curve = [None] * 3601
    for secs, watts in [(5, 900), (30, 600), (60, 400), (300, 300), (1200, 270), (3600, 240)]:
        curve[secs] = watts

    async def fake_request(*_args, **kwargs):
        url = kwargs.get("url", "")
        if "power-curves" in url:
            return curve
        # Athlete endpoint for weight
        return {"weight": 72.0}

    monkeypatch.setattr("intervals_mcp_server.tools.power_progression.make_intervals_request", fake_request)

    result = asyncio.run(get_power_progression(athlete_id="i1"))
    assert "Power Curve Progression" in result
    assert "W/kg" in result
    assert "Profile:" in result


def test_recovery_patterns():
    """Test recovery pattern correlation analysis."""
    from datetime import datetime, timedelta

    # Create activities and wellness with known correlation:
    # higher sleep → higher load next day
    acts = []
    wellness = []
    start = datetime(2024, 3, 1)
    for i in range(30):
        d = start + timedelta(days=i)
        sleep_hours = 6 + (i % 3)  # varies 6-8h
        load = 60 + (i % 3) * 20  # correlates with sleep pattern

        wellness.append({
            "id": d.strftime("%Y-%m-%d"),
            "ctl": 60, "atl": 55,
            "hrv": 45 + (i % 5),
            "restingHR": 52,
            "sleepSecs": sleep_hours * 3600,
            "soreness": 3,
            "fatigue": 4,
            "stress": 3,
            "mood": 7,
            "motivation": 8,
        })
        # Activity is on the next day (so it correlates with prior-day wellness)
        act_date = d + timedelta(days=1)
        acts.append({
            "id": f"a{i}",
            "start_date_local": act_date.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride",
            "name": f"Ride {i}",
            "moving_time": 3600,
            "distance": 30000,
            "icu_training_load": load,
            "icu_average_watts": 200 + (i % 3) * 10,
            "average_heartrate": 140,
        })

    analytics = TrainingAnalytics()
    af = analytics.activities_frame(acts)
    wf = analytics.wellness_frame(wellness)
    result = analytics.recovery_patterns(af, wf, lookback_days=60)

    assert result["sample_size"] > 0
    # Should find sleep correlation since we made it deterministic
    assert len(result["correlations"]) > 0 or len(result["patterns"]) > 0


def test_recovery_patterns_tool(monkeypatch):
    """Integration test for recovery patterns tool."""
    from datetime import datetime, timedelta

    acts = []
    wellness = []
    start = datetime(2024, 3, 1)
    for i in range(30):
        d = start + timedelta(days=i)
        wellness.append({
            "id": d.strftime("%Y-%m-%d"),
            "ctl": 60, "atl": 55,
            "hrv": 45 + (i % 7),
            "restingHR": 52 + (i % 3),
            "sleepSecs": 25200 + i * 300,
            "soreness": 3 + (i % 3),
            "fatigue": 4,
            "stress": 3,
            "mood": 7,
            "motivation": 8,
        })
        act_date = d + timedelta(days=1)
        acts.append({
            "id": f"a{i}",
            "start_date_local": act_date.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride",
            "name": f"Ride {i}",
            "moving_time": 3600,
            "distance": 30000,
            "icu_training_load": 70 + i * 2,
            "icu_average_watts": 200 + i,
            "average_heartrate": 140,
        })

    async def fake_request(*_args, **kwargs):
        url = kwargs.get("url", "")
        if "wellness" in url:
            return wellness
        return acts

    monkeypatch.setattr("intervals_mcp_server.tools.recovery_patterns.make_intervals_request", fake_request)

    result = asyncio.run(get_recovery_patterns(athlete_id="i1", days=60))
    assert "Recovery Pattern Analysis" in result
    assert "paired days" in result


def test_recovery_patterns_insufficient_data(monkeypatch):
    """Test graceful handling when not enough paired data."""

    async def fake_request(*_args, **kwargs):
        url = kwargs.get("url", "")
        if "wellness" in url:
            return [{"id": "2024-03-01", "ctl": 60, "atl": 55}]
        return [{"id": "a1", "start_date_local": "2024-03-05T08:00:00", "type": "Ride", "name": "Ride", "moving_time": 3600, "icu_training_load": 80}]

    monkeypatch.setattr("intervals_mcp_server.tools.recovery_patterns.make_intervals_request", fake_request)

    result = asyncio.run(get_recovery_patterns(athlete_id="i1", days=60))
    assert "Insufficient paired data" in result


def test_missing_wellness_fields():
    """Test that analytics handle sparse wellness data gracefully."""
    sparse_wellness = [
        {"id": "2024-03-01", "ctl": 60, "atl": 55},
        {"id": "2024-03-02", "hrv": 45},
        {"id": "2024-03-03", "sleepSecs": 28800, "ctl": 62, "atl": 57},
    ]
    analytics = TrainingAnalytics()
    wf = analytics.wellness_frame(sparse_wellness)
    assert len(wf) == 3
    trends = analytics.wellness_trends(wf, days=28)
    # Should still compute TSB from whatever CTL/ATL is available
    assert "tsb" in trends


def test_missing_activity_fields():
    """Test that analytics handle activities with missing power/HR gracefully."""
    sparse_acts = [
        {"id": "a1", "start_date_local": "2024-03-01T08:00:00", "type": "Ride", "name": "Ride 1", "moving_time": 3600, "icu_training_load": 80},
        {"id": "a2", "start_date_local": "2024-03-03T08:00:00", "type": "Run", "name": "Run 1", "moving_time": 2400, "icu_training_load": 50},
        {"id": "a3", "start_date_local": "2024-03-05T08:00:00", "type": "Ride", "name": "Ride 2", "moving_time": 5400, "icu_training_load": 120, "icu_average_watts": 220, "average_heartrate": 145},
    ]
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(sparse_acts)
    assert len(df) == 3
    # Efficiency should only use the one activity with both power and HR
    eff = analytics.efficiency_trend(df, weeks=4)
    assert "weeks" in eff
    # Load trend should work fine
    trend = analytics.load_trend(df, weeks=4)
    assert trend["current_load"] > 0


def _make_aerobic_activities(n=25):
    """Generate activities with decoupling data for aerobic development tests."""
    from datetime import datetime, timedelta

    acts = []
    start = datetime(2024, 2, 1)
    for i in range(n):
        d = start + timedelta(days=i * 3)
        # Vary duration between 1h and 4h
        duration_secs = 3600 + (i % 5) * 1800
        # Drift increases with duration, improves over time
        base_drift = 2.0 + (duration_secs / 3600) * 1.5
        time_improvement = i * 0.08  # drift improves over time
        drift = max(0.5, base_drift - time_improvement + (i % 3) * 0.5)

        acts.append({
            "id": f"a{i}",
            "start_date_local": d.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride",
            "name": f"Ride {i}",
            "moving_time": duration_secs,
            "distance": 30000 + duration_secs * 8,
            "icu_training_load": 50 + duration_secs // 60,
            "icu_average_watts": 190 + (i % 5) * 5,
            "average_heartrate": 135 + (i % 4),
            "icu_weighted_avg_watts": 200 + (i % 5) * 5,
            "icu_intensity": 0.65 + (i % 4) * 0.03,
            "decoupling": drift,
        })
    return acts


def test_aerobic_development():
    """Test aerobic development analysis with sufficient data."""
    acts = _make_aerobic_activities(25)
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    dev = analytics.aerobic_development(df)

    assert dev["status"] == "ok"
    assert dev["activities_analyzed"] >= 20
    assert len(dev["duration_drift"]) > 0
    assert dev["trend"] is not None
    assert dev["trend"]["direction"] in ("improving", "declining", "stable")


def test_aerobic_development_insufficient_data():
    """Test graceful handling with too few activities."""
    acts = [
        {"id": "a1", "start_date_local": "2024-03-01T08:00:00", "type": "Ride", "name": "Ride 1",
         "moving_time": 3600, "icu_training_load": 80, "decoupling": 3.5},
    ]
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    dev = analytics.aerobic_development(df)
    assert dev["status"] == "insufficient data"


def test_aerobic_development_no_decoupling():
    """Test graceful handling when no activities have decoupling data."""
    from datetime import datetime, timedelta

    acts = []
    start = datetime(2024, 3, 1)
    for i in range(10):
        d = start + timedelta(days=i * 2)
        acts.append({
            "id": f"a{i}",
            "start_date_local": d.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride",
            "name": f"Ride {i}",
            "moving_time": 3600,
            "icu_training_load": 80,
            "icu_average_watts": 200,
            "average_heartrate": 140,
            # no decoupling field
        })
    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    dev = analytics.aerobic_development(df)
    assert dev["status"] == "insufficient data"


def test_aerobic_development_tool(monkeypatch):
    """Integration test for the aerobic development tool."""
    acts = _make_aerobic_activities(25)

    async def fake_request(*_args, **_kwargs):
        return acts

    monkeypatch.setattr("intervals_mcp_server.tools.aerobic_development.make_intervals_request", fake_request)

    result = asyncio.run(get_aerobic_development(athlete_id="i1", weeks=12))
    assert "Aerobic Development Analysis" in result
    assert "Drift by Duration:" in result
    assert "Drift Trend" in result


def test_custom_wellness_fields_in_frame():
    """Test that custom numeric fields (e.g. peptide doses) are captured in the wellness frame."""
    wellness = [
        {"id": "2024-03-01", "ctl": 60, "atl": 55, "hrv": 45, "bpc157_mcg": 250, "tb500_mg": 2.5},
        {"id": "2024-03-02", "ctl": 61, "atl": 56, "hrv": 48, "bpc157_mcg": 250, "tb500_mg": 2.5},
        {"id": "2024-03-03", "ctl": 62, "atl": 57, "hrv": 42, "bpc157_mcg": 0, "tb500_mg": 0},
    ]
    analytics = TrainingAnalytics()
    wf = analytics.wellness_frame(wellness)
    assert "bpc157_mcg" in wf.columns
    assert "tb500_mg" in wf.columns
    assert wf["bpc157_mcg"].to_list() == [250, 250, 0]
    assert wf["tb500_mg"].to_list() == [2.5, 2.5, 0.0]


def test_custom_fields_in_recovery_patterns():
    """Test that custom wellness fields are correlated with performance in recovery patterns."""
    from datetime import datetime, timedelta

    acts = []
    wellness = []
    start = datetime(2024, 3, 1)
    for i in range(30):
        d = start + timedelta(days=i)
        # Peptide on/off cycle: on days 0-14, off days 15-29
        dose = 250 if i < 15 else 0
        # Performance correlates with dose (load higher when on peptide)
        load = 90 + (20 if i < 15 else 0) + (i % 5) * 3

        wellness.append({
            "id": d.strftime("%Y-%m-%d"),
            "ctl": 60, "atl": 55, "hrv": 45,
            "bpc157_mcg": dose,
        })
        act_date = d + timedelta(days=1)
        acts.append({
            "id": f"a{i}",
            "start_date_local": act_date.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride",
            "name": f"Ride {i}",
            "moving_time": 3600,
            "distance": 30000,
            "icu_training_load": load,
            "icu_average_watts": 200 + (10 if i < 15 else 0),
            "average_heartrate": 140,
        })

    analytics = TrainingAnalytics()
    af = analytics.activities_frame(acts)
    wf = analytics.wellness_frame(wellness)
    result = analytics.recovery_patterns(af, wf, lookback_days=60)

    # Should find bpc157_mcg in the correlations or patterns
    all_metrics = [c["wellness_metric"] for c in result["correlations"]]
    all_pattern_metrics = [p["metric"] for p in result.get("patterns", [])]
    assert "bpc157_mcg" in all_metrics or "bpc157_mcg" in all_pattern_metrics


def test_custom_fields_in_wellness_trends():
    """Test that custom fields get z-scores in wellness_trends."""
    wellness = [{"id": f"2024-03-{i+1:02d}", "ctl": 60, "atl": 55, "bpc157_mcg": 250} for i in range(28)]
    # Last day is 0 (off day)
    wellness[-1]["bpc157_mcg"] = 0

    analytics = TrainingAnalytics()
    wf = analytics.wellness_frame(wellness)
    trends = analytics.wellness_trends(wf, days=28)
    # Custom field should appear in trends with z-score
    assert "bpc157_mcg" in trends
    # 0 vs mean of ~241 should give a negative z-score
    assert trends["bpc157_mcg"]["z_score"] < 0


def test_aerobic_development_concerning_rides():
    """Test that concerning rides (high drift at low IF) are flagged."""
    from datetime import datetime, timedelta

    acts = []
    start = datetime(2024, 3, 1)
    for i in range(15):
        d = start + timedelta(days=i * 2)
        acts.append({
            "id": f"a{i}",
            "start_date_local": d.strftime("%Y-%m-%dT08:00:00"),
            "type": "Ride",
            "name": f"Ride {i}",
            "moving_time": 5400,
            "icu_training_load": 70,
            "icu_average_watts": 180,
            "average_heartrate": 140,
            "icu_weighted_avg_watts": 190,
            "icu_intensity": 0.68,  # low intensity
            "decoupling": 7.5 if i < 3 else 3.0,  # first 3 have bad drift
        })

    analytics = TrainingAnalytics()
    df = analytics.activities_frame(acts)
    dev = analytics.aerobic_development(df)

    assert dev["status"] == "ok"
    assert len(dev["concerning_rides"]) > 0
    assert dev["concerning_rides"][0]["drift"] > 5.0
