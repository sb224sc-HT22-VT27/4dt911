import json
import os
import re
import unicodedata

import numpy as np
import pandas as pd
import mlflow
from mlflow.tracking import MlflowClient

from app.schemas.prediction import DriverPrediction, FantasyPoints, Predictions, ConstructorBreakdown, ConstructorPrediction

# {season: {round: {driver_slug: DriverPrediction}}}
PREDICTION_CACHE: dict[str, dict[str, dict[str, DriverPrediction]]] = {}

CONSTRUCTOR_CACHE: dict[str, dict[str, dict[str, ConstructorPrediction]]] = {}
DRIVERS_CSV = "../data/f1-fantasy-data/drivers.csv"

EXPERIMENT_NAME = "F1_Fantasy_Baseline"
GRID_SIZE = 22

QUALI_FEATURES = [
    "fp_pace_delta", "driver_form_3_race", "driver_form_5_race", "driver_quali_form_3",
    "driver_dnf_rate_5_race", "constructor_form_3_race", "beat_teammate_prev_race",
    "beat_teammate_prev_quali", "h2h_race_win_rate_5", "h2h_quali_win_rate_5",
    "driver_track_affinity", "is_street_circuit", "is_low_downforce", "street_circuit_form",
]
RACE_FEATURES = ["target_quali_pos"] + QUALI_FEATURES

FINISH_PTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}

# prediction.py
KEY_ALIASES = {"alexander_albon": "alex_albon", "kimi_antonelli": "andrea_kimi_antonelli"}

def _driver_team_map() -> dict[str, str]:
    df = pd.read_csv(DRIVERS_CSV)
    df = df[df["is_active_seat"] == True]
    return {KEY_ALIASES.get(_slugify(n), _slugify(n)): str(t)
            for n, t in zip(df["driver_name"], df["team_key"])}

def _get_points(q_pos: float, r_pos: float, beat_teammate: bool, is_dnf: bool) -> float:
    pts = 0.0
    if q_pos <= 10:
        pts += 11 - q_pos
    pts += FINISH_PTS.get(int(r_pos), 0)
    pts += max(min(q_pos - r_pos, 10), -10)  # positions gained/lost
    if beat_teammate:
        pts += 10
    if is_dnf:
        pts -= 20
    return pts


def calculate_fantasy_percentiles(row: pd.Series, mae: float = 3.5) -> pd.Series:
    base_q = row["predicted_quali_rank"]
    base_r = row["predicted_race_rank"]
    dnf_prob = row["predicted_dnf_prob"]

    p50 = _get_points(base_q, base_r, False, False) + 5 - (dnf_prob * 20)
    p90 = _get_points(max(1, base_q - mae), max(1, base_r - mae), True, False)
    p10 = _get_points(
        min(GRID_SIZE, base_q + mae),
        min(GRID_SIZE, base_r + mae),
        False,
        dnf_prob > 0.10,
    )
    return pd.Series([round(p10, 1), round(p50, 1), round(p90, 1)])

def _load_lightgbm_model(experiment_id: str, run_id: str, name: str):
    # DagsHub ignores/rejects filter_string here, so filter client-side
    all_models = mlflow.search_logged_models(
        experiment_ids=[experiment_id],
        output_format="list",
    )
    candidates = [m for m in all_models if m.name == name]
    if not candidates:
        raise RuntimeError(f"No logged model named '{name}' found.")

    match = next((m for m in candidates if m.source_run_id == run_id), None)
    if match is None:
        match = max(candidates, key=lambda m: m.creation_timestamp)
        print(f"WARNING: no '{name}' linked to run {run_id}; using newest ({match.model_id}).")
    else:
        print(f"Loading {name} from {match.model_id}")
    return mlflow.lightgbm.load_model(f"models:/{match.model_id}")


