from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import driver, constructor

app = FastAPI(title="F1 Fantasy API", version="1.0.0")

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

@app.get("/")
def root():
    return {"message": "Welcome to the F1 Fantasy API!"}