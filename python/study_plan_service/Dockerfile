FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g., for psycopg2)
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY python/study_plan_service/requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the entire src directory to ensure all modules are included
COPY python/study_plan_service/src/ ./src/

# Set Python path to include src directory for imports
ENV PYTHONPATH=/app/src

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Run the main application
CMD ["python", "-m", "src.main"]