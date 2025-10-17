import asyncio
from fastapi import FastAPI
from app.kafka_service.producer import KafkaProducerService
from app.kafka_service.consumer import KafkaConsumerService
from app.controllers.query_controller import QueryController
from dotenv import load_dotenv
import os


# Load environment variables
load_dotenv()

# Get Kafka brokers from environment or use default
BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9093")

# Topics that this service will handle
TOPICS = [
    "document-query.chats",
    "document-query.search-documents",
    "document-query.get-document-summary", 
    "document-query.documents"
]
GROUP_ID = "document-query-service"
SERVICE_NAME = "DocumentQueryService"


# Initialize components
producer = KafkaProducerService(BROKERS)
query_controller = QueryController()
consumer = KafkaConsumerService(BROKERS, GROUP_ID, TOPICS, producer, query_controller)

app = FastAPI(title="Document Query Service", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    """Start producer and consumer on service startup"""
    print(f"[{SERVICE_NAME}] Starting up...")
    print(f"[{SERVICE_NAME}] Registered topics: {TOPICS}")
    
    await producer.start()
    asyncio.create_task(consumer.start())  # run consumer loop in background


@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shutdown producer"""
    print(f"[{SERVICE_NAME}] Shutting down...")
    await producer.stop()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "service": SERVICE_NAME,
        "topics": TOPICS
    }


@app.get("/status")
async def status_check():
    """Detailed status endpoint"""
    return {
        "service": SERVICE_NAME,
        "brokers": BROKERS,
        "group_id": GROUP_ID,
        "topics": TOPICS,
        "controller": query_controller.__class__.__name__
    }

# uvicorn main:app --reload --host 0.0.0.0 --port 8000