def _load_latest_run_artifacts() -> tuple:
    """Needs MLFLOW_TRACKING_URI, MLFLOW_TRACKING_USERNAME and
    MLFLOW_TRACKING_PASSWORD in the environment (never hardcode them)."""
    os.environ["MLFLOW_TRACKING_URI"] = "https://dagshub.com/SamuelFredricBerg/4dt911.mlflow"
    mlflow.set_tracking_uri(os.environ["MLFLOW_TRACKING_URI"])
    client = MlflowClient()

    experiment = client.get_experiment_by_name(EXPERIMENT_NAME)
    if experiment is None:
        raise RuntimeError(f"MLflow experiment '{EXPERIMENT_NAME}' not found.")
    runs = client.search_runs(experiment_ids=[experiment.experiment_id], order_by=["start_time DESC"], max_results=1)
    if not runs:
        raise RuntimeError("No MLflow runs found. Did you upload the models?")
    run_id = runs[0].info.run_id
    print(f"Using MLflow run {run_id}")

    exp_id = experiment.experiment_id
    quali_model = _load_lightgbm_model(exp_id, run_id, "quali_ranker_model")
    race_model = _load_lightgbm_model(exp_id, run_id, "race_ranker_model")
    dnf_model = _load_lightgbm_model(exp_id, run_id, "dnf_classifier_model")

    #quali_model = mlflow.lightgbm.load_model(f"runs:/{run_id}/quali_ranker_model")
    #race_model = mlflow.lightgbm.load_model(f"runs:/{run_id}/race_ranker_model")
    #dnf_model = mlflow.lightgbm.load_model(f"runs:/{run_id}/dnf_classifier_model")

    local_path = client.download_artifacts(run_id, "feature_store/upcoming_race_features.json")
    with open(local_path, "r") as f:
        feature_dict = json.load(f)

    return quali_model, race_model, dnf_model, feature_dict


def load_predictions(season: str, round_num: str, race_name: str, date: str) -> None:
    """Run the models for the upcoming race and fill PREDICTION_CACHE."""
    quali_model, race_model, dnf_model, feature_dict = _load_latest_run_artifacts()

    grid_df = pd.DataFrame.from_dict(feature_dict, orient="index").reset_index()
    grid_df = grid_df.rename(columns={"index": "driver_slug"})

    grid_df["predicted_quali_score"] = quali_model.predict(grid_df[QUALI_FEATURES])
    # method="first" avoids fractional ranks (3.5) on ties
    grid_df["predicted_quali_rank"] = grid_df["predicted_quali_score"].rank(
        ascending=False, method="first"
    )

    grid_df["target_quali_pos"] = grid_df["predicted_quali_rank"]
    grid_df["predicted_race_score"] = race_model.predict(grid_df[RACE_FEATURES])
    grid_df["predicted_race_rank"] = grid_df["predicted_race_score"].rank(
        ascending=False, method="first"
    )
    grid_df["predicted_dnf_prob"] = dnf_model.predict_proba(grid_df[RACE_FEATURES])[:, 1]

    grid_df[["P10_Pts", "P50_Pts", "P90_Pts"]] = grid_df.apply(
        calculate_fantasy_percentiles, axis=1
    )

    round_cache: dict[str, DriverPrediction] = {}
    for _, row in grid_df.iterrows():
        round_cache[row["driver_slug"]] = DriverPrediction(
            race_name=race_name,
            date=date,
            driver=row["driver_slug"],
            predictions=Predictions(
                qualifying_position=int(row["predicted_quali_rank"]),
                race_position=int(row["predicted_race_rank"]),
                dnf_probability=float(np.round(row["predicted_dnf_prob"] * 100, 1)),
            ),
            fantasy_points=FantasyPoints(
                floor_p10=float(row["P10_Pts"]),
                expected_p50=float(row["P50_Pts"]),
                ceiling_p90=float(row["P90_Pts"]),
            ),
        )

    PREDICTION_CACHE.setdefault(season, {})[round_num] = round_cache
    print(f"Cached predictions for {len(round_cache)} drivers ({season} R{round_num}).")

    CONSTRUCTOR_CACHE.setdefault(season, {})[round_num] = _build_constructor_predictions(
        grid_df, race_name, date
    )


