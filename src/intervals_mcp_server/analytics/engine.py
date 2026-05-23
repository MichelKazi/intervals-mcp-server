"""Polars-based training analytics engine.

Converts raw API responses into DataFrames and computes metrics that would
burn too many tokens if left to the LLM: z-scores, rolling averages,
percentile ranks, trend detection, and anomaly flagging.
"""

from typing import Any

import polars as pl


class TrainingAnalytics:
    """Stateless analytics over activity and wellness data."""

    @staticmethod
    def activities_frame(activities: list[dict[str, Any]]) -> pl.DataFrame:
        """Build a typed DataFrame from raw activity dicts."""
        rows = []
        for a in activities:
            rows.append({
                "id": a.get("id"),
                "date": (a.get("start_date_local") or a.get("startTime", ""))[:10],
                "type": a.get("type", "Other"),
                "name": a.get("name", "Unnamed"),
                "moving_time": a.get("moving_time") or a.get("elapsed_time") or 0,
                "distance": a.get("distance") or 0,
                "load": a.get("icu_training_load") or a.get("trainingLoad") or 0,
                "avg_power": a.get("icu_average_watts") or a.get("average_watts"),
                "avg_hr": a.get("average_heartrate") or a.get("avgHr"),
                "max_hr": a.get("max_heartrate") or a.get("maxHr"),
                "np": a.get("icu_weighted_avg_watts") or a.get("weighted_average_watts"),
                "if_": a.get("icu_intensity"),
                "efficiency_factor": a.get("icu_efficiency_factor"),
                "decoupling": a.get("decoupling"),
                "elevation_gain": a.get("total_elevation_gain") or a.get("elevationGain"),
                "calories": a.get("icu_calories") or a.get("calories"),
            })
        return pl.DataFrame(rows).with_columns(
            pl.col("date").str.to_date("%Y-%m-%d")
        )

    @staticmethod
    def wellness_frame(wellness: list[dict[str, Any]]) -> pl.DataFrame:
        """Build a typed DataFrame from raw wellness dicts."""
        rows = []
        for w in wellness:
            rows.append({
                "date": (w.get("id") or "")[:10],
                "ctl": w.get("ctl"),
                "atl": w.get("atl"),
                "ramp_rate": w.get("rampRate"),
                "hrv": w.get("hrv"),
                "resting_hr": w.get("restingHR"),
                "sleep_secs": w.get("sleepSecs"),
                "sleep_quality": w.get("sleepQuality"),
                "weight": w.get("weight"),
                "soreness": w.get("soreness"),
                "fatigue": w.get("fatigue"),
                "stress": w.get("stress"),
                "mood": w.get("mood"),
                "motivation": w.get("motivation"),
                "spo2": w.get("spO2"),
            })
        return pl.DataFrame(rows).with_columns(
            pl.col("date").str.to_date("%Y-%m-%d")
        )

    @staticmethod
    def load_trend(df: pl.DataFrame, weeks: int = 6) -> dict[str, Any]:
        """Weekly load with rolling avg, week-over-week delta, and monotony."""
        weekly = (
            df.with_columns(pl.col("date").dt.truncate("1w").alias("week"))
            .group_by("week")
            .agg(
                pl.col("load").sum().alias("total_load"),
                pl.col("load").mean().alias("mean_load"),
                pl.col("load").std().alias("std_load"),
                pl.col("load").count().alias("session_count"),
                pl.col("moving_time").sum().alias("total_duration"),
                pl.col("distance").sum().alias("total_distance"),
            )
            .sort("week")
            .tail(weeks)
        )

        weekly = weekly.with_columns([
            (pl.col("total_load") - pl.col("total_load").shift(1)).alias("load_delta"),
            pl.when(pl.col("std_load") > 0)
            .then(pl.col("mean_load") / pl.col("std_load"))
            .otherwise(None)
            .alias("monotony"),
            (pl.col("total_load") * pl.when(pl.col("std_load") > 0)
             .then(pl.col("mean_load") / pl.col("std_load"))
             .otherwise(None))
            .alias("strain"),
        ])

        return {
            "weeks": weekly.to_dicts(),
            "current_load": weekly["total_load"][-1] if len(weekly) > 0 else 0,
            "avg_load": weekly["total_load"].mean() if len(weekly) > 0 else 0,
            "load_trend_pct": _pct_change(
                weekly["total_load"][0] if len(weekly) > 1 else 0,
                weekly["total_load"][-1] if len(weekly) > 0 else 0,
            ),
        }

    @staticmethod
    def efficiency_trend(df: pl.DataFrame, weeks: int = 8) -> dict[str, Any]:
        """Weekly power:HR ratio with trend detection."""
        with_ratio = df.filter(
            pl.col("avg_power").is_not_null() & pl.col("avg_hr").is_not_null() & (pl.col("avg_hr") > 0)
        ).with_columns(
            (pl.col("avg_power") / pl.col("avg_hr")).alias("pwr_hr")
        )

        if with_ratio.is_empty():
            return {"weeks": [], "trend_pct": None}

        weekly = (
            with_ratio.with_columns(pl.col("date").dt.truncate("1w").alias("week"))
            .group_by("week")
            .agg(
                pl.col("pwr_hr").mean().alias("avg_pwr_hr"),
                pl.col("efficiency_factor").mean().alias("avg_ef"),
                pl.col("decoupling").mean().alias("avg_decouple"),
                pl.col("pwr_hr").count().alias("n"),
            )
            .sort("week")
            .tail(weeks)
        )

        trend_pct = _pct_change(
            weekly["avg_pwr_hr"][0] if len(weekly) > 1 else 0,
            weekly["avg_pwr_hr"][-1] if len(weekly) > 0 else 0,
        )

        return {"weeks": weekly.to_dicts(), "trend_pct": trend_pct}

    @staticmethod
    def wellness_trends(wf: pl.DataFrame, days: int = 28) -> dict[str, Any]:
        """Rolling averages and z-scores for wellness metrics."""
        wf = wf.sort("date").tail(days)
        if wf.is_empty():
            return {}

        results: dict[str, Any] = {}
        latest = wf.row(-1, named=True)

        for col in ["hrv", "resting_hr", "sleep_secs", "weight"]:
            series = wf[col].drop_nulls()
            if series.is_empty():
                continue
            mean = series.mean()
            std = series.std()
            current = latest.get(col)
            if current is not None and mean is not None and std and std > 0:
                results[col] = {
                    "current": current,
                    "mean_28d": round(mean, 1),
                    "std_28d": round(std, 2),
                    "z_score": round((current - mean) / std, 2),
                }
            elif current is not None and mean is not None:
                results[col] = {
                    "current": current,
                    "mean_28d": round(mean, 1),
                }

        # TSB
        ctl = latest.get("ctl")
        atl = latest.get("atl")
        if ctl is not None and atl is not None:
            results["tsb"] = round(ctl - atl, 1)
            results["ctl"] = ctl
            results["atl"] = atl

        return results

    @staticmethod
    def standout_efforts(df: pl.DataFrame, days: int = 28) -> list[dict[str, Any]]:
        """Identify activities that are statistical outliers (load, power, duration)."""
        recent = df.sort("date").tail(100)
        if len(recent) < 5:
            return []

        standouts = []
        for col, label in [("load", "training load"), ("avg_power", "avg power"), ("moving_time", "duration")]:
            series = recent[col].drop_nulls()
            if series.is_empty():
                continue
            mean = series.mean()
            std = series.std()
            if not std or std == 0:
                continue

            cutoff_date = recent["date"].max() - pl.duration(days=days)
            period = recent.filter(pl.col("date") >= cutoff_date)

            for row in period.iter_rows(named=True):
                val = row.get(col)
                if val is None:
                    continue
                z = (val - mean) / std
                if z >= 1.8:
                    standouts.append({
                        "date": str(row["date"]),
                        "name": row["name"],
                        "metric": label,
                        "value": round(val, 1) if isinstance(val, float) else val,
                        "z_score": round(z, 2),
                    })

        # Deduplicate by activity, keep highest z
        seen: dict[str, dict[str, Any]] = {}
        for s in standouts:
            key = f"{s['date']}_{s['name']}"
            if key not in seen or s["z_score"] > seen[key]["z_score"]:
                seen[key] = s
        return sorted(seen.values(), key=lambda x: -x["z_score"])[:5]

    @staticmethod
    def sport_distribution(df: pl.DataFrame) -> list[dict[str, Any]]:
        """Volume distribution by sport type."""
        return (
            df.group_by("type")
            .agg(
                pl.col("load").sum().alias("total_load"),
                pl.col("moving_time").sum().alias("total_time"),
                pl.col("distance").sum().alias("total_distance"),
                pl.len().alias("count"),
            )
            .sort("total_load", descending=True)
            .to_dicts()
        )


def _pct_change(old: float | None, new: float | None) -> float | None:
    if not old or not new:
        return None
    return round((new - old) / old * 100, 1)
