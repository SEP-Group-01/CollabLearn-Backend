"""
Main entry point for Study Plan Service
Initializes Kafka consumers and producers
"""
import asyncio
import logging
from config import KAFKA_BROKER_URL, SERVICE_GROUP_ID, TOPICS
from kafka_service.consumer import KafkaConsumerService
from kafka_service.producer import get_producer
from controllers.study_plan_controller import StudyPlanController

# uvicorn app:app --host 0.0.0.0 --port 8000 --reload  

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """Main function to start the service"""
    logger.info("=" * 60)
    logger.info("Starting Study Plan Service\n")
    logger.info("=" * 60)
    
    try:
        # Initialize producer
        producer = await get_producer()
        logger.info("✓ Kafka Producer initialized\n")
        
        # Initialize controller
        controller = StudyPlanController()
        logger.info("✓ Study Plan Controller initialized\n")

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

        logger.info(f"✓ Kafka Consumer initialized for topics: {topics}\n")
        logger.info("=" * 60)
        logger.info("Study Plan Service is ready and listening...\n")
        logger.info("=" * 60)
        
        # Start consuming messages
        await consumer.start()
        
    except KeyboardInterrupt:
        logger.info("\n" + "=" * 60)
        logger.info("Shutting down Study Plan Service...\n")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"Fatal error in Study Plan Service: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user\n")
    except Exception as e:
        logger.error(f"Service crashed: {e}")
        exit(1)
