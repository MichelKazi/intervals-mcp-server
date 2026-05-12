"""
Formatting utilities for Intervals.icu MCP Server

This module contains formatting functions for handling data from the Intervals.icu API.
"""

import json
from datetime import datetime
from typing import Any


class _KeyTracker(dict):
    """A dict wrapper that records which keys are accessed."""

    def __init__(self, data: dict[str, Any]) -> None:
        super().__init__(data)
        self.accessed: set[str] = set()

    def get(self, key: str, default: Any = None) -> Any:
        self.accessed.add(key)
        return super().get(key, default)

    def __getitem__(self, key: str) -> Any:
        self.accessed.add(key)
        return super().__getitem__(key)

    def __contains__(self, key: object) -> bool:
        if isinstance(key, str):
            self.accessed.add(key)
        return super().__contains__(key)


def _fmt_time(raw: str | None) -> str | None:
    """Parse an ISO timestamp into a short readable string, or return None."""
    if not raw or not isinstance(raw, str):
        return None
    if len(raw) > 10:
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass
    return raw


def _has_value(val: Any) -> bool:
    """Return True if a value is meaningful (not None, not 0, not empty)."""
    if val is None:
        return False
    if isinstance(val, (int, float)) and val == 0:
        return False
    if isinstance(val, str) and not val.strip():
        return False
    return True


def _first_of(data: dict[str, Any], *keys: str) -> Any:
    """Return the first non-None value for the given keys."""
    for k in keys:
        val = data.get(k)
        if val is not None:
            return val
    return None


def _emit(lines: list[str], label: str, val: Any, unit: str = "") -> None:
    """Append a formatted line only if the value is meaningful."""
    if not _has_value(val):
        return
    suffix = f" {unit}" if unit else ""
    lines.append(f"  {label}: {val}{suffix}")


