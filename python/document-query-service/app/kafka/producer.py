import asyncio
from aiokafka import AIOKafkaProducer


class KafkaProducerService:
    def __init__(self, brokers: str):
        self.brokers = brokers
        self.producer = AIOKafkaProducer(bootstrap_servers=self.brokers)

    async def start(self):
        await self.producer.start()

    async def stop(self):
        await self.producer.stop()

    async def send_message(self, topic: str, correlation_id: str, value: str, partition: int = None):
        """Send a message to Kafka"""
        try:
            # NestJS expects correlation ID as BOTH message key AND header
            headers = [
                ('kafka_correlationId', correlation_id.encode('utf-8')),
            ]
            
            # CRITICAL: Use correlation_id as the message KEY for NestJS matching
            await self.producer.send_and_wait(
                topic,
                key=correlation_id.encode("utf-8"),  # This is crucial for NestJS!
                value=value.encode("utf-8"),
                headers=headers,
                partition=partition
            )
            print(f"[KafkaProducer] Sent message to {topic}" + (f" partition {partition}" if partition is not None else "") + f": {value} using correlation ID: {correlation_id}")
            print(f"[KafkaProducer] Headers sent: {headers}")
            print(f"[KafkaProducer] Message key: {correlation_id}")
        except Exception as e:
            print(f"[KafkaProducer] Error: {e}")
