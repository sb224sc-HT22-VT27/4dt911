"""
THE KEYS
--------
driver_code   3-letter abbreviation (VER, HAM, ...). Primary driver join key. OpenF1: name_acronym   Kaggle: drivers.code   Fantasy: added here.
driver_key    slug of the accent-stripped full name ('max_verstappen'); stable fallback for historical drivers with no code.
team_key      stable constructor *lineage* ('audi' covers Sauber / Alfa Romeo / Kick Sauber, 'racing_bulls' covers Toro Rosso / AlphaTauri / RB, ...) so a team keeps one identity through rebrands in the Kaggle history.
race_key      'YYYY-RR' Links OpenF1 meetings to Kaggle races by DATE.

Grain notes
-----------
* Fantasy can hold the same driver twice (different seats). Join on (driver_code, team_key); `is_active_seat` marks the current seat.
"""

from __future__ import annotations

import argparse
import os
import re
import time
import unicodedata

import numpy as np
import pandas as pd


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def slug(s) -> str:
    return _norm(s).replace(" ", "_")


TEAM_RULES: list[tuple[str, str]] = [
    ("cadillac", r"\bcadillac\b"),
    (
        "racing_bulls",
        r"racing bulls|\brb f1\b|^rb$|alphatauri|alpha tauri|toro rosso|visa cash app rb",
    ),
    ("red_bull", r"\bred bull\b"),
    ("ferrari", r"ferrari"),
    ("mercedes", r"mercedes|\bbrawn\b"),
    ("mclaren", r"mclaren"),
    ("williams", r"williams"),
    ("haas", r"\bhaas\b"),
    ("alpine", r"alpine|renault|^lotus f1$|lotus f1 team"),
    ("aston_martin", r"aston martin|racing point|force india"),
    ("audi", r"\baudi\b|sauber|alfa romeo|^alfa$"),
]

TEAM_DISPLAY = {
    "alpine": "Alpine",
    "aston_martin": "Aston Martin",
    "audi": "Audi",
    "cadillac": "Cadillac",
    "ferrari": "Ferrari",
    "haas": "Haas F1 Team",
    "mclaren": "McLaren",
    "mercedes": "Mercedes",
    "racing_bulls": "Racing Bulls",
    "red_bull": "Red Bull Racing",
    "williams": "Williams",
}


def resolve_team(name) -> str | None:
    if name is None or (isinstance(name, float) and np.isnan(name)):
        return None
    n = _norm(name)
    for key, pat in TEAM_RULES:
        if re.search(pat, n):
            return key
    return slug(name)


GRID_2026 = [
    ("ALB", "Alexander Albon", 23, "williams"),
    ("ALO", "Fernando Alonso", 14, "aston_martin"),
    ("ANT", "Kimi Antonelli", 12, "mercedes"),
    ("BEA", "Oliver Bearman", 87, "haas"),
    ("BOR", "Gabriel Bortoleto", 5, "audi"),
    ("BOT", "Valtteri Bottas", 77, "cadillac"),
    ("COL", "Franco Colapinto", 43, "alpine"),
    ("GAS", "Pierre Gasly", 10, "alpine"),
    ("HAD", "Isack Hadjar", 6, "red_bull"),
    ("HAM", "Lewis Hamilton", 44, "ferrari"),
    ("HUL", "Nico Hulkenberg", 27, "audi"),
    ("LAW", "Liam Lawson", 30, "racing_bulls"),
    ("LEC", "Charles Leclerc", 16, "ferrari"),
    ("LIN", "Arvid Lindblad", 41, "racing_bulls"),
    ("NOR", "Lando Norris", 1, "mclaren"),
    ("OCO", "Esteban Ocon", 31, "haas"),
    ("PER", "Sergio Perez", 11, "cadillac"),
    ("PIA", "Oscar Piastri", 81, "mclaren"),
    ("RUS", "George Russell", 63, "mercedes"),
    ("SAI", "Carlos Sainz", 55, "williams"),
    ("STR", "Lance Stroll", 18, "aston_martin"),
    ("TSU", "Yuki Tsunoda", 22, None),
    ("VER", "Max Verstappen", 3, "red_bull"),
]