def format_activity_summary(activity: dict[str, Any]) -> str:
    """Format an activity into a readable string, omitting fields without data."""
    name = activity.get("name", "Unnamed")
    act_id = activity.get("id", "?")
    act_type = activity.get("type", "Unknown")
    start_time = _fmt_time(activity.get("startTime") or activity.get("start_date"))

    lines = [f"Activity: {name} [{act_type}] (ID: {act_id})"]
    if start_time:
        lines.append(f"  Date: {start_time}")
    if _has_value(activity.get("description")):
        lines.append(f"  Description: {activity['description']}")

    # Core metrics
    _emit(lines, "Distance", activity.get("distance"), "m")
    duration = _first_of(activity, "duration", "elapsed_time")
    _emit(lines, "Duration", duration, "s")
    _emit(lines, "Moving Time", activity.get("moving_time"), "s")
    elev_gain = _first_of(activity, "elevationGain", "total_elevation_gain")
    _emit(lines, "Elevation Gain", elev_gain, "m")
    _emit(lines, "Elevation Loss", activity.get("total_elevation_loss"), "m")

    # Power
    avg_power = _first_of(activity, "avgPower", "icu_average_watts", "average_watts")
    power_lines: list[str] = []
    _emit(power_lines, "Avg Power", avg_power, "W")
    _emit(power_lines, "Weighted Avg", activity.get("icu_weighted_avg_watts"), "W")
    _emit(power_lines, "Training Load", _first_of(activity, "trainingLoad", "icu_training_load"))
    _emit(power_lines, "FTP", activity.get("icu_ftp"), "W")
    _emit(power_lines, "kJ", activity.get("icu_joules"))
    _emit(power_lines, "Intensity", activity.get("icu_intensity"))
    _emit(power_lines, "Power:HR", activity.get("icu_power_hr"))
    _emit(power_lines, "VI", activity.get("icu_variability_index"))
    if power_lines:
        lines.append("Power:")
        lines.extend(power_lines)

    # Heart rate
    avg_hr = _first_of(activity, "avgHr", "average_heartrate")
    hr_lines: list[str] = []
    _emit(hr_lines, "Avg HR", avg_hr, "bpm")
    _emit(hr_lines, "Max HR", activity.get("max_heartrate"), "bpm")
    _emit(hr_lines, "LTHR", activity.get("lthr"), "bpm")
    _emit(hr_lines, "Resting HR", activity.get("icu_resting_hr"), "bpm")
    _emit(hr_lines, "Decoupling", activity.get("decoupling"))
    if hr_lines:
        lines.append("Heart Rate:")
        lines.extend(hr_lines)

    # Speed / cadence
    other_lines: list[str] = []
    _emit(other_lines, "Avg Speed", activity.get("average_speed"), "m/s")
    _emit(other_lines, "Max Speed", activity.get("max_speed"), "m/s")
    _emit(other_lines, "Cadence", activity.get("average_cadence"), "rpm")
    _emit(other_lines, "Avg Stride", activity.get("average_stride"))
    _emit(other_lines, "L/R Balance", activity.get("avg_lr_balance"))
    _emit(other_lines, "Calories", activity.get("calories"), "kcal")
    # RPE / feel
    rpe = _first_of(activity, "perceived_exertion", "icu_rpe")
    if _has_value(rpe):
        other_lines.append(f"  RPE: {rpe}/10")
    feel = activity.get("feel")
    if _has_value(feel):
        other_lines.append(f"  Feel: {feel}/5")
    _emit(other_lines, "Session RPE", activity.get("session_rpe"))
    _emit(other_lines, "Weight", activity.get("icu_weight"), "kg")
    if other_lines:
        lines.append("Metrics:")
        lines.extend(other_lines)

    # Environment
    env_lines: list[str] = []
    trainer = activity.get("trainer")
    if trainer is True:
        env_lines.append("  Indoor/Trainer: Yes")
    _emit(env_lines, "Avg Temp", activity.get("average_temp"), "°C")
    _emit(env_lines, "Avg Wind", activity.get("average_wind_speed"), "km/h")
    if env_lines:
        lines.append("Environment:")
        lines.extend(env_lines)

    # Training load
    tl_lines: list[str] = []
    _emit(tl_lines, "CTL", activity.get("icu_ctl"))
    _emit(tl_lines, "ATL", activity.get("icu_atl"))
    _emit(tl_lines, "TRIMP", activity.get("trimp"))
    _emit(tl_lines, "Efficiency Factor", activity.get("icu_efficiency_factor"))
    _emit(tl_lines, "Polarization Index", activity.get("polarization_index"))
    if tl_lines:
        lines.append("Training:")
        lines.extend(tl_lines)

    # Device
    dev_lines: list[str] = []
    _emit(dev_lines, "Device", activity.get("device_name"))
    _emit(dev_lines, "Power Meter", activity.get("power_meter"))
    if dev_lines:
        lines.extend(dev_lines)

    return "\n".join(lines) + "\n"


def format_workout(workout: dict[str, Any]) -> str:
    """Format a workout into a readable string."""
    return f"""
Workout: {workout.get("name", "Unnamed")}
Description: {workout.get("description", "No description")}
Sport: {workout.get("sport", "Unknown")}
Duration: {workout.get("duration", 0)} seconds
TSS: {workout.get("tss", "N/A")}
Intervals: {len(workout.get("intervals", []))}
"""


def _format_training_metrics(entries: dict[str, Any]) -> list[str]:
    """Format training metrics section."""
    training_metrics = []
    for k, label in [
        ("ctl", "Fitness (CTL)"),
        ("atl", "Fatigue (ATL)"),
        ("rampRate", "Ramp Rate"),
        ("ctlLoad", "CTL Load"),
        ("atlLoad", "ATL Load"),
    ]:
        if entries.get(k) is not None:
            training_metrics.append(f"- {label}: {entries[k]}")
    return training_metrics


def _format_sport_info(entries: dict[str, Any]) -> list[str]:
    """Format sport-specific info section."""
    sport_info_list = []
    if entries.get("sportInfo"):
        for sport in entries.get("sportInfo", []):
            if isinstance(sport, dict) and sport.get("eftp") is not None:
                sport_info_list.append(f"- {sport.get('type')}: eFTP = {sport['eftp']}")
    return sport_info_list


