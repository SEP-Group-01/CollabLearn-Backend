import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer
from .producer import KafkaProducerService
from config import KAFKA_BROKER_URL

logger = logging.getLogger(__name__)

class KafkaConsumerService:
    """
    Async Kafka Consumer Service for Study Plan Service
    Compatible with NestJS Kafka client expectations
    """
    def __init__(self, brokers: str, group_id: str, topics: list, producer: KafkaProducerService, controller):
        self.brokers = brokers
        self.group_id = group_id
        self.topics = topics
        self.producer = producer
        self.controller = controller  # Direct reference to the service controller
        self.consumer = AIOKafkaConsumer(
            *self.topics,
            bootstrap_servers=self.brokers,
            group_id=self.group_id,
            auto_offset_reset="earliest"
        )

    async def start(self):
        """Start the Kafka consumer and begin processing messages"""
        logger.info(f"[KafkaConsumer] Starting consumer for topics: {self.topics}")
        await self.consumer.start()
        try:
            async for msg in self.consumer:
                logger.info(f"[KafkaConsumer] Consumed message from {msg.topic}: {msg.value.decode('utf-8')}")
                await self.handle_message(msg)
        except Exception as e:
            logger.error(f"[KafkaConsumer] Error: {e}")
        finally:
            await self.consumer.stop()

    async def handle_message(self, msg):
        """Handle incoming Kafka messages and send replies"""
        try:
            # Debug: Print raw message details
            logger.debug(f"[KafkaConsumer] === Raw Message Debug ===")
            logger.debug(f"[KafkaConsumer] Topic: {msg.topic}")
            logger.debug(f"[KafkaConsumer] Partition: {msg.partition}")
            logger.debug(f"[KafkaConsumer] Offset: {msg.offset}")
            logger.debug(f"[KafkaConsumer] Key (raw): {msg.key}")
            logger.debug(f"[KafkaConsumer] Key type: {type(msg.key)}")
            logger.debug(f"[KafkaConsumer] Value (raw): {msg.value}")
            logger.debug(f"[KafkaConsumer] Headers: {msg.headers}")
            logger.debug(f"[KafkaConsumer] ========================")
            
            # Decode the message
            message_value = msg.value.decode('utf-8')
            message_key = msg.key.decode('utf-8') if msg.key else None
            
            logger.info(f"[KafkaConsumer] Received on topic {msg.topic}: {message_value}")
            logger.info(f"[KafkaConsumer] Message key (correlation_id): {message_key}")
            
            # Parse the message (NestJS sends JSON)
            try:
                payload = json.loads(message_value)
                logger.debug(f"[KafkaConsumer] Parsed payload: {payload}")
            except json.JSONDecodeError:
                payload = {"data": message_value}
                logger.warning(f"[KafkaConsumer] Failed to parse JSON, using raw data")
            
            # Try to find correlation ID from multiple sources
            correlation_id = None
            
            # 1. Check message key first
            if message_key:
                correlation_id = message_key
                logger.debug(f"[KafkaConsumer] Found correlation ID in message key: {correlation_id}")
            
            # 2. Check headers for correlation ID
            elif msg.headers:
                for header_item in msg.headers:
                    if isinstance(header_item, tuple) and len(header_item) == 2:
                        header_name, header_value = header_item
                        if isinstance(header_name, bytes):
                            header_name = header_name.decode('utf-8')
                        if 'correlation' in header_name.lower():
                            if isinstance(header_value, bytes):
                                correlation_id = header_value.decode('utf-8')
                            else:
                                correlation_id = str(header_value)
                            logger.debug(f"[KafkaConsumer] Found correlation ID in header '{header_name}': {correlation_id}")
                            break
            
            # 3. Check payload for correlation ID fields (for emit pattern)
            if not correlation_id and isinstance(payload, dict):
                possible_fields = ['correlationId', '__correlationId', 'correlation_id', 'id']
                for field in possible_fields:
                    if field in payload:
                        correlation_id = str(payload[field])
                        logger.debug(f"[KafkaConsumer] Found correlation ID in payload field '{field}': {correlation_id}")
                        break
            
            # 4. Use default if none found
            if not correlation_id:
                correlation_id = 'default'
                logger.warning(f"[KafkaConsumer] No correlation ID found, using default")
            
            logger.info(f"[KafkaConsumer] Final correlation ID: {correlation_id}")
            
            # Pass directly to the controller
            response_data = await self.controller.handle_request(msg.topic, payload)
            
            # Extract base topic for reply (remove action suffixes)
            # For topics like "study-plan-slots.get-slots", reply should go to "study-plan-slots.reply"
            # For topics like "study-plan-requests.generate", reply should go to "study-plan-requests.reply"
            # Pattern: "prefix-category.action" -> reply to "prefix-category.reply"
            base_topic = msg.topic
            if '.' in msg.topic:
                # Get everything before the last dot (the action part)
                # "study-plan-slots.get-slots" -> "study-plan-slots"
                # "study-plan-requests.generate" -> "study-plan-requests"
                last_dot_index = msg.topic.rfind('.')
                base_topic = msg.topic[:last_dot_index]
            
            reply_topic = f"{base_topic}.reply"
            reply_partition = None
            
            logger.info(f"[KafkaConsumer] 📨 Replying from topic '{msg.topic}' to '{reply_topic}'")
            
            # Check if NestJS specified a reply partition
            if msg.headers:
                for header_item in msg.headers:
                    if isinstance(header_item, tuple) and len(header_item) == 2:
                        header_name, header_value = header_item
                        if isinstance(header_name, bytes):
                            header_name = header_name.decode('utf-8')
                        if header_name == 'kafka_replyPartition':
                            if isinstance(header_value, bytes):
                                reply_partition = int(header_value.decode('utf-8'))
                            else:
                                reply_partition = int(header_value)
                            logger.debug(f"[KafkaConsumer] NestJS specified reply partition: {reply_partition}")
                            break
            
            # Pass reply topic, correlation ID, and partition to send_reply
            await self.send_reply(reply_topic, correlation_id, response_data, reply_partition)
                
        except Exception as e:
            logger.error(f"[KafkaConsumer] Error handling message: {e}")
            # Send error reply
            reply_topic = f"{msg.topic}.reply"
            correlation_id = message_key or 'default'
            error_response = {
                "error": str(e),
                "success": False,
                "service": "study-plan-service"
            }
            await self.send_reply(reply_topic, correlation_id, error_response)

    async def send_reply(self, reply_topic: str, correlation_id: str, data: dict, partition: int = None):
        """Send reply message to the reply topic"""
        try:
            response_json = json.dumps(data)
            await self.producer.send_message(reply_topic, correlation_id or "default", response_json, partition)
            logger.info(f"[KafkaConsumer] Sent reply to {reply_topic}" + 
                       (f" partition {partition}" if partition is not None else ""))
        except Exception as e:
            logger.error(f"[KafkaConsumer] Error sending reply: {e}")

# Legacy function for backward compatibility with synchronous code
def start_consumer():
    """
    Legacy function to start consumer (synchronous wrapper)
    Note: This will be deprecated in favor of async version
    """
    logger.warning("Using deprecated synchronous start_consumer function")
    # For backward compatibility, we'll need to run the async version
    # This is a temporary solution - the main.py should be updated to use async
    try:
        asyncio.run(_start_async_consumer())
    except Exception as e:
        logger.error(f"Error starting consumer: {e}")

async def _start_async_consumer():
    """Internal async function to start consumer"""
    from .producer import get_producer
    from controllers.study_plan_controller import StudyPlanController
    
    # Initialize services
    producer = await get_producer()
    controller = StudyPlanController()
    
    # Topics to listen to
    topics = [
        "study-plan-requests",
        "study-plan-progress"
    ]
    
    # Create and start consumer
    consumer = KafkaConsumerService(
        brokers=KAFKA_BROKER_URL,
        group_id="study-plan-service-group",
        topics=topics,
        producer=producer,
        controller=controller
    )
    
    await consumer.start()