NAME_ALIASES = {"andrea kimi antonelli": "kimi antonelli"}


def driver_key(name) -> str:
    n = _norm(name)
    return slug(NAME_ALIASES.get(n, n))


def build_dim_driver() -> pd.DataFrame:
    d = pd.DataFrame(
        GRID_2026,
        columns=["driver_code", "full_name", "driver_number_2026", "team_key_2026"],
    )
    d.insert(0, "driver_key", d["full_name"].map(driver_key))
    return d


def build_dim_team(fantasy_teams: pd.DataFrame | None = None) -> pd.DataFrame:
    t = pd.DataFrame(
        {"team_key": list(TEAM_DISPLAY), "team_name": list(TEAM_DISPLAY.values())}
    )
    if fantasy_teams is not None:
        f = fantasy_teams.assign(team_key=fantasy_teams["team_name"].map(resolve_team))
        t = t.merge(
            f[["team_key", "player_id"]].rename(
                columns={"player_id": "fantasy_team_id"}
            ),
            on="team_key",
            how="left",
        )
    return t


def link_fantasy_drivers(df: pd.DataFrame) -> pd.DataFrame:
    dim = build_dim_driver()
    out = df.copy()
    out["driver_key"] = out["driver_name"].map(driver_key)
    out["team_key"] = out["team_name"].map(resolve_team)
    out = out.merge(
        dim.rename(columns={"driver_number_2026": "driver_number"})[
            ["driver_key", "driver_code", "driver_number", "team_key_2026"]
        ],
        on="driver_key",
        how="left",
    )
    out["is_active_seat"] = out["team_key"] == out["team_key_2026"]
    out = out.drop(columns="team_key_2026")
    if out["driver_code"].isna().any():
        miss = out.loc[out["driver_code"].isna(), "driver_name"].tolist()
        print(f"  [WARNING] no driver_code for {miss}; add them to GRID_2026")
    front = [
        "season",
        "player_id",
        "driver_name",
        "driver_code",
        "driver_number",
        "driver_key",
        "team_id",
        "team_name",
        "team_key",
        "is_active_seat",
    ]
    return out[front + [c for c in out.columns if c not in front]]


