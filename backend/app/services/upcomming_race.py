import pandas as pd
import datetime

from app.schemas.race import Race


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



if __name__ == "__main__":
    file_path = "../data/kaggle-base-data/races.csv"
    races = load_uppcoming_races_from_csv(file_path)
    for race in races:
        print(race)

    