from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import logging
logging.basicConfig(level=logging.INFO)

from app.api.routes import driver, constructor, races, prediction, stats, teams
from app.api.routes.races import RACES
from app.services.prediction import load_predictions

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Predict for the next upcoming race. A failure here (MLflow down, bad token)
    # should not take the rest of the API down.
    try:
        if RACES:
            nxt = min(RACES, key=lambda r: r.date)
            load_predictions(
                season=str(nxt.year),
                round_num=str(nxt.round),
                race_name=nxt.name,
                date=nxt.date[:10],
            )
        else:
            print("No upcoming races found; skipping predictions.")
    except Exception as e:
        print(f"Prediction startup failed: {e}")
    yield


app = FastAPI(title="F1 Fantasy API", version="1.0.0", lifespan=lifespan)

# Enable CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(driver.router)
app.include_router(constructor.router)
app.include_router(races.router)
app.include_router(prediction.router)
app.include_router(stats.router)
app.include_router(teams.router)

logging.info(load_predictions)


@app.get("/")
def root():
    return {"message": "Welcome to the F1 Fantasy API!"}