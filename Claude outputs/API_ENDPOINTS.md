# OptiGrid API

Everything the frontend needs from the backend. The frontend does no calculations itself, it only shows what these endpoints return.

- **2 endpoints already exist** in the backend, **8 are still mocked** by `frontend/mock_api/mock_server.py`.
- The mock server is the **reference implementation**: every calculation below is already written there in plain Python (see the last section).
- When an endpoint is done in the backend, change its line in `frontend/src/api/endpoints.ts` from `MOCK_API` to `REAL_API`.

## Overview

| # | Endpoint | Status | Returns | Built from |
|---|---|---|---|---|
| 1 | `GET /drivers/` | ✅ Exists | Driver roster and prices | Fantasy `drivers.csv` |
| 2 | `GET /constructors/` | ✅ Exists | Constructor roster and prices | Fantasy `teams.csv` |
| 3 | `GET /races/upcoming` | Mock | Races still to come | Kaggle `races.csv` + `circuits.csv` |
| 4 | `GET /predictions` | Mock | Points per player (summed over the chosen races) | ML predictions + fantasy prices |
| 5 | `GET /predictions/by-round` | Mock | Points per player for each race separately | ML predictions |
| 6 | `GET /stats/drivers` | Mock | Ratings and season stats per driver | Kaggle results + fantasy `drivers.csv` |
| 7 | `GET /stats/constructors` | Mock | Same, per constructor | Kaggle results + fantasy `teams.csv` |
| 8 | `GET /stats/teammates` | Mock | Head-to-head between teammates | Kaggle results + qualifying |
| 9 | `POST /teams/evaluate` | Mock | Totals for one team | Endpoint 4 |
| 10 | `POST /optimize` | Mock | Best team, or best transfers | Endpoint 4 + prices |

## Shared rules

- **Ids** are always the fantasy `player_id` (the same `id` that endpoints 1 and 2 return).
- **Only current drivers:** use rows where `is_active_seat` is `True`, so a driver is never listed twice.
- **Freeze:** the app currently acts as if the next race is round 13 (Italian GP). Endpoint 3 starts at round 13 and the stats (6–8) only use races before it. In the code this is `FREEZE_ROUND = 13`.
- **Numbers:** points are rounded to 1 decimal.

**Settings parameters.** Endpoints 4, 5, 9 and 10 all take the same settings, as query parameters (GET) or in the JSON body (POST):

| Name | Example | Meaning |
|---|---|---|
| `rounds` | `13` or `13,14,15` | Which races to include (1 or 3 for the horizon, up to 10 for the race planner) |
| `risk` | `expected` | Which prediction to use: `floor` (P10), `expected` (P50) or `ceiling` (P90) |
| `form` | `0`–`100` | How much recent form changes the points |
| `track` | `0`–`100` | How much track-type fit changes the points |
| `dnf` | `0`–`100` | How much the DNF chance lowers the points |

How the three sliders change points (per player, per race), with a slider at 100% moving points by at most ±30%:

```
multiplier = (1 + form/100 × 0.3 × (formRating − 50)/50 + track/100 × 0.3 × (trackFit − 50)/50) × (1 − dnf/100 × dnfChance/100)
points     = prediction × multiplier
```

---

## 1–2. `GET /drivers/` and `GET /constructors/` ✅

Already exist, no changes needed. The frontend uses: `id`, `name`, `number` (drivers), `team` (drivers), `price`, `ownership`, `avatarColor`.

---

## 3. `GET /races/upcoming`

Races from the current round onward, ordered by round.

```json
[
  { "round": "13", "name": "Italian Grand Prix", "date": "2026-09-06", "location": "Monza", "trackType": "high_speed" }
]
```

| Field | From |
|---|---|
| `round`, `name`, `date` | Kaggle `races.csv` |
| `location` | Kaggle `circuits.csv` → `location` |
| `trackType` | `street`, `high_speed` or `technical`, from the `TRACK_TYPES` table in `statsMocker.py` (by `circuitRef`) |

---

