"""Turns the cached model predictions into the planner's rows, with the user's settings applied."""
from dataclasses import dataclass

from app.schemas.planner import PredictionRow, Settings
from app.services import stats
from app.services.data_store import Player, players
from app.services.freeze import season
from app.services.prediction import CONSTRUCTOR_CACHE, PREDICTION_CACHE

DNF_PENALTY = 20.0  # race DNF points


@dataclass
class RoundPts:
    floor: float
    expected: float
    ceiling: float
    dnf_chance: float | None
    quali_pos: int | None
    race_pos: int | None


def _round_data(cache: dict, rnd: str):
    """Predictions exist only for the race the models were run for. Other rounds fall back
    to the latest loaded round (settings like `track` still differ per round)."""
    by_round = cache.get(str(season()), {})
    if rnd in by_round:
        return by_round[rnd]
    return by_round[max(by_round, key=int)] if by_round else None


def _factor(p: Player, rnd: str, s: Settings) -> float:
    # PLACEHOLDER semantics for the form / track sliders (-100..100): +100 = scale points by
    # up to +/-100% depending on the player's form / trackFit rating (50 = neutral).
    if not (s.form or s.track):
        return 1.0
    try:
        r = stats.ratings_lookup(p.kind, int(rnd)).get(p.id)
    except ValueError:
        r = None
    if r is None:
        return 1.0
    f = 1 + s.form / 100 * (r["form"] - 50) / 50 + s.track / 100 * (r["trackFit"] - 50) / 50
    return min(max(f, 0.0), 2.0)


def round_points(p: Player, rnd: str, s: Settings) -> RoundPts | None:
    drivers = _round_data(PREDICTION_CACHE, rnd) or {}
    if p.kind == "driver":
        pred = drivers.get(p.key)
        if pred is None:
            return None
        dnf = pred.predictions.dnf_probability
        qp, rp = pred.predictions.qualifying_position, pred.predictions.race_position
    else:
        data = _round_data(CONSTRUCTOR_CACHE, rnd) or {}
        pred = data.get(p.key)
        if pred is None:
            return None
        dnf = sum(drivers[d].predictions.dnf_probability for d in pred.drivers if d in drivers)
        qp = rp = None
    base = pred.fantasy_points
    factor = _factor(p, rnd, s)
    # PLACEHOLDER: `dnf` slider (0..100) = extra weight on expected DNF loss
    penalty = s.dnf / 100 * dnf / 100 * DNF_PENALTY

    def adj(x: float) -> float:
        return round(x * factor - penalty, 1)

    return RoundPts(adj(base.floor_p10), adj(base.expected_p50), adj(base.ceiling_p90),
                    dnf if p.kind == "driver" else None, qp, rp)


def player_row(p: Player, s: Settings) -> PredictionRow | None:
    parts = [x for r in s.rounds if (x := round_points(p, r, s))]
    if not parts:
        return None
    tot = {k: round(sum(getattr(x, k) for x in parts), 1) for k in ("floor", "expected", "ceiling")}
    dnfs = [x.dnf_chance for x in parts if x.dnf_chance is not None]
    return PredictionRow(
        id=p.id, kind=p.kind, **tot,
        ppm=round(tot[s.risk] / p.price, 2) if p.price else 0.0,
        dnfChance=round(sum(dnfs) / len(dnfs), 1) if dnfs else None,
        qualiPos=parts[0].quali_pos, racePos=parts[0].race_pos,
    )


def all_rows(s: Settings) -> list[PredictionRow]:
    return [row for p in players().values() if (row := player_row(p, s))]


def by_round(s: Settings) -> list[dict]:
    out = []
    for p in players().values():
        pts = {}
        for r in s.rounds:
            x = round_points(p, r, s)
            if x:
                pts[r] = getattr(x, s.risk)
        if pts:
            out.append({"id": p.id, "kind": p.kind, "points": pts, "total": round(sum(pts.values()), 1)})
    return sorted(out, key=lambda d: d["total"], reverse=True)