def _format_vital_signs(entries: dict[str, Any]) -> list[str]:
    """Format vital signs section."""
    vital_signs = []
    for k, label, unit in [
        ("weight", "Weight", "kg"),
        ("restingHR", "Resting HR", "bpm"),
        ("hrv", "HRV", ""),
        ("hrvSDNN", "HRV SDNN", ""),
        ("avgSleepingHR", "Average Sleeping HR", "bpm"),
        ("spO2", "SpO2", "%"),
        ("systolic", "Systolic BP", ""),
        ("diastolic", "Diastolic BP", ""),
        ("respiration", "Respiration", "breaths/min"),
        ("bloodGlucose", "Blood Glucose", "mmol/L"),
        ("lactate", "Lactate", "mmol/L"),
        ("vo2max", "VO2 Max", "ml/kg/min"),
        ("bodyFat", "Body Fat", "%"),
        ("abdomen", "Abdomen", "cm"),
        ("baevskySI", "Baevsky Stress Index", ""),
    ]:
        if entries.get(k) is not None:
            value = entries[k]
            if k == "systolic" and entries.get("diastolic") is not None:
                vital_signs.append(
                    f"- Blood Pressure: {entries['systolic']}/{entries['diastolic']} mmHg"
                )
            elif k not in ("systolic", "diastolic"):
                vital_signs.append(f"- {label}: {value}{(' ' + unit) if unit else ''}")
    return vital_signs


def _format_sleep_recovery(entries: dict[str, Any]) -> list[str]:
    """Format sleep and recovery section."""
    sleep_lines = []
    sleep_hours = None
    if entries.get("sleepSecs") is not None:
        sleep_hours = f"{entries['sleepSecs'] / 3600:.2f}"
    elif entries.get("sleepHours") is not None:
        sleep_hours = f"{entries['sleepHours']}"
    if sleep_hours is not None:
        sleep_lines.append(f"  Sleep: {sleep_hours} hours")

    if entries.get("sleepQuality") is not None:
        quality_value = entries["sleepQuality"]
        quality_labels = {1: "Great", 2: "Good", 3: "Average", 4: "Poor"}
        quality_text = quality_labels.get(quality_value, str(quality_value))
        sleep_lines.append(f"  Sleep Quality: {quality_value} ({quality_text})")

    if entries.get("sleepScore") is not None:
        sleep_lines.append(f"  Device Sleep Score: {entries['sleepScore']}/100")

    if entries.get("readiness") is not None:
        sleep_lines.append(f"  Readiness: {entries['readiness']}/10")

    return sleep_lines


def _format_menstrual_tracking(entries: dict[str, Any]) -> list[str]:
    """Format menstrual tracking section."""
    menstrual_lines = []
    if entries.get("menstrualPhase") is not None:
        menstrual_lines.append(f"  Menstrual Phase: {str(entries['menstrualPhase']).capitalize()}")
    if entries.get("menstrualPhasePredicted") is not None:
        menstrual_lines.append(
            f"  Predicted Phase: {str(entries['menstrualPhasePredicted']).capitalize()}"
        )
    return menstrual_lines


def _format_subjective_feelings(entries: dict[str, Any]) -> list[str]:
    """Format subjective feelings section."""
    subjective_lines = []
    for k, label in [
        ("soreness", "Soreness"),
        ("fatigue", "Fatigue"),
        ("stress", "Stress"),
        ("mood", "Mood"),
        ("motivation", "Motivation"),
        ("injury", "Injury Level"),
    ]:
        if entries.get(k) is not None:
            subjective_lines.append(f"  {label}: {entries[k]}/10")
    return subjective_lines


