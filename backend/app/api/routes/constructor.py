from fastapi import APIRouter, HTTPException

from app.schemas.constructor import Constructor
from app.services.constructor_loader import load_constructors_from_csv

router = APIRouter(prefix="/constructors", tags=["constructors"])

CONSTRUCTORS = load_constructors_from_csv("../data/f1-fantasy-data/teams.csv")

@router.get("/", response_model=list[Constructor])
def get_constructors():
    return CONSTRUCTORS