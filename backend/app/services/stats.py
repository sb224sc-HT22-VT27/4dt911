"""Season stats, ratings and teammate head-to-heads built from the Kaggle CSVs."""
import functools

import pandas as pd

from app.services.data_store import players
from app.services.freeze import freeze_date, read_kaggle, season
from app.services.track_types import track_type

HISTORY_FROM = 2023
TRACK_FIT_SCALE = 5.0   # finishing 1 place better than own average on this track type = +5 rating
MAX_PIT_SECONDS = 60    # drops red-flag "pit stops"


def _f(x, nd: int = 1):
    return None if pd.isna(x) else round(float(x), nd)


def _pct(s: pd.Series, higher_better: bool) -> pd.Series:
    """0-100 rank versus the grid (100 = best)."""
    n = s.notna().sum()
    if n < 2:
        return s.where(s.isna(), 50.0)
    return (s.rank(ascending=higher_better) - 1) / (n - 1) * 100


@functools.cache
def _frames() -> dict:
    races = read_kaggle("races.csv")
    races["date"] = pd.to_datetime(races["date"])
    circuits = read_kaggle("circuits.csv")[["circuitId", "circuitRef"]]
    races = races.merge(circuits, on="circuitId", how="left")
    races["trackType"] = races["circuitRef"].map(track_type)
    played = races[races["date"] <= freeze_date()]
    race_cols = played[["raceId", "year", "round", "date", "circuitId", "name", "trackType"]]

    res = read_kaggle("results.csv").merge(read_kaggle("status.csv"), on="statusId").merge(race_cols, on="raceId")
    res["dnf"] = ~(res["status"].isin(["Finished", "Lapped"]) | res["status"].str.startswith("+"))
    last = res.groupby("raceId")["positionOrder"].transform("max")
    res["gridPos"] = res["grid"].where(res["grid"] > 0, last)  # pit lane start = last
    res["gained"] = res["gridPos"] - res["positionOrder"]
    res = res.sort_values(["date", "raceId"]).reset_index(drop=True)
    this = res[res["year"] == season()]

    year_of = race_cols[["raceId", "year"]]
    sprint = read_kaggle("sprint_results.csv").merge(year_of, on="raceId")
    quali = read_kaggle("qualifying.csv").merge(year_of, on="raceId")
    pits = read_kaggle("pit_stops.csv")
    pits["duration"] = pd.to_numeric(pits["duration"], errors="coerce")
    pits = pits[pits["duration"] < MAX_PIT_SECONDS].merge(
        this[["raceId", "driverId", "constructorId"]], on=["raceId", "driverId"]
    )
    return {
        "all_races": races,
        "this": this,
        "hist": res[res["year"] >= HISTORY_FROM],
        "sprint": sprint[sprint["year"] == season()],
        "quali": quali[quali["year"] == season()],
        "pits": pits,
    }


def _round_info(round_num: int) -> tuple[int, str]:
    r = _frames()["all_races"]
    hit = r[(r["year"] == season()) & (r["round"] == round_num)]
    if hit.empty:
        raise ValueError(f"Round {round_num} not found in {season()}")
    row = hit.iloc[0]
    return int(row["circuitId"]), row["trackType"]


