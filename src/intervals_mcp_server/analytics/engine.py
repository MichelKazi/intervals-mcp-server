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

    @staticmethod
    def fatigue_risk(df: pl.DataFrame) -> dict[str, Any]:
        """Acute:chronic workload ratio (ACWR) with injury risk bands.

        ACWR = 7-day rolling load / 28-day rolling load.
        Risk bands: <0.8 undertrained, 0.8-1.3 sweet spot, 1.3-1.5 caution, >1.5 danger.
        """
        daily_load = (
            df.group_by("date")
            .agg(pl.col("load").sum().alias("daily_load"))
            .sort("date")
        )

        if len(daily_load) < 14:
            return {"days": [], "current_acwr": None, "risk_band": "insufficient data"}

        # Fill missing dates with 0 load
        date_range = pl.date_range(
            daily_load["date"].min(), daily_load["date"].max(), eager=True
        ).alias("date")
        full_range = pl.DataFrame({"date": date_range})
        daily_load = full_range.join(daily_load, on="date", how="left").with_columns(
            pl.col("daily_load").fill_null(0)
        )

        daily_load = daily_load.with_columns([
            pl.col("daily_load").rolling_sum(window_size=7).alias("acute_load"),
            pl.col("daily_load").rolling_sum(window_size=28).alias("chronic_load"),
        ]).with_columns(
            pl.when(pl.col("chronic_load") > 0)
            .then(pl.col("acute_load") / (pl.col("chronic_load") / 4))
            .otherwise(None)
            .alias("acwr")
        )

        # Only return last 14 days of data
        recent = daily_load.filter(pl.col("acwr").is_not_null()).tail(14)
        if recent.is_empty():
            return {"days": [], "current_acwr": None, "risk_band": "insufficient data"}

        current_acwr = recent["acwr"][-1]
        if current_acwr < 0.8:
            risk_band = "undertrained"
        elif current_acwr <= 1.3:
            risk_band = "sweet spot"
        elif current_acwr <= 1.5:
            risk_band = "caution"
        else:
            risk_band = "danger"

        # Week-over-week ACWR trend
        acwr_7d_ago = recent["acwr"][-8] if len(recent) >= 8 else None
        acwr_delta = round(current_acwr - acwr_7d_ago, 2) if acwr_7d_ago is not None else None

        # Spike detection: any day in last 7 where ACWR jumped > 0.3 in one day
        last_7 = recent.tail(7)
        spikes = []
        if len(last_7) > 1:
            acwr_vals = last_7["acwr"].to_list()
            dates = last_7["date"].to_list()
            for i in range(1, len(acwr_vals)):
                if acwr_vals[i] is not None and acwr_vals[i - 1] is not None:
                    jump = acwr_vals[i] - acwr_vals[i - 1]
                    if jump > 0.3:
                        spikes.append({"date": str(dates[i]), "jump": round(jump, 2)})

        return {
            "days": recent.select("date", "acute_load", "chronic_load", "acwr").to_dicts(),
            "current_acwr": round(current_acwr, 2),
            "risk_band": risk_band,
            "acwr_delta_7d": acwr_delta,
            "spikes": spikes,
        }

    @staticmethod
    def power_curve_progression(
        recent_curve: list[int | float | None],
        baseline_curve: list[int | float | None],
    ) -> dict[str, Any]:
        """Compare recent power bests to baseline across key durations.

        Returns percentile rank of recent vs baseline at 5s, 30s, 1min, 5min, 20min, 60min.
        """
        key_durations = {
            "5s": 5, "30s": 30, "1min": 60, "5min": 300, "20min": 1200, "60min": 3600,
        }

        comparisons = []
        for label, secs in key_durations.items():
            recent_w = _extract_curve_value(recent_curve, secs)
            baseline_w = _extract_curve_value(baseline_curve, secs)

            if recent_w is None and baseline_w is None:
                continue

            entry: dict[str, Any] = {"duration": label, "seconds": secs}
            if recent_w is not None:
                entry["recent_watts"] = int(recent_w)
            if baseline_w is not None:
                entry["baseline_watts"] = int(baseline_w)
            if recent_w and baseline_w and baseline_w > 0:
                entry["pct_of_best"] = round(recent_w / baseline_w * 100, 1)
            comparisons.append(entry)

        # Identify rider profile (strengths)
        profile = _classify_power_profile(comparisons)

        return {"comparisons": comparisons, "profile": profile}

    @staticmethod
    def recovery_patterns(
        af: pl.DataFrame, wf: pl.DataFrame, lookback_days: int = 60
    ) -> dict[str, Any]:
        """Correlate prior-day wellness signals with next-day performance.

        Identifies which recovery metrics (sleep, HRV, RHR, soreness, etc.) are
        most predictive of performance for this athlete.
        """
        af_sorted = af.sort("date")
        wf_sorted = wf.sort("date")

        if len(af_sorted) < 10 or len(wf_sorted) < 10:
            return {"correlations": [], "patterns": [], "sample_size": 0}

        # Join: for each activity, get prior-day wellness
        af_with_prior = af_sorted.with_columns(
            (pl.col("date") - pl.duration(days=1)).alias("prior_date")
        )

        joined = af_with_prior.join(
            wf_sorted, left_on="prior_date", right_on="date", how="inner", suffix="_w"
        )

        if len(joined) < 8:
            return {"correlations": [], "patterns": [], "sample_size": len(joined)}

        # Compute correlations between wellness inputs and performance outputs
        wellness_cols = ["hrv", "resting_hr", "sleep_secs", "soreness", "fatigue", "stress", "mood", "motivation"]
        perf_cols = ["load", "avg_power", "if_"]

        correlations = []
        for w_col in wellness_cols:
            if w_col not in joined.columns:
                continue
            w_series = joined[w_col].drop_nulls()
            if len(w_series) < 8:
                continue

            for p_col in perf_cols:
                if p_col not in joined.columns:
                    continue
                valid = joined.filter(
                    pl.col(w_col).is_not_null() & pl.col(p_col).is_not_null()
                )
                if len(valid) < 8:
                    continue

                corr = valid.select(pl.corr(w_col, p_col)).item()
                if corr is not None and abs(corr) > 0.2:
                    correlations.append({
                        "wellness_metric": w_col,
                        "performance_metric": p_col,
                        "correlation": round(corr, 3),
                        "strength": "strong" if abs(corr) > 0.5 else "moderate",
                        "direction": "positive" if corr > 0 else "negative",
                        "n": len(valid),
                    })

        correlations.sort(key=lambda x: -abs(x["correlation"]))

        # Pattern mining: split activities into "good day" vs "bad day" based on load/power
        # and compare the prior-day wellness between groups
        patterns = _mine_good_bad_patterns(joined, wellness_cols)

        return {
            "correlations": correlations[:10],
            "patterns": patterns,
            "sample_size": len(joined),
        }


    @staticmethod
    def aerobic_development(df: pl.DataFrame) -> dict[str, Any]:
        """Analyze cardiac drift patterns to assess aerobic base development.

        Examines decoupling across rides at different durations and intensities
        to identify:
        - Duration threshold where drift becomes problematic (>5%)
        - Whether that threshold is improving over time
        - Rides with concerning drift given their intensity
        - Pacing consistency (power variability) vs drift relationship
        """
        # Filter to rides/runs with decoupling data and endurance-ish intensity (IF < 0.85)
        aero = df.filter(
            pl.col("decoupling").is_not_null()
            & pl.col("moving_time").is_not_null()
            & (pl.col("moving_time") > 1800)  # at least 30 min
        ).with_columns(
            (pl.col("moving_time") / 3600).alias("hours"),
        ).sort("date")

        if len(aero) < 5:
            return {"status": "insufficient data", "activities_with_drift": len(aero)}

        # Duration buckets for drift analysis
        buckets = [
            ("30-60min", 0.5, 1.0),
            ("1-1.5h", 1.0, 1.5),
            ("1.5-2h", 1.5, 2.0),
            ("2-3h", 2.0, 3.0),
            ("3h+", 3.0, 99.0),
        ]

        duration_drift: list[dict[str, Any]] = []
        for label, low, high in buckets:
            bucket = aero.filter(
                (pl.col("hours") >= low) & (pl.col("hours") < high)
            )
            if len(bucket) < 2:
                continue
            avg_dc = bucket["decoupling"].mean()
            median_dc = bucket["decoupling"].median()
            n = len(bucket)
            problematic = bucket.filter(pl.col("decoupling") > 5.0)
            duration_drift.append({
                "bucket": label,
                "avg_drift": round(avg_dc, 1) if avg_dc is not None else None,
                "median_drift": round(median_dc, 1) if median_dc is not None else None,
                "count": n,
                "problematic_count": len(problematic),
                "problematic_pct": round(len(problematic) / n * 100) if n > 0 else 0,
            })

        # Find drift threshold: first bucket where median drift > 5%
        drift_threshold = None
        for dd in duration_drift:
            if dd["median_drift"] is not None and dd["median_drift"] > 5.0:
                drift_threshold = dd["bucket"]
                break

        # Trend: is drift improving over time? Compare first half vs second half
        mid = len(aero) // 2
        trend = None
        if mid >= 5:
            first_half_drift = aero[:mid]["decoupling"].mean()
            second_half_drift = aero[mid:]["decoupling"].mean()
            if first_half_drift and second_half_drift and first_half_drift > 0:
                improvement = round((first_half_drift - second_half_drift) / first_half_drift * 100, 1)
                trend = {
                    "first_half_avg": round(first_half_drift, 1),
                    "second_half_avg": round(second_half_drift, 1),
                    "improvement_pct": improvement,
                    "direction": "improving" if improvement > 5 else "declining" if improvement < -5 else "stable",
                }

        # Concerning rides: high drift at low intensity (IF < 0.75 but drift > 5%)
        # These suggest the aerobic base needs work
        concerning = aero.filter(
            (pl.col("decoupling") > 5.0)
            & (pl.col("if_").is_not_null())
            & (pl.col("if_") < 0.75)
        ).sort("decoupling", descending=True).head(5)

        concerning_rides = []
        for row in concerning.iter_rows(named=True):
            concerning_rides.append({
                "date": str(row["date"]),
                "name": row["name"],
                "duration_h": round(row["hours"], 1),
                "drift": round(row["decoupling"], 1),
                "intensity": round(row["if_"], 2) if row.get("if_") else None,
            })

        # Pacing consistency: correlation between variability index and drift
        # VI proxy: NP/avg_power ratio (closer to 1.0 = steadier)
        pacing_insight = None
        with_pacing = aero.filter(
            pl.col("np").is_not_null() & pl.col("avg_power").is_not_null() & (pl.col("avg_power") > 0)
        ).with_columns(
            (pl.col("np") / pl.col("avg_power")).alias("vi")
        )
        if len(with_pacing) >= 8:
            corr = with_pacing.select(pl.corr("vi", "decoupling")).item()
            if corr is not None and abs(corr) > 0.2:
                pacing_insight = {
                    "vi_drift_correlation": round(corr, 3),
                    "interpretation": (
                        "Steadier pacing → less drift" if corr > 0.3
                        else "Pacing variability has minimal effect on your drift" if abs(corr) < 0.3
                        else "Your drift is somewhat independent of pacing"
                    ),
                }

        return {
            "status": "ok",
            "activities_analyzed": len(aero),
            "duration_drift": duration_drift,
            "drift_threshold": drift_threshold,
            "trend": trend,
            "concerning_rides": concerning_rides,
            "pacing_insight": pacing_insight,
        }