## 4. `GET /predictions?rounds=13&risk=expected&form=0&track=0&dnf=0`

One row per player that has a prediction, with the settings already applied. With several rounds, points are summed.

```json
[
  { "id": "131", "kind": "driver", "floor": 2.4, "expected": 10.2, "ceiling": 22.2, "ppm": 0.36,
    "dnfChance": 14.2, "qualiPos": 13, "racePos": 16 },
  { "id": "28", "kind": "constructor", "floor": 3.0, "expected": 7.5, "ceiling": 11.9, "ppm": 0.22,
    "dnfChance": 12, "qualiPos": null, "racePos": null }
]
```

| Field | From |
|---|---|
| `floor`, `expected`, `ceiling` | ML output `floor_p10`, `expected_p50`, `ceiling_p90` × the settings multiplier |
| `ppm` | points for the chosen `risk` ÷ `price_m` |
| `dnfChance` | Drivers: ML `dnf_probability`. Constructors: % of races with a DNF this season (Kaggle) |
| `qualiPos`, `racePos` | ML `qualifying_position`, `race_position` (drivers only, `null` for constructors) |

With several rounds, `dnfChance`, `qualiPos` and `racePos` are for the first race in `rounds`.

The ML output per player and race already looks like this (see `mock_api/mock_predictions.json`):
`{ "predictions": { "qualifying_position", "race_position", "dnf_probability" }, "fantasy_points": { "floor_p10", "expected_p50", "ceiling_p90" } }`

---

## 5. `GET /predictions/by-round?rounds=13,14,15&risk=expected&form=0&track=0&dnf=0`

Same as 4, but points for the chosen `risk` per race instead of summed. Used by the race planner. Sorted by `total`, highest first.

```json
[
  { "id": "131", "kind": "driver", "points": { "13": 10.2, "14": 26.1, "15": 13.6 }, "total": 49.9 }
]
```

A race without a prediction for the player is `null`.

---

## 6–7. `GET /stats/drivers?round=13` and `GET /stats/constructors?round=13`

Real stats from this season's races before the freeze. `round` is the race being planned, used for `trackFit` and `trackAvg`.

```json
[
  {
    "id": "131",
    "code": "VER",
    "ratings": { "quali": 78, "race": 60, "form": 58, "reliability": 0, "overtaking": 78, "trackFit": 52 },
    "season": { "points": 112.0, "wins": 0, "podiums": 4, "avgQuali": 5.5, "avgFinish": 9.4, "avgGained": 2.8,
                "dnfs": 4, "avgPitStop": 23.08, "fantasyPoints": 343, "fantasyPpm": 12.16 },
    "trackAvg": 2.7,
    "recentFinishes": [ { "race": "Dutch", "position": 22, "dnf": true } ]
  }
]
```

| Field | Meaning | From |
|---|---|---|
| `ratings.*` | 0–100 versus the grid (formulas in `summarise()` in `statsMocker.py`) | Kaggle `results.csv`, `qualifying.csv`, `status.csv` |
| `ratings.trackFit` | How much better than their own average they finish on this track type (50 = no difference) | Kaggle `results.csv` since 2023 |
| `season.points`, `wins`, `podiums`, `avgFinish`, `dnfs`, `avgGained` | This season's results | Kaggle `results.csv` + `sprint_results.csv` |
| `season.avgQuali` | Average qualifying position | Kaggle `qualifying.csv` |
| `season.avgPitStop` | Average pit lane time in seconds | Kaggle `pit_stops.csv` |
| `season.fantasyPoints`, `fantasyPpm` | Fantasy points this season, and per €1M | Fantasy CSV `avg_fantasy_points` × races raced, ÷ `price_m` |
| `trackAvg` | Average finish at this circuit since 2023 (`null` if never raced there) | Kaggle `results.csv` |
| `recentFinishes` | Last 5 races, oldest first. Constructors: best car, `dnf` only if both cars failed to finish | Kaggle `results.csv` |

For constructors `code` is `null`, and form uses the last 10 results (5 races × 2 cars).

