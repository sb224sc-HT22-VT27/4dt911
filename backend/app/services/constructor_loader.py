import pandas as pd
from app.schemas.constructor import Constructor
# Temporary using random
import random as rd
from app.helpers import teams

def load_constructors_from_csv(file_path: str) -> list[Constructor]:
    # Load the CSV file into a DataFrame

    df = pd.read_csv(file_path)

    print(f"Loaded {len(df)} rows from {file_path}")

    # Convert the DataFrame to a list of Team objects
    constructors = []
    for _, row in df.iterrows():
        predicted = rd.randint(10,40)
        team = Constructor(
            # Info
            id=str(row['player_id']),
            name=row['team_name'],
            code="", #row['code'],
            avatarColor=teams.get(row["team_key"], "#FFFFFF"), #row['avatarColor']

            # Stats
            price=row['price_m'],
            ownership=row['selected_by_pct'],
            fantasyPoints=row['fantasy_points_total'],
            # Swap to real prediction
            predictedPoints=predicted, #row[''],
            championshipPoints=0, #row[''],
        )
        constructors.append(team)

    return constructors

if __name__ == "__main__":
    # Example usage
    file_path = "../data/f1-fantasy-data/teams.csv"
    teams = load_constructors_from_csv(file_path)
    for team in teams:
        print(team)