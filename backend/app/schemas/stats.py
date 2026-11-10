from pydantic import BaseModel


class Ratings(BaseModel):
    quali: int
    race: int
    form: int
    reliability: int
    overtaking: int
    trackFit: int


class SeasonStats(BaseModel):
    points: float
    wins: int
    podiums: int
    avgQuali: float | None
    avgFinish: float | None
    avgGained: float | None
    dnfs: int
    avgPitStop: float | None
    fantasyPoints: int
    fantasyPpm: float


class RecentFinish(BaseModel):
    race: str
    position: int
    dnf: bool


class PlayerStats(BaseModel):
    id: str
    code: str | None
    ratings: Ratings
    season: SeasonStats
    trackAvg: float | None
    recentFinishes: list[RecentFinish]


class TeammateStats(BaseModel):
    constructorId: str
    drivers: list[str]
    races: int
    quali: list[int]
    race: list[int]
    points: list[float]
    avgQuali: list[float | None]
    avgFinish: list[float | None]
    dnfs: list[int]