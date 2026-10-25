from pydantic import BaseModel

class Driver(BaseModel):
    # Info
    id: str
    name: str
    number: int
    code: str
    team: str
    team_id: str
    avatarColor: str

    # Stats
    price: float
    ownership: float
    fantasyPoints: int
    predictedPoints: int
    championshipPoints: int