def _format_nutrition_hydration(entries: dict[str, Any]) -> list[str]:
    """Format nutrition and hydration section.

    Handles both legacy fields (kcalConsumed, hydrationVolume) and the native
    macro fields from the Intervals.icu API (carbohydrates, protein,
    fatTotal). All fields are rendered conditionally — a null/missing value
    hides the corresponding line for backward compatibility with older
    wellness records.
    """
    nutrition_lines = []
    for k, label, unit in [
        ("kcalConsumed", "Calories Consumed", ""),
        ("carbohydrates", "Carbohydrates", "g"),
        ("protein", "Protein", "g"),
        ("fatTotal", "Fat", "g"),
        ("hydrationVolume", "Hydration Volume", ""),
    ]:
        if entries.get(k) is not None:
            suffix = f" {unit}" if unit else ""
            nutrition_lines.append(f"- {label}: {entries[k]}{suffix}")

    if entries.get("hydration") is not None:
        nutrition_lines.append(f"  Hydration Score: {entries['hydration']}/10")

    return nutrition_lines


def _format_other_fields(entries: dict[str, Any], known_keys: set[str]) -> list[str]:
    """Format any fields not already handled by the standard formatting sections."""
    other_lines = []
    for key, value in entries.items():
        if key not in known_keys and value is not None:
            if isinstance(value, (dict, list)):
                other_lines.append(f"- {key}: {json.dumps(value)}")
            else:
                other_lines.append(f"- {key}: {value}")
    return other_lines


def format_wellness_entry(entries: dict[str, Any], include_all_fields: bool = False) -> str:
    """Format wellness entry data into a readable string.

    Formats various wellness metrics including training metrics, vital signs,
    sleep data, menstrual tracking, subjective feelings, nutrition, and activity.

    Args:
        entries: Dictionary containing wellness data fields such as:
            - Training metrics: ctl, atl, rampRate, ctlLoad, atlLoad
            - Vital signs: weight, restingHR, hrv, hrvSDNN, avgSleepingHR, spO2,
              systolic, diastolic, respiration, bloodGlucose, lactate, vo2max,
              bodyFat, abdomen, baevskySI
            - Sleep: sleepSecs, sleepHours, sleepQuality, sleepScore, readiness
            - Menstrual: menstrualPhase, menstrualPhasePredicted
            - Subjective: soreness, fatigue, stress, mood, motivation, injury
            - Nutrition: kcalConsumed, carbohydrates, protein, fatTotal, hydrationVolume, hydration
            - Activity: steps
            - Other: comments, locked, date
        include_all_fields: If True, any fields not covered by the standard
            sections are appended under an "Other Fields" heading (default False).

    Returns:
        A formatted string representation of the wellness entry.
    """
    tracker: _KeyTracker | None = None
    if include_all_fields:
        tracker = _KeyTracker(entries)
        entries = tracker
        # Mark metadata/internal keys so they don't appear in "Other Fields"
        entries.get("date")
        entries.get("updated")
        entries.get("tempWeight")
        entries.get("tempRestingHR")

    lines = ["Wellness Data:"]
    lines.append(f"Date: {entries.get('id', 'N/A')}")
    lines.append("")

    training_metrics = _format_training_metrics(entries)
    if training_metrics:
        lines.append("Training Metrics:")
        lines.extend(training_metrics)
        lines.append("")

    sport_info_list = _format_sport_info(entries)
    if sport_info_list:
        lines.append("Sport-Specific Info:")
        lines.extend(sport_info_list)
        lines.append("")

    vital_signs = _format_vital_signs(entries)
    if vital_signs:
        lines.append("Vital Signs:")
        lines.extend(vital_signs)
        lines.append("")

    sleep_lines = _format_sleep_recovery(entries)
    if sleep_lines:
        lines.append("Sleep & Recovery:")
        lines.extend(sleep_lines)
        lines.append("")

    menstrual_lines = _format_menstrual_tracking(entries)
    if menstrual_lines:
        lines.append("Menstrual Tracking:")
        lines.extend(menstrual_lines)
        lines.append("")

    subjective_lines = _format_subjective_feelings(entries)
    if subjective_lines:
        lines.append("Subjective Feelings:")
        lines.extend(subjective_lines)
        lines.append("")

    nutrition_lines = _format_nutrition_hydration(entries)
    if nutrition_lines:
        lines.append("Nutrition & Hydration:")
        lines.extend(nutrition_lines)
        lines.append("")

    if entries.get("steps") is not None:
        lines.append("Activity:")
        lines.append(f"- Steps: {entries['steps']}")
        lines.append("")

    if entries.get("comments"):
        lines.append(f"Comments: {entries['comments']}")
    if "locked" in entries:
        lines.append(f"Status: {'Locked' if entries.get('locked') else 'Unlocked'}")

    if include_all_fields and tracker is not None:
        other_lines = _format_other_fields(entries, tracker.accessed)
        if other_lines:
            lines.append("")
            lines.append("Other Fields:")
            lines.extend(other_lines)

    return "\n".join(lines)


