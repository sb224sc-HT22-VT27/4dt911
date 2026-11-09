# Endpoints

Keep current drivers and constructor apis

## GET `/races/upcoming` 
Make sure its from right before monza

Races that haven't happened yet, ordered by round.

I want something like this:
`trackType` is `street`, `high_speed` or `technical`. Dont think we have that data so create it. 

```json
[
  {
    "round": "20",
    "name": "Sao Paulo Grand Prix",
    "date": "2026-11-08",
    "circuit": "Autódromo José Carlos Pace",
    "location": "São Paulo",
    "trackType": "high_speed"
  }
]
```


## `GET /predictions?rounds=13&risk=expected&form=0&track=0&dnf=0`

One row per player that has a prediction, with the settings already applied. With several rounds, points are summed. This is not entirely correct example use the one we discussed earlier.

```json
  { "id": "131", "kind": "driver", "floor": 2.4, "expected": 10.2, "ceiling": 22.2, "ppm": 0.36,
    "dnfChance": 14.2, "qualiPos": 13, "racePos": 16 },
```


## `GET /predictions/by-round?rounds=13,14,15&risk=expected&form=0&track=0&dnf=0`

Same as above but points for the chosen `risk` per race instead of summed. Used by the race planner. Sorted by `total`, highest first. Something like this you can change it out and if you want me to have all drivers at once decide which fits backend better.

```json
[
  { "id": "131", "kind": "driver", "points": { "13": 10.2, "14": 26.1, "15": 13.6 }, "total": 49.9 }
]
```

## `GET /stats/drivers?round=13` and `GET /stats/constructors?round=13`

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
| `ratings.*` | 0–100 versus the grid | Kaggle `results.csv`, `qualifying.csv`, `status.csv` |
| `ratings.trackFit` | How much better than their own average they finish on this track type (50 = no difference) | Kaggle `results.csv` since 2023 |
| `season.points`, `wins`, `podiums`, `avgFinish`, `dnfs`, `avgGained` | This season's results | Kaggle `results.csv` + `sprint_results.csv` |
| `season.avgQuali` | Average qualifying position | Kaggle `qualifying.csv` |
| `season.avgPitStop` | Average pit lane time in seconds | Kaggle `pit_stops.csv` |
| `season.fantasyPoints`, `fantasyPpm` | Fantasy points this season, and per €1M | Fantasy CSV `avg_fantasy_points` × races raced, ÷ `price_m` |
| `trackAvg` | Average finish at this circuit since 2023 (`null` if never raced there) | Kaggle `results.csv` |
| `recentFinishes` | Last 5 races, oldest first. Constructors: best car, `dnf` only if both cars failed to finish | Kaggle `results.csv` |

For constructors `code` is `null`, and form uses the last 10 results (5 races × 2 cars).

## `GET /stats/teammates`

Head-to-head between the two current drivers of each team, over races this season where both drove for it. Pairs are `[first driver, second driver]`, in the same order as `drivers`.

```json
[
  { "constructorId": "29", "drivers": ["11032", "131"], "races": 11,
    "quali": [2, 8], "race": [3, 8], "points": [71.0, 100.0],
    "avgQuali": [8.8, 5.4], "avgFinish": [9.0, 8.3], "dnfs": [2, 3] }
]
```

`quali` and `race` count how often each driver finished ahead of the other. `points` are championship points in those races.

## `POST /teams/evaluate`

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


## `POST /optimize`

finds the best 5 drivers + 2 constructors within the budget, for the chosen `risk`, with the best driver as DRS Boost.

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
