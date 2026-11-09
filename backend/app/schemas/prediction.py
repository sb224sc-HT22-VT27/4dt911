from pydantic import BaseModel


class Predictions(BaseModel):
    qualifying_position: int
    race_position: int
    dnf_probability: float  # percent, 0-100


class FantasyPoints(BaseModel):
    floor_p10: float
    expected_p50: float
    ceiling_p90: float


class DriverPrediction(BaseModel):
    race_name: str
    date: str
    driver: str  # driver slug from the feature store
    predictions: PredictionsPredictions
    fantasy_points: FantasyPoints