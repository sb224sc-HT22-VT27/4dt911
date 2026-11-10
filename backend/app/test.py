"""Calls every endpoint in-process and prints the responses plus consistency checks.

Run from the backend root:  python -m app.test_print
Needs: pip install httpx   (FastAPI's TestClient)
Needs MLFLOW_TRACKING_URI / _USERNAME / _PASSWORD in the environment, as for the API.
"""
import json

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.api.routes.races import RACES
from app.services.prediction import load_predictions

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", None)

# TestClient used without `with` -> lifespan is NOT run, we load predictions ourselves below
client = TestClient(app)
RESULTS: list[tuple[str, bool]] = []


def check(name: str, ok: bool) -> None:
    RESULTS.append((name, bool(ok)))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")


def show(title: str, resp, n: int = 2):
    print(f"\n=== {title} -> {resp.status_code} ===")
    try:
        data = resp.json()
    except Exception:
        print(resp.text[:500])
        return None
    if isinstance(data, list):
        print(f"{len(data)} items, first {min(n, len(data))}:")
        print(json.dumps(data[:n], indent=2))
    else:
        print(json.dumps(data, indent=2))
    return data


def settings(rounds, risk="expected", form=0, track=0, dnf=0) -> dict:
    return {"rounds": [str(r) for r in rounds], "risk": risk, "form": form, "track": track, "dnf": dnf}


def qs(s: dict) -> str:
    return f"rounds={','.join(s['rounds'])}&risk={s['risk']}&form={s['form']}&track={s['track']}&dnf={s['dnf']}"


# ---------------------------------------------------------------- setup
nxt = min(RACES, key=lambda r: r.date)
rnd = str(nxt.round)
load_predictions(season=str(nxt.year), round_num=rnd, race_name=nxt.name, date=nxt.date[:10])
base = settings([rnd])

# ---------------------------------------------------------------- existing endpoints
drivers = show("GET /drivers", client.get("/drivers/"), 1)
constructors = show("GET /constructors", client.get("/constructors/"), 1)
price = {p["id"]: p["price"] for p in drivers + constructors}

# ---------------------------------------------------------------- GET /races/upcoming
upcoming = show("GET /races/upcoming", client.get("/races/upcoming"), 3)
print(pd.DataFrame(upcoming).to_string(index=False))
check("upcoming has the 6 fields", all(set(r) == {"round", "name", "date", "circuit", "location", "trackType"} for r in upcoming))
check("upcoming ordered by round", [int(r["round"]) for r in upcoming] == sorted(int(r["round"]) for r in upcoming))
check("trackType values valid", all(r["trackType"] in {"street", "high_speed", "technical"} for r in upcoming))

# ---------------------------------------------------------------- GET /predictions
preds = show(f"GET /predictions?{qs(base)}", client.get(f"/predictions?{qs(base)}"), 2)
df = pd.DataFrame(preds)
print("\nTop 10 by expected:")
print(df.sort_values("expected", ascending=False).head(10).to_string(index=False))
check("one row per id", df["id"].is_unique)
check("floor <= expected <= ceiling", ((df["floor"] <= df["expected"]) & (df["expected"] <= df["ceiling"])).all())
check("all prediction ids exist in /drivers or /constructors", set(df["id"]) <= set(price))
check("drivers have quali/race pos", df[df["kind"] == "driver"][["qualiPos", "racePos"]].notna().all().all())
check("constructors have null positions", df[df["kind"] == "constructor"][["qualiPos", "racePos"]].isna().all().all())
n_d, n_c = (df["kind"] == "driver").sum(), (df["kind"] == "constructor").sum()
print(f"  drivers with prediction: {n_d}/{len(drivers)}, constructors: {n_c}/{len(constructors)}")

# settings applied
adj = client.get(f"/predictions?{qs(settings([rnd], form=50, track=50, dnf=50))}").json()
adj_df = pd.DataFrame(adj).set_index("id")
cmp = df.set_index("id")[["expected"]].join(adj_df[["expected"]], rsuffix="_adjusted")
cmp["diff"] = (cmp["expected_adjusted"] - cmp["expected"]).round(1)
print("\nSettings form=50 track=50 dnf=50, largest changes:")
print(cmp.reindex(cmp["diff"].abs().sort_values(ascending=False).index).head(5).to_string())
check("settings change something", (cmp["diff"] != 0).any())

