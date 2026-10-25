from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import requests
import seaborn as sns

sns.set_theme(style="whitegrid")

# ruff: noqa: UP017
# ruff: noqa: FURB162
# ruff: noqa: BLE001

LOCAL_KAGGLE_DIR = "./kaggle-base-data"
LOCAL_OPENF1_DIR = "./openf1-telemetry-data"
LOCAL_FANTASY_DIR = "./f1-fantasy-data"

KAGGLE_DATASET_HANDLE = "jtrotman/formula-1-race-data"
# Records which published Kaggle version the local copy is, so every run can check it against the latest.
KAGGLE_CACHE_LOG = os.path.join(LOCAL_KAGGLE_DIR, "kaggle_cache_log.json")
KAGGLE_LOG_HISTORY = 25  # how many past checks to keep in the log

ALL_SOURCES = ("kaggle", "openf1", "fantasy")  # default: fetch everything

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_START_YEAR = 2023
OPENF1_COMBINED_FILENAME = f"all_laps_{OPENF1_START_YEAR}_to_latest.csv"
OPENF1_WEATHER_COLS = {
    "air_temperature",
    "track_temperature",
    "humidity",
}  # present in every cached race file
OPENF1_REQUEST_DELAY = 2.0  # polite delay between calls to the free API
OPENF1_MAX_RETRIES = 3
OPENF1_WEATHER_TOLERANCE = pd.Timedelta(
    minutes=5
)  # max gap when matching a lap to a weather reading

# OpenF1 session_name -> file code. (2023 called sprint qualifying "Sprint Shootout".)
OPENF1_SESSION_CODES = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SQ",
    "Sprint": "SR",
    "Qualifying": "Q",
    "Race": "R",
}
OPENF1_SESSION_COLS = {
    "session_code",
    "session_name",
}  # present in every cached session file