def format_event_summary(event: dict[str, Any]) -> str:
    """Format a basic event summary into a readable string, omitting empty fields."""
    event_date = event.get("start_date_local") or event.get("date", "Unknown")
    event_type = "Workout" if event.get("workout") else "Race" if event.get("race") else "Other"
    event_name = event.get("name", "Unnamed")
    event_id = event.get("id", "?")

    lines = [f"{event_name} [{event_type}] (ID: {event_id}) — {event_date}"]
    if _has_value(event.get("description")):
        lines.append(f"  Description: {event['description']}")
    return "\n".join(lines)


def format_event_details(event: dict[str, Any]) -> str:
    """Format detailed event information, omitting fields without data."""
    name = event.get("name", "Unnamed")
    eid = event.get("id", "?")
    date = event.get("date", "Unknown")

    lines = [f"Event: {name} (ID: {eid}) — {date}"]
    if _has_value(event.get("description")):
        lines.append(f"  Description: {event['description']}")

    workout = event.get("workout")
    if workout and isinstance(workout, dict):
        lines.append("  Workout:")
        _emit(lines, "    Sport", workout.get("sport"))
        _emit(lines, "    Duration", workout.get("duration"), "s")
        _emit(lines, "    TSS", workout.get("tss"))
        intervals = workout.get("intervals")
        if isinstance(intervals, list) and intervals:
            lines.append(f"    Intervals: {len(intervals)}")

    if event.get("race"):
        lines.append("  Race:")
        _emit(lines, "    Priority", event.get("priority"))
        _emit(lines, "    Result", event.get("result"))

    cal = event.get("calendar")
    if isinstance(cal, dict) and _has_value(cal.get("name")):
        lines.append(f"  Calendar: {cal['name']}")

    return "\n".join(lines)


def format_activity_message(message: dict[str, Any]) -> str:
    """Format an activity message/note into a readable string."""
    author = message.get("name", "Unknown")
    created = _fmt_time(message.get("created")) or "Unknown"
    content = message.get("content", "")
    msg_type = message.get("type")

    line = f"{author} ({created})"
    if msg_type and msg_type != "TEXT":
        line += f" [{msg_type}]"
    line += f": {content}"
    return line


def format_custom_item_details(item: dict[str, Any]) -> str:
    """Format detailed custom item information into a readable string."""
    lines = ["Custom Item Details:", ""]
    lines.append(f"ID: {item.get('id', 'N/A')}")
    lines.append(f"Name: {item.get('name', 'N/A')}")
    lines.append(f"Type: {item.get('type', 'N/A')}")

    if item.get("description"):
        lines.append(f"Description: {item['description']}")
    if item.get("visibility"):
        lines.append(f"Visibility: {item['visibility']}")
    if item.get("index") is not None:
        lines.append(f"Index: {item['index']}")
    if item.get("hide_script") is not None:
        lines.append(f"Hide Script: {item['hide_script']}")
    if item.get("content"):
        lines.append(f"Content: {json.dumps(item['content'], indent=2)}")

    return "\n".join(lines)


