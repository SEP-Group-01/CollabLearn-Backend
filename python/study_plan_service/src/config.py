"""
Configuration for Study Plan Service
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Kafka Configuration
# NOTE: Use 'localhost:9093' when running locally (not in Docker)
# Change to 'kafka:9092' when running in Docker container
KAFKA_BROKER_URL = 'localhost:9093'  # TODO: Change to 'kafka:9092' after dockerizing

# Database Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Service Configuration
SERVICE_NAME = 'study-plan-service'
SERVICE_GROUP_ID = 'study-plan-service-group'

# Kafka Topics
TOPICS = {
    'study_plan_requests': 'study-plan-requests',
    'study_plan_progress': 'study-plan-progress',
    'study_plan_slots': 'study-plan-slots',
    'study_plan_tasks': 'study-plan-tasks'
}

# Logging Configuration
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
