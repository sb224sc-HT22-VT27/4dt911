import functools

import pandas as pd

KAGGLE = "../data/kaggle-base-data/"
FANTASY = "../data/f1-fantasy-data/"
FALLBACK_FREEZE = "2026-09-05"

def read_kaggle(name: str) -> pd.DataFrame:
    return pd.read_csv(KAGGLE + name, na_values=["\\N"])

@functools.cache
def season() -> int:
    return int(read_kaggle("races.csv")["year"].max())

@functools.cache
def freeze_date() -> str:
    races = read_kaggle("races.csv")
    races["date"] = pd.to_datetime(races["date"])
    freeze_time = races[(races["year"] == season()) & (races["name"] == "United States Grand Prix")]
    if freeze_time.empty:
        return pd.Timestamp(FALLBACK_FREEZE)
    return freeze_time["date"].min() - pd.Timedelta(days=1)