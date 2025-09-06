import asyncio
from fastapi import FastAPI
from kafka.producer import KafkaProducerService
from kafka.consumer import KafkaConsumerService


BROKERS = "localhost:9093"  # replace with your docker-compose hostname
TOPIC = "document-queries"
GROUP_ID = "document-query-service"


producer = KafkaProducerService(BROKERS)
consumer = KafkaConsumerService(BROKERS, GROUP_ID, TOPIC)

app = FastAPI(title="Document Query Service")


@app.on_event("startup")
async def startup_event():
    """Start producer and consumer on service startup"""
    await producer.start()
    asyncio.create_task(consumer.start())  # run consumer loop in background


@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shutdown producer"""
    await producer.stop()


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "document-query-service"}

#uvicorn main:app --reload --host 0.0.0.0 --port 8000