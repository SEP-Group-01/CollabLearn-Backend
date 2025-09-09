import asyncio
import json
from aiokafka import AIOKafkaConsumer
from .producer import KafkaProducerService


class KafkaConsumerService:
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
        print(f"[KafkaConsumer] Starting consumer for topics: {self.topics}")
        await self.consumer.start()
        try:
            async for msg in self.consumer:
                print(f"[KafkaConsumer] Consumed message from {msg.topic}: {msg.value.decode('utf-8')}")
                await self.handle_message(msg)
        except Exception as e:
            print(f"[KafkaConsumer] Error: {e}")
        finally:
            await self.consumer.stop()

    async def handle_message(self, msg):
        """Handle incoming Kafka messages and send replies"""
        try:
            # Decode the message
            message_value = msg.value.decode('utf-8')
            message_key = msg.key.decode('utf-8') if msg.key else None
            
            print(f"[KafkaConsumer] Received on topic {msg.topic}: {message_value}")
            print(f"[KafkaConsumer] Message key (correlation_id): {message_key}")
            
            # Parse the message (NestJS sends JSON)
            try:
                payload = json.loads(message_value)
            except json.JSONDecodeError:
                payload = {"data": message_value}
            
            # Use the message key as correlation ID, or fallback to payload, or default
            correlation_id = message_key or payload.get('__correlationId') or 'default'
            print(f"[KafkaConsumer] Using correlation ID: {correlation_id}")
            
            # Pass directly to the controller
            response_data = await self.controller.handle_request(msg.topic, payload)
            
            # Send reply using the standard NestJS pattern: {original_topic}.reply
            reply_topic = f"{msg.topic}.reply"
            await self.send_reply(reply_topic, correlation_id, response_data)
                
        except Exception as e:
            print(f"[KafkaConsumer] Error handling message: {e}")
            # Send error reply
            reply_topic = f"{msg.topic}.reply"
            correlation_id = message_key or payload.get('__correlationId', 'default') if 'payload' in locals() else 'default'
            error_response = {
                "error": str(e),
                "success": False
            }
            await self.send_reply(reply_topic, correlation_id, error_response)

    async def send_reply(self, reply_topic: str, correlation_id: str, data: dict):
        """Send reply message to the reply topic"""
        try:
            response_json = json.dumps(data)
            await self.producer.send_message(reply_topic, correlation_id or "default", response_json)
            print(f"[KafkaConsumer] Sent reply to {reply_topic}")
        except Exception as e:
            print(f"[KafkaConsumer] Error sending reply: {e}")