def link_fantasy_teams(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["team_key"] = out["team_name"].map(resolve_team)
    front = ["season", "player_id", "team_name", "team_key"]
    return out[front + [c for c in out.columns if c not in front]]


def validate_fantasy(drivers: pd.DataFrame, teams: pd.DataFrame) -> list[str]:
    problems = []
    orphan = set(drivers["team_id"]) - set(teams["player_id"])
    if orphan:
        problems.append(f"drivers.team_id not in teams.player_id: {sorted(orphan)}")
    if drivers["driver_code"].isna().any():
        problems.append("drivers without driver_code")
    m = drivers.merge(
        teams[["player_id", "team_key"]],
        left_on="team_id",
        right_on="player_id",
        suffixes=("", "_t"),
    )
    bad = m[m["team_key"] != m["team_key_t"]]
    if len(bad):
        problems.append(
            f"team_key mismatch between drivers and teams: {bad['driver_name'].tolist()}"
        )
    act = drivers[drivers["is_active_seat"]]
    if act["driver_code"].duplicated().any():
        problems.append("a driver has more than one active seat")
    return problems


def _clean_kaggle(df: pd.DataFrame) -> pd.DataFrame:
    return df.replace({"\\N": np.nan})


def link_kaggle(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    res, drv = _clean_kaggle(tables["results"]), _clean_kaggle(tables["drivers"])
    con, rac = _clean_kaggle(tables["constructors"]), _clean_kaggle(tables["races"])

    drv = drv.assign(
        driver_key=(drv["forename"].astype(str) + " " + drv["surname"].astype(str)).map(
            driver_key
        ),
        driver_code=drv["code"],
    )
    derived = drv["driver_code"].isna()
    drv["code_is_derived"] = derived
    drv.loc[derived, "driver_code"] = (
        drv.loc[derived, "surname"].map(_norm).str.replace(" ", "").str[:3].str.upper()
    )

    con = con.assign(
        team_key=[
            resolve_team(n) or resolve_team(r)
            for n, r in zip(con["name"], con["constructorRef"])
        ]
    )
    rac = rac.assign(season=rac["year"].astype(int), round=rac["round"].astype(int))
    rac["race_key"] = (
        rac["season"].astype(str) + "-" + rac["round"].map("{:02d}".format)
    )

    out = (
        res.merge(
            rac[
                ["raceId", "season", "round", "race_key", "date", "circuitId", "name"]
            ].rename(
                columns={
                    "date": "race_date",
                    "circuitId": "circuit_id",
                    "name": "race_name",
                }
            ),
            on="raceId",
        )
        .merge(
            drv[["driverId", "driver_key", "driver_code", "code_is_derived"]],
            on="driverId",
        )
        .merge(
            con[["constructorId", "team_key", "name"]].rename(
                columns={"name": "team_name_raw"}
            ),
            on="constructorId",
        )
    )
    out["driver_number"] = pd.to_numeric(out["number"], errors="coerce")
    out["grid"] = pd.to_numeric(out["grid"], errors="coerce")
    out["finish_pos"] = pd.to_numeric(out["positionOrder"], errors="coerce")
    out["points"] = pd.to_numeric(out["points"], errors="coerce")
    out["dnf"] = (
        ~out["positionText"].astype(str).str.fullmatch(r"\d+")
    )
    keep = [
        "race_key",
        "season",
        "round",
        "raceId",
        "race_date",
        "circuit_id",
        "race_name",
        "driverId",
        "driver_key",
        "driver_code",
        "code_is_derived",
        "driver_number",
        "constructorId",
        "team_key",
        "team_name_raw",
        "grid",
        "finish_pos",
        "points",
        "dnf",
    ]
    return (
        out[keep].sort_values(["season", "round", "finish_pos"]).reset_index(drop=True)
    )


def add_form_features(
    res: pd.DataFrame, n_form: int = 5, n_dnf: int = 10
) -> pd.DataFrame:
    r = res.sort_values(["season", "round"]).reset_index(drop=True)

    def prior_mean(s, n):
        return s.shift(1).rolling(n, min_periods=1).mean()

    g = r.groupby("driver_key", sort=False)
    for col in ("finish_pos", "grid", "points"):
        r[f"{col}_avg_last{n_form}"] = g[col].transform(lambda s: prior_mean(s, n_form))
    r[f"dnf_rate_last{n_dnf}"] = g["dnf"].transform(
        lambda s: prior_mean(s.astype(float), n_dnf)
    )
    r["circuit_finish_avg_prior"] = r.groupby(["driver_key", "circuit_id"])[
        "finish_pos"
    ].transform(lambda s: s.shift(1).expanding().mean())

    tr = (
        r.groupby(["team_key", "season", "round"], as_index=False)["points"]
        .sum()
        .rename(columns={"points": "team_points"})
        .sort_values(["season", "round"])
    )
    tr[f"team_points_avg_last{n_form}"] = tr.groupby("team_key")[
        "team_points"
    ].transform(lambda s: prior_mean(s, n_form))
    r = r.merge(
        tr[["team_key", "season", "round", f"team_points_avg_last{n_form}"]],
        on=["team_key", "season", "round"],
        how="left",
    )

    s = r.groupby(["race_key", "team_key"])["finish_pos"].transform("sum")
    c = r.groupby(["race_key", "team_key"])["finish_pos"].transform("count")
    r["teammate_finish"] = np.where(
        c > 1, (s - r["finish_pos"]) / (c - 1).replace(0, np.nan), np.nan
    )
    r["beat_teammate"] = np.where(
        r["teammate_finish"].notna(),
        (r["finish_pos"] < r["teammate_finish"]).astype(float),
        np.nan,
    )
    r = r.sort_values(["season", "round"]).reset_index(drop=True)
    r["beat_teammate_rate_last10"] = r.groupby("driver_key")["beat_teammate"].transform(
        lambda s: prior_mean(s, 10)
    )
    return r.drop(columns=["teammate_finish", "beat_teammate"])


def fetch_openf1_drivers(
    meeting_keys, session_key_by_meeting: dict, delay: float = 2.0
) -> pd.DataFrame:
    import requests

    rows = []
    for mk in meeting_keys:
        r = requests.get(
            "https://api.openf1.org/v1/drivers",
            params={"session_key": session_key_by_meeting[mk]},
            timeout=20,
        )
        r.raise_for_status()
        rows.extend(r.json())
        time.sleep(delay)
    return pd.DataFrame(rows)


def attach_race_keys(
    laps: pd.DataFrame, kaggle_races: pd.DataFrame, max_days: int = 4
) -> pd.DataFrame:
    rac = _clean_kaggle(kaggle_races).assign(
        date=lambda d: pd.to_datetime(d["date"]).dt.tz_localize(None)
    )
    ts = (
        pd.to_datetime(laps["date_start"], utc=True, format="mixed")
        .dt.tz_localize(None)
        .dt.normalize()
    )
    meet = (
        laps.assign(_d=ts)
        .groupby("meeting_key")
        .agg(start=("_d", "min"), season=("session_year", "first"))
    )
    rows = []
    for mk, m in meet.iterrows():
        cand = rac[
            (rac["year"].astype(int) == int(m["season"]))
            & (rac["date"] >= m["start"] - pd.Timedelta(days=1))
            & (rac["date"] <= m["start"] + pd.Timedelta(days=max_days))
        ]
        if cand.empty:
            rows.append((mk, None, None))
            continue
        c = cand.iloc[(cand["date"] - m["start"]).abs().argsort().iloc[0]]
        rows.append((mk, f"{int(c['year'])}-{int(c['round']):02d}", int(c["raceId"])))
    mp = pd.DataFrame(rows, columns=["meeting_key", "race_key", "kaggle_raceId"])
    unmatched = mp["race_key"].isna().sum()
    if unmatched:
        print(
            f"  [WARNING] {unmatched} OpenF1 meeting(s) have no Kaggle race yet (new race / dataset lag)."
        )
    return laps.merge(mp, on="meeting_key", how="left")


def link_openf1_laps(
    laps: pd.DataFrame,
    openf1_drivers: pd.DataFrame | None = None,
    kaggle_linked: pd.DataFrame | None = None,
) -> pd.DataFrame:
    out = laps.copy()
    code = pd.Series(None, index=out.index, dtype="object")
    team = pd.Series(None, index=out.index, dtype="object")
    src = pd.Series(None, index=out.index, dtype="object")

    def fill(c, t, name):
        nonlocal code, team, src
        new = c.notna() & code.isna()
        code, team, src = (
            code.where(~new, c),
            team.where(~new, t),
            src.where(~new, name),
        )

    if openf1_drivers is not None:
        d = openf1_drivers.drop_duplicates(["meeting_key", "driver_number"])
        m = out[["meeting_key", "driver_number"]].merge(
            d[["meeting_key", "driver_number", "name_acronym", "team_name"]],
            on=["meeting_key", "driver_number"],
            how="left",
        )
        m.index = out.index
        fill(
            m["name_acronym"],
            m["team_name"].map(resolve_team).where(m["team_name"].notna()),
            "openf1_drivers",
        )

    if kaggle_linked is not None and "race_key" in out.columns:
        k = kaggle_linked.dropna(subset=["driver_number"]).drop_duplicates(
            ["race_key", "driver_number"]
        )
        m = out[["race_key", "driver_number"]].merge(
            k[["race_key", "driver_number", "driver_code", "team_key"]],
            on=["race_key", "driver_number"],
            how="left",
        )
        m.index = out.index
        fill(m["driver_code"], m["team_key"], "kaggle_results")

    seed = (
        build_dim_driver()
        .dropna(subset=["team_key_2026"])
        .set_index("driver_number_2026")
    )
    is26 = out["session_year"] == 2026
    fill(
        out["driver_number"].map(seed["driver_code"]).where(is26),
        out["driver_number"].map(seed["team_key_2026"]).where(is26),
        "seed_2026",
    )

    out["driver_code"], out["team_key"], out["link_source"] = code, team, src
    k2c = build_dim_driver().set_index("driver_code")["driver_key"]
    out["driver_key"] = out["driver_code"].map(k2c)
    if out["driver_code"].isna().any():
        print(
            f"  [WARNING] {out['driver_code'].isna().sum()} lap rows have no driver_code "
            f"(pass openf1_drivers for seasons other than 2026)."
        )
    return out


def build_openf1_features(laps: pd.DataFrame, clean_pct: float = 1.07) -> pd.DataFrame:
    keys = ["meeting_key", "session_key", "session_code", "driver_code", "team_key"]
    for opt in ("race_key", "session_year"):
        if opt in laps.columns:
            keys.append(opt)
    l = laps.dropna(subset=["driver_code"]).copy()
    valid = l[l["lap_duration"].notna() & ~l["is_pit_out_lap"].astype(bool)].copy()
    best = valid.groupby(["session_key", "driver_code"])["lap_duration"].transform(
        "min"
    )
    valid["_clean"] = valid["lap_duration"] <= best * clean_pct

    agg = valid.groupby(keys, dropna=False).agg(
        n_laps=("lap_number", "count"),
        best_lap=("lap_duration", "min"),
        s1_best=("duration_sector_1", "min"),
        s2_best=("duration_sector_2", "min"),
        s3_best=("duration_sector_3", "min"),
        i1_speed_max=("i1_speed", "max"),
        i2_speed_max=("i2_speed", "max"),
        top_speed=("st_speed", "max"),
    )
    clean = (
        valid[valid["_clean"]]
        .groupby(keys, dropna=False)["lap_duration"]
        .agg(pace_median="median", pace_std="std")
    )
    pits = l.groupby(keys, dropna=False)["is_pit_out_lap"].sum().rename("pit_out_laps")
    f = agg.join(clean).join(pits).reset_index()

    wcols = [
        c
        for c in (
            "air_temperature",
            "track_temperature",
            "humidity",
            "wind_speed",
            "rainfall",
        )
        if c in l.columns
    ]
    if wcols:
        w = l.groupby("session_key")[wcols].mean().add_prefix("wx_").reset_index()
        f = f.merge(w, on="session_key", how="left")

    grp = ["session_key"]
    f["gap_best_pct"] = f["best_lap"] / f.groupby(grp)["best_lap"].transform("min") - 1
    f["gap_pace_pct"] = (
        f["pace_median"] / f.groupby(grp)["pace_median"].transform("min") - 1
    )
    f["top_speed_delta"] = f["top_speed"] - f.groupby(grp)["top_speed"].transform("max")
    f["pace_rank"] = f.groupby(grp)["pace_median"].rank(method="min")

    tg = ["session_key", "team_key"]
    n = f.groupby(tg)["gap_pace_pct"].transform("count")
    for col in ("gap_best_pct", "gap_pace_pct"):
        s = f.groupby(tg)[col].transform("sum")
        mate = (s - f[col]) / (n - 1).replace(0, np.nan)
        f[f"{col}_vs_teammate"] = np.where(n > 1, f[col] - mate, np.nan)
    return f


def build_team_features(driver_feats: pd.DataFrame) -> pd.DataFrame:
    g = [
        c
        for c in ("race_key", "meeting_key", "session_key", "session_code", "team_key")
        if c in driver_feats.columns
    ]
    t = (
        driver_feats.groupby(g, dropna=False)
        .agg(
            team_gap_best_pct=("gap_best_pct", "mean"),
            team_gap_pace_pct=("gap_pace_pct", "mean"),
            team_best_gap_pct=("gap_best_pct", "min"),
            team_top_speed_delta=("top_speed_delta", "max"),
            team_pit_out_laps=("pit_out_laps", "sum"),
            team_drivers=("driver_code", "nunique"),
        )
        .reset_index()
    )
    t["team_pace_rank"] = t.groupby("session_key")["team_gap_pace_pct"].rank(
        method="min"
    )
    return t


PER_DRIVER_VALUES = [
    "gap_best_pct",
    "gap_pace_pct",
    "gap_best_pct_vs_teammate",
    "gap_pace_pct_vs_teammate",
    "top_speed_delta",
    "pace_std",
    "pace_rank",
    "n_laps",
    "pit_out_laps",
]
PER_TEAM_VALUES = [
    "team_gap_best_pct",
    "team_gap_pace_pct",
    "team_top_speed_delta",
    "team_pace_rank",
]


def pivot_sessions(
    feats: pd.DataFrame, index: list[str], values: list[str]
) -> pd.DataFrame:
    p = feats.pivot_table(
        index=index,
        columns="session_code",
        values=[v for v in values if v in feats.columns],
        aggfunc="first",
    )
    p.columns = [f"{sc}_{v}" for v, sc in p.columns]
    return p.reset_index()


def build_training_table(
    kaggle_form: pd.DataFrame,
    of1_driver_feats: pd.DataFrame,
    of1_team_feats: pd.DataFrame,
    pre_race_only: bool = True,
) -> pd.DataFrame:
    d, t = of1_driver_feats, of1_team_feats
    if pre_race_only:
        d, t = d[d["session_code"] != "R"], t[t["session_code"] != "R"]
    dw = pivot_sessions(
        d.dropna(subset=["race_key"]), ["race_key", "driver_code"], PER_DRIVER_VALUES
    )
    tw = pivot_sessions(
        t.dropna(subset=["race_key"]), ["race_key", "team_key"], PER_TEAM_VALUES
    )
    out = kaggle_form.merge(dw, on=["race_key", "driver_code"], how="left").merge(
        tw, on=["race_key", "team_key"], how="left"
    )
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--fantasy-dir", default="./f1-fantasy-data")
    ap.add_argument(
        "--out-dir", default=None, help="default: overwrite in --fantasy-dir"
    )
    a = ap.parse_args()
    out_dir = a.out_dir or a.fantasy_dir
    os.makedirs(out_dir, exist_ok=True)

    drivers = link_fantasy_drivers(
        pd.read_csv(os.path.join(a.fantasy_dir, "drivers.csv"))
    )
    teams = link_fantasy_teams(pd.read_csv(os.path.join(a.fantasy_dir, "teams.csv")))
    for p in validate_fantasy(drivers, teams):
        print("  [WARNING]", p)
    drivers.to_csv(os.path.join(out_dir, "drivers.csv"), index=False)
    teams.to_csv(os.path.join(out_dir, "teams.csv"), index=False)
    build_dim_driver().to_csv(os.path.join(out_dir, "dim_driver.csv"), index=False)
    build_dim_team(teams).to_csv(os.path.join(out_dir, "dim_team.csv"), index=False)
    print(f"  [INFO] wrote linked fantasy files + dim tables to {out_dir}")


if __name__ == "__main__":
    main()