def get_expected_points(driver_slug: str) -> int | None:
    """P50 points for the most recently loaded race, or None if unavailable.
    Use this to replace the random placeholders in the loaders."""
    for season in reversed(list(PREDICTION_CACHE)):
        for round_num in reversed(list(PREDICTION_CACHE[season])):
            pred = PREDICTION_CACHE[season][round_num].get(driver_slug)
            if pred:
                return round(pred.fantasy_points.expected_p50)
    return None


def _slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

def _driver_team_map() -> dict[str, str]:
    df = pd.read_csv(DRIVERS_CSV)
    return {_slugify(str(r["driver_name"])): str(r["team_key"]) for _, r in df.iterrows()}

def _quali_pts(q_pos: int) -> int:
    return 11 - q_pos if q_pos <= 10 else 0

def _driver_rule_points(q_pos: float, r: float, dnf: float) -> float:
    q, r = int(round(q_pos)), int(round(r))
    pts = _quali_pts(q)
    if dnf:
        return pts - 20
    return pts + FINISH_PTS.get(r, 0) + (q - r)

def _quali_bonus(q_ranks: list[float]) -> int:
    in_q3 = sum(round(q) <= 10 for q in q_ranks)
    in_q2 = sum(round(q) <= 16 for q in q_ranks)
    if in_q3 == 2:
        return 10
    if in_q3 == 1:
        return 5
    if in_q2 == 2:
        return 3
    if in_q2 == 1:
        return 1
    return -1

def _constructor_scenario(rows: list[tuple[float, float, float]], scenario: str, mae: float = 3.5) -> tuple[float, float, float]:
    q_pts = r_pts = 0.0
    q_ranks = []
    for q, r, p in rows:
        if scenario == "p10":
            q, r = min(GRID_SIZE, q + mae), min(GRID_SIZE, r + mae)
            dnf = p > 0.10
            total = _driver_rule_points(q, r, dnf)
        elif scenario == "p90":
            q, r = max(1, q - mae), max(1, r - mae)
            total = _driver_rule_points(q, r, False)
        else:  # p50: probability-weighted DNF
            total = (1 - p) * _driver_rule_points(q, r, False) + p * _driver_rule_points(q, r, True)
        qp = _quali_pts(int(round(q)))
        q_pts += qp
        r_pts += total - qp
        q_ranks.append(q)
    return q_pts, r_pts, _quali_bonus(q_ranks)

def _build_constructor_predictions(grid_df: pd.DataFrame, race_name: str, date: str
                                   ) -> dict[str, ConstructorPrediction]:
    team_map = _driver_team_map()
    by_team: dict[str, list[pd.Series]] = {}
    for _, row in grid_df.iterrows():
        team = team_map.get(row["driver_slug"])
        if team is None:
            print(f"No team found for driver slug '{row['driver_slug']}', skipping.")
            continue
        by_team.setdefault(team, []).append(row)

    out: dict[str, ConstructorPrediction] = {}
    for team, drivers in by_team.items():
        rows = [(d["predicted_quali_rank"], d["predicted_race_rank"], d["predicted_dnf_prob"])
                for d in drivers]
        totals = {}
        for sc in ("p10", "p50", "p90"):
            q, r, b = _constructor_scenario(rows, sc)
            totals[sc] = (q, r, b)
        q50, r50, b50 = totals["p50"]
        out[team] = ConstructorPrediction(
            race_name=race_name,
            date=date,
            constructor=team,
            drivers=[d["driver_slug"] for d in drivers],
            breakdown=ConstructorBreakdown(
                qualifying_points=round(q50, 1),
                race_points=round(r50, 1),
                qualifying_bonus=float(b50),
            ),
            fantasy_points=FantasyPoints(
                floor_p10=round(sum(totals["p10"]), 1),
                expected_p50=round(sum(totals["p50"]), 1),
                ceiling_p90=round(sum(totals["p90"]), 1),
            ),
        )
    return out

def get_constructor_expected_points(team_key: str) -> int | None:
    for season in reversed(list(CONSTRUCTOR_CACHE)):
        for round_num in reversed(list(CONSTRUCTOR_CACHE[season])):
            pred = CONSTRUCTOR_CACHE[season][round_num].get(team_key)
            if pred:
                return round(pred.fantasy_points.expected_p50)
    return None