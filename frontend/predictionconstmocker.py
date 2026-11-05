import json
import random

# The official final 6 races of the 2026 calendar
REMAINING_RACES = [
    {"round": "18", "name": "United States Grand Prix", "date": "2026-10-25"},
    {"round": "19", "name": "Mexico City Grand Prix", "date": "2026-11-01"},
    {"round": "20", "name": "Sao Paulo Grand Prix", "date": "2026-11-08"},
    {"round": "21", "name": "Las Vegas Grand Prix", "date": "2026-11-21"},
    {"round": "22", "name": "Qatar Grand Prix", "date": "2026-11-29"},
    {"round": "23", "name": "Abu Dhabi Grand Prix", "date": "2026-12-06"}
]

# The 11 Teams mapped to their 22 Drivers
TEAMS = {
    "1": ["max_verstappen", "sergio_perez"],
    "2": ["lewis_hamilton", "george_russell"],
    "3": ["charles_leclerc", "carlos_sainz"],
    "4": ["lando_norris", "oscar_piastri"],
    "5": ["fernando_alonso", "lance_stroll"],
    "6": ["esteban_ocon", "pierre_gasly"],
    "7": ["alex_albon", "franco_colapinto"],
    "8": ["yuki_tsunoda", "liam_lawson"],
    "9": ["valtteri_bottas", "gabriel_bortoleto"],
    "10": ["nico_hulkenberg", "oliver_bearman"],
    "11": ["andrea_kimi_antonelli", "isack_hadjar"]
}

mock_constructor_cache = {"2026": {}}

for race in REMAINING_RACES:
    round_num = race["round"]
    mock_constructor_cache["2026"][round_num] = {}
    
    for team_id, drivers in TEAMS.items():
        # Mock the combined driver points for the team
        base_driver_pts = random.uniform(5.0, 40.0)
        
        payload = {
            "race_name": race["name"],
            "date": race["date"],
            "team_id": int(team_id),
            "drivers_included": drivers,
            "fantasy_points": {
                "floor_p10": round(base_driver_pts * 0.4, 1),
                "expected_p50": round(base_driver_pts, 1),
                "ceiling_p90": round(base_driver_pts * 1.6, 1)
            }
        }
        
        mock_constructor_cache["2026"][round_num][team_id] = payload

# Save to JSON file
with open("mock_constructors.json", "w") as f:
    json.dump(mock_constructor_cache, f, indent=4)

print("✅ Successfully generated mock_constructors.json!")