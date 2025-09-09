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

    async def send_message(self, topic: str, correlation_id: str, value: str):
        """Send a message to Kafka"""
        try:
            await self.producer.send_and_wait(
                topic,
                key=correlation_id.encode("utf-8"),
                value=value.encode("utf-8"),
            )
            print(f"[KafkaProducer] Sent message to {topic}: {value} using correlation ID: {correlation_id}")
        except Exception as e:
            print(f"[KafkaProducer] Error: {e}")
