
from fastapi import APIRouter, HTTPException
 
from app.schemas.prediction import DriverPrediction
from app.services.prediction import PREDICTION_CACHE
 
router = APIRouter(prefix="/predictions", tags=["predictions"])
 
 
@router.get("/{season}/{round_num}", response_model=list[DriverPrediction])
def get_all_drivers_for_round(season: str, round_num: str):
    """Predictions for all drivers for a specific weekend."""
    round_data = PREDICTION_CACHE.get(season, {}).get(round_num)
    if round_data is None:
        raise HTTPException(status_code=404, detail="Predictions not found for this race.")
    return list(round_data.values())
 
 
@router.get("/{season}/{round_num}/{driver_slug}", response_model=DriverPrediction)
def get_single_driver(season: str, round_num: str, driver_slug: str):
    """Prediction for a specific driver."""
    round_data = PREDICTION_CACHE.get(season, {}).get(round_num)
    if round_data is None:
        raise HTTPException(status_code=404, detail="Predictions not found for this race.")
    if driver_slug not in round_data:
        raise HTTPException(status_code=404, detail=f"Driver '{driver_slug}' not found.")
    return round_data[driver_slug]
