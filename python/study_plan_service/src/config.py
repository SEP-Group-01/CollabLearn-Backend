import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Kafka Configuration
KAFKA_BROKER_URL = os.getenv("KAFKA_BROKER_URL", "localhost:9092")
KAFKA_REQUEST_TOPIC = os.getenv("KAFKA_REQUEST_TOPIC", "study-plan-requests")
KAFKA_RESULT_TOPIC = os.getenv("KAFKA_RESULT_TOPIC", "study-plan-results")

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL")

# Service Configuration
SERVICE_NAME = os.getenv("SERVICE_NAME", "study-plan-service")
SERVICE_VERSION = os.getenv("SERVICE_VERSION", "2.0.0")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Optimization Configuration
MAX_OPTIMIZATION_TIME_SECONDS = int(os.getenv("MAX_OPTIMIZATION_TIME_SECONDS", "30"))
DEFAULT_WEEKLY_HOURS = int(os.getenv("DEFAULT_WEEKLY_HOURS", "10"))
DEFAULT_STUDY_WEEKS = int(os.getenv("DEFAULT_STUDY_WEEKS", "4"))

# Validation
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

if not KAFKA_BROKER_URL:
    raise ValueError("KAFKA_BROKER_URL environment variable is required")