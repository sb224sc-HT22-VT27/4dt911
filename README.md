# 4dt911

## Data Sources

- [Kaggle Race Data](https://www.kaggle.com/datasets/jtrotman/formula-1-race-data), this is our base data we make additions to from the other datasets.
- [OpenF1 API](https://openf1.org/), is where we extract to partly validate the kaggle data aswell as the addition of weather data which impacts races and driver performance.
- [F1 Fantasy](https://fantasy.formula1.com/en/statistics), is scraped on race weeks for latest fantasy values which is utilized to maximize points scored per race weekend.

- [Data Fetched 2026-10-21 in a zip](https://drive.google.com/file/d/1WslXtM_Y1lDhHIFlHMJJCnSh3h18pmfk/view?usp=sharing), place in data/ directory the three data source directories.

To populate the data directory create a `.venv` and install the `requirements.txt` and run `playwright install chromium` after, then redirect yourself into the data directory and run the `f1_data_script.py` without flags fetches all data sources otherwise specified sources can be fetch by following flags `--kaggle --openf1 --fantasy`.

## Local hosting

In project root run the command `docker compose up -d` to start the application, to shut it down and clean up after usage run `docker compose down` && `docker system prune -a --volumes`.
