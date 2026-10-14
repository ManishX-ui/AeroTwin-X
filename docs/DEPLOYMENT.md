# AeroTwin-X: Deployment & Operational Setup Guide

This guide covers production and development deployment workflows for **AeroTwin-X**, including **Vercel Serverless**, **Docker Containerization**, **Bare-Metal / Uvicorn**, and **Neon PostgreSQL Database Configuration**.

---

## Table of Contents
1. [Deployment Architectures](#1-deployment-architectures)
2. [Environment Configuration Reference](#2-environment-configuration-reference)
3. [Vercel Cloud Deployment](#3-vercel-cloud-deployment)
4. [Docker & Containerized Deployment](#4-docker--containerized-deployment)
5. [Local Development (Uvicorn)](#5-local-development-uvicorn)
6. [Neon PostgreSQL Configuration & Migrations](#6-neon-postgresql-configuration--migrations)
7. [Post-Deployment Verification](#7-post-deployment-verification)

---

## 1. Deployment Architectures

| Deployment Target | Frontend Delivery | Backend Runtime | Telemetry Delivery | Persistence Layer | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vercel Cloud** | Edge Static Delivery | Python Serverless Functions (`api/index.py`) | REST Polling (`/api/v1/telemetry/live` @ 500ms) | Neon Serverless PostgreSQL | Public demos, portfolios, cloud evaluations. |
| **Docker Compose** | Nginx / FastAPI Static Mount | Persistent Uvicorn ASGI Worker | Full 50 Hz WebSockets (`/ws/telemetry`) | PostgreSQL container or Neon Cloud | Mission control stations, flight test benches. |
| **Local Python** | FastAPI Static Mount (`localhost:8000`) | Local Uvicorn ASGI Worker | Full 50 Hz WebSockets (`/ws/telemetry`) | Neon Cloud or Local SQLite | Day-to-day engineering, debugging, testing. |

---

## 2. Environment Configuration Reference

The application reads configuration from environment variables (or `.env` / `.env.local` files):

| Variable Name | Required | Default Value | Example / Format | Description |
| :--- | :---: | :--- | :--- | :--- |
| `DATABASE_URL` | Optional | `sqlite:///./aerotwin_x.db` | `postgresql+psycopg://user:pass@ep-*-pooler.*.aws.neon.tech/neondb?sslmode=require` | Primary database connection string. Accepts pooled Neon PostgreSQL or SQLite. |
| `DATABASE_URL_UNPOOLED`| Optional | — | `postgresql+psycopg://user:pass@ep-*.aws.neon.tech/neondb?sslmode=require` | Direct unpooled Neon connection URL used for Alembic DDL schema migrations. |
| `AEROTWIN_INGEST_API_KEY`| Optional | `aerotwin-sensor-key-live-2026` | `your-secret-edge-key-2026` | Shared secret key required for authenticating edge sensor ingestion via `POST /api/v1/telemetry/ingest`. |
| `TELEMETRY_HZ` | Optional | `2.0` | `2.0` or `50.0` | Target telemetry simulation frequency in Hertz. |
| `DEFAULT_UAV_ID` | Optional | `UAV-01` | `UAV-01`, `UAV-07` | Default tactical airframe identifier. |
| `DEFAULT_ENGINE_ID` | Optional | `AE-03` | `AE-03` | Default aero-engine serial designation. |
| `VERCEL` | Auto | — | `1` | Automatically set by the Vercel platform runtime. Activates serverless middleware path fixes. |

---

## 3. Vercel Cloud Deployment

AeroTwin-X is pre-configured for Vercel with `vercel.json`, `pyproject.toml`, and the serverless entry point `api/index.py`.

### 3.1. One-Click Git Integration
1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Import your GitHub repository (`ManishX-ui/AeroTwin-X`).
4. **Build & Development Settings**:
   - Framework Preset: **Other**
   - Root Directory: `./`
5. **Environment Variables**:
   Add your Neon PostgreSQL connection string:
   - `DATABASE_URL`: `postgresql+psycopg://neondb_owner:PASSWORD@ep-*-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - `AEROTWIN_INGEST_API_KEY`: `your-secure-production-api-key`
6. Click **Deploy**.

### 3.2. Deploying via Vercel CLI
```bash
# 1. Log in to Vercel
npx vercel login

# 2. Deploy preview build
npx vercel

# 3. Deploy to production
npx vercel --prod
```

### 3.3. How the Vercel Architecture Operates
- **Static Assets:** `index.html`, `js/`, `css/`, and `assets/` are served globally across Vercel's Edge CDN.
- **API Routing:** Any request to `/api/*` is routed by Vercel to `api/index.py` (which wraps `backend.app.main:app`).
- **Path Rewrite Middleware:** `vercel_rewrite_path_fix` in `main.py` restores the original requested URI if Vercel internal routing rewrote the path to `/api/index.py`.
- **Telemetry Streaming:** Because serverless functions cannot maintain long-lived WebSocket connections, the frontend automatically falls back to polling `/api/v1/telemetry/live` every 500ms when hosted on Vercel.

---

## 4. Docker & Containerized Deployment

A production-ready `Dockerfile` and `docker-compose.yml` are included in the repository.

### 4.1. Build and Run with Docker Compose
```bash
# Clone the repository
git clone https://github.com/ManishX-ui/AeroTwin-X.git
cd AeroTwin-X

# Build and start container in foreground
docker-compose up --build
```

To run as a background daemon:
```bash
docker-compose up -d
```

To view live container logs:
```bash
docker-compose logs -f
```

To stop the container:
```bash
docker-compose down
```

The containerized service is accessible at `http://localhost:8000`.

---

## 5. Local Development (Uvicorn)

For day-to-day engineering and full 50 Hz WebSocket testing:

### 5.1. Prerequisites
- Python 3.10+ (tested through Python 3.12 / 3.14)
- Git

### 5.2. Setup Instructions
```bash
# 1. Clone repository
git clone https://github.com/ManishX-ui/AeroTwin-X.git
cd AeroTwin-X

# 2. Create and activate a Python virtual environment
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Optional) Configure environment
copy .env.example .env.local

# 5. Start the local development server with hot-reloading
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open your browser to:
- **GCS Dashboard:** `http://localhost:8000/`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`
- **Service Diagnostics:** `http://localhost:8000/api/v1/diagnostics/services`

---

## 6. Neon PostgreSQL Configuration & Migrations

### 6.1. Provisioning a Free Neon Database
1. Sign up at [neon.tech](https://neon.tech).
2. Create a project named `aerotwin-x` (recommended region: `aws-us-east-2`).
3. Neon provides two connection strings in the dashboard:
   - **Pooled connection string** (contains `-pooler`): Use for `DATABASE_URL`.
   - **Direct unpooled connection string**: Use for `DATABASE_URL_UNPOOLED` (migrations).

### 6.2. Running Migrations
```bash
# Set unpooled connection URL
set DATABASE_URL=postgresql+psycopg://user:password@ep-*.aws.neon.tech/neondb?sslmode=require

# Run Alembic migrations to create tables
alembic upgrade head
```

### 6.3. Seeding Operational Demo Data
To populate registered UAV airframes, sensors, and initial maintenance logs:
```bash
curl -X POST "http://localhost:8000/api/v1/system/seed-demo-fixtures?force=true"
```

---

## 7. Post-Deployment Verification

Verify deployment health with this sequence:

1. **Check Service Health:**
   ```bash
   curl -s http://localhost:8000/health
   ```
   *Expected response contains `"status": "HEALTHY"`.*

2. **Check Diagnostics & Database Latency:**
   ```bash
   curl -s http://localhost:8000/api/v1/diagnostics/services
   ```
   *Verify `"database": { "status": "CONNECTED" }`.*

3. **Verify Telemetry Ingestion (with API Key):**
   ```bash
   curl -X POST "http://localhost:8000/api/v1/telemetry/ingest" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: aerotwin-sensor-key-live-2026" \
     -d "{\"timestamp\": \"2026-10-14T12:00:00Z\", \"uav_id\": \"UAV-01\", \"engine_id\": \"AE-03\", \"rpm\": 2550.0, \"cht\": 108.0, \"egt\": 725.0, \"oil_pressure\": 4.2, \"oil_temperature\": 88.0, \"fuel_flow\": 18.2, \"vibration\": 1.15, \"battery_voltage\": 28.2, \"alternator_current\": 12.8, \"throttle_pos\": 75.0, \"manifold_pressure\": 31.4, \"ambient_temp\": 15.0, \"pressure_altitude\": 14500.0, \"mission_phase\": \"CRUISE\", \"quality\": \"VALID\"}"
   ```
   *Expected response: `HTTP 201 Created` with `"status": "INGESTED"`.*
