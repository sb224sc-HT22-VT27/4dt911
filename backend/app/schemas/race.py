from pydantic import BaseModel

class Race(BaseModel):

    # Info
    id: str
    year: int
    round: int
    circuit_id: str
    name: str
    date: str
    time: str
    fp1_date: str
    fp1_time: str
    fp2_date: str | None
    fp2_time: str | None
    fp3_date: str | None
    fp3_time: str | None
    quali_date: str
    quali_time: str
    sprint_date: str | None
    sprint_time: str | None