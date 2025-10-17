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

# Command to start the service
# Since you don't expose an API, you just need to run main.py
# CMD ["python", "app/main.py"]
# If you want to run with Uvicorn for better performance, uncomment the line below
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