---

## 8. `GET /stats/teammates`

Head-to-head between the two current drivers of each team, over races this season where both drove for it. Pairs are `[first driver, second driver]`, in the same order as `drivers`.

```json
[
  { "constructorId": "29", "drivers": ["11032", "131"], "races": 11,
    "quali": [2, 8], "race": [3, 8], "points": [71.0, 100.0],
    "avgQuali": [8.8, 5.4], "avgFinish": [9.0, 8.3], "dnfs": [2, 3] }
]
```

`quali` and `race` count how often each driver finished ahead of the other. `points` are championship points in those races.

---

## 9. `POST /teams/evaluate`

Totals for one team. The DRS Boost driver's points count double.

Request: settings + `drivers`, `constructors` and `drs` (id or `null`).

```json
{ "drivers": ["111", "121", "115", "1982", "11"], "constructors": ["2640", "210"], "drs": "1982",
  "rounds": ["13"], "risk": "expected", "form": 0, "track": 0, "dnf": 0 }
```

Response:

```json
{ "cost": 85.3, "floor": 132.4, "expected": 232.1, "ceiling": 362.5, "drs": "1982" }
```

`drs` is `null` if the given driver isn't in the team. No transfer penalty is ever subtracted here.

---

## 10. `POST /optimize`

Finds the best 5 drivers + 2 constructors within the budget, for the chosen `risk`, with the best driver as DRS Boost.

**Best team.** Request: settings + `budget`.

```json
{ "budget": 100, "rounds": ["13"], "risk": "expected", "form": 0, "track": 0, "dnf": 0 }
```

Response:

```json
{ "drivers": ["111", "121", "115", "1982", "11"], "constructors": ["2640", "210"], "drs": "1982", "points": 232.1 }
```

**Transfers.** Also send the current team and free transfers. Every player swapped out beyond `freeTransfers` costs 10 points.

| Extra field | Meaning |
|---|---|
| `currentTeam` | `{ "drivers": [...], "constructors": [...] }` |
| `freeTransfers` | 0–3 (the game's maximum) |
| `maxTransfers` | Optional. Never swap out more players than this |

The frontend makes two calls: one without `maxTransfers` (extra transfers allowed) and one with `maxTransfers = freeTransfers` (free transfers only), then shows which is better.

```json
{
  "drivers": ["12", "111", "121", "1982", "11"], "constructors": ["24", "2640"], "drs": "1982",
  "points": 204.4, "currentPoints": 152.0, "penaltyPoints": 10,
  "transfers": [
    { "kind": "driver", "out": "129", "in": "111" },
    { "kind": "driver", "out": "13", "in": "1982" },
    { "kind": "constructor", "out": "2641", "in": "2640" }
  ]
}
```

- `points` is after the penalty, and `currentPoints` is the current team's points (with its best driver as DRS).
- `transfers` is empty if the current team is already best. `out` is `null` when a new player fills an empty slot.
- If no team fits the budget, return status `422` with `{ "error": "No team fits the budget" }`.

---

## Reference implementation

| Endpoint | Function | File |
|---|---|---|
| 3 | `upcoming_races()` | `mock_api/mock_server.py` |
| 4 | `predictions()` + `predict_round()` (settings multiplier) | `mock_api/mock_server.py` |
| 5 | `predictions_by_round()` | `mock_api/mock_server.py` |
| 6–7 | `stats()`, numbers computed by `summarise()` | `mock_server.py` / `mock_api/statsMocker.py` |
| 8 | `teammates_out` section | `mock_api/statsMocker.py` |
| 9 | `evaluate()` | `mock_api/mock_server.py` |
| 10 | `optimize()` (checks every team, buckets by transfers) | `mock_api/mock_server.py` |

**Running the mock:** from the project root, `python3 frontend/mock_api/mock_server.py` (port 8001). Rebuild its data with the scripts in `frontend/mock_api/`: `predictionMocker.py`, `predictionconstmocker.py`, `statsMocker.py`.
