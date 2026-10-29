from fastapi import APIRouter, HTTPException

from app.schemas.driver import Driver
from app.services.driver_loader import load_drivers_from_csv

router = APIRouter(prefix="/drivers", tags=["drivers"])

DRIVERS = load_drivers_from_csv("../data/f1-fantasy-data/drivers.csv")

@router.get("/", response_model=list[Driver])
def get_drivers():
    return DRIVERS