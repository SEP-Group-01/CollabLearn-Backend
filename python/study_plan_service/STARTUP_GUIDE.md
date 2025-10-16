# Study Plan Service - Startup Guide

## Files Overview

### `app.py` ✅ (RECOMMENDED)

- FastAPI application with HTTP endpoints
- Runs Kafka consumer in background
- Provides health check endpoints
- **Use this for production**

### `main.py` (Legacy)

- Standalone asyncio script
- Only runs Kafka consumer
- No HTTP endpoints
- Keep for reference only

---

## How to Start the Service

### Option 1: Using the Startup Script (EASIEST) ⭐

```powershell
.\start-service.ps1
```

This automatically:

- Changes to the correct directory
- Activates the virtual environment
- Runs uvicorn with proper module path

---

### Option 2: Manual Start

#### From the `study_plan_service` directory:

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Change to src directory (IMPORTANT!)
cd src

# Run uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

#### From anywhere:

```powershell
cd "path\to\study_plan_service\src"
..\\.venv\Scripts\Activate.ps1
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## Why the Import Error?

The error `ModuleNotFoundError: No module named 'config'` happens when:

- Running `uvicorn src.app:app` from the parent directory
- Python can't find `config.py` because imports are relative

**Solution**: Always run from inside the `src` directory, or use `start-service.ps1`

---

## Endpoints

Once running, access:

- **Root**: http://localhost:8000/
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs (FastAPI auto-generated)

---

## Kafka Topics Monitored

The service listens to:

- `study-plan-requests.generate` - Generate new study plans
- `study-plan-requests.drop-plan` - Drop existing plans
- `study-plan-slots.*` - Time slot management
- `study-plan-tasks.*` - Task management
- `study-plan-workspaces.get-workspaces` - Fetch workspace data
- `study-plan-analysis.feasibility` - Feasibility analysis

---

## Troubleshooting

### Import Errors

**Problem**: `ModuleNotFoundError: No module named 'config'`
**Solution**: Use `start-service.ps1` or run from `src` directory

### Kafka Connection Issues

**Problem**: Service starts but can't connect to Kafka
**Solution**: Check `config.py` - ensure `KAFKA_BROKER_URL = 'localhost:9093'`

### Port Already in Use

**Problem**: `Address already in use: 0.0.0.0:8000`
**Solution**:

```powershell
# Find process using port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess
# Kill it
Stop-Process -Id <ProcessId> -Force
```

---

## Environment Variables

Create a `.env` file in `study_plan_service` directory:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
LOG_LEVEL=INFO
```

---

## Development vs Production

### Development (Current Setup)

```python
# config.py
KAFKA_BROKER_URL = 'localhost:9093'
```

### Production (Docker)

```python
# config.py
KAFKA_BROKER_URL = 'kafka:9092'
```

Change this when deploying to Docker!