class PartialDataError(RuntimeError):
    """
    A stage that loaded some, but not all, of its data. `partial` is what was loaded
    and `missing` names what wasn't, so the report can still use the former and say
    exactly what is lacking. Nothing is ever substituted for the missing part.
    """

    def __init__(self, message: str, partial, missing):
        super().__init__(message)
        self.partial = partial
        self.missing = list(missing)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _kaggle_read_log() -> dict:
    """The cache log, or {} if there is none / it can't be read (=> local copy is unverified)."""
    try:
        with open(KAGGLE_CACHE_LOG, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        print("  [INFO] No cache log found; treating the local copy as unverified.")
        return {}
    except (OSError, ValueError) as e:
        print(
            f"  [ERROR] Kaggle cache log unreadable ({e}); treating the local copy as unverified."
        )
        return {}


def _kaggle_write_log(log: dict) -> None:
    os.makedirs(LOCAL_KAGGLE_DIR, exist_ok=True)
    tmp = KAGGLE_CACHE_LOG + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(log, fh, indent=2)
    os.replace(tmp, KAGGLE_CACHE_LOG)


def _kaggle_published_version() -> tuple[int, str]:
    """
    Asks Kaggle for the dataset's current published version. kagglehub resolves an
    unversioned handle to the latest published version on every call (and only
    downloads it if that version isn't already in kagglehub's own cache), returning
    <kagglehub cache>/datasets/<owner>/<dataset>/versions/<N>.
    Returns (N, that directory).
    """
    import kagglehub  # ImportError / network / auth errors propagate to the caller

    path = str(kagglehub.dataset_download(KAGGLE_DATASET_HANDLE))
    m = re.search(r"versions[\\/](\d+)[\\/]*$", path)
    if not m:
        raise RuntimeError(
            f"  [ERROR] Could not read the published version number from kagglehub's path '{path}'."
        )
    return int(m.group(1)), path


def _kaggle_local_matches_log(log: dict, version: int) -> tuple[bool, str]:
    """Is the local copy exactly the log's recorded files of the given published version?"""
    if log.get("dataset") != KAGGLE_DATASET_HANDLE:
        return False, "no cache log for this dataset"
    if log.get("published_version") != version:
        return (
            False,
            f"published version changed ({log.get('published_version')} -> {version})",
        )
    files = log.get("files") or {}
    if not files:
        return False, "cache log lists no files (previous sync did not finish)"
    local = {
        os.path.basename(f) for f in glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv"))
    }
    if local != set(files):
        return False, "local CSV files differ from the cache log"
    for name, size in files.items():
        if os.path.getsize(os.path.join(LOCAL_KAGGLE_DIR, name)) != size:
            return False, f"'{name}' differs in size from the cache log"
    return True, "local copy matches the cache log"


def _kaggle_sync_local(src_dir: str, log: dict) -> dict:
    """Replaces the local CSVs with those of src_dir; returns {file name: size}."""
    sources = glob.glob(os.path.join(src_dir, "*.csv"))
    if not sources:
        raise RuntimeError(
            f"  [ERROR] The downloaded dataset at '{src_dir}' contains no CSV files."
        )
    os.makedirs(LOCAL_KAGGLE_DIR, exist_ok=True)
    # Invalidate the log first: if we're interrupted mid-copy, the next run re-syncs.
    _kaggle_write_log(
        {**log, "published_version": None, "files": {}, "status": "sync in progress"}
    )
    for old in glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv")):
        os.remove(old)
    files = {}
    for src in sources:
        dest = os.path.join(LOCAL_KAGGLE_DIR, os.path.basename(src))
        shutil.copy2(src, dest)
        files[os.path.basename(src)] = os.path.getsize(dest)
    return files


def load_all_kaggle_files() -> dict[str, pd.DataFrame]:
    """
    Loads ALL CSV tables of the Kaggle F1 dataset into a dict of DataFrames, always
    from the latest *published* version of the dataset.

    Every run asks Kaggle for the current published version and checks it against
    the cache log (kaggle_f1_data/kaggle_cache_log.json: dataset, published version,
    fetched-at time, file list, and a history of checks). If the local copy is
    already that version (and its files match the log) it is reused; otherwise the
    latest version is downloaded, the local copy replaced and the log updated.

    Raises if the latest version can't be checked or fetched. A local copy that
    can't be verified against the latest version is NOT used, and no
    sample/placeholder data is ever generated.
    """
    print("[STAGE 1] Processing Kaggle Data")
    log = _kaggle_read_log()

    try:
        version, src_dir = _kaggle_published_version()
    except Exception as e:
        print(
            f"  [ERROR] Could not check/download the latest published version of "
            f"'{KAGGLE_DATASET_HANDLE}': {type(e).__name__}: {e}"
        )
        had = (
            (
                f" A local copy of version {log['published_version']} (fetched {log.get('fetched_at_utc')}) exists "
                f"but could not be verified as the latest, so it was not used."
            )
            if log.get("published_version")
            else ""
        )
        raise RuntimeError(
            f"  [ERROR] Could not check/download the latest published version of "
            f"'{KAGGLE_DATASET_HANDLE}': {type(e).__name__}: {e}.{had}"
        ) from e
    print(f"  [INFO] Latest published version of '{KAGGLE_DATASET_HANDLE}': {version}")

    up_to_date, reason = _kaggle_local_matches_log(log, version)
    previous_version = log.get("published_version")
    now = _utc_now_iso()
    if up_to_date:
        print(
            f"  [INFO] Local copy at '{LOCAL_KAGGLE_DIR}' is version {version} (fetched {log.get('fetched_at_utc')}). Skipping copy."
        )
        action = "up-to-date"
    else:
        print(f"  [INFO] Updating local copy at '{LOCAL_KAGGLE_DIR}': {reason}.")
        if not log and glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv")):
            print(
                "  [WARNING] found an unversioned local copy (no cache log); replacing it with the published version."
            )
        log["files"] = _kaggle_sync_local(src_dir, log)
        log.update(
            {
                "dataset": KAGGLE_DATASET_HANDLE,
                "published_version": version,
                "fetched_at_utc": now,
                "source_path": src_dir,
                "status": "ok",
            }
        )
        action = "downloaded"

    log["last_checked_utc"] = now
    log["history"] = (
        log.get("history", [])
        + [
            {
                "checked_at_utc": now,
                "published_version": version,
                "previous_local_version": previous_version,
                "action": action,
            }
        ]
    )[-KAGGLE_LOG_HISTORY:]
    _kaggle_write_log(log)

    kaggle_dfs, unreadable = {}, []
    for path in glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv")):
        table_name = os.path.basename(path).replace(".csv", "")
        try:
            kaggle_dfs[table_name] = pd.read_csv(path)
            print(
                f"  [INFO] Loaded table: '{table_name}' ({len(kaggle_dfs[table_name]):,} rows, {len(kaggle_dfs[table_name].columns)} cols)"
            )
        except Exception as err:
            print(f"  [ERROR] Could not read '{table_name}': {err}")
            unreadable.append(table_name)

    if not kaggle_dfs:
        raise RuntimeError(f"No readable CSV tables found in '{LOCAL_KAGGLE_DIR}'.")
    if unreadable:
        raise PartialDataError(
            f"{len(unreadable)} Kaggle table(s) could not be read",
            kaggle_dfs,
            sorted(unreadable),
        )
    return kaggle_dfs


# ---------------------------------------------------------------------------
# OpenF1 helpers (internal) — used by fetch_openf1_data()
# ---------------------------------------------------------------------------


def _openf1_get(endpoint: str, params: dict, strict: bool = False) -> list:
    """
    GET helper with retries and simple backoff. When every retry fails it returns []
    — or raises RuntimeError if strict=True, so a network failure can never be
    mistaken for "the API has no data".
    """
    url = f"{OPENF1_BASE_URL}/{endpoint}"
    for attempt in range(1, OPENF1_MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=20)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt == OPENF1_MAX_RETRIES:
                print(
                    f"  [ERROR] Failed {endpoint} {params} after {OPENF1_MAX_RETRIES} tries: {e}"
                )
                if strict:
                    raise RuntimeError(
                        f"OpenF1 request failed: {endpoint} {params}: {e}"
                    ) from e
                return []
            wait = 2**attempt
            print(
                f"  [ERROR] {endpoint} attempt {attempt} failed ({e}); retrying in {wait}s"
            )
            time.sleep(wait)
        finally:
            time.sleep(OPENF1_REQUEST_DELAY)
    return []


def _openf1_parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _openf1_race_dir_name(year, location) -> str:
    """'2023-Austin', '2024-Sao_Paulo': one directory per race weekend."""
    safe = (
        re.sub(r"[^\w\-]+", "_", str(location or "unknown").strip()).strip("_")
        or "unknown"
    )
    return f"{year}-{safe}"


def _openf1_collect_sessions(cutoff: datetime) -> pd.DataFrame:
    """
    Every non-cancelled session of every race weekend from OPENF1_START_YEAR that had
    finished by `cutoff` (the time the script was run): FP1-FP3, sprint qualifying,
    sprint, qualifying and race, whichever apply to the weekend. A session still in
    progress at the cut-off is left out, since its laps would be partial. Adds
    `session_code` (FP1/FP2/FP3/SQ/SR/Q/R) and `race_dir` (e.g. '2023-Austin').
    Raises if a year's session list can't be fetched, so a network error can't
    silently drop sessions.
    """
    all_sessions = []
    for year in range(OPENF1_START_YEAR, cutoff.year + 1):
        print(f"  [INFO] Listing {year} sessions...")
        all_sessions.extend(_openf1_get("sessions", {"year": year}, strict=True))

    df = pd.DataFrame(all_sessions)
    if df.empty:
        return df

    known = df["session_name"].isin(OPENF1_SESSION_CODES)
    if (~known).any():
        print(
            f"  [INFO] Ignoring unmapped session types: {sorted(df.loc[~known, 'session_name'].unique())}"
        )
    df = df[known].copy()
    if df.empty:
        return df
    df["session_code"] = df["session_name"].map(OPENF1_SESSION_CODES)

    # One directory per meeting; if two meetings in a year share a location name, add the meeting key.
    df["race_dir"] = [
        _openf1_race_dir_name(y, loc) for y, loc in zip(df["year"], df["location"])
    ]
    clash = df.groupby("race_dir")["meeting_key"].nunique()
    for d in clash[clash > 1].index:
        mask = df["race_dir"] == d
        df.loc[mask, "race_dir"] = d + "_" + df.loc[mask, "meeting_key"].astype(str)

    df["date_start_dt"] = df["date_start"].apply(_openf1_parse_dt)
    ends = (
        df["date_end"]
        if "date_end" in df.columns
        else pd.Series([None] * len(df), index=df.index)
    )
    df["date_end_dt"] = [
        _openf1_parse_dt(e) if isinstance(e, str) and e else st
        for e, st in zip(ends, df["date_start_dt"])
    ]

    if "is_cancelled" in df.columns:
        df = df[~df["is_cancelled"].fillna(False)]

    df = df[df["date_end_dt"] <= cutoff]
    return df.sort_values("date_start_dt").reset_index(drop=True)


def _openf1_attach_weather(laps_df: pd.DataFrame, session_key) -> pd.DataFrame:
    """
    Fetches weather readings for a session and attaches the nearest reading
    (within OPENF1_WEATHER_TOLERANCE) to each lap, matched on time. Weather
    is sampled about once a minute, laps are per-lap, so this is a nearest-
    timestamp merge rather than a 1:1 join.
    """
    weather = _openf1_get("weather", {"session_key": session_key}, strict=True)
    if not weather:
        # No weather published for this session — return laps unchanged,
        # but still add empty weather columns so the schema stays consistent.
        for col in [
            "air_temperature",
            "track_temperature",
            "humidity",
            "rainfall",
            "wind_speed",
            "wind_direction",
            "pressure",
        ]:
            laps_df[col] = np.nan
        return laps_df

    weather_df = pd.DataFrame(weather)
    weather_df["date"] = pd.to_datetime(weather_df["date"], format="ISO8601", utc=True)

    if "date_start" not in laps_df.columns:
        # Can't time-align without a lap timestamp; skip merge.
        return laps_df

    laps_df = laps_df.copy()
    laps_df["date_start"] = pd.to_datetime(
        laps_df["date_start"], format="ISO8601", utc=True, errors="coerce"
    )

    weather_cols = [
        "date",
        "air_temperature",
        "track_temperature",
        "humidity",
        "rainfall",
        "wind_speed",
        "wind_direction",
        "pressure",
    ]
    weather_cols = [c for c in weather_cols if c in weather_df.columns]

    # merge_asof requires a non-null join key, but some laps (e.g. the first
    # lap of a session) have no date_start. Merge only the timestamped rows
    # and reattach the rest afterward with blank weather columns.
    has_date = laps_df["date_start"].notna()
    timed, untimed = laps_df[has_date], laps_df[~has_date].copy()

    merged = pd.merge_asof(
        timed.sort_values("date_start"),
        weather_df[weather_cols].sort_values("date"),
        left_on="date_start",
        right_on="date",
        direction="nearest",
        tolerance=OPENF1_WEATHER_TOLERANCE,
    ).drop(columns=["date"])

    if not untimed.empty:
        for col in weather_cols[1:]:  # skip "date", already excluded
            untimed[col] = np.nan
        merged = pd.concat([merged, untimed], ignore_index=True)

    return merged


def _openf1_find_upcoming_race() -> dict:
    """
    Returns info about the next Race session that hasn't happened yet
    (checks the current year, then next year in case of a season rollover).
    Empty dict if nothing upcoming can be found.
    """
    now = datetime.now(timezone.utc)
    for year in (now.year, now.year + 1):
        sessions = _openf1_get("sessions", {"year": year, "session_name": "Race"})
        upcoming = [
            s
            for s in sessions
            if _openf1_parse_dt(s["date_start"]) > now
            and not s.get("is_cancelled", False)
        ]
        if upcoming:
            nxt = min(upcoming, key=lambda s: s["date_start"])
            return {
                "race_name": nxt.get("location")
                or nxt.get("circuit_short_name")
                or "Unknown",
                "race_date": _openf1_parse_dt(nxt["date_start"]),
                "session_key": nxt.get("session_key"),
                "meeting_key": nxt.get("meeting_key"),
            }
    return {}


def _openf1_download_all_races(output_dir: str, cutoff: datetime) -> pd.DataFrame:
    """
    Builds the lap dataset (all drivers, with weather) for every session of every
    race weekend from OPENF1_START_YEAR that had finished by `cutoff`: FP1-FP3,
    sprint qualifying, sprint, qualifying and race (whichever the weekend had).

    Layout: <output_dir>/<year>-<Location>/<code>.csv, e.g. 2023-Austin/FP1.csv,
    2023-Austin/SQ.csv, 2023-Austin/SR.csv, 2023-Austin/Q.csv, 2023-Austin/R.csv.
    Sessions already saved (with weather and session columns) are reused, so a re-run
    only downloads sessions that finished since the last run. Writes the combined CSV
    and returns it. If some sessions can't be downloaded, the combined CSV is still
    written from the rest and PartialDataError is raised carrying that partial frame
    and the failed sessions (nothing is substituted); re-running resumes from the
    sessions already saved. The returned frame's .attrs record the expected session
    count and the sessions OpenF1 published no lap data for.
    """
    os.makedirs(output_dir, exist_ok=True)

    race_sessions = _openf1_collect_sessions(cutoff)
    if race_sessions.empty:
        raise RuntimeError("[ERROR] No finished sessions found up to the cut-off.")

    n = len(race_sessions)
    print(
        f"  [INFO] Found {n} finished sessions across {race_sessions['race_dir'].nunique()} race weekends "
        f"from {OPENF1_START_YEAR} through {race_sessions['date_end_dt'].max().date()}. Collecting laps..."
    )

    frames, failed, no_data = [], [], []
    for i, row in race_sessions.iterrows():
        session_key = row["session_key"]
        code = row["session_code"]
        label = f"{row['race_dir']}/{code}"
        tag = f"[{i + 1}/{n}] {label}"  # type: ignore
        race_path = os.path.join(output_dir, row["race_dir"])
        os.makedirs(race_path, exist_ok=True)
        file_path = os.path.join(race_path, f"{code}.csv")

        if os.path.exists(file_path):
            try:
                cached = pd.read_csv(file_path)
                if (
                    len(cached) > 0
                    and OPENF1_WEATHER_COLS.issubset(cached.columns)
                    and OPENF1_SESSION_COLS.issubset(cached.columns)
                ):
                    print(f"  [INFO] {tag}: already saved ({len(cached):,} rows)")
                    frames.append(cached)
                    continue
                print(
                    f"  [GET] {tag}: saved file is empty or predates weather/session columns; re-downloading"
                )
            except Exception as e:
                print(f"  [GET] {tag}: saved file unreadable ({e}); re-downloading")

        try:
            laps = _openf1_get("laps", {"session_key": session_key}, strict=True)
            if not laps:
                print(
                    f"  [INFO] {tag}: OpenF1 has no lap data for this session, skipping."
                )
                no_data.append(label)
                continue
            laps_df = pd.DataFrame(laps)
            laps_df["meeting_location"] = row.get("location")
            laps_df["session_year"] = row.get("year")
            laps_df["session_name"] = row["session_name"]
            laps_df["session_code"] = code
            laps_df["race_dir"] = row["race_dir"]
            laps_df = _openf1_attach_weather(laps_df, session_key)
        except RuntimeError as e:
            print(f"  [WARNING] {tag}: FAILED ({e})")
            failed.append(label)
            continue

        laps_df.to_csv(file_path, index=False)
        print(f"  [GET] {tag}: downloaded {len(laps_df):,} rows -> {file_path}")
        frames.append(laps_df)

    if not frames:
        raise RuntimeError(
            f"No lap data could be loaded for any of the {n} sessions "
            f"({len(failed)} failed to download, {len(no_data)} have no published lap data)."
        )
    if no_data:
        print(f"  [INFO] Note: no lap data published for: {', '.join(no_data)}")

    combined_path = os.path.join(output_dir, OPENF1_COMBINED_FILENAME)
    pd.concat(frames, ignore_index=True).to_csv(combined_path, index=False)
    combined_df = pd.read_csv(combined_path)
    combined_df.attrs["expected_sessions"] = n
    combined_df.attrs["no_data_sessions"] = list(no_data)
    print(
        f"  [INFO] Saved combined dataset ({len(combined_df):,} rows) to {combined_path}"
    )

    if failed:
        raise PartialDataError(
            f"{len(failed)} of {n} session(s) could not be downloaded; nothing was substituted. ",
            combined_df,
            failed,
        )
    return combined_df


def fetch_openf1_data() -> pd.DataFrame:
    """
    Fetches real lap telemetry from OpenF1 for every session (FP1-FP3, sprint
    qualifying, sprint, qualifying, race) from the start of the 2023 season up to a
    cut-off set at the moment the script is run: all sessions that had finished by
    then are included, saved one directory per race weekend. Each lap is enriched with the
    nearest weather reading for that session (air/track temperature, humidity,
    rainfall, wind, pressure).

    Because the cut-off moves with every run, the session list is re-checked each
    time; races already saved locally are reused and only newly finished races
    are downloaded. Raises on failure: no mock telemetry is ever generated.
    """
    print("\n[STAGE 2] Processing OpenF1 Data")
    cutoff = datetime.now(timezone.utc)
    print(f"  [INFO] Cut-off (script run time): {cutoff:%Y-%m-%d %H:%M:%S} UTC")
    df = _openf1_download_all_races(LOCAL_OPENF1_DIR, cutoff)
    print(
        f"  [INFO] Loaded OpenF1 lap metrics ({len(df):,} records, including weather)."
    )
    return df


def _save_fantasy_csv(df: pd.DataFrame, filename: str) -> str:
    os.makedirs(LOCAL_FANTASY_DIR, exist_ok=True)
    path = os.path.join(LOCAL_FANTASY_DIR, filename)
    df.to_csv(path, index=False)
    return path


# ---------------------------------------------------------------------------
# Formula Fantasy — scraped from the official statistics page
#
# NOTE: there is NO historical fantasy data to fetch. The site only exposes the
# current season to date plus *current* prices, so this is a single snapshot of
# the present state (re-fetched every run, never cached, never back-filled).
#
# How it works: the statistics page is a JavaScript app that loads ONE json
# feed (.../feeds/v2/statistics/driverconstructors_<n>.json) holding every
# statistic filter as a block {"config": {"key": ...}, "participants": [...]}.
# We open the page, capture that feed and map each filter key to a column.
# Entities are matched by the site's player id, so two drivers with the same
# name (e.g. Liam Lawson at two teams) stay separate rows.
# ---------------------------------------------------------------------------

FANTASY_STATS_URL = (
    "https://fantasy.formula1.com/en/statistics/details?tab=driver&filter=fPoints"
)
FANTASY_FEED_MARKER = "statistics/driverconstructors"  # part of the feed's url
FANTASY_FEED_WAIT_SECONDS = 15
FANTASY_SOURCE_LABEL = "F1 Fantasy statistics feed (current season snapshot)"

# feed filter key -> column
FANTASY_FEED_KEY_TO_COL = {
    "fPoints": "fantasy_points_total",
    "fAvg": "avg_fantasy_points",
    "priceChange": "valuation_change",
    "mostPicked": "selected_by_pct",
    "pointsPermillion": "value_for_money",
    "overTakepoints": "overtakes",  # as published; may be overtake points
    "podiumsStats": "podiums",
    "topFinshed": "top10_finishes",  # (sic) the site's own spelling
    "mostDnf": "dnfs",
    "fastestLap": "fastest_lap_awards",
    "driverOfday": "dotds",
    "fastestPitstopstats": "fastest_pitstop_awards",
}
# columns that only exist for one entity type
FANTASY_NOT_APPLICABLE = {
    "driver": {"fastest_pitstop_awards"},
    "constructor": {"dotds"},
}
# The site only lists entities that have a selection %; absent means none.
FANTASY_MISSING_MEANS_ZERO = {"selected_by_pct"}

_FANTASY_STAT_ORDER = [
    "price_m",
    "selected_by_pct",
    "fantasy_points_total",
    "avg_fantasy_points",
    "valuation_change",
    "value_for_money",
    "overtakes",
    "podiums",
    "top10_finishes",
    "dnfs",
    "fastest_lap_awards",
]
FANTASY_DRIVER_COLS = (
    ["season", "player_id", "driver_name", "team_id", "team_name"]
    + _FANTASY_STAT_ORDER
    + ["dotds", "upcoming_race", "upcoming_race_date", "data_source"]
)
FANTASY_TEAM_COLS = (
    ["season", "player_id", "team_name"]
    + _FANTASY_STAT_ORDER
    + ["fastest_pitstop_awards", "upcoming_race", "upcoming_race_date", "data_source"]
)


def _fantasy_capture_feed() -> dict:
    """Open the statistics page in headless Chromium and return the captured feed json."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError(
            "[ERROR] playwright is required to read the F1 Fantasy page "
            "(pip install playwright && playwright install chromium)"
        ) from e

    captured = []

    def on_response(resp):
        if (
            FANTASY_FEED_MARKER in resp.url
            and "json" in (resp.headers.get("content-type") or "").lower()
        ):
            try:
                captured.append((resp.url, resp.json()))
            except Exception:
                pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                )
            )
            page = ctx.new_page()
            page.on("response", on_response)
            page.goto(FANTASY_STATS_URL, wait_until="domcontentloaded", timeout=60000)
            try:  # cookie banner
                page.click("#onetrust-accept-btn-handler", timeout=4000)
            except Exception:
                pass
            for _ in range(FANTASY_FEED_WAIT_SECONDS):
                if captured:
                    break
                page.wait_for_timeout(1000)
        finally:
            browser.close()
    print("  [INFO] Closed the browser.")

    if not captured:
        raise RuntimeError(
            f"[ERROR] The statistics feed ('{FANTASY_FEED_MARKER}') was not loaded by the page."
        )
    url, data = captured[-1]
    print(f"  [INFO] Feed: {url}")
    return data


def _fantasy_parse_feed(data: dict) -> tuple[list, list, list, list]:
    """Feed json -> (driver_rows, team_rows, unknown_filter_keys, defaulted_cells)."""
    try:
        feed = data["Data"]
        season = feed.get("season")
        sections = {"driver": feed["driver"], "constructor": feed["constructor"]}
    except (KeyError, TypeError) as e:
        raise RuntimeError(
            f"[ERROR] Unexpected feed structure (missing {e}); the site may have changed."
        ) from e

    out, unknown, defaulted = {}, [], []
    for etype, blocks in sections.items():
        entities = {}  # player id -> row
        for block in blocks:
            key = block["config"]["key"]
            col = FANTASY_FEED_KEY_TO_COL.get(key)
            if col is None:
                unknown.append(f"{etype}:{key}")
                continue
            for p in block["participants"]:
                name = p.get("playername") or p.get("teamname")
                pid = p.get("playerid")
                if (
                    pid is None
                ):  # the feed sometimes lists an entity without an id: match by name
                    pid = next(
                        (k for k, r in entities.items() if r["_name"] == name), name
                    )
                row = entities.setdefault(
                    str(pid),
                    {
                        "season": season,
                        "player_id": str(pid),
                        "_name": name,
                        "team_id": p.get("teamid"),
                        "team_name": p.get("teamname") if etype == "driver" else name,
                    },
                )
                if row.get("price_m") is None and p.get("curvalue") is not None:
                    row["price_m"] = p["curvalue"]
                if p.get("statvalue") is None:
                    # no value published = the entity has none (e.g. Cadillac top-10 finishes)
                    row[col] = 0
                    defaulted.append((name, col))
                else:
                    row[col] = p["statvalue"]
        for row in entities.values():
            for col in FANTASY_MISSING_MEANS_ZERO:
                if col not in row:
                    row[col] = 0
                    defaulted.append((row["_name"], col))
            if etype == "driver":
                row["driver_name"] = row["_name"]
            del row["_name"]
        out[etype] = list(entities.values())
    return out["driver"], out["constructor"], unknown, defaulted


def _fantasy_to_frame(
    rows: list, etype: str, cols: list, upcoming: dict
) -> pd.DataFrame:
    if not rows:
        raise RuntimeError(f"The feed contained no {etype} rows.")
    df = pd.DataFrame(rows)
    df["upcoming_race"] = upcoming.get("race_name") if upcoming else pd.NA
    df["upcoming_race_date"] = upcoming.get("race_date") if upcoming else pd.NaT
    df["data_source"] = FANTASY_SOURCE_LABEL
    for col in cols:
        if col not in df.columns:
            df[col] = np.nan  # never invented: left empty and reported below
    df = df[cols].sort_values(
        ["team_name"] + (["driver_name"] if etype == "driver" else [])
    )
    df = df.reset_index(drop=True)

    applicable = [
        c
        for c in cols
        if c not in FANTASY_NOT_APPLICABLE[etype]
        and c not in ("upcoming_race", "upcoming_race_date", "team_id")
    ]
    for col in ("price_m", "fantasy_points_total"):
        if df[col].isna().all():
            raise RuntimeError(
                f"No '{col}' values for any {etype}; the feed layout may have changed."
            )
    gaps = df[applicable].isna().sum()
    gaps = gaps[gaps > 0]
    if not gaps.empty:
        print(
            f"  [WARNING] ({etype}): empty cells left as NaN (not filled): {gaps.to_dict()}"
        )
    return df


def fetch_formula_fantasy(upcoming: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Scrapes the current F1 Fantasy statistics (price, ownership, points, average
    points, valuation change, value for money, overtakes, podiums, top-10
    finishes, DNFs, fastest laps, DOTDs / fastest pit stops) for every driver
    and constructor, and returns (drivers_df, teams_df). Also writes
    fantasy_f1_data/drivers.csv and fantasy_f1_data/teams.csv.

    There is no historical fantasy data to fetch: this is always a snapshot of
    the current season to date, with prices that apply to the next deadline —
    every row is stamped with the upcoming race name/date (`upcoming`, from
    _openf1_find_upcoming_race) for the optimizer to key off.

    Raises RuntimeError on any failure. Never substitutes mock data.
    """
    print("\n[STAGE 3] Processing Formula Fantasy Data (Drivers & Constructors)")
    if upcoming:
        print(
            f"  [INFO] Costs below apply to the upcoming race: {upcoming['race_name']} "
            f"({upcoming['race_date'].date()})"
        )
    else:
        print(
            "  [INFO] Could not determine the upcoming race (season may be between calendars); "
            "costs are still current, just unlabeled by race."
        )

    driver_rows, team_rows, unknown, defaulted = _fantasy_parse_feed(
        _fantasy_capture_feed()
    )
    if unknown:
        print(
            f"  [WARNING] feed filters with no column mapping (add to FANTASY_FEED_KEY_TO_COL): {unknown}"
        )
    if defaulted:
        print(
            f"  [INFO] No value for {len(defaulted)} cells; treated as 0 "
            f"(entity has none): {sorted(defaulted)}"
        )

    df_drivers = _fantasy_to_frame(driver_rows, "driver", FANTASY_DRIVER_COLS, upcoming)
    df_teams = _fantasy_to_frame(team_rows, "constructor", FANTASY_TEAM_COLS, upcoming)
    from f1_linkage import link_fantasy_drivers, link_fantasy_teams

    df_drivers = link_fantasy_drivers(df_drivers)
    df_teams = link_fantasy_teams(df_teams)

    _save_fantasy_csv(df_drivers, "drivers.csv")
    _save_fantasy_csv(df_teams, "teams.csv")
    print("  [INFO] Saved fantasy data to CSV files.")
    print(
        f"  [INFO] Loaded {len(df_drivers)} drivers and {len(df_teams)} constructors from the F1 Fantasy statistics feed."
    )
    return df_drivers, df_teams


_SOURCE_LABELS = {"kaggle": "Kaggle", "openf1": "OpenF1", "fantasy": "Formula Fantasy"}


def _run_stage(name: str, fn, *args):
    """
    Runs one pipeline stage and returns (result, error). On a total failure the result
    is None. On a partial failure (PartialDataError) the result is whatever was loaded,
    so the report can still use it. Nothing is mocked, estimated or substituted.
    """
    try:
        return fn(*args), None
    except PartialDataError as e:
        print(f"\n[WARNING] {name} INCOMPLETE: {e}")
        print(
            "[WARNING] Continuing with the partial data; the missing parts are NOT substituted."
        )
        return e.partial, e
    except Exception as e:
        print(f"\n[ERROR] {name} FAILED: {type(e).__name__}: {e}")
        print(f"[ERROR] No substitute data will be generated; '{name}' has no data.")
        return None, e


def _reason(e: Exception) -> str:
    msg = re.sub(r"^\s*\[ERROR\]\s*", "", str(e)).strip()
    return f"{type(e).__name__}: {msg}"


def _group_sessions(labels) -> list[str]:
    """['2023-Austin/FP1', '2023-Austin/Q', ...] -> ['2023-Austin: FP1, Q', ...]"""
    grouped: dict[str, list[str]] = {}
    for label in labels:
        weekend, _, code = label.rpartition("/")
        grouped.setdefault(weekend, []).append(code)
    return [f"{weekend}: {', '.join(codes)}" for weekend, codes in grouped.items()]


def fetch_sources(sources=ALL_SOURCES) -> dict:
    """
    Fetches the selected sources (default: all three — Kaggle, OpenF1, Formula Fantasy).
    Each stage is independent: a failed one is recorded in data["failures"] (keyed by
    source label) and a partially loaded one still returns what it has. Sources that
    were not selected are skipped. Nothing is ever mocked.
    """
    sources = tuple(sources)
    unknown = set(sources) - set(ALL_SOURCES)
    if unknown:
        raise ValueError(
            f"Unknown source(s) {sorted(unknown)}; choose from {list(ALL_SOURCES)}"
        )

    print(
        f"Sources selected: {', '.join(s for s in ALL_SOURCES if s in sources)}"
        f"{'' if len(sources) == len(ALL_SOURCES) else '   (others skipped)'}\n"
    )

    failures: dict[str, Exception] = {}
    kaggle_tables = df_openf1 = df_fantasy_drivers = df_fantasy_teams = None

    if "kaggle" in sources:
        kaggle_tables, err = _run_stage("Kaggle", load_all_kaggle_files)
        if err:
            failures["Kaggle"] = err
    if "openf1" in sources:
        df_openf1, err = _run_stage("OpenF1", fetch_openf1_data)
        if err:
            failures["OpenF1"] = err
    if "fantasy" in sources:
        # the upcoming race (a light OpenF1 lookup) only labels the fantasy prices
        upcoming_race, _ = _run_stage(
            "OpenF1 upcoming race lookup", _openf1_find_upcoming_race
        )
        fantasy, err = _run_stage(
            "Formula Fantasy", fetch_formula_fantasy, upcoming_race or {}
        )
        if err:
            failures["Formula Fantasy"] = err
        df_fantasy_drivers, df_fantasy_teams = fantasy if fantasy else (None, None)

    return {
        "kaggle_tables": kaggle_tables or {},
        "df_openf1": df_openf1,
        "df_fantasy_drivers": df_fantasy_drivers,
        "df_fantasy_teams": df_fantasy_teams,
        "failures": failures,
    }


def _print_completeness(sources, data: dict) -> bool:
    """
    Prints, per source, whether its data is COMPLETE, PARTIAL or MISSING and exactly
    what is missing and why. Returns True if every selected source is complete.
    """
    failures = data["failures"]
    print("\n\n[DATA] DATA COMPLETENESS")
    complete = True

    for src in ALL_SOURCES:
        label = _SOURCE_LABELS[src]
        if src not in sources:
            print(f"{label}: NOT SELECTED (skipped by flags)")
            continue
        err = failures.get(label)

        if src == "kaggle":
            tables = data["kaggle_tables"]
            if err is None:
                print(f"  {label}: COMPLETE - {len(tables)} tables loaded")
            elif isinstance(err, PartialDataError):
                print(f"  {label}: PARTIAL - {len(tables)} tables loaded")
                print(f"\t[MISSING] unreadable tables: {', '.join(err.missing)}")
            else:
                print(f"  {label}: MISSING - no tables loaded")

        elif src == "openf1":
            df = data["df_openf1"]
            if df is None:
                print(f"  {label}: MISSING - no sessions loaded")
            else:
                expected = df.attrs.get("expected_sessions")
                no_data = df.attrs.get("no_data_sessions", [])
                failed = err.missing if isinstance(err, PartialDataError) else []
                loaded = (
                    (expected - len(failed) - len(no_data))
                    if expected is not None
                    else None
                )
                counts = (
                    f" - {loaded} of {expected} sessions loaded"
                    if loaded is not None
                    else ""
                )
                print(f"  {label}: {'PARTIAL' if failed else 'COMPLETE'}{counts}")
                if failed:
                    print(
                        f"\t[MISSING] {len(failed)} session(s) failed to download, by weekend:"
                    )
                    for line in _group_sessions(failed):
                        print(f"\t  - {line}")
                if no_data:
                    print(
                        f"\t[MISSING] {len(no_data)} session(s) have no lap data published by OpenF1, by weekend:"
                    )
                    for line in _group_sessions(no_data):
                        print(f"\t  - {line}")
                if "air_temperature" in df.columns and len(df):
                    gap = int(df["air_temperature"].isna().sum())
                    if gap:
                        print(
                            f"\t[MISSING] weather readings absent for {gap:,} of {len(df):,} laps "
                            f"({gap / len(df):.1%}): no reading within {OPENF1_WEATHER_TOLERANCE.total_seconds() / 60:.0f} min, or none published"
                        )

        else:  # fantasy
            drivers, teams = data["df_fantasy_drivers"], data["df_fantasy_teams"]
            if err is None and drivers is not None and teams is not None:
                print(
                    f"  {label}: COMPLETE - {len(drivers)} drivers, {len(teams)} constructors (current snapshot)"
                )
            else:
                print(f"  {label}: MISSING - no drivers or constructors loaded")

        if err is not None:
            complete = False
            print(f"\t[REASON] {_reason(err)}")

    return complete


def generate_data_report(sources=ALL_SOURCES, data: dict | None = None) -> bool:
    """
    Prints the data report and writes the distribution plots from already-fetched
    `data` (from fetch_sources; fetched here if omitted). The report is produced
    whatever is missing: the DATA COMPLETENESS section states exactly what is absent,
    every section marks the sources it could not cover with [MISSING], and plots
    that can't be drawn say why. Returns True if all selected sources are complete.
    """
    sources = tuple(sources)
    if data is None:
        data = fetch_sources(sources)

    kaggle_tables = data["kaggle_tables"]
    df_openf1 = data["df_openf1"]
    df_fantasy_drivers = data["df_fantasy_drivers"]
    df_fantasy_teams = data["df_fantasy_teams"]
    failures = data["failures"]

    have = {
        "kaggle": bool(kaggle_tables),
        "openf1": df_openf1 is not None,
        "fantasy": df_fantasy_drivers is not None or df_fantasy_teams is not None,
    }
    partial = {
        src
        for src, label in _SOURCE_LABELS.items()
        if isinstance(failures.get(label), PartialDataError)
    }

    def _why(src: str, default: str) -> str:
        if src not in sources:
            return "not selected"
        if _SOURCE_LABELS[src] in failures and not have[src]:
            return f"{_SOURCE_LABELS[src]} failed to load"
        return default

    def _t(title: str, src: str) -> str:
        return title + (" [PARTIAL DATA]" if src in partial else "")

    print("\n\n[REPORT] F1 DATA REPORT")
    complete = _print_completeness(sources, data)
    if not complete:
        print(
            "  NOTE: the sections below describe only the data that was actually loaded."
        )

    # 1. Total Data Points & Dimensions Breakdown
    print("\n\n[DATA] DATA POINTS & DIMENSIONS BREAKDOWN")
    total_data_points = 0
    if kaggle_tables:
        print("Kaggle Tables (Entire Relational Package):")
        for name, df in kaggle_tables.items():
            rows, cols = df.shape
            points = rows * cols
            total_data_points += points
            print(
                f"  Table '{name}': {rows:,} rows x {cols} cols = {points:,} data points"
            )
    elif "kaggle" in sources:
        print("Kaggle Tables:\n  [MISSING] no tables loaded.")

    singles = [
        ("openf1", "OpenF1 Telemetry", df_openf1),
        ("fantasy", "Formula Fantasy Drivers (Snapshot)", df_fantasy_drivers),
        ("fantasy", "Formula Fantasy Constructors (Snapshot)", df_fantasy_teams),
    ]
    for src, label, df in singles:
        if df is None:
            if src in sources:
                print(f"\n{label}:\n  [MISSING] no data loaded.")
            continue
        rows, cols = df.shape
        total_data_points += rows * cols
        print(
            f"\n{label}:\n  1 table: {rows:,} rows x {cols} cols = {rows * cols:,} data points"
        )

    print(f"\nTOTAL COMBINED DATA POINTS: {total_data_points:,}")

    all_datasets = dict(kaggle_tables)
    if df_openf1 is not None:
        all_datasets["openf1_laps"] = df_openf1
    if df_fantasy_drivers is not None:
        all_datasets["formula_fantasy_drivers"] = df_fantasy_drivers
    if df_fantasy_teams is not None:
        all_datasets["formula_fantasy_teams"] = df_fantasy_teams

    # 2. Dimension Types Breakdown
    print("\n\n[DATA] DIMENSION TYPES BREAKDOWN")
    if not all_datasets:
        print("  [MISSING] no datasets were loaded, so there is nothing to break down.")
    for name, df in all_datasets.items():
        num = df.select_dtypes(include=[np.number]).columns.tolist()
        try:
            cat = df.select_dtypes(
                include=["object", "category", "bool", "str"]
            ).columns.tolist()
        except TypeError:
            # Older pandas versions don't recognize 'str' as a dtype name.
            cat = df.select_dtypes(
                include=["object", "category", "bool"]
            ).columns.tolist()
        dt = df.select_dtypes(
            include=["datetime64", "datetime64[ns, UTC]"]
        ).columns.tolist()
        print(f"\n[{name}]")
        print(f"  Numeric ({len(num)}): {num[:4]}{'...' if len(num) > 4 else ''}")
        print(
            f"  Categorical/Nominal ({len(cat)}): {cat[:4]}{'...' if len(cat) > 4 else ''}"
        )
        print(f"  Temporal ({len(dt)}): {dt}")

    # 4. Data Cleanup Assessment
    print("\n\n[DATA] DATA CLEANUP ASSESSMENT")
    if not all_datasets:
        print("  [MISSING] no datasets were loaded, so nothing was assessed.")
    for name, df in all_datasets.items():
        nulls = df.isnull().sum().sum()
        hashable_cols = [
            c
            for c in df.columns
            if not df[c].apply(lambda x: isinstance(x, list)).any()
        ]
        dups = df.duplicated(subset=hashable_cols).sum()
        print(
            f"  [INFO] Dataset '{name}': {nulls:,} missing cells | {dups:,} duplicate rows"
        )

    if not complete:
        print(
            "[WARNING] THIS REPORT IS BASED ON INCOMPLETE DATA - see [DATA] DATA COMPLETENESS above for exactly what is missing."
        )
    return complete


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(
        description="F1 data pipeline. With no source flags every source is fetched; "
        "pass one or more source flags to fetch only those sources. "
        "The data report is only produced with --report."
    )
    ap.add_argument(
        "--kaggle", action="store_true", help="fetch only the Kaggle tables"
    )
    ap.add_argument(
        "--openf1",
        action="store_true",
        help="fetch only the OpenF1 session lap/weather data",
    )
    ap.add_argument(
        "--fantasy", action="store_true", help="fetch only the Formula Fantasy data"
    )
    ap.add_argument(
        "--report",
        action="store_true",
        help="also print the data report and write the distribution plots "
        "(produced even if some data is missing; the missing data is listed)",
    )
    a = ap.parse_args(argv)
    sources = tuple(src for src in ALL_SOURCES if getattr(a, src)) or ALL_SOURCES

    data = fetch_sources(sources)
    if a.report:
        generate_data_report(sources, data)
    else:
        _print_completeness(sources, data)

    if data["failures"]:
        print("\n[ERROR] PIPELINE INCOMPLETE - these sources failed or are partial:")
        for name, e in data["failures"].items():
            print(f"  [ERROR] {name}: {_reason(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
