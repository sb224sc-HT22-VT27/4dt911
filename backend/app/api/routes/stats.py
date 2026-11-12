from fastapi import APIRouter, HTTPException, Query

from app.schemas.stats import PlayerStats, TeammateStats
from app.services import stats

router = APIRouter(prefix="/stats", tags=["stats"])


def _get(kind: str, round_num: int):
    try:
        return list(stats.stats_for(kind, round_num))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/drivers", response_model=list[PlayerStats])
def driver_stats(round_num: int = Query(..., alias="round")):
    return _get("driver", round_num)


@router.get("/constructors", response_model=list[PlayerStats])
def constructor_stats(round_num: int = Query(..., alias="round")):
    return _get("constructor", round_num)


@router.get("/teammates", response_model=list[TeammateStats])
def teammate_stats():
    return stats.teammates()