def _mine_good_bad_patterns(joined: pl.DataFrame, wellness_cols: list[str]) -> list[dict[str, Any]]:
    """Split into top/bottom quartile performance days and compare prior wellness."""
    load_series = joined["load"].drop_nulls()
    if len(load_series) < 12:
        return []

    q75 = load_series.quantile(0.75)
    q25 = load_series.quantile(0.25)
    if q75 is None or q25 is None or q75 == q25:
        return []

    good_days = joined.filter(pl.col("load") >= q75)
    bad_days = joined.filter(pl.col("load") <= q25)

    if len(good_days) < 3 or len(bad_days) < 3:
        return []

    patterns = []
    for col in wellness_cols:
        if col not in joined.columns:
            continue
        good_vals = good_days[col].drop_nulls()
        bad_vals = bad_days[col].drop_nulls()
        if len(good_vals) < 3 or len(bad_vals) < 3:
            continue

        good_mean = good_vals.mean()
        bad_mean = bad_vals.mean()
        if good_mean is None or bad_mean is None:
            continue

        overall_std = joined[col].drop_nulls().std()
        if not overall_std or overall_std == 0:
            continue

        effect_size = (good_mean - bad_mean) / overall_std
        if abs(effect_size) > 0.4:
            patterns.append({
                "metric": col,
                "good_day_avg": round(good_mean, 1),
                "bad_day_avg": round(bad_mean, 1),
                "effect_size": round(effect_size, 2),
                "interpretation": _interpret_pattern(col, effect_size),
            })

    patterns.sort(key=lambda x: -abs(x["effect_size"]))
    return patterns[:6]


