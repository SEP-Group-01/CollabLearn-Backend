import asyncio
from aiokafka import AIOKafkaConsumer


class KafkaConsumerService:
    def __init__(self, brokers: str, group_id: str, topic: str):
        self.brokers = brokers
        self.group_id = group_id
        self.topic = topic
        self.consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=self.brokers,
            group_id=self.group_id,
            auto_offset_reset="earliest"  # or "latest"
        )

    async def start(self):
        await self.consumer.start()
        try:
            async for msg in self.consumer:
                print(f"[KafkaConsumer] Received: {msg.value.decode('utf-8')}")
                # TODO: process the message here (e.g. query documents)
        except Exception as e:
            print(f"[KafkaConsumer] Error: {e}")
        finally:
            await self.consumer.stop()
