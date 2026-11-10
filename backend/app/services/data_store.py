import functools
from dataclasses import dataclass
 
import pandas as pd
 
from app.services.freeze import FANTASY, read_kaggle

from app.services.prediction import KEY_ALIASES, _slugify
 
# helpers.teams keys that differ from Kaggle constructorRef
TEAM_ALIASES = {
    "racing_bulls": ["rb", "racing_bulls", "alphatauri"],
    "audi": ["audi", "sauber"],
}
TEAM_ALIASES = {
    "racing_bulls": ["rb", "racing_bulls", "alphatauri"],
    "audi": ["audi", "sauber"],
}
# fantasy CSV name -> name used by the ML predictions
KEY_ALIASES = {"alexander_albon": "alex_albon", "kimi_antonelli": "andrea_kimi_antonelli"}

@dataclass(frozen=True)
class Player:
    id: str
    kind: str
    name: str
    price: float
    key: str
    team_key: str
    kaggle_id: int | None
    code: str | None
    fantasy_points: float


@functools.cache
def players() -> dict[str, Player]:
    out: dict[str, Player] = {}

    
 
    kd = read_kaggle("drivers.csv")
    kd["slug"] = (kd["forename"] + " " + kd["surname"]).map(_slugify)
    kd["surname_slug"] = kd["surname"].map(_slugify)
    res = read_kaggle("results.csv").merge(read_kaggle("races.csv")[["raceId", "year"]], on="raceId")
    recent = kd[kd["driverId"].isin(set(res.loc[res["year"] >= 2024, "driverId"]))]
 
    def match_driver(name: str):
        hit = kd[kd["slug"] == _slugify(name)]
        if len(hit) != 1:
            hit = recent[recent["surname_slug"] == _slugify(name.split()[-1])]
        return hit.iloc[0] if len(hit) == 1 else None
 
    drv = pd.read_csv(FANTASY + "drivers.csv")
    drv = drv[drv["is_active_seat"] == True]
    drv["fantasy_points_total"] = pd.to_numeric(drv["fantasy_points_total"], errors="coerce").fillna(0)
    for _, r in drv.iterrows():
        name = str(r["driver_name"])
        key = KEY_ALIASES.get(_slugify(name), _slugify(name))
        m = match_driver(name)
        if m is None:
            print(f"[data_store] no Kaggle match for driver '{name}'")
        out[str(r["player_id"])] = Player(
            id=str(r["player_id"]), kind="driver", name=name, price=float(r["price_m"]),
            key=key, team_key=str(r["team_key"]),
            kaggle_id=int(m["driverId"]) if m is not None else None,
            code=str(m["code"]) if m is not None and pd.notna(m["code"]) else None,
            fantasy_points=float(r["fantasy_points_total"]),
        )
 
    kc = read_kaggle("constructors.csv")
    con = pd.read_csv(FANTASY + "teams.csv")
    con["fantasy_points_total"] = pd.to_numeric(con["fantasy_points_total"], errors="coerce").fillna(0)
    for _, r in con.iterrows():
        key = str(r["team_key"])
        m = None
        for ref in TEAM_ALIASES.get(key, [key]):
            hit = kc[kc["constructorRef"] == ref]
            if not hit.empty:
                m = hit.iloc[0]
                break
        if m is None:
            print(f"[data_store] no Kaggle match for constructor '{key}'")
        out[str(r["player_id"])] = Player(
            id=str(r["player_id"]), kind="constructor", name=str(r["team_name"]),
            price=float(r["price_m"]), key=key, team_key=key,
            kaggle_id=int(m["constructorId"]) if m is not None else None,
            code=None, fantasy_points=float(r["fantasy_points_total"]),
        )
    return out
 
