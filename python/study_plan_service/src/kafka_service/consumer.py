# from kafka import KafkaConsumer
# import json
# from controllers.kafka_controller import handle_study_plan_request
# from config import KAFKA_BROKER_URL, KAFKA_REQUEST_TOPIC

# def start_consumer():
#     consumer = KafkaConsumer(
#         KAFKA_REQUEST_TOPIC,
#         bootstrap_servers=[KAFKA_BROKER_URL],
#         value_deserializer=lambda m: json.loads(m.decode('utf-8'))
#     )
#     for msg in consumer:
#         handle_study_plan_request(msg.value)


from kafka import KafkaConsumer
import json
from controllers.kafka_controller import handle_study_plan_request
from config import KAFKA_BROKER_URL, KAFKA_REQUEST_TOPIC

def start_consumer():
    consumer = KafkaConsumer(
        KAFKA_REQUEST_TOPIC,
        bootstrap_servers=[KAFKA_BROKER_URL],
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    for msg in consumer:
        handle_study_plan_request(msg.value)