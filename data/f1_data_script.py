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

import matplotlib.pyplot as plt
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
KAGGLE_LOG_HISTORY = 25   # how many past checks to keep in the log

ALL_SOURCES = ("kaggle", "openf1", "fantasy")   # default: fetch everything

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_START_YEAR = 2023
OPENF1_COMBINED_FILENAME = f"all_laps_{OPENF1_START_YEAR}_to_latest.csv"
OPENF1_WEATHER_COLS = {"air_temperature", "track_temperature", "humidity"}  # present in every cached race file
OPENF1_REQUEST_DELAY = 2.0   # polite delay between calls to the free API
OPENF1_MAX_RETRIES = 3
OPENF1_WEATHER_TOLERANCE = pd.Timedelta(minutes=5)  # max gap when matching a lap to a weather reading


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
        print(f"  [ERROR] Kaggle cache log unreadable ({e}); treating the local copy as unverified.")
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
        raise RuntimeError(f"  [ERROR] Could not read the published version number from kagglehub's path '{path}'.")
    return int(m.group(1)), path


def _kaggle_local_matches_log(log: dict, version: int) -> tuple[bool, str]:
    """Is the local copy exactly the log's recorded files of the given published version?"""
    if log.get("dataset") != KAGGLE_DATASET_HANDLE:
        return False, "no cache log for this dataset"
    if log.get("published_version") != version:
        return False, f"published version changed ({log.get('published_version')} -> {version})"
    files = log.get("files") or {}
    if not files:
        return False, "cache log lists no files (previous sync did not finish)"
    local = {os.path.basename(f) for f in glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv"))}
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
        raise RuntimeError(f"  [ERROR] The downloaded dataset at '{src_dir}' contains no CSV files.")
    os.makedirs(LOCAL_KAGGLE_DIR, exist_ok=True)
    # Invalidate the log first: if we're interrupted mid-copy, the next run re-syncs.
    _kaggle_write_log({**log, "published_version": None, "files": {}, "status": "sync in progress"})
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
        print(f"  [ERROR] Could not check/download the latest published version of "
              f"'{KAGGLE_DATASET_HANDLE}': {type(e).__name__}: {e}")
        had = (f" A local copy of version {log['published_version']} (fetched {log.get('fetched_at_utc')}) exists "
               f"but could not be verified as the latest, so it was not used.") if log.get("published_version") else ""
        raise RuntimeError(f"  [ERROR] Could not check/download the latest published version of "
                           f"'{KAGGLE_DATASET_HANDLE}': {type(e).__name__}: {e}.{had}") from e
    print(f"  [INFO] Latest published version of '{KAGGLE_DATASET_HANDLE}': {version}")

    up_to_date, reason = _kaggle_local_matches_log(log, version)
    previous_version = log.get("published_version")
    now = _utc_now_iso()
    if up_to_date:
        print(f"  [INFO] Local copy at '{LOCAL_KAGGLE_DIR}' is version {version} (fetched {log.get('fetched_at_utc')}). Skipping copy.")
        action = "up-to-date"
    else:
        print(f"  [INFO] Updating local copy at '{LOCAL_KAGGLE_DIR}': {reason}.")
        if not log and glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv")):
            print("  [WARNING] found an unversioned local copy (no cache log); replacing it with the published version.")
        log["files"] = _kaggle_sync_local(src_dir, log)
        log.update({"dataset": KAGGLE_DATASET_HANDLE, "published_version": version,
                    "fetched_at_utc": now, "source_path": src_dir, "status": "ok"})
        action = "downloaded"

    log["last_checked_utc"] = now
    log["history"] = (log.get("history", []) + [{
        "checked_at_utc": now, "published_version": version,
        "previous_local_version": previous_version, "action": action,
    }])[-KAGGLE_LOG_HISTORY:]
    _kaggle_write_log(log)

    kaggle_dfs = {}
    for path in glob.glob(os.path.join(LOCAL_KAGGLE_DIR, "*.csv")):
        table_name = os.path.basename(path).replace(".csv", "")
        try:
            kaggle_dfs[table_name] = pd.read_csv(path)
            print(f"  [INFO] Loaded table: '{table_name}' ({len(kaggle_dfs[table_name]):,} rows, {len(kaggle_dfs[table_name].columns)} cols)")
        except Exception as err:
            raise RuntimeError(f"  [ERROR] Could not read '{table_name}': {err}")

    if not kaggle_dfs:
        raise RuntimeError(f"  [ERROR] No readable CSV tables found in '{LOCAL_KAGGLE_DIR}'.")
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
                print(f"  [ERROR] Failed {endpoint} {params} after {OPENF1_MAX_RETRIES} tries: {e}")
                if strict:
                    raise RuntimeError(f"OpenF1 request failed: {endpoint} {params}: {e}") from e
                return []
            wait = 2 ** attempt
            print(f"  [ERROR] {endpoint} attempt {attempt} failed ({e}); retrying in {wait}s")
            time.sleep(wait)
        finally:
            time.sleep(OPENF1_REQUEST_DELAY)
    return []


def _openf1_parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def _openf1_collect_race_sessions(cutoff: datetime) -> pd.DataFrame:
    """
    Every non-cancelled Race session from OPENF1_START_YEAR that had finished by
    `cutoff` (the time the script was run). A race still in progress at the cut-off
    is left out, since its laps would be partial. Raises if a year's session list
    can't be fetched, so a network error can't silently drop races.
    """
    all_sessions = []
    for year in range(OPENF1_START_YEAR, cutoff.year + 1):
        print(f"  [INFO] Listing {year} race sessions...")
        all_sessions.extend(_openf1_get("sessions", {"year": year, "session_name": "Race"}, strict=True))

    df = pd.DataFrame(all_sessions)
    if df.empty:
        return df

    df["date_start_dt"] = df["date_start"].apply(_openf1_parse_dt)
    ends = df["date_end"] if "date_end" in df.columns else pd.Series([None] * len(df), index=df.index)
    df["date_end_dt"] = [_openf1_parse_dt(e) if isinstance(e, str) and e else st
                         for e, st in zip(ends, df["date_start_dt"])]

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
        for col in ["air_temperature", "track_temperature", "humidity",
                    "rainfall", "wind_speed", "wind_direction", "pressure"]:
            laps_df[col] = np.nan
        return laps_df

    weather_df = pd.DataFrame(weather)
    weather_df["date"] = pd.to_datetime(weather_df["date"], format="ISO8601", utc=True)

    if "date_start" not in laps_df.columns:
        # Can't time-align without a lap timestamp; skip merge.
        return laps_df

    laps_df = laps_df.copy()
    laps_df["date_start"] = pd.to_datetime(laps_df["date_start"], format="ISO8601", utc=True, errors="coerce")

    weather_cols = ["date", "air_temperature", "track_temperature", "humidity",
                     "rainfall", "wind_speed", "wind_direction", "pressure"]
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
            s for s in sessions
            if _openf1_parse_dt(s["date_start"]) > now and not s.get("is_cancelled", False)
        ]
        if upcoming:
            nxt = min(upcoming, key=lambda s: s["date_start"])
            return {
                "race_name": nxt.get("location") or nxt.get("circuit_short_name") or "Unknown",
                "race_date": _openf1_parse_dt(nxt["date_start"]),
                "session_key": nxt.get("session_key"),
                "meeting_key": nxt.get("meeting_key"),
            }
    return {}


