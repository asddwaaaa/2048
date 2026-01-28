from fastapi import FastAPI
from settings import settings

app = FastAPI()


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Service is running"
    }


@app.post("/webhook")
async def webhook(data: dict):
    print("Webhook data:", data)
    return {"status": "received"}


@app.get("/health")
async def healthcheck():
    return {"health": "ok"}
