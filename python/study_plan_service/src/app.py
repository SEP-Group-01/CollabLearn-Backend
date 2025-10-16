"""
FastAPI application for Study Plan Service
This runs the Kafka consumer in the background
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from contextlib import asynccontextmanager
from config import KAFKA_BROKER_URL, SERVICE_GROUP_ID
from kafka_service.consumer import KafkaConsumerService
from kafka_service.producer import get_producer
from controllers.study_plan_controller import StudyPlanController

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Store consumer task
consumer_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to handle startup and shutdown"""
    global consumer_task
    
    logger.info("=" * 60)
    logger.info("Starting Study Plan Service")
    logger.info("=" * 60)
    
    try:
        # Initialize producer
        producer = await get_producer()
        logger.info("✓ Kafka Producer initialized")
        
        # Initialize controller
        controller = StudyPlanController()
        logger.info("✓ Study Plan Controller initialized")
        
        # Define topics to consume
        topics = [
            'study-plan-requests',
            'study-plan-requests.generate',
            'study-plan-requests.drop-plan',
            'study-plan-requests.history',
            'study-plan-progress',
            'study-plan-progress.update-progress',
            'study-plan-slots',
            'study-plan-slots.create-slot',
            'study-plan-slots.get-slots',
            'study-plan-slots.update-slot',
            'study-plan-slots.delete-slot',
            'study-plan-tasks',
            'study-plan-tasks.get-tasks',
            'study-plan-tasks.update-task',
            'study-plan-analysis',
            'study-plan-analysis.feasibility',
            'study-plan-workspaces',
            'study-plan-workspaces.get-workspaces'
        ]
        
        # Initialize consumer
        consumer = KafkaConsumerService(
            brokers=KAFKA_BROKER_URL,
            group_id=SERVICE_GROUP_ID,
            topics=topics,
            producer=producer,
            controller=controller
        )
        
        logger.info(f"✓ Kafka Consumer initialized for topics: {topics}")
        logger.info("=" * 60)
        logger.info("Study Plan Service is ready and listening...")
        logger.info("=" * 60)
        
        # Start consuming messages in background
        consumer_task = asyncio.create_task(consumer.start())
        
        yield
        
    except Exception as e:
        logger.error(f"Error during startup: {e}", exc_info=True)
        raise
    finally:
        # Cleanup on shutdown
        logger.info("\n" + "=" * 60)
        logger.info("Shutting down Study Plan Service...")
        logger.info("=" * 60)
        
        if consumer_task:
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass


# Create FastAPI app
app = FastAPI(
    title="Study Plan Service",
    description="AI-powered study plan generation and management service",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Study Plan Service",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "study-plan-service",
        "kafka_broker": KAFKA_BROKER_URL,
        "consumer_running": consumer_task is not None and not consumer_task.done()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
