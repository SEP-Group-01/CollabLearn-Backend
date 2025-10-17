# Use an official lightweight Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_HOME=/app

# Create app directory
WORKDIR $APP_HOME

# Install system dependencies (if you need Kafka SSL or build tools)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY python/document-query-service/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy ONLY the service code (not the entire workspace)
COPY python/document-query-service/app ./app

# Set Python path to include app directory for imports
ENV PYTHONPATH=/app

# Command to start the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
