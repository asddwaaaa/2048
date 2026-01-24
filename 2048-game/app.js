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
    # сюда придёт webhook (Telegram / другой сервис)
    print("Webhook data:", data)
    return {"status": "received"}


@app.get("/health")
async def healthcheck():
    return {"health": "ok"}


# Для локального запуска
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
