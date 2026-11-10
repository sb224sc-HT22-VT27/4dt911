from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas.planner import PredictionRow, Risk, Settings
from app.schemas.prediction import DriverPrediction
from app.services import scoring
from app.services.prediction import PREDICTION_CACHE

router = APIRouter(prefix="/predictions", tags=["predictions"])


def settings_from_query(
    rounds: str = Query(..., description="comma separated, e.g. 13,14,15"),
    risk: Risk = "expected",
    form: float = 0,
    track: float = 0,
    dnf: float = 0,
) -> Settings:
    return Settings(rounds=[r.strip() for r in rounds.split(",") if r.strip()],
                    risk=risk, form=form, track=track, dnf=dnf)


@router.get("", response_model=list[PredictionRow])
def predictions(s: Settings = Depends(settings_from_query)):
    """One row per player with a prediction, settings applied, points summed over rounds."""
    return scoring.all_rows(s)


@router.get("/by-round")
def predictions_by_round(s: Settings = Depends(settings_from_query)):
    """Points for the chosen risk per round, all drivers and constructors, best total first."""
    return scoring.by_round(s)


# --- older per-weekend endpoints (unchanged) ---

@router.get("/{season}/{round_num}", response_model=list[DriverPrediction])
def get_all_drivers_for_round(season: str, round_num: str):
    round_data = PREDICTION_CACHE.get(season, {}).get(round_num)
    if round_data is None:
        raise HTTPException(status_code=404, detail="Predictions not found for this race.")
    return list(round_data.values())


@router.get("/{season}/{round_num}/{driver_slug}", response_model=DriverPrediction)
def get_single_driver(season: str, round_num: str, driver_slug: str):
    round_data = PREDICTION_CACHE.get(season, {}).get(round_num)
    if round_data is None:
        raise HTTPException(status_code=404, detail="Predictions not found for this race.")
    if driver_slug not in round_data:
        raise HTTPException(status_code=404, detail=f"Driver '{driver_slug}' not found.")
    return round_data[driver_slug]