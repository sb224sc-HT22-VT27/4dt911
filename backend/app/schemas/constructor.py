from pydantic import BaseModel

class Constructor(BaseModel):
    # Info
    id: str
    name: str
    code: str
    avatarColor: str

    # Stats
    price: float
    ownership: float
    fantasyPoints: int
    predictedPoints: int 
    championshipPoints: int