from fastapi import FastAPI
from kafka.consumer import start_consumer

app = FastAPI()

@app.on_event("startup")
def startup_event():
    # Start Kafka consumer in background
    import threading
    threading.Thread(target=start_consumer, daemon=True).start()

@app.get("/health")
def health():
    return {"status": "ok"}