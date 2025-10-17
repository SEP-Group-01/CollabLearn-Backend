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
            # Debug: Print raw message details
            print(f"[KafkaConsumer] === Raw Message Debug ===")
            print(f"[KafkaConsumer] Topic: {msg.topic}")
            print(f"[KafkaConsumer] Partition: {msg.partition}")
            print(f"[KafkaConsumer] Offset: {msg.offset}")
            print(f"[KafkaConsumer] Key (raw): {msg.key}")
            print(f"[KafkaConsumer] Key type: {type(msg.key)}")
            print(f"[KafkaConsumer] Value (raw): {msg.value}")
            print(f"[KafkaConsumer] Headers: {msg.headers}")
            print(f"[KafkaConsumer] ========================")
            
            # Decode the message
            message_value = msg.value.decode('utf-8')
            message_key = msg.key.decode('utf-8') if msg.key else None
            
            print(f"[KafkaConsumer] Received on topic {msg.topic}: {message_value}")
            print(f"[KafkaConsumer] Message key (correlation_id): {message_key}")
            
            # Parse the message (NestJS sends JSON)
            try:
                payload = json.loads(message_value)
                print(f"[KafkaConsumer] Parsed payload: {payload}")
            except json.JSONDecodeError:
                payload = {"data": message_value}
                print(f"[KafkaConsumer] Failed to parse JSON, using raw data")
            
            # Try to find correlation ID from multiple sources
            correlation_id = None
            
            # 1. Check message key first
            if message_key:
                correlation_id = message_key
                print(f"[KafkaConsumer] Found correlation ID in message key: {correlation_id}")
            
            # 2. Check headers for correlation ID
            elif msg.headers:
                # msg.headers is a tuple of tuples: (('key', b'value'), ...)
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
                            print(f"[KafkaConsumer] Found correlation ID in header '{header_name}': {correlation_id}")
                            break
            
            # 3. Check payload for correlation ID fields (for emit pattern)
            if not correlation_id and isinstance(payload, dict):
                possible_fields = ['correlationId', '__correlationId', 'correlation_id', 'id']
                for field in possible_fields:
                    if field in payload:
                        correlation_id = str(payload[field])
                        print(f"[KafkaConsumer] Found correlation ID in payload field '{field}': {correlation_id}")
                        break
            
            # 4. Use default if none found
            if not correlation_id:
                correlation_id = 'default'
                print(f"[KafkaConsumer] No correlation ID found, using default")
            
            print(f"[KafkaConsumer] Final correlation ID: {correlation_id}")
            
            # TEMPORARY FIX: Let's see what the raw message looks like from NestJS
            print(f"[KafkaConsumer] === NESTJS MESSAGE ANALYSIS ===")
            if msg.key:
                print(f"[KafkaConsumer] Message has key: {msg.key} (type: {type(msg.key)})")
                if isinstance(msg.key, bytes):
                    try:
                        decoded_key = msg.key.decode('utf-8')
                        print(f"[KafkaConsumer] Decoded key: {decoded_key}")
                        # Use the decoded key as correlation ID for NestJS compatibility
                        correlation_id = decoded_key
                    except:
                        print(f"[KafkaConsumer] Could not decode key as UTF-8")
            else:
                print(f"[KafkaConsumer] Message has NO key")
                
            if msg.headers:
                print(f"[KafkaConsumer] Message headers: {msg.headers}")
                # Check if there's a specific NestJS correlation header
                for header_item in msg.headers:
                    if isinstance(header_item, tuple) and len(header_item) == 2:
                        k, v = header_item
                        header_name = k.decode('utf-8') if isinstance(k, bytes) else str(k)
                        header_value = v.decode('utf-8') if isinstance(v, bytes) else str(v)
                        print(f"[KafkaConsumer] Header: {header_name} = {header_value}")
            else:
                print(f"[KafkaConsumer] Message has NO headers")
            print(f"[KafkaConsumer] ===================================")
            
            # Use the final correlation ID
            print(f"[KafkaConsumer] FINAL CORRELATION ID TO USE: {correlation_id}")
            
            # Pass directly to the controller
            response_data = await self.controller.handle_request(msg.topic, payload)
            
            # Extract reply topic and partition from NestJS headers
            reply_topic = f"{msg.topic}.reply"
            reply_partition = None
            
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
                            print(f"[KafkaConsumer] NestJS specified reply partition: {reply_partition}")
                            break
            
            # Pass reply topic, correlation ID, and partition to send_reply
            await self.send_reply(reply_topic, correlation_id, response_data, reply_partition)
                
        except Exception as e:
            print(f"[KafkaConsumer] Error handling message: {e}")
            # Send error reply
            reply_topic = f"{msg.topic}.reply"
            correlation_id = message_key or 'default'
            error_response = {
                "error": str(e),
                "success": False
            }
            await self.send_reply(reply_topic, correlation_id, error_response)

    async def send_reply(self, reply_topic: str, correlation_id: str, data: dict, partition: int = None):
        """Send reply message to the reply topic"""
        try:
            response_json = json.dumps(data)
            await self.producer.send_message(reply_topic, correlation_id or "default", response_json, partition)
            print(f"[KafkaConsumer] Sent reply to {reply_topic}" + (f" partition {partition}" if partition is not None else ""))
        except Exception as e:
            print(f"[KafkaConsumer] Error sending reply: {e}")