def _openf1_download_all_races(output_dir: str, cutoff: datetime) -> pd.DataFrame:
    """
    Builds the lap dataset (all drivers, with weather) for every Race session from
    OPENF1_START_YEAR that had finished by `cutoff`. Races already saved in
    output_dir (one CSV per race, with weather columns) are reused, so a re-run only
    downloads races that finished since the last run. Writes the combined CSV and
    returns it. Any race that can't be downloaded makes this raise (nothing is
    substituted); re-running resumes from the races already saved.
    """
    os.makedirs(output_dir, exist_ok=True)

    race_sessions = _openf1_collect_race_sessions(cutoff)
    if race_sessions.empty:
        raise RuntimeError("[ERROR] No finished race sessions found up to the cut-off.")

    n = len(race_sessions)
    print(f"  [INFO] Found {n} finished race sessions from {OPENF1_START_YEAR} through "
          f"{race_sessions['date_end_dt'].max().date()}. Collecting laps...")

    frames, failed, no_data = [], [], []
    for i, row in race_sessions.iterrows():
        session_key = row["session_key"]
        label = f"{row.get('year')}_{str(row.get('location', 'unknown')).replace(' ', '_')}"
        tag = f"[{i + 1}/{n}] {label}"
        file_path = os.path.join(output_dir, f"{label}_{session_key}.csv")

        if os.path.exists(file_path):
            try:
                cached = pd.read_csv(file_path)
                if len(cached) > 0 and OPENF1_WEATHER_COLS.issubset(cached.columns):
                    print(f"  [INFO] {tag}: already saved ({len(cached):,} rows)")
                    frames.append(cached)
                    continue
                print(f"  [GET] {tag}: saved file is empty or predates weather data; re-downloading")
            except Exception as e:
                print(f"  [GET] {tag}: saved file unreadable ({e}); re-downloading")

        try:
            laps = _openf1_get("laps", {"session_key": session_key}, strict=True)
            if not laps:
                print(f"  [INFO] {tag}: OpenF1 has no lap data for this race, skipping.")
                no_data.append(label)
                continue
            laps_df = pd.DataFrame(laps)
            laps_df["meeting_location"] = row.get("location")
            laps_df["session_year"] = row.get("year")
            laps_df = _openf1_attach_weather(laps_df, session_key)
        except RuntimeError as e:
            print(f"  [WARNING] {tag}: FAILED ({e})")
            failed.append(label)
            continue

        laps_df.to_csv(file_path, index=False)
        print(f"  [GET] {tag}: downloaded {len(laps_df):,} rows -> {file_path}")
        frames.append(laps_df)

    if failed:
        raise RuntimeError(f"[ERROR] {len(failed)} race(s) could not be downloaded ({', '.join(failed)}); nothing was "
                           f"substituted. Re-run to resume: races already saved are reused.")
    if not frames:
        raise RuntimeError(" [ERROR] No lap data could be downloaded for any race session.")
    if no_data:
        print(f"  [INFO] Note: no lap data published for: {', '.join(no_data)}")

    combined_path = os.path.join(output_dir, OPENF1_COMBINED_FILENAME)
    pd.concat(frames, ignore_index=True).to_csv(combined_path, index=False)
    combined_df = pd.read_csv(combined_path)
    print(f"  [INFO] Saved combined dataset ({len(combined_df):,} rows) to {combined_path}")
    return combined_df