def _interpret_pattern(metric: str, effect_size: float) -> str:
    """Human-readable interpretation of a wellness→performance pattern."""
    direction = "higher" if effect_size > 0 else "lower"
    magnitude = "much" if abs(effect_size) > 0.8 else "somewhat"

    interpretations = {
        "hrv": f"{magnitude} {direction} HRV the day before predicts better performance",
        "resting_hr": f"{magnitude} {direction} resting HR the day before predicts better performance",
        "sleep_secs": f"{magnitude} {'more' if effect_size > 0 else 'less'} sleep the night before predicts better performance",
        "soreness": f"{magnitude} {direction} soreness score the day before predicts better performance",
        "fatigue": f"{magnitude} {direction} fatigue score the day before predicts better performance",
        "stress": f"{magnitude} {direction} stress the day before predicts better performance",
        "mood": f"{magnitude} {direction} mood the day before predicts better performance",
        "motivation": f"{magnitude} {direction} motivation the day before predicts better performance",
    }
    return interpretations.get(metric, f"{magnitude} {direction} {metric} correlates with better days")


def _extract_curve_value(curve: list[int | float | None], secs: int) -> float | None:
    if not curve:
        return None
    if secs < len(curve) and curve[secs] is not None:
        return float(curve[secs])
    return None


def _classify_power_profile(comparisons: list[dict[str, Any]]) -> str:
    """Classify rider type based on where they're strongest relative to their own baseline."""
    if not comparisons:
        return "unknown"

    best_pct = 0.0
    best_duration = ""
    for c in comparisons:
        pct = c.get("pct_of_best", 0)
        if pct > best_pct:
            best_pct = pct
            best_duration = c["duration"]

    short = ["5s", "30s"]
    medium = ["1min", "5min"]
    long = ["20min", "60min"]

    if best_duration in short:
        return "sprinter/neuromuscular"
    elif best_duration in medium:
        return "puncheur/anaerobic"
    elif best_duration in long:
        return "time trialist/aerobic"
    return "all-rounder"


def _pct_change(old: float | None, new: float | None) -> float | None:
    if not old or not new:
        return None
    return round((new - old) / old * 100, 1)