def _format_single_interval(i: int, interval: dict[str, Any]) -> str:
    """Format a single interval, emitting only fields with data."""
    label = interval.get("label", f"Interval {i}")
    int_type = interval.get("type", "")
    header = f"[{i}] {label}" + (f" ({int_type})" if int_type else "")
    lines = [header]

    _emit(lines, "Duration", interval.get("elapsed_time"), "s")
    _emit(lines, "Moving Time", interval.get("moving_time"), "s")
    _emit(lines, "Distance", interval.get("distance"), "m")

    # Power
    pw: list[str] = []
    avg_w = interval.get("average_watts")
    if _has_value(avg_w):
        wkg = interval.get("average_watts_kg")
        pw.append(f"  Avg: {avg_w}W" + (f" ({wkg} W/kg)" if _has_value(wkg) else ""))
    max_w = interval.get("max_watts")
    if _has_value(max_w):
        pw.append(f"  Max: {max_w}W")
    _emit(pw, "Weighted Avg", interval.get("weighted_average_watts"), "W")
    _emit(pw, "Intensity", interval.get("intensity"))
    _emit(pw, "Load", interval.get("training_load"))
    _emit(pw, "kJ", interval.get("joules"))
    zone = interval.get("zone")
    if _has_value(zone):
        zmin = interval.get("zone_min_watts")
        zmax = interval.get("zone_max_watts")
        pw.append(f"  Zone: {zone}" + (f" ({zmin}-{zmax}W)" if _has_value(zmin) else ""))
    _emit(pw, "L/R Balance", interval.get("avg_lr_balance"))
    if pw:
        lines.append("  Power:")
        lines.extend(f"  {line}" if not line.startswith("  ") else line for line in pw)

    # HR
    hr: list[str] = []
    avg_hr_val = interval.get("average_heartrate")
    if _has_value(avg_hr_val):
        max_hr_val = interval.get("max_heartrate")
        hr.append(f"  Avg: {avg_hr_val}" + (f", Max: {max_hr_val}" if _has_value(max_hr_val) else "") + " bpm")
    _emit(hr, "Decoupling", interval.get("decoupling"))
    _emit(hr, "DFA α1", interval.get("average_dfa_a1"))
    if hr:
        lines.append("  HR:")
        lines.extend(f"  {line}" if not line.startswith("  ") else line for line in hr)

    # Speed / cadence
    spd: list[str] = []
    avg_spd = interval.get("average_speed")
    if _has_value(avg_spd):
        spd.append(f"  Avg Speed: {avg_spd} m/s")
    _emit(spd, "GAP", interval.get("gap"), "m/s")
    avg_cad = interval.get("average_cadence")
    if _has_value(avg_cad):
        spd.append(f"  Cadence: {avg_cad} rpm")
    _emit(spd, "Stride", interval.get("average_stride"))
    if spd:
        lines.extend(spd)

    # Elevation / environment
    _emit(lines, "Elev Gain", interval.get("total_elevation_gain"), "m")
    _emit(lines, "Gradient", interval.get("average_gradient"), "%")
    _emit(lines, "Temp", interval.get("average_temp"), "°C")

    return "\n".join(lines)


def format_intervals(intervals_data: dict[str, Any]) -> str:
    """Format intervals data, omitting fields without meaningful data."""
    lines = ["Intervals Analysis:"]
    _emit(lines, "ID", intervals_data.get("id"))

    if "icu_intervals" in intervals_data and intervals_data["icu_intervals"]:
        lines.append("")
        for i, interval in enumerate(intervals_data["icu_intervals"], 1):
            lines.append(_format_single_interval(i, interval))
            lines.append("")

    if "icu_groups" in intervals_data and intervals_data["icu_groups"]:
        lines.append("Groups:")
        for group in intervals_data["icu_groups"]:
            if not isinstance(group, dict):
                continue
            gid = group.get("id", "?")
            count = group.get("count", "?")
            parts = [f"Group {gid} ({count} intervals)"]
            _emit(parts, "Duration", group.get("elapsed_time"), "s")
            _emit(parts, "Distance", group.get("distance"), "m")
            _emit(parts, "Avg Power", group.get("average_watts"), "W")
            _emit(parts, "Avg HR", group.get("average_heartrate"), "bpm")
            _emit(parts, "Avg Speed", group.get("average_speed"), "m/s")
            _emit(parts, "Cadence", group.get("average_cadence"), "rpm")
            lines.append("\n".join(parts))
            lines.append("")

    return "\n".join(lines)
