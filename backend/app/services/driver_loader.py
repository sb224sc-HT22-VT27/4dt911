import pandas as pd
from app.schemas.driver import Driver


def load_drivers_from_csv(file_path: str) -> list[Driver]:
    # Load the CSV file into a DataFrame

    df = pd.read_csv(file_path)

    print(f"Loaded {len(df)} rows from {file_path}")

    # Convert the DataFrame to a list of Team objects
    drivers = []
    for _, row in df.iterrows():
        driver = Driver(
            # Info
            id=str(row['player_id']),
            name=str(row['driver_name']),
            number=0, #row[''],
            code="", #row['code'],
            team=str(row['team_name']),
            team_id=str(row['team_id']),
            avatarColor="", #row['avatarColor']

            # Stats
            price=row['price_m'],
            ownership=row['selected_by_pct'],
            fantasyPoints=row['fantasy_points_total'],
            predictedPoints=0, #row[''],
            championshipPoints=0, #row[''],
        )
        drivers.append(driver)

    return drivers

if __name__ == "__main__":
    # Example usage
    file_path = "../data/f1-fantasy-data/drivers.csv"
    drivers = load_drivers_from_csv(file_path)
    for driver in drivers:
        print(driver)