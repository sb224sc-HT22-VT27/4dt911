"""Builds mock_stats.json (non-fantasy driver/constructor stats keyed by fantasy player_id) from the Kaggle data.
Run: python3 statsMocker.py"""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
KAGGLE = HERE.parent.parent / "data" / "kaggle-base-data"
FANTASY = HERE.parent.parent / "data" / "f1-fantasy-data"
SEASON = "2026"
HISTORY_FROM = "2023"

TRACK_TYPES = {
    "street": ["monaco", "baku", "marina_bay", "jeddah", "vegas", "miami", "madring", "albert_park", "villeneuve"],
    "high_speed": ["monza", "spa", "silverstone", "red_bull_ring", "losail", "suzuka", "interlagos", "bahrain", "sepang"],
    "technical": ["hungaroring", "catalunya", "zandvoort", "rodriguez", "imola", "yas_marina", "shanghai", "americas"],
}
TRACK_TYPE_OF = {ref: t for t, refs in TRACK_TYPES.items() for ref in refs}
TEAM_KEY_OF = {"rb": "racing_bulls", "alphatauri": "racing_bulls", "sauber": "audi", "alfa": "audi"}


def read(name, folder=KAGGLE):
    with open(f"{folder}/{name}", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def clamp(v):
    return max(0, min(100, round(v)))


def pos_rating(avg):
    return clamp(100 * (22 - avg) / 21) if avg is not None else 50


def num(v):
    return int(v) if v.isdigit() else 0


def avg(values):
    return sum(values) / len(values) if values else None


races = {r["raceId"]: r for r in read("races.csv") if r["year"] >= HISTORY_FROM}
circuits = {c["circuitId"]: c for c in read("circuits.csv")}
status = {s["statusId"]: s["status"] for s in read("status.csv")}
kaggle_drivers = {d["driverId"]: d["code"] for d in read("drivers.csv")}
kaggle_teams = {c["constructorId"]: c["constructorRef"] for c in read("constructors.csv")}
quali = [q for q in read("qualifying.csv") if q["raceId"] in races]
results = [r for r in read("results.csv") if r["raceId"] in races]
sprints = [r for r in read("sprint_results.csv") if r["raceId"] in races]
pits = [p for p in read("pit_stops.csv") if p["raceId"] in races]


def is_dnf(r):
    s = status[r["statusId"]]
    return not (s == "Finished" or s.startswith("+"))


def season_race(race_id):
    return races[race_id]["year"] == SEASON


def summarise(rows, quali_rows, sprint_rows, pit_rows, form_results=5):
    """rows are all race results for one driver or one team"""
    season = [r for r in rows if season_race(r["raceId"])]
    season.sort(key=lambda r: races[r["raceId"]]["date"])
    finishes = [int(r["positionOrder"]) for r in season]
    recent = finishes[-form_results:]
    gained = [num(r["grid"]) - int(r["positionOrder"]) for r in season if not is_dnf(r) and num(r["grid"]) > 0]
    q_pos = [num(q["position"]) for q in quali_rows if season_race(q["raceId"]) and num(q["position"])]
    dnfs = sum(is_dnf(r) for r in season)
    points = sum(float(r["points"]) for r in season) + sum(float(r["points"]) for r in sprint_rows if season_race(r["raceId"]))
    pit_times = [float(p["duration"]) for p in pit_rows if season_race(p["raceId"]) and re.fullmatch(r"\d+(\.\d+)?", p["duration"]) and float(p["duration"]) < 60]

    # Last 5 races, best car for constructors (DNF only if no car finished)
    by_race = defaultdict(list)
    for r in season:
        by_race[r["raceId"]].append(r)
    recent_finishes = [
        {
            "race": races[race_id]["name"].replace(" Grand Prix", ""),
            "position": min(int(r["positionOrder"]) for r in by_race[race_id]),
            "dnf": all(is_dnf(r) for r in by_race[race_id]),
        }
        for race_id in sorted(by_race, key=lambda i: races[i]["date"])[-5:]
    ]

    overall = avg([int(r["positionOrder"]) for r in rows])
    track_fit, history = {}, defaultdict(list)
    for r in rows:
        history[circuits[races[r["raceId"]]["circuitId"]]["circuitRef"]].append(int(r["positionOrder"]))
    for t, refs in TRACK_TYPES.items():
        typed = [p for ref in refs for p in history.get(ref, [])]
        track_fit[t] = clamp(50 + (overall - avg(typed)) * 8) if len(typed) >= 2 and overall else 50

    return {
        "ratings": {
            "quali": pos_rating(avg(q_pos)),
            "race": pos_rating(avg(finishes)),
            "form": pos_rating(avg(recent)),
            "reliability": clamp(100 * (1 - (dnfs / len(season) if season else 0.15) / 0.3)),
            "overtaking": clamp(50 + (avg(gained) or 0) * 10),
        },
        "trackFit": track_fit,
        "season": {
            "starts": len(season),
            "wins": finishes.count(1),
            "podiums": sum(p <= 3 for p in finishes),
            "points": round(points, 1),
            "avgQuali": round(avg(q_pos), 1) if q_pos else None,
            "avgFinish": round(avg(finishes), 1) if finishes else None,
            "bestFinish": min(finishes) if finishes else None,
            "dnfs": dnfs,
            "avgGained": round(avg(gained), 1) if gained else 0,
            "avgPitStop": round(avg(pit_times), 2) if pit_times else None,
        },
        "trackHistory": {ref: round(avg(p), 1) for ref, p in history.items()},
        "recentFinishes": recent_finishes,
    }


fantasy_drivers = [d for d in read("drivers.csv", FANTASY) if d["is_active_seat"] == "True"]
fantasy_teams = read("teams.csv", FANTASY)

drivers_out = {}
for d in fantasy_drivers:
    ids = {k for k, code in kaggle_drivers.items() if code == d["driver_code"]}
    drivers_out[d["player_id"]] = {
        "name": d["driver_name"],
        "code": d["driver_code"],
        "team": d["team_name"],
        **summarise(
            [r for r in results if r["driverId"] in ids],
            [q for q in quali if q["driverId"] in ids],
            [s for s in sprints if s["driverId"] in ids],
            [p for p in pits if p["driverId"] in ids],
        ),
    }

constructors_out = {}
for t in fantasy_teams:
    ids = {k for k, ref in kaggle_teams.items() if TEAM_KEY_OF.get(ref, ref) == t["team_key"]}
    rows = [r for r in results if r["constructorId"] in ids]
    race_drivers = {(r["raceId"], r["driverId"]) for r in rows}
    constructors_out[t["player_id"]] = {
        "name": t["team_name"],
        **summarise(
            rows,
            [q for q in quali if q["constructorId"] in ids],
            [s for s in sprints if s["constructorId"] in ids],
            [p for p in pits if (p["raceId"], p["driverId"]) in race_drivers],
            form_results=10,
        ),
    }

tracks_out = {}
for r in races.values():
    if r["year"] == SEASON:
        c = circuits[r["circuitId"]]
        tracks_out[r["round"]] = {
            "circuit": c["name"],
            "circuitRef": c["circuitRef"],
            "location": c["location"],
            "type": TRACK_TYPE_OF.get(c["circuitRef"], "technical"),
        }

with open(HERE / "mock_stats.json", "w", encoding="utf-8") as f:
    json.dump({SEASON: {"tracks": tracks_out, "drivers": drivers_out, "constructors": constructors_out}}, f, indent=2, ensure_ascii=False)

print(f"Wrote mock_stats.json: {len(drivers_out)} drivers, {len(constructors_out)} constructors")