def fetch_openf1_data() -> pd.DataFrame:
    """
    Fetches real lap telemetry from OpenF1 for every race from the start of the
    2023 season up to a cut-off set at the moment the script is run: all race
    sessions that had finished by then are included. Each lap is enriched with the
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
    print(f"  [INFO] Loaded OpenF1 lap metrics ({len(df):,} records, including weather).")
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

FANTASY_STATS_URL = "https://fantasy.formula1.com/en/statistics/details?tab=driver&filter=fPoints"
FANTASY_FEED_MARKER = "statistics/driverconstructors"   # part of the feed's url
FANTASY_FEED_WAIT_SECONDS = 15
FANTASY_SOURCE_LABEL = "F1 Fantasy statistics feed (current season snapshot)"

# feed filter key -> column
FANTASY_FEED_KEY_TO_COL = {
    "fPoints": "fantasy_points_total",
    "fAvg": "avg_fantasy_points",
    "priceChange": "valuation_change",
    "mostPicked": "selected_by_pct",
    "pointsPermillion": "value_for_money",
    "overTakepoints": "overtakes",          # as published; may be overtake points
    "podiumsStats": "podiums",
    "topFinshed": "top10_finishes",         # (sic) the site's own spelling
    "mostDnf": "dnfs",
    "fastestLap": "fastest_lap_awards",
    "driverOfday": "dotds",
    "fastestPitstopstats": "fastest_pitstop_awards",
}
# columns that only exist for one entity type
FANTASY_NOT_APPLICABLE = {"driver": {"fastest_pitstop_awards"}, "constructor": {"dotds"}}
# The site only lists entities that have a selection %; absent means none.
FANTASY_MISSING_MEANS_ZERO = {"selected_by_pct"}

_FANTASY_STAT_ORDER = ["price_m", "selected_by_pct", "fantasy_points_total", "avg_fantasy_points",
                       "valuation_change", "value_for_money", "overtakes", "podiums",
                       "top10_finishes", "dnfs", "fastest_lap_awards"]
FANTASY_DRIVER_COLS = (["season", "player_id", "driver_name", "team_id", "team_name"] + _FANTASY_STAT_ORDER
                       + ["dotds", "upcoming_race", "upcoming_race_date", "data_source"])
FANTASY_TEAM_COLS = (["season", "player_id", "team_name"] + _FANTASY_STAT_ORDER
                     + ["fastest_pitstop_awards", "upcoming_race", "upcoming_race_date", "data_source"])


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
        if FANTASY_FEED_MARKER in resp.url and "json" in (resp.headers.get("content-type") or "").lower():
            try:
                captured.append((resp.url, resp.json()))
            except Exception:
                pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx = browser.new_context(user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"))
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
        raise RuntimeError(f"[ERROR] The statistics feed ('{FANTASY_FEED_MARKER}') was not loaded by the page.")
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
        raise RuntimeError(f"[ERROR] Unexpected feed structure (missing {e}); the site may have changed.") from e

    out, unknown, defaulted = {}, [], []
    for etype, blocks in sections.items():
        entities = {}   # player id -> row
        for block in blocks:
            key = block["config"]["key"]
            col = FANTASY_FEED_KEY_TO_COL.get(key)
            if col is None:
                unknown.append(f"{etype}:{key}")
                continue
            for p in block["participants"]:
                name = p.get("playername") or p.get("teamname")
                pid = p.get("playerid")
                if pid is None:   # the feed sometimes lists an entity without an id: match by name
                    pid = next((k for k, r in entities.items() if r["_name"] == name), name)
                row = entities.setdefault(str(pid), {
                    "season": season, "player_id": str(pid), "_name": name,
                    "team_id": p.get("teamid"), "team_name": p.get("teamname") if etype == "driver" else name,
                })
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


def _fantasy_to_frame(rows: list, etype: str, cols: list, upcoming: dict) -> pd.DataFrame:
    if not rows:
        raise RuntimeError(f"The feed contained no {etype} rows.")
    df = pd.DataFrame(rows)
    df["upcoming_race"] = upcoming.get("race_name") if upcoming else pd.NA
    df["upcoming_race_date"] = upcoming.get("race_date") if upcoming else pd.NaT
    df["data_source"] = FANTASY_SOURCE_LABEL
    for col in cols:
        if col not in df.columns:
            df[col] = np.nan   # never invented: left empty and reported below
    df = df[cols].sort_values(["team_name"] + (["driver_name"] if etype == "driver" else []))
    df = df.reset_index(drop=True)

    applicable = [c for c in cols if c not in FANTASY_NOT_APPLICABLE[etype]
                  and c not in ("upcoming_race", "upcoming_race_date", "team_id")]
    for col in ("price_m", "fantasy_points_total"):
        if df[col].isna().all():
            raise RuntimeError(f"No '{col}' values for any {etype}; the feed layout may have changed.")
    gaps = df[applicable].isna().sum()
    gaps = gaps[gaps > 0]
    if not gaps.empty:
        print(f"  [WARNING] ({etype}): empty cells left as NaN (not filled): {gaps.to_dict()}")
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
        print(f"  [INFO] Costs below apply to the upcoming race: {upcoming['race_name']} "
              f"({upcoming['race_date'].date()})")
    else:
        print("  [INFO] Could not determine the upcoming race (season may be between calendars); "
              "costs are still current, just unlabeled by race.")
        
    driver_rows, team_rows, unknown, defaulted = _fantasy_parse_feed(_fantasy_capture_feed())
    if unknown:
        print(f"  [WARNING] feed filters with no column mapping (add to FANTASY_FEED_KEY_TO_COL): {unknown}")
    if defaulted:
        print(f"  [INFO] No value for {len(defaulted)} cells; treated as 0 "
              f"(entity has none): {sorted(defaulted)}")

    df_drivers = _fantasy_to_frame(driver_rows, "driver", FANTASY_DRIVER_COLS, upcoming)
    df_teams = _fantasy_to_frame(team_rows, "constructor", FANTASY_TEAM_COLS, upcoming)
    _save_fantasy_csv(df_drivers, "drivers.csv")
    _save_fantasy_csv(df_teams, "teams.csv")
    print("  [INFO] Saved fantasy data to CSV files.")
    print(f"  [INFO] Loaded {len(df_drivers)} drivers and {len(df_teams)} constructors from the F1 Fantasy statistics feed.")
    return df_drivers, df_teams


def _run_stage(name: str, fn, *args):
    """
    Runs one pipeline stage. On failure, reports it and returns (None, error).
    The failed source is simply left out of the report: nothing is mocked,
    estimated or substituted.
    """
    try:
        return fn(*args), None
    except Exception as e:
        print(f"\n[ERROR] {name} FAILED: {type(e).__name__}: {e}")
        print(f"[ERROR] No substitute data will be generated; '{name}' is excluded from the report.")
        return None, e


def _unavailable(ax, title: str, why: str = "source unavailable") -> None:
    ax.text(0.5, 0.5, f"No data\n({why})", ha='center', va='center')
    ax.set_title(title)
    ax.set_xticks([])
    ax.set_yticks([])


def generate_data_report(sources=ALL_SOURCES):
    """
    Fetches the selected sources (default: all three — Kaggle, OpenF1, Formula
    Fantasy), then prints the data report and writes the distribution plots.
    Sources that were not selected are skipped and shown as "not selected";
    sources that were selected but failed are reported as failures. Neither
    is ever mocked.
    """
    sources = tuple(sources)
    unknown = set(sources) - set(ALL_SOURCES)
    if unknown:
        raise ValueError(f"Unknown source(s) {sorted(unknown)}; choose from {list(ALL_SOURCES)}")

    def _why(src: str, default: str = "source unavailable") -> str:
        return "not selected" if src not in sources else default

    print(f"Sources selected: {', '.join(s for s in ALL_SOURCES if s in sources)}"
          f"{'' if len(sources) == len(ALL_SOURCES) else '   (others skipped)'}\n")

    failures: dict[str, Exception] = {}
    kaggle_tables = df_openf1 = df_fantasy_drivers = df_fantasy_teams = None

    # Fetch Datasets (each stage is independent; a failed one is excluded, never mocked)
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
        upcoming_race, _ = _run_stage("OpenF1 upcoming race lookup", _openf1_find_upcoming_race)
        fantasy, err = _run_stage("Formula Fantasy", fetch_formula_fantasy, upcoming_race or {})
        if err:
            failures["Formula Fantasy"] = err
        df_fantasy_drivers, df_fantasy_teams = fantasy if fantasy else (None, None)
    kaggle_tables = kaggle_tables or {}

    # 1. Total Data Points & Dimensions Breakdown
    print("\n\n[DATA] DATA POINTS & DIMENSIONS BREAKDOWN")
    print("=" * 50)
    total_data_points = 0
    if kaggle_tables:
        print("Kaggle Tables (Entire Relational Package):")
        for name, df in kaggle_tables.items():
            rows, cols = df.shape
            points = rows * cols
            total_data_points += points
            print(f"  Table '{name}': {rows:,} rows x {cols} cols = {points:,} data points")

    singles = [
        ("OpenF1 Telemetry", df_openf1),
        ("Formula Fantasy Drivers (Snapshot)", df_fantasy_drivers),
        ("Formula Fantasy Constructors (Snapshot)", df_fantasy_teams),
    ]
    for label, df in singles:
        if df is None:
            continue
        rows, cols = df.shape
        total_data_points += rows * cols
        print(f"\n{label}:\n  1 table: {rows:,} rows x {cols} cols = {rows * cols:,} data points")

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
    for name, df in all_datasets.items():
        num = df.select_dtypes(include=[np.number]).columns.tolist()
        try:
            cat = df.select_dtypes(include=['object', 'category', 'bool', 'str']).columns.tolist()
        except TypeError:
            # Older pandas versions don't recognize 'str' as a dtype name.
            cat = df.select_dtypes(include=['object', 'category', 'bool']).columns.tolist()
        dt = df.select_dtypes(include=['datetime64', 'datetime64[ns, UTC]']).columns.tolist()
        print(f"\n[{name}]")
        print(f"  Numeric ({len(num)}): {num[:4]}{'...' if len(num) > 4 else ''}")
        print(f"  Categorical/Nominal ({len(cat)}): {cat[:4]}{'...' if len(cat) > 4 else ''}")
        print(f"  Temporal ({len(dt)}): {dt}")

    # 3. Spatial and Temporal Characteristics
    print("\n\n[DATA] SPATIAL & TEMPORAL CHARACTERISTICS")
    print("Temporal Dimensions:")
    if "kaggle" in sources:
        print("  - Kaggle: Historical temporal tracking spanning 1950 to present day (Season Years, Race Dates, Pit Stop Times, Qualifying Durations).")
    if "openf1" in sources:
        print("  - OpenF1: Sub-second micro-temporal telemetry feeds (ISO-8601 UTC timestamps, live sector splits) across every race from 2023 through the cut-off (the time the script was run).")
    if "fantasy" in sources:
        print("  - Formula Fantasy: No historical data exists; a single current-season snapshot (season-to-date totals and current prices) tied to the upcoming race deadline.")
    print("Spatial Characteristics:")
    if "kaggle" in sources:
        print("  - Kaggle: Macro-spatial GPS mapping (lat/lng coordinates, altitude, circuit locations per country).")
    if "openf1" in sources:
        print("  - OpenF1: Micro-spatial track telemetry (X, Y, Z coordinates along track segments).")
    if "fantasy" in sources:
        print("  - Formula Fantasy: none (no spatial dimension).")

    # 4. Data Cleanup Assessment
    print("\n\n[DATA] DATA CLEANUP ASSESSMENT")
    for name, df in all_datasets.items():
        nulls = df.isnull().sum().sum()
        hashable_cols = [c for c in df.columns if not df[c].apply(lambda x: isinstance(x, list)).any()]
        dups = df.duplicated(subset=hashable_cols).sum()
        print(f"  [INFO] Dataset '{name}': {nulls:,} missing cells | {dups:,} duplicate rows")

    # 5. Visualizations
    print("\n\n[VISUAL] GENERATING DISTRIBUTION PLOTS...")
    fig, axes = plt.subplots(2, 3, figsize=(20, 10))
    fig.suptitle("Data Distributions Across F1 InfoVis Pipeline", fontsize=16, fontweight='bold')

    # Plot 1: Kaggle Table Distribution (Results/Circuits)
    results = kaggle_tables.get('results')
    if results is not None and 'points' in results.columns:
        sns.histplot(results['points'].dropna(), ax=axes[0, 0], color='crimson', bins=15)
        axes[0, 0].set_title("Kaggle (Results): Points Distribution")
    elif kaggle_tables:
        print("  [INFO] No 'points' column found in Kaggle results.")
        plotted = False
        for tname, table in kaggle_tables.items():
            numeric = table.select_dtypes(include=[np.number]).columns
            if len(numeric):
                sns.histplot(table[numeric[0]].dropna(), ax=axes[0, 0], color='crimson')
                axes[0, 0].set_title(f"Kaggle ({tname}): {numeric[0]} Distribution")
                plotted = True
                break
        if not plotted:
            _unavailable(axes[0, 0], "Kaggle Distribution", "no numeric columns")
    else:
        _unavailable(axes[0, 0], "Kaggle Distribution", _why("kaggle"))

    # Plot 2: OpenF1 Lap Duration (spans every race from 2023 through the run-time cut-off)
    if df_openf1 is not None and 'lap_duration' in df_openf1.columns:
        sns.boxplot(y=df_openf1['lap_duration'].dropna(), ax=axes[0, 1], color='darkorange')
        axes[0, 1].set_title("OpenF1: Lap Duration Variance (s), 2023 - latest race")
    else:
        _unavailable(axes[0, 1], "OpenF1: Lap Duration Variance (s)", _why("openf1"))

    # Plot 3: Fantasy Driver Price vs Fantasy Points
    if df_fantasy_drivers is not None:
        sns.scatterplot(data=df_fantasy_drivers, x='price_m', y='fantasy_points_total', ax=axes[0, 2], color='purple', s=90)
        axes[0, 2].set_title("Fantasy: Driver Price vs Total Points")
    else:
        _unavailable(axes[0, 2], "Fantasy: Driver Price vs Total Points", _why("fantasy"))

    # Plot 4: Kaggle Spatial Map (Circuits)
    circuits = kaggle_tables.get('circuits')
    if circuits is not None and 'lat' in circuits.columns and 'lng' in circuits.columns:
        sns.scatterplot(data=circuits, x='lng', y='lat', ax=axes[1, 0], color='teal', s=70)
        axes[1, 0].set_title("Kaggle (Circuits): Global Lat/Lng Coordinates")
    else:
        _unavailable(axes[1, 0], "Circuit Geography", _why("kaggle", "no circuit coordinates"))

    # Plot 5: Fantasy Constructor Price vs Fantasy Points
    if df_fantasy_teams is not None:
        sns.scatterplot(data=df_fantasy_teams, x='price_m', y='fantasy_points_total', ax=axes[1, 1], color='steelblue', s=110)
        axes[1, 1].set_title("Fantasy: Constructor Price vs Total Points")
    else:
        _unavailable(axes[1, 1], "Fantasy: Constructor Price vs Total Points", _why("fantasy"))

    axes[1, 2].axis('off')

    plt.tight_layout()
    plt.savefig("f1_data_report_distributions.png", dpi=300)
    print("  [CREATE] Distribution visual saved to 'f1_data_report_distributions.png'.\n")

    if failures:
        print("[ERROR] PIPELINE INCOMPLETE — these sources failed:")
        for name, e in failures.items():
            print(f"  [ERROR] {name}: {type(e).__name__}: {e}")
        sys.exit(1)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(
        description="F1 data pipeline. With no flags every source is fetched; "
                    "pass one or more flags to fetch only those sources.")
    ap.add_argument("--kaggle", action="store_true", help="fetch only the Kaggle tables")
    ap.add_argument("--openf1", action="store_true", help="fetch only the OpenF1 lap/weather data")
    ap.add_argument("--fantasy", action="store_true", help="fetch only the Formula Fantasy data")
    a = ap.parse_args(argv)
    chosen = tuple(src for src in ALL_SOURCES if getattr(a, src))
    generate_data_report(chosen or ALL_SOURCES)


if __name__ == "__main__":
    main()
