import json
import os

import numpy as np
import pandas as pd
import mlflow
from mlflow.tracking import MlflowClient

from app.schemas.prediction import DriverPrediction, FantasyPoints, Predictions

# {season: {round: {driver_slug: DriverPrediction}}}
PREDICTION_CACHE: dict[str, dict[str, dict[str, DriverPrediction]]] = {}

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


def _load_latest_run_artifacts() -> tuple:
    """Needs MLFLOW_TRACKING_URI, MLFLOW_TRACKING_USERNAME and
    MLFLOW_TRACKING_PASSWORD in the environment (never hardcode them)."""
    mlflow.set_tracking_uri(os.environ["MLFLOW_TRACKING_URI"])
    client = MlflowClient()

    experiment = client.get_experiment_by_name(EXPERIMENT_NAME)
    if experiment is None:
        raise RuntimeError(f"MLflow experiment '{EXPERIMENT_NAME}' not found.")
    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        order_by=["start_time DESC"],
        max_results=1,
    )
    if not runs:
        raise RuntimeError("No MLflow runs found. Did you upload the models?")
    run_id = runs[0].info.run_id
    print(f"Using MLflow run {run_id}")

    quali_model = mlflow.lightgbm.load_model(f"runs:/{run_id}/quali_ranker_model")
    race_model = mlflow.lightgbm.load_model(f"runs:/{run_id}/race_ranker_model")
    dnf_model = mlflow.lightgbm.load_model(f"runs:/{run_id}/dnf_classifier_model")

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


def get_expected_points(driver_slug: str) -> int | None:
    """P50 points for the most recently loaded race, or None if unavailable.
    Use this to replace the random placeholders in the loaders."""
    for season in reversed(list(PREDICTION_CACHE)):
        for round_num in reversed(list(PREDICTION_CACHE[season])):
            pred = PREDICTION_CACHE[season][round_num].get(driver_slug)
            if pred:
                return round(pred.fantasy_points.expected_p50)
    return None