# several rounds are summed
rounds3 = [str(r["round"]) for r in upcoming[:3]]
multi = pd.DataFrame(client.get(f"/predictions?{qs(settings(rounds3))}").json()).set_index("id")
check("3 rounds ~= 3x one round (no per-round data yet)", ((multi["expected"] - 3 * df.set_index("id")["expected"]).abs() < 0.5).all())

# ---------------------------------------------------------------- GET /predictions/by-round
br = show(f"GET /predictions/by-round (rounds {rounds3})", client.get(f"/predictions/by-round?{qs(settings(rounds3))}"), 3)
check("by-round sorted by total desc", [r["total"] for r in br] == sorted((r["total"] for r in br), reverse=True))
check("by-round has a value per round", all(set(r["points"]) == set(rounds3) for r in br))
check("by-round total == sum of points", all(abs(r["total"] - sum(r["points"].values())) < 0.15 for r in br))
check("by-round includes drivers and constructors", {r["kind"] for r in br} == {"driver", "constructor"})
single = {r["id"]: r["total"] for r in client.get(f"/predictions/by-round?{qs(base)}").json()}
check("by-round (1 round) == /predictions expected", all(abs(single[i] - e) < 0.15 for i, e in zip(df["id"], df["expected"])))

# ---------------------------------------------------------------- GET /stats/*
sd = show(f"GET /stats/drivers?round={rnd}", client.get(f"/stats/drivers?round={rnd}"), 1)
sc = show(f"GET /stats/constructors?round={rnd}", client.get(f"/stats/constructors?round={rnd}"), 1)
print("\nDriver ratings:")
print(pd.DataFrame([{"id": s["id"], "code": s["code"], **s["ratings"], "trackAvg": s["trackAvg"],
                     "points": s["season"]["points"], "avgQuali": s["season"]["avgQuali"],
                     "avgFinish": s["season"]["avgFinish"], "dnfs": s["season"]["dnfs"]} for s in sd]).to_string(index=False))
check("stats cover all drivers", len(sd) == len(drivers))
check("stats cover all constructors", len(sc) == len(constructors))
check("ratings within 0-100", all(0 <= v <= 100 for s in sd + sc for v in s["ratings"].values()))
check("constructor code is null", all(s["code"] is None for s in sc))
check("recentFinishes <= 5", all(len(s["recentFinishes"]) <= 5 for s in sd + sc))
bad = client.get("/stats/drivers?round=999")
print(f"\nGET /stats/drivers?round=999 -> {bad.status_code} (expected 404)")
check("unknown round -> 404", bad.status_code == 404)

tm = show("GET /stats/teammates", client.get("/stats/teammates"), 2)
check("teammates: pairs of 2 drivers", all(len(t["drivers"]) == 2 for t in tm))
check("teammates: quali counts <= races", all(sum(t["quali"]) <= t["races"] for t in tm))
check("teammates: race counts <= races", all(sum(t["race"]) <= t["races"] for t in tm))

# ---------------------------------------------------------------- POST /teams/evaluate
top = df.sort_values("expected", ascending=False)
top_d = top[top["kind"] == "driver"]["id"].head(5).tolist()
top_c = top[top["kind"] == "constructor"]["id"].head(2).tolist()
req = {**base, "drivers": top_d, "constructors": top_c, "drs": top_d[0]}
ev = show("POST /teams/evaluate (top-5 drivers + top-2 constructors, DRS = best)", client.post("/teams/evaluate", json=req))
exp_by_id = df.set_index("id")["expected"]
hand = round(exp_by_id[top_d + top_c].sum() + exp_by_id[top_d[0]], 1)
check("evaluate expected == hand sum + DRS bonus", abs(ev["expected"] - hand) < 0.15)
check("evaluate cost == sum of prices", abs(ev["cost"] - round(sum(price[i] for i in top_d + top_c), 1)) < 0.05)
check("evaluate keeps drs", ev["drs"] == top_d[0])
ev2 = client.post("/teams/evaluate", json={**req, "drs": "not-in-team"}).json()
check("evaluate drs null when driver not in team", ev2["drs"] is None)

# ---------------------------------------------------------------- POST /optimize
opt = show("POST /optimize (budget 100)", client.post("/optimize", json={**base, "budget": 100}))
check("optimize: 5 drivers + 2 constructors", len(opt["drivers"]) == 5 and len(opt["constructors"]) == 2)
check("optimize: within budget", sum(price[i] for i in opt["drivers"] + opt["constructors"]) <= 100 + 1e-6)
check("optimize: drs is one of the drivers", opt["drs"] in opt["drivers"])
ev_opt = client.post("/teams/evaluate", json={**base, "drivers": opt["drivers"], "constructors": opt["constructors"], "drs": opt["drs"]}).json()
check("optimize points == evaluate expected of same team", abs(opt["points"] - ev_opt["expected"]) < 0.15)
check("optimize beats the naive top-5/top-2 team (if affordable)",
      ev["cost"] > 100 or opt["points"] >= ev["expected"] - 0.15)

for risk in ("floor", "ceiling"):
    o = client.post("/optimize", json={**settings([rnd], risk=risk), "budget": 100}).json()
    print(f"  risk={risk}: points {o['points']}, drs {o['drs']}")

too_small = client.post("/optimize", json={**base, "budget": 1})
print(f"\nPOST /optimize budget=1 -> {too_small.status_code} {too_small.json()}")
check("no team fits -> 422 {'error': ...}", too_small.status_code == 422 and too_small.json() == {"error": "No team fits the budget"})

# transfers: the current team must be affordable, so start from the floor-risk optimum
cur_opt = client.post("/optimize", json={**settings([rnd], risk="floor"), "budget": 100}).json()
current = {"drivers": cur_opt["drivers"], "constructors": cur_opt["constructors"]}
print(f"\nCurrent team (floor-risk optimum, cost {sum(price[i] for i in current['drivers'] + current['constructors']):.1f}): {current}")
free = 2
t_any = show("POST /optimize with currentTeam (extra transfers allowed)",
             client.post("/optimize", json={**base, "budget": 100, "currentTeam": current, "freeTransfers": free}))
t_free = show(f"POST /optimize with currentTeam, maxTransfers={free}",
              client.post("/optimize", json={**base, "budget": 100, "currentTeam": current, "freeTransfers": free, "maxTransfers": free}))
ok_any, ok_free = "transfers" in t_any, "transfers" in t_free
check("transfer calls return a team (staying put is always feasible)", ok_any and ok_free)
if ok_any and ok_free:
    for label, t in (("unlimited", t_any), ("free only", t_free)):
        n_out = sum(1 for x in t["transfers"] if x["out"])
        check(f"{label}: penaltyPoints == 10 * max(0, outs - free)", t["penaltyPoints"] == 10 * max(0, n_out - free))
    check("free only: <= maxTransfers swapped out", sum(1 for x in t_free["transfers"] if x["out"]) <= free)
    check("free only: no penalty", t_free["penaltyPoints"] == 0)
    check("unlimited >= free only", t_any["points"] >= t_free["points"] - 0.15)
    check("optimum >= staying put", t_any["points"] >= t_any["currentPoints"] - 0.15)
    best_cur = max(current["drivers"], key=lambda i: exp_by_id[i])
    ev_cur = client.post("/teams/evaluate", json={**base, **current, "drs": best_cur}).json()
    check("currentPoints == evaluate expected of current team", abs(t_any["currentPoints"] - ev_cur["expected"]) < 0.15)

    # current team with an empty slot -> new player fills it with out = null
    partial = {"drivers": current["drivers"][:4], "constructors": current["constructors"]}
    t_empty = client.post("/optimize", json={**base, "budget": 100, "currentTeam": partial, "freeTransfers": 1}).json()
    print("\nPartial team transfers:", json.dumps(t_empty.get("transfers", t_empty)))
    check("empty slot filled with out=null", any(x["out"] is None for x in t_empty.get("transfers", [])))

# ---------------------------------------------------------------- summary
failed = [n for n, ok in RESULTS if not ok]
print(f"\n=== {len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed ===")
for n in failed:
    print("  FAILED:", n)