from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import logging
logging.basicConfig(level=logging.INFO)

from app.api.routes import driver, constructor, races, prediction, stats, teams
from app.services.upcomming_race import upcoming_races_view
from app.services.prediction import load_all_predictions

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Predict every upcoming race. A failure here (MLflow down, bad token)
    # should not take the rest of the API down.
    try:
        races = upcoming_races_view()
        if races:
            load_all_predictions(races)
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



@app.get("/")
def root():
    return {"message": "Welcome to the F1 Fantasy API!"}