from typing import Literal

from pydantic import BaseModel, Field

Risk = Literal["floor", "expected", "ceiling"]
RISKS = ("floor", "expected", "ceiling")


class Settings(BaseModel):
    rounds: list[str]
    risk: Risk = "expected"
    form: float = 0
    track: float = 0
    dnf: float = 0


class UpcomingRace(BaseModel):
    round: str
    name: str
    date: str
    circuit: str
    location: str
    trackType: Literal["street", "high_speed", "technical"]


class PredictionRow(BaseModel):
    id: str
    kind: Literal["driver", "constructor"]
    floor: float
    expected: float
    ceiling: float
    ppm: float
    dnfChance: float | None
    qualiPos: int | None
    racePos: int | None


class TeamSelection(BaseModel):
    drivers: list[str]
    constructors: list[str]


class EvaluateRequest(Settings, TeamSelection):
    drs: str | None = None


class OptimizeRequest(Settings):
    budget: float
    currentTeam: TeamSelection | None = None
    freeTransfers: int = Field(0, ge=0, le=3)
    maxTransfers: int | None = None