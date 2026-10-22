from fastapi import FastAPI

from app.api.routes import driver, constructor

app = FastAPI(title="F1 Fantasy API", version="1.0.0")

app.include_router(driver.router)
app.include_router(constructor.router)

@app.get("/")
def root():
    return {"message": "Welcome to the F1 Fantasy API!"}