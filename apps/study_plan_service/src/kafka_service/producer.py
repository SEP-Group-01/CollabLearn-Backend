# from kafka import KafkaProducer
# import json
# from config import KAFKA_BROKER_URL, KAFKA_RESULT_TOPIC

# producer = KafkaProducer(
#     bootstrap_servers=[KAFKA_BROKER_URL],
#     value_serializer=lambda m: json.dumps(m).encode('utf-8')
# )

# def send_result(result):
#     producer.send(KAFKA_RESULT_TOPIC, result)

from kafka import KafkaProducer
import json
from src.config import KAFKA_BROKER_URL, KAFKA_RESULT_TOPIC

producer = KafkaProducer(
    bootstrap_servers=[KAFKA_BROKER_URL],
    value_serializer=lambda m: json.dumps(m).encode('utf-8')
)

def send_result(result):
    producer.send(KAFKA_RESULT_TOPIC, result)