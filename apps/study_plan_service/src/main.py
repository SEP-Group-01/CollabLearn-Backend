from fastapi import FastAPI
from src.kafka_service.consumer import start_consumer
from src.kafka_service.producer import send_result
from src.database import get_free_slots

app = FastAPI()

@app.on_event("startup")
def startup_event():
    # Start Kafka consumer in background
    import threading
    threading.Thread(target=start_consumer, daemon=True).start()

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-test/{user_id}")
def db_test(user_id: str):
    try:
        slots = get_free_slots(user_id)
        return {"success": True, "slots": slots}
    except Exception as e:
        return {"success": False, "error": str(e)}