def _build(kind: str, round_num: int) -> tuple[dict, ...]:
    key = "driverId" if kind == "driver" else "constructorId"
    f = _frames()
    this, hist = f["this"], f["hist"]
    circuit_id, ttype = _round_info(round_num)

    g = this.groupby(key)
    agg = pd.DataFrame({
        "n": g.size(),
        "points": g["points"].sum(),
        "wins": g["positionOrder"].apply(lambda s: int((s == 1).sum())),
        "podiums": g["positionOrder"].apply(lambda s: int((s <= 3).sum())),
        "avgFinish": g["positionOrder"].mean(),
        "dnfs": g["dnf"].sum(),
    })
    agg["avgGained"] = this[~this["dnf"]].groupby(key)["gained"].mean()
    agg["avgQuali"] = f["quali"].groupby(key)["position"].mean()
    agg["sprintPts"] = f["sprint"].groupby(key)["points"].sum()
    agg["sprintPts"] = agg["sprintPts"].fillna(0)
    agg["avgPit"] = f["pits"].groupby(key)["duration"].mean()
    n_form = 5 if kind == "driver" else 10  # constructors: 5 races x 2 cars
    agg["formAvg"] = this.groupby(key).tail(n_form).groupby(key)["positionOrder"].mean()

    ratings = pd.DataFrame({
        "quali": _pct(agg["avgQuali"], False),
        "race": _pct(agg["avgFinish"], False),
        "form": _pct(agg["formAvg"], False),
        "reliability": _pct(agg["dnfs"] / agg["n"], False),
        "overtaking": _pct(agg["avgGained"], True),
    })
    overall = hist.groupby(key)["positionOrder"].mean()
    same = hist[hist["trackType"] == ttype].groupby(key)["positionOrder"].mean()
    ratings["trackFit"] = (50 + (overall - same) * TRACK_FIT_SCALE).clip(0, 100)
    ratings = ratings.fillna(50).round().astype(int)

    track_avg = hist[hist["circuitId"] == circuit_id].groupby(key)["positionOrder"].mean()

    per_race = (
        this.groupby([key, "raceId"], sort=False)
        .agg(position=("positionOrder", "min"), dnf=("dnf", "all"), date=("date", "first"), name=("name", "first"))
        .reset_index()
        .sort_values("date")
    )
    recent = {k: grp.tail(5) for k, grp in per_race.groupby(key)}

    out = []
    for p in players().values():
        if p.kind != kind or p.kaggle_id not in agg.index:
            continue
        k = p.kaggle_id
        a, r = agg.loc[k], ratings.loc[k]
        out.append({
            "id": p.id,
            "code": p.code,
            "ratings": {c: int(r[c]) for c in ratings.columns},
            "season": {
                "points": round(float(a["points"] + a["sprintPts"]), 1),
                "wins": int(a["wins"]),
                "podiums": int(a["podiums"]),
                "avgQuali": _f(a["avgQuali"]),
                "avgFinish": _f(a["avgFinish"]),
                "avgGained": _f(a["avgGained"]),
                "dnfs": int(a["dnfs"]),
                "avgPitStop": _f(a["avgPit"], 2),
                "fantasyPoints": int(round(p.fantasy_points)),
                "fantasyPpm": round(p.fantasy_points / p.price, 2) if p.price else 0.0,
            },
            "trackAvg": _f(track_avg.get(k)),
            "recentFinishes": [
                {"race": row.name.replace(" Grand Prix", ""), "position": int(row.position), "dnf": bool(row.dnf)}
                for row in recent[k].itertuples()
            ],
        })
    return tuple(out)


@functools.lru_cache(maxsize=64)
def stats_for(kind: str, round_num: int) -> tuple[dict, ...]:
    return _build(kind, round_num)


def ratings_lookup(kind: str, round_num: int) -> dict[str, dict]:
    return {row["id"]: row["ratings"] for row in stats_for(kind, round_num)}


@functools.cache
def teammates() -> list[dict]:
    f = _frames()
    this, quali = f["this"], f["quali"]
    ps = players().values()
    out = []
    for team in (p for p in ps if p.kind == "constructor" and p.kaggle_id is not None):
        pair = [p for p in ps if p.kind == "driver" and p.team_key == team.team_key and p.kaggle_id is not None][:2]
        if len(pair) < 2:
            continue
        a, b = pair
        sub = this[this["constructorId"] == team.kaggle_id]
        ra = sub[sub["driverId"] == a.kaggle_id].set_index("raceId")
        rb = sub[sub["driverId"] == b.kaggle_id].set_index("raceId")
        common = ra.index.intersection(rb.index)
        if len(common) == 0:
            continue
        ra, rb = ra.loc[common], rb.loc[common]
        qa, qb = (
            quali[quali["driverId"] == d.kaggle_id].set_index("raceId")["position"].reindex(common)
            for d in (a, b)
        )
        both = qa.notna() & qb.notna()
        out.append({
            "constructorId": team.id,
            "drivers": [a.id, b.id],
            "races": int(len(common)),
            "quali": [int((qa[both] < qb[both]).sum()), int((qb[both] < qa[both]).sum())],
            "race": [int((ra["positionOrder"] < rb["positionOrder"]).sum()),
                     int((rb["positionOrder"] < ra["positionOrder"]).sum())],
            "points": [round(float(ra["points"].sum()), 1), round(float(rb["points"].sum()), 1)],
            "avgQuali": [_f(qa.mean()), _f(qb.mean())],
            "avgFinish": [_f(ra["positionOrder"].mean()), _f(rb["positionOrder"].mean())],
            "dnfs": [int(ra["dnf"].sum()), int(rb["dnf"].sum())],
        })
    return out