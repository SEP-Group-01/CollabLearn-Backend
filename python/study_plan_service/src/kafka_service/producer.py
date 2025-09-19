import asyncio
import json
from aiokafka import AIOKafkaProducer
from config import KAFKA_BROKER_URL
import logging

logger = logging.getLogger(__name__)

class KafkaProducerService:
    """
    Async Kafka Producer Service for Study Plan Service
    Compatible with NestJS Kafka client expectations
    """
    def __init__(self, brokers: str = None):
        self.brokers = brokers or KAFKA_BROKER_URL
        self.producer = AIOKafkaProducer(bootstrap_servers=self.brokers)
        self._started = False

    async def start(self):
        """Start the Kafka producer"""
        if not self._started:
            await self.producer.start()
            self._started = True
            logger.info(f"[KafkaProducer] Started with brokers: {self.brokers}")

    async def stop(self):
        """Stop the Kafka producer"""
        if self._started:
            await self.producer.stop()
            self._started = False
            logger.info("[KafkaProducer] Stopped")

    async def send_message(self, topic: str, correlation_id: str, value: str, partition: int = None):
        """
        Send a message to Kafka with NestJS compatibility
        
        Args:
            topic: Kafka topic to send to
            correlation_id: Correlation ID for request-reply pattern
            value: Message content (JSON string)
            partition: Optional partition to send to
        """
        try:
            if not self._started:
                await self.start()
            
            # NestJS expects correlation ID as BOTH message key AND header
            headers = [
                ('kafka_correlationId', correlation_id.encode('utf-8')),
                ('service', 'study-plan-service'.encode('utf-8')),
                ('timestamp', str(int(asyncio.get_event_loop().time())).encode('utf-8'))
            ]
            
            # CRITICAL: Use correlation_id as the message KEY for NestJS matching
            await self.producer.send_and_wait(
                topic,
                key=correlation_id.encode("utf-8"),  # This is crucial for NestJS!
                value=value.encode("utf-8"),
                headers=headers,
                partition=partition
            )
            
            logger.info(f"[KafkaProducer] Sent message to {topic}" + 
                       (f" partition {partition}" if partition is not None else "") + 
                       f" with correlation ID: {correlation_id}")
            logger.debug(f"[KafkaProducer] Message content: {value}")
            
        except Exception as e:
            logger.error(f"[KafkaProducer] Error sending message: {e}")
            raise

    async def send_study_plan_result(self, correlation_id: str, result_data: dict, reply_topic: str = None):
        """
        Send study plan result back to API Gateway
        
        Args:
            correlation_id: Correlation ID from original request
            result_data: Study plan result or error data
            reply_topic: Reply topic (defaults to study-plan-requests.reply)
        """
        topic = reply_topic or "study-plan-requests.reply"
        message = json.dumps(result_data)
        await self.send_message(topic, correlation_id, message)

    async def send_progress_update_result(self, correlation_id: str, result_data: dict, reply_topic: str = None):
        """
        Send progress update result back to API Gateway
        
        Args:
            correlation_id: Correlation ID from original request
            result_data: Progress update result or error data
            reply_topic: Reply topic (defaults to study-plan-progress.reply)
        """
        topic = reply_topic or "study-plan-progress.reply"
        message = json.dumps(result_data)
        await self.send_message(topic, correlation_id, message)

# Global producer instance
_producer_instance = None

async def get_producer() -> KafkaProducerService:
    """Get or create global producer instance"""
    global _producer_instance
    if _producer_instance is None:
        _producer_instance = KafkaProducerService()
        await _producer_instance.start()
    return _producer_instance

# Legacy synchronous function for backward compatibility
def send_result(result: dict):
    """
    Legacy synchronous function for sending results
    Note: This will be deprecated in favor of async methods
    """
    logger.warning("Using deprecated synchronous send_result function")
    # For now, just log the result - async version should be used instead
    logger.info(f"Result to send: {result}")