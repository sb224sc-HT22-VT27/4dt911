from fastapi import APIRouter, HTTPException

from app.schemas.race import Race
from app.services.upcomming_race import load_uppcoming_races_from_csv

router = APIRouter(prefix="/races", tags=["races"])

RACES = load_uppcoming_races_from_csv("../data/kaggle-base-data/races.csv")

@router.get("/", response_model=list[Race])
def get_upcoming_races():
    return RACES