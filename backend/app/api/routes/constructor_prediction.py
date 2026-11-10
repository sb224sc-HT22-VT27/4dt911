from fastapi import APIRouter, HTTPException

from app.schemas.prediction import ConstructorPrediction
from app.services.prediction import CONSTRUCTOR_CACHE

router = APIRouter(prefix="/constructor-predictions", tags=["constructor-predictions"])


@router.get("/{season}/{round_num}", response_model=list[ConstructorPrediction])
def get_all_constructors_for_round(season: str, round_num: str):
    data = CONSTRUCTOR_CACHE.get(season, {}).get(round_num)
    if data is None:
        raise HTTPException(status_code=404, detail="Predictions not found for this race.")
    return list(data.values())

@router.get("/{season}/{round_num}/{team_key}", response_model=ConstructorPrediction)
def get_single_constructor(season: str, round_num: str, team_key: str):
    data = CONSTRUCTOR_CACHE.get(season, {}).get(round_num)
    if data is None:
        raise HTTPException(status_code=404, detail="Predictions not found for this race.")
    if team_key not in data:
        raise HTTPException(status_code=404, detail=f"Constructor '{team_key}' not found.")
    return data[team_key]