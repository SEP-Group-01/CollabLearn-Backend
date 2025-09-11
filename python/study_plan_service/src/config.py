import os
from dotenv import load_dotenv

load_dotenv()  # Loads variables from .env

KAFKA_BROKER_URL = os.getenv("KAFKA_BROKER_URL")
KAFKA_REQUEST_TOPIC = os.getenv("KAFKA_REQUEST_TOPIC")
KAFKA_RESULT_TOPIC = os.getenv("KAFKA_RESULT_TOPIC")
DATABASE_URL = os.getenv("DATABASE_URL")