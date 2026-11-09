"""Mock backend for the endpoints the real backend doesn't have yet (see ../API_ENDPOINTS.md).
Run: python3 mock_api/mock_server.py   (serves http://localhost:8001)
Only uses the standard library so it can be moved into the backend later."""
import csv
import json
import re
import unicodedata
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import combinations, zip_longest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
FANTASY = HERE.parent.parent / "data" / "f1-fantasy-data"
SEASON = "2026"
PORT = 8001
# The app is frozen before this round (Italian GP), races from here on are "upcoming"
FREEZE_ROUND = 13
# Points lost for every transfer beyond the free ones (F1 Fantasy rule)
TRANSFER_PENALTY = 10

DRIVER_PREDICTIONS = json.loads((HERE / "mock_predictions.json").read_text())[SEASON]
CONSTRUCTOR_PREDICTIONS = json.loads((HERE / "mock_constructors.json").read_text())[SEASON]
STATS = json.loads((HERE / "mock_stats.json").read_text(encoding="utf-8"))[SEASON]

# Prediction mock keys that differ from the fantasy names
DRIVER_ALIASES = {"kimi_antonelli": "andrea_kimi_antonelli", "alexander_albon": "alex_albon"}
# Team ids used by predictionconstmocker.py
TEAM_IDS = {
    "red_bull": "1", "mercedes": "2", "ferrari": "3", "mclaren": "4", "aston_martin": "5", "alpine": "6",
    "williams": "7", "racing_bulls": "8", "audi": "9", "haas": "10", "cadillac": "11",
}
SEASON_FIELDS = ("points", "wins", "podiums", "avgQuali", "avgFinish", "avgGained", "dnfs", "avgPitStop",
                 "fantasyPoints", "fantasyPpm")
# At 100% weight a perfect rating gives up to +30% points and a rating of 0 gives -30%
MAX_SWING = 0.3


def slug(s):
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^a-z]+", "_", s.lower()).strip("_")


def read_csv(name):
    with open(FANTASY / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


# All selectable players, keyed by fantasy player_id (same ids as the real backend)
PLAYERS = {}
for d in read_csv("drivers.csv"):
    if d["is_active_seat"] == "True":
        key = slug(d["driver_name"])
        PLAYERS[d["player_id"]] = {
            "kind": "driver", "price": float(d["price_m"]), "predKey": DRIVER_ALIASES.get(key, key),
            "stats": STATS["drivers"].get(d["player_id"]),
        }
for t in read_csv("teams.csv"):
    PLAYERS[t["player_id"]] = {
        "kind": "constructor", "price": float(t["price_m"]), "predKey": TEAM_IDS[t["team_key"]],
        "stats": STATS["constructors"].get(t["player_id"]),
    }


def upcoming_races():
    races = []
    for rnd, drivers in DRIVER_PREDICTIONS.items():
        first = next(iter(drivers.values()))
        track = STATS["tracks"][rnd]
        races.append({
            "round": rnd, "name": first["race_name"], "date": first["date"],
            "location": track["location"], "trackType": track["type"],
        })
    races.sort(key=lambda r: int(r["round"]))
    return [r for r in races if int(r["round"]) >= FREEZE_ROUND]


def predict_round(player, rnd, weights):
    """Weighted floor/expected/ceiling for one player in one round, or None without a prediction"""
    stats = player["stats"]
    if player["kind"] == "driver":
        pred = DRIVER_PREDICTIONS.get(rnd, {}).get(player["predKey"])
        dnf = pred and pred["predictions"]["dnf_probability"]
    else:
        pred = CONSTRUCTOR_PREDICTIONS.get(rnd, {}).get(player["predKey"])
        dnf = stats and stats["season"]["starts"] and round(100 * stats["season"]["dnfs"] / stats["season"]["starts"])
    if not pred:
        return None

    form_boost = track_boost = 0
    if stats:
        track_fit = stats["trackFit"][STATS["tracks"][rnd]["type"]]
        form_boost = weights["form"] / 100 * MAX_SWING * (stats["ratings"]["form"] - 50) / 50
        track_boost = weights["track"] / 100 * MAX_SWING * (track_fit - 50) / 50
    multiplier = (1 + form_boost + track_boost) * (1 - weights["dnf"] / 100 * (dnf or 0) / 100)

    fp = pred["fantasy_points"]
    return {
        "floor": fp["floor_p10"] * multiplier,
        "expected": fp["expected_p50"] * multiplier,
        "ceiling": fp["ceiling_p90"] * multiplier,
        "multiplier": multiplier,
        "dnfChance": dnf,
        "qualiPos": pred.get("predictions", {}).get("qualifying_position"),
        "racePos": pred.get("predictions", {}).get("race_position"),
    }


def predictions(rounds, risk, weights):
    """Predictions summed over the given rounds for every player that has one"""
    out = {}
    for pid, player in PLAYERS.items():
        per_round = [p for p in (predict_round(player, r, weights) for r in rounds) if p]
        if not per_round:
            continue
        first = per_round[0]
        item = {
            "id": pid,
            "kind": player["kind"],
            "floor": round(sum(p["floor"] for p in per_round), 1),
            "expected": round(sum(p["expected"] for p in per_round), 1),
            "ceiling": round(sum(p["ceiling"] for p in per_round), 1),
            "dnfChance": first["dnfChance"],
            "qualiPos": first["qualiPos"],
            "racePos": first["racePos"],
        }
        item["ppm"] = round(item[risk] / player["price"], 2)
        out[pid] = item
    return out


def predictions_by_round(rounds, risk, weights):
    """Points for the chosen risk in each round separately, for the race planner"""
    out = []
    for pid, player in PLAYERS.items():
        per_round = {r: predict_round(player, r, weights) for r in rounds}
        if not any(per_round.values()):
            continue
        points = {r: round(p[risk], 1) if p else None for r, p in per_round.items()}
        out.append({
            "id": pid,
            "kind": player["kind"],
            "points": points,
            "total": round(sum(v for v in points.values() if v is not None), 1),
        })
    return sorted(out, key=lambda p: -p["total"])


def stats(kind, rnd):
    track = STATS["tracks"][rnd]
    out = []
    for pid, player in PLAYERS.items():
        s = player["stats"]
        if player["kind"] != kind or not s:
            continue
        out.append({
            "id": pid,
            "code": s.get("code"),
            "ratings": {**s["ratings"], "trackFit": s["trackFit"][track["type"]]},
            "season": {k: s["season"].get(k) for k in SEASON_FIELDS},
            "trackAvg": s["trackHistory"].get(track["circuitRef"]),
            "recentFinishes": s["recentFinishes"],
        })
    return out


def evaluate(body):
    """Team totals, the DRS Boost driver's points count double"""
    preds = predictions(body["rounds"], body["risk"], weights_of(body))
    drs = body.get("drs") if body.get("drs") in body["drivers"] else None
    team = [preds[i] for i in body["drivers"] + body["constructors"] if i in preds]
    factor = lambda p: 2 if p["id"] == drs else 1
    return {
        "cost": round(sum(PLAYERS[p["id"]]["price"] for p in team), 1),
        **{k: round(sum(p[k] * factor(p) for p in team), 1) for k in ("floor", "expected", "ceiling")},
        "drs": drs,
    }


def optimize(body):
    """Best 5 drivers + 2 constructors within budget for the chosen risk, with the best driver as DRS Boost (2x).
    With currentTeam it works as transfers mode: every player swapped out beyond freeTransfers costs TRANSFER_PENALTY points.
    maxTransfers (optional) limits how many players may be swapped out."""
    risk, budget = body["risk"], body["budget"]
    preds = predictions(body["rounds"], risk, weights_of(body))
    current = body.get("currentTeam")
    free, penalty = min(int(body.get("freeTransfers", 0)), 3), TRANSFER_PENALTY
    max_transfers = body.get("maxTransfers")
    cur_drivers = set(current["drivers"]) if current else set()
    cur_constructors = set(current["constructors"]) if current else set()
    price = lambda pid: PLAYERS[pid]["price"]
    drivers = [pid for pid in preds if preds[pid]["kind"] == "driver"]
    constructors = [pid for pid in preds if preds[pid]["kind"] == "constructor"]

    # Driver groups bucketed by how many current drivers they swap out, best points first
    buckets = defaultdict(list)
    for group in combinations(drivers, 5):
        cost = sum(price(p) for p in group)
        if cost <= budget:
            # the DRS Boost doubles the best driver, so add their points once more
            points = sum(preds[p][risk] for p in group) + max(preds[p][risk] for p in group)
            buckets[len(cur_drivers - set(group))].append((points, cost, group))
    for groups in buckets.values():
        groups.sort(reverse=True)

    best = None
    for pair in combinations(constructors, 2):
        left = budget - sum(price(p) for p in pair)
        pair_points = sum(preds[p][risk] for p in pair)
        pair_outs = len(cur_constructors - set(pair))
        for outs, groups in buckets.items():
            if max_transfers is not None and outs + pair_outs > int(max_transfers):
                continue
            # sorted by points, so the first group that fits is the best one for this pair and swap count
            fit = next((g for g in groups if g[1] <= left + 1e-6), None)
            if not fit:
                continue
            extra = max(0, outs + pair_outs - free) if current else 0
            net = fit[0] + pair_points - extra * penalty
            if not best or net > best["net"]:
                best = {"net": net, "drivers": fit[2], "constructors": pair, "extra": extra}
    if not best:
        return None

    result = {
        "drivers": list(best["drivers"]),
        "constructors": list(best["constructors"]),
        "drs": max(best["drivers"], key=lambda p: preds[p][risk]),
        "points": round(best["net"], 1),
    }
    if current:
        transfers = []
        for kind, old, new in (("driver", current["drivers"], best["drivers"]),
                               ("constructor", current["constructors"], best["constructors"])):
            outs = [p for p in old if p not in new]
            ins = [p for p in new if p not in old]
            transfers += [{"kind": kind, "out": o, "in": i} for o, i in zip_longest(outs, ins)]
        cur_points = [preds[p][risk] for p in current["drivers"] + current["constructors"] if p in preds]
        cur_drs = max((preds[p][risk] for p in current["drivers"] if p in preds), default=0)
        result.update({
            "transfers": transfers,
            "penaltyPoints": round(best["extra"] * penalty, 1),
            "currentPoints": round(sum(cur_points) + cur_drs, 1),
        })
    return result


def teammates():
    return [{"constructorId": cid, **pair} for cid, pair in STATS["teammates"].items()]


def weights_of(source):
    return {k: float(source.get(k, 0)) for k in ("form", "track", "dnf")}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/races/upcoming":
            return self.send_json(upcoming_races())
        if url.path == "/predictions/by-round":
            rounds = q.get("rounds", "").split(",")
            return self.send_json(predictions_by_round(rounds, q.get("risk", "expected"), weights_of(q)))
        if url.path == "/predictions":
            rounds = q.get("rounds", "").split(",")
            return self.send_json(list(predictions(rounds, q.get("risk", "expected"), weights_of(q)).values()))
        if url.path == "/stats/teammates":
            return self.send_json(teammates())
        if url.path in ("/stats/drivers", "/stats/constructors"):
            kind = "driver" if url.path.endswith("drivers") else "constructor"
            return self.send_json(stats(kind, q["round"]))
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or "{}")
        if self.path == "/teams/evaluate":
            return self.send_json(evaluate(body))
        if self.path == "/optimize":
            result = optimize(body)
            return self.send_json(result) if result else self.send_json({"error": "No team fits the budget"}, 422)
        self.send_json({"error": "Not found"}, 404)


if __name__ == "__main__":
    print(f"Mock API running on http://localhost:{PORT}")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
