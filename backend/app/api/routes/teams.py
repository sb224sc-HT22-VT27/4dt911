from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.schemas.planner import EvaluateRequest, OptimizeRequest
from app.services import optimizer

router = APIRouter(tags=["teams"])


@router.post("/teams/evaluate")
def evaluate_team(req: EvaluateRequest):
    try:
        return optimizer.evaluate(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/optimize")
def optimize(req: OptimizeRequest):
    result = optimizer.best_team(req)
    if result is None:
        return JSONResponse(status_code=422, content={"error": "No team fits the budget"})
    return result