import pandas as pd
import datetime

from app.schemas.race import Race
from app.services.freeze import read_kaggle, season, freeze_date
from app.services.track_types import track_type

def load_uppcoming_races_from_csv(file_path: str) -> list[Race]:
    # Load the CSV file inot a DataFrame
    df = pd.read_csv(file_path)
    print(f"Loaded {len(df)} rows from {file_path}")

    # Filter for upcoming races
    df['date'] = pd.to_datetime(df['date'])
    today = pd.to_datetime("2026-10-11")
    df = df[df['date'] > today].copy()
    print("Today's date:", today)
    print(df[['date', 'name']])

    races = []
    for _, row in df.iterrows():
        race = Race(
            # Info
            id=str(row['raceId']),
            year=row['year'],
            round=row['round'],
            circuit_id=str(row['circuitId']),
            name=str(row['name']),
            date=str(row['date']),
            time=str(row['time']),
            fp1_date=str(row['fp1_date']),
            fp1_time=str(row['fp1_time']),
            fp2_date=str(row['fp2_date']),
            fp2_time=str(row['fp2_time']),
            fp3_date=str(row['fp3_date']),
            fp3_time=str(row['fp3_time']),
            quali_date=str(row['quali_date']),
            quali_time=str(row['quali_time']),
            sprint_date=str(row['sprint_date']),
            sprint_time=str(row['sprint_time']),
        )
        races.append(race)

    print(f"Filtered {len(races)} upcoming races from {file_path}")

    return races

def upcoming_races_view() -> list[dict]:
    races = read_kaggle("races.csv")
    races["date"] = pd.to_datetime(races["date"])
    circuits = read_kaggle("circuits.csv").rename(columns={"name": "circuit"})
    df = (
        races[(races["year"] == season()) & (races["date"] > freeze_date())]
        .merge(circuits[["circuitId", "circuitRef", "circuit", "location"]], on="circuitId", how="left")
        .sort_values("round")
    )
    return [
        {
            "round": str(int(r["round"])),
            "name": str(r["name"]),
            "date": r["date"].strftime("%Y-%m-%d"),
            "circuit": str(r["circuit"]),
            "location": str(r["location"]),
            "trackType": track_type(r["circuitRef"]),
        }
        for _, r in df.iterrows()
    ]




if __name__ == "__main__":
    file_path = "../data/kaggle-base-data/races.csv"
    races = load_uppcoming_races_from_csv(file_path)
    for race in races:
        print(race)

    