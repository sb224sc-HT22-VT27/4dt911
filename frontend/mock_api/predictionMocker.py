import json
import random

# The 2026 races from round 13 (the app is frozen before the Italian GP)
REMAINING_RACES = [
    {"round": "13", "name": "Italian Grand Prix", "date": "2026-09-06"},
    {"round": "14", "name": "Spanish Grand Prix", "date": "2026-09-13"},
    {"round": "15", "name": "Azerbaijan Grand Prix", "date": "2026-09-26"},
    {"round": "16", "name": "Bahrain Grand Prix in Malaysia", "date": "2026-10-04"},
    {"round": "17", "name": "Singapore Grand Prix", "date": "2026-10-11"},
    {"round": "18", "name": "United States Grand Prix", "date": "2026-10-25"},
    {"round": "19", "name": "Mexico City Grand Prix", "date": "2026-11-01"},
    {"round": "20", "name": "Sao Paulo Grand Prix", "date": "2026-11-08"},
    {"round": "21", "name": "Las Vegas Grand Prix", "date": "2026-11-21"},
    {"round": "22", "name": "Qatar Grand Prix", "date": "2026-11-29"},
    {"round": "23", "name": "Abu Dhabi Grand Prix", "date": "2026-12-06"}
]

# 22 Drivers for the 2026 Grid
DRIVERS = [
    "max_verstappen", "sergio_perez", "lewis_hamilton", "george_russell", 
    "charles_leclerc", "carlos_sainz", "lando_norris", "oscar_piastri", 
    "fernando_alonso", "lance_stroll", "esteban_ocon", "pierre_gasly", 
    "alex_albon", "franco_colapinto", "yuki_tsunoda", "liam_lawson", 
    "valtteri_bottas", "gabriel_bortoleto", "nico_hulkenberg", "oliver_bearman", 
    "andrea_kimi_antonelli", "isack_hadjar"
]

mock_cache = {"2026": {}}

for race in REMAINING_RACES:
    round_num = race["round"]
    mock_cache["2026"][round_num] = {}
    
    # Shuffle positions 1-22 so every driver gets a unique finish position in the mock
    quali_positions = list(range(1, 23))
    race_positions = list(range(1, 23))
    random.shuffle(quali_positions)
    random.shuffle(race_positions)
    
    for i, driver in enumerate(DRIVERS):
        q_pos = quali_positions[i]
        r_pos = race_positions[i]
        
        # Generate realistic-looking float values for DNF and points
        dnf_prob = round(random.uniform(1.0, 15.0), 1)
        
        # Base expected points on their mock race position (higher finish = more points)
        base_pts = max(0, 25 - r_pos) + random.uniform(0, 5)
        
        p50 = round(base_pts, 1)
        p10 = round(max(0, p50 - random.uniform(5.0, 12.0)), 1)
        p90 = round(p50 + random.uniform(8.0, 20.0), 1)

        payload = {
            "race_name": race["name"],
            "date": race["date"],
            "driver": driver,
            "predictions": {
                "qualifying_position": q_pos,
                "race_position": r_pos,
                "dnf_probability": dnf_prob
            },
            "fantasy_points": {
                "floor_p10": p10,
                "expected_p50": p50,
                "ceiling_p90": p90
            }
        }
        
        mock_cache["2026"][round_num][driver] = payload

# Save to JSON file
with open("mock_predictions.json", "w") as f:
    json.dump(mock_cache, f, indent=4)

print("✅ Successfully generated mock_predictions.json!")