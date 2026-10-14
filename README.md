# AeroTwin-X

### AI-Powered Digital Twin for Intelligent UAV Engine Health Monitoring

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/Neon%20PostgreSQL-16+-4169E1.svg?logo=postgresql&logoColor=white)](https://neon.tech/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00.svg?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.4+-F7931E.svg?logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black.svg?logo=three.js&logoColor=white)](https://threejs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel%20%7C%20Docker-black.svg?logo=vercel&logoColor=white)](https://aero-twin-x-vj25.vercel.app/)
[![License](https://img.shields.io/badge/License-Unspecified-lightgrey.svg)](#license)

> **🚀 Live Operational Deployments:**
> - **Main Ground Control Station (GCS):** [https://aero-twin-x-vj25.vercel.app/](https://aero-twin-x-vj25.vercel.app/)
> - **Interactive 3D Mechanical Simulator ([EngineVerse 3D](./engineverse-3d)):** [https://aero-twin-x-u8z2.vercel.app/](https://aero-twin-x-u8z2.vercel.app/)
>
> **Operational Scope & Integrity Notice:** AeroTwin-X is an industrial cyber-physical demonstrator and digital twin test bench engineered for Medium-Altitude Long-Endurance (MALE) tactical UAV propulsion systems (turbocharged Rotax 915iSc class). The platform demonstrates real-time physics tracking, multidimensional residual analysis, automated anomaly detection, multi-class fault classification, and Condition-Based Maintenance (CBM+) workflows. It is an engineering evaluation and decision-support platform, not certified flight-critical avionics firmware.

---

## Executive Overview

In long-endurance tactical and ISR UAV operations (14,000+ ft operating ceiling, 24+ hour missions), unscheduled propulsion system degradation represents the primary hazard to airframe recovery. Traditional aero-engine operations rely on static threshold exceedance limits (e.g., warning if $CHT > 135^\circ\text{C}$). However:
- **Thresholds trigger too late:** By the time a fixed limit is breached, thermomechanical damage has already propagated across the cylinder assembly.
- **Setpoints shift with atmosphere:** Nominal operating temperatures and pressures shift dynamically between sea-level takeoff and high-altitude cold cruise.
- **Subtle failures stay masked:** Single-cylinder injector clogging, partial oil scavenge loss, or thermocouple drift remain concealed within aggregate engine averages.

**AeroTwin-X** solves this challenge by deploying a continuous, closed-loop **Physics-Informed Digital Twin** coupled with an **Edge AI/ML Diagnostic Ensemble**:

$$\text{Physical / Verified Sensor Stream } x_{\text{act}}(t) \quad \longleftrightarrow \quad \text{Physics Digital Twin Expectation } x_{\text{exp}}(t) = f(\text{RPM}, \theta_{\text{thr}}, h_{\text{alt}}, T_{\text{amb}})$$

$$\text{Multi-Channel Normalized Residual: } r_i(t) = \frac{x_{\text{act}, i}(t) - x_{\text{exp}, i}(t)}{\sigma_i}$$

By transforming raw multi-sensor telemetry into a multi-dimensional normalized residual space $\vec{r}(t)$, AeroTwin-X detects subtle aerothermodynamic divergence, isolates failure signatures before structural damage occurs, estimates Remaining Useful Life (RUL), and generates actionable Condition-Based Maintenance (CBM+) work orders with EASA Part-M compliance references.

### End-to-End Conceptual Workflow
$$\text{Physical System / Sensor Ingestion} \longrightarrow \text{Validation \& Provenance Classification} \longrightarrow \text{Neon PostgreSQL Persistence} \longrightarrow \text{Digital Twin Physics (ODE)} \longrightarrow \text{AI/ML Diagnostic Ensemble} \longrightarrow \text{Health \& RUL Insights} \longrightarrow \text{Predictive Maintenance Work Orders}$$

---

![AeroTwin-X Mission Control Overview](docs/images/01_mission_control_overview.png)

---

## Table of Contents
1. [Key Capabilities](#1-key-capabilities)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Installation & Local Setup](#5-installation--local-setup)
6. [Database & Neon PostgreSQL Integration](#6-database--neon-postgresql-integration)
7. [API & Telemetry Ingestion Reference](#7-api--telemetry-ingestion-reference)
8. [Digital Twin Mathematical Physics & AI/ML Models](#8-digital-twin-mathematical-physics--aiml-models)
9. [Interface Walkthrough & Feature Modules (13 Screenshots)](#9-interface-walkthrough--feature-modules)
10. [Automated Verification & Testing](#10-automated-verification--testing)
11. [Deployment Architectures (Vercel & Docker)](#11-deployment-architectures)
12. [Current Limitations & Engineering Roadmap](#12-current-limitations--engineering-roadmap)
13. [Contributing & License](#13-contributing--license)

---

## 1. Key Capabilities

| Capability | Engineering Implementation | Operational Impact |
| :--- | :--- | :--- |
| **Multi-Source Data Provenance** | Strict separation of `LIVE_SENSOR`, `DATASET_REPLAY`, and `SIMULATION`. Validated via `X-API-Key`, registered asset verification, and physical bounds. | Prevents synthetic simulation data from being misrepresented as physical hardware measurements. |
| **Physics-Informed Digital Twin** | Lumped-parameter aerothermodynamic model calibrated for turbocharged Rotax 915iSc with ISA atmospheric lapse rates and 1st-order thermal lag. | Establishes dynamic, phase-aware expected baselines for CHT, EGT, oil pressure, and fuel flow. |
| **Real-Time Residual Analysis** | 7-channel normalized residual calculation ($r = \Delta x / \sigma$) with chi-square divergence tracking and digital twin sync percentage. | Isolates microscopic thermodynamic deviations ($>1.8\sigma$ warning, $>3.0\sigma$ critical) independent of flight ceiling. |
| **AI/ML Anomaly Detection** | Scikit-learn `IsolationForest` (100 estimators, 10 residual/trend features) with sigmoidal calibration ($0.02 - 0.99$ score). | Flags emerging subsystem degradation with a calibrated $0.35$ anomaly threshold. |
| **Multi-Class Fault Diagnosis** | Supervised `GradientBoostingClassifier` (60 estimators, depth 4) diagnosing 10 discrete failure modes with automated nominal suppression. | Pinpoints root causes (overheating, misfire, injector restriction, lubrication loss) with multi-class probability scores. |
| **Explainable AI (XAI)** | Deterministic feature attribution engine returning relative percentage impacts, evidence arrays, and plain-English engineering explanations. | Delivers transparent, auditable evidence for mission abort or turnaround maintenance decisions. |
| **Prognostics & RUL Modeling** | Non-linear analytical degradation model tracking 2,500-hour TBO with thermal and mechanical wear acceleration penalties. | Projects remaining flight hours and operational wear trends based on actual in-flight stress. |
| **Interactive 3D Engine CAD** | Three.js (r128) cutaway visualization of Rotax 915iSc 4-cylinder boxer engine with dynamic vertex thermal FEA mapping. | Translates numerical cylinder temperature telemetry into intuitive spatial thermal gradients. |
| **Enterprise Persistence** | Neon Serverless PostgreSQL with SQLAlchemy 2.0, Psycopg 3, Alembic migrations (`dcaf25d9e518`), and SHA-256 deduplication. | Guaranteed transactional storage for time-series observations, ML predictions, alerts, and CBM+ work orders. |
| **Condition-Based Maintenance (CBM+)**| Automated advisory generator outputting work orders, borescope triggers, and EASA Part-M compliance CSV exports. | Eliminates arbitrary calendar-based maintenance schedules in favor of empirical health data. |

---

## 2. End-to-End System Architecture

```mermaid
flowchart TD
    subgraph DataSources["1. Multi-Mode Telemetry Ingestion"]
        PS["Physical CAN Bus / Edge Sensor"]
        DR["Flight Log Replay (JSON Benchmark)"]
        ES["Internal Physics Simulator (ODE / RK4)"]
    end

    subgraph SecurityValidation["2. Validation & Security Layer"]
        AUTH["API Key Auth (X-API-Key / Bearer)"]
        VAL["FastAPI Schema Validation & Boundary Checks"]
        TS["Dual Timestamps (Source vs. Ingestion)"]
        DEDUP["SHA-256 Idempotency Check"]
    end

    subgraph CoreService["3. State Coordination (AeroTwinStateService)"]
        PROV["Provenance Classifier (LIVE | REPLAY | SIM)"]
        STALE["Staleness Monitor (5.0s Timeout)"]
        CBUF["Circular Frame History (600 Frames)"]
    end

    subgraph DigitalTwin["4. Physics-Informed Digital Twin"]
        ISA["ISA Atmospheric Model (Lapse Rate)"]
        ODE["Rotax 915iSc Baseline State Maps"]
        RES["Residual Engine (r = Delta / Sigma)"]
    end

    subgraph AIInference["5. AI / ML Diagnostic Ensemble"]
        FE["Feature Extractor (Window Stats & Trends)"]
        IF["Isolation Forest Anomaly Detector"]
        GBC["Gradient Boosted Fault Classifier"]
        HLTH["Composite Health Scoring (0-100)"]
        RUL["Weibull Hazard RUL Estimator"]
        XAI["Explainability Engine (SHAP-Style Attributions)"]
    end

    subgraph Persistence["6. PostgreSQL Persistence Layer (Neon Cloud)"]
        SR[("sensor_readings")]
        AP[("ai_predictions")]
        MR[("maintenance_records")]
        AR[("alert_records")]
    end

    subgraph RealTimeDistribution["7. Real-Time Distribution"]
        WS["WebSocket Stream (/ws/telemetry @ 2-50 Hz)"]
        POLL["Live State Polling (/api/v1/telemetry/live)"]
    end

    subgraph GCSFrontend["8. Ground Control Station (Single-Page App)"]
        DASH["Mission Control Cockpit"]
        GAUGES["Live Sensor Instrumentation"]
        THREE["Three.js 3D Engine Cutaway"]
        CBM["CBM+ Maintenance Workspace"]
    end

    PS -->|POST /api/v1/telemetry/ingest| AUTH
    DR -->|POST /api/v1/telemetry/replay/step| VAL
    ES -->|In-Process Step| PROV

    AUTH --> VAL
    VAL --> TS
    TS --> DEDUP
    DEDUP --> PROV

    PROV --> STALE & CBUF & ISA
    ISA --> ODE --> RES --> FE
    FE --> IF & GBC
    IF & GBC --> HLTH --> RUL
    GBC & RES --> XAI

    DEDUP -.->|SQLAlchemy / NullPool| SR
    XAI & GBC & RUL -.->|SQLAlchemy / NullPool| AP
    HLTH & IF -.->|Advisories| MR & AR

    PROV --> WS & POLL
    WS & POLL --> DASH & GAUGES & THREE & CBM
```

*For an in-depth exploration of the architectural layers, consult [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).*

---

## 3. Technology Stack

AeroTwin-X is built strictly with modern, verified open-source technologies:

| Layer | Technology | Version | Purpose in AeroTwin-X |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | **FastAPI** | `0.110.0+` | High-performance asynchronous REST API gateway, dependency injection, and Pydantic validation. |
| **ASGI Server** | **Uvicorn** | `0.29.0+` | Asynchronous server implementation supporting high-concurrency WebSocket channels. |
| **Database** | **Neon PostgreSQL** | `16.0+` | Hosted serverless PostgreSQL in AWS `us-east-2` with managed PgBouncer connection pooling. |
| **Database ORM** | **SQLAlchemy** | `2.0.29+` | Modern ORM with 2.0-style unified querying, relationship cascades, and `NullPool` serverless support. |
| **Database Driver** | **Psycopg 3** | `3.1.0+` | High-efficiency C/binary PostgreSQL driver supporting client-side parameter binding and SSL. |
| **Schema Migrations**| **Alembic** | `1.13.0+` | Declarative database migration versioning (`alembic/versions/dcaf25d9e518_*`). |
| **Machine Learning** | **Scikit-Learn** | `1.4.2+` | Production implementations of `IsolationForest` and `GradientBoostingClassifier`. |
| **Scientific Computing**| **NumPy & SciPy** | `1.26.4+` / `1.13.0+`| Multi-dimensional array manipulation, statistical sigmoidal calibration, and numerical routines. |
| **Data Processing** | **Pandas** | `2.2.2+` | Tabular telemetry analysis, rolling time-window feature extraction, and EASA Part-M CSV exports. |
| **Real-Time Streaming**| **WebSockets** | `12.0+` | Bidirectional low-latency frame broadcast (`/ws/telemetry`) with client command handling. |
| **Frontend Framework** | **Vanilla HTML5 & ES6**| Modern Standard | High-performance zero-overhead Single Page Application (SPA) avoiding heavy framework virtual DOMs. |
| **3D CAD Visualization**| **Three.js** | `r128` | WebGL 3D rendering of Rotax 915iSc engine cutaway with dynamic shader vertex thermal mapping. |
| **Styling & Design** | **Tailwind CSS** | `v3.4+` | Clean, high-density aerospace instrumentation interface styling and responsive layouts. |
| **Deployment** | **Vercel & Docker** | Modern Standard | Serverless cloud edge deployment (`vercel.json`) and reproducible containerization (`Dockerfile`). |

---

## 4. Project Structure

```
AeroTwin-X/
├── api/
│   └── index.py                          # Vercel serverless function ASGI entry point
├── alembic/
│   ├── env.py                            # Alembic database migration environment
│   └── versions/
│       └── dcaf25d9e518_initial_neon_relational_schema.py # Active PostgreSQL schema migration
├── assets/
│   └── logo.png                          # AeroTwin-X high-resolution brand asset
├── backend/
│   ├── app/
│   │   ├── api/                          # 12 Modular REST API Routers
│   │   │   ├── alerts.py                 # Alert queries & operator acknowledgment
│   │   │   ├── data_quality.py           # Sensor noise, drift, and incident resolution
│   │   │   ├── edge_ai.py                # Edge compute node telemetry & hardware metrics
│   │   │   ├── engines.py                # Synchronized engine state & 3D component health
│   │   │   ├── fleet.py                  # Squadrons, airframes, and sensor channel queries
│   │   │   ├── maintenance.py            # CBM+ work orders, status changes & EASA Part-M CSV
│   │   │   ├── missions.py               # Mission profile catalog and black-box replay
│   │   │   ├── models.py                 # Model registry metadata and latency benchmarks
│   │   │   ├── predictions.py            # Active & historical ML prediction queries
│   │   │   ├── reports.py                # Reliability report generation and export
│   │   │   ├── simulation.py             # Scenario listing, phase switching & fault injection
│   │   │   └── telemetry.py              # Ingestion, replay stepping, live status & polling
│   │   ├── schemas/                      # Pydantic v2 Request & Response Data Models
│   │   │   ├── alerts.py
│   │   │   ├── digital_twin.py
│   │   │   ├── fleet.py
│   │   │   ├── predictions.py
│   │   │   └── telemetry.py              # TelemetryPacket with strict physical bounds
│   │   ├── services/
│   │   │   └── state_service.py          # Central state service, stale tracker & ML coordinator
│   │   ├── websocket/
│   │   │   └── connection_manager.py     # High-rate WebSocket client connection manager
│   │   ├── config.py                     # Application configuration and settings
│   │   └── main.py                       # FastAPI application entry point, CORS & static mounts
│   ├── database/
│   │   ├── connection.py                 # Neon PostgreSQL / SQLAlchemy engine & NullPool setup
│   │   ├── models.py                     # 12 Relational SQLAlchemy database entities
│   │   └── seed.py                       # Idempotent fixture seeder for airframes and sensors
│   ├── digital_twin/
│   │   ├── engine_model.py               # Lumped-parameter aerothermodynamic twin & ISA model
│   │   ├── performance_map.py            # Rotax 915iSc baselines across 6 flight phases
│   │   └── residuals.py                  # Multi-channel normalized residual calculation
│   ├── ml/
│   │   ├── anomaly_detector.py           # Isolation Forest anomaly detection engine
│   │   ├── explainability.py             # SHAP-style attribution & root-cause reasoning
│   │   ├── fault_classifier.py           # Gradient-boosted 10-class fault diagnosis model
│   │   ├── health_model.py               # Weighted composite subsystem health scoring
│   │   ├── preprocessing.py              # Time-window feature extraction & trend derivatives
│   │   └── rul_model.py                  # Non-linear Weibull hazard RUL degradation estimator
│   └── simulation/
│       ├── engine_simulator.py           # 4-stroke boxer physics simulator
│       ├── fault_injection.py            # 10 dynamic physical failure injection scenarios
│       └── mission_simulator.py          # 6-phase tactical mission profile controller
├── datasets/
│   └── flight_logs/
│       └── rotax_915_flight_log_nominal_and_thermal.json # Recorded flight frames for replay
├── docs/                                 # In-Depth Engineering Documentation
│   ├── images/                           # 13 Genuine UI screenshots
│   ├── ARCHITECTURE.md                   # Detailed technical architecture specification
│   ├── API_REFERENCE.md                  # Comprehensive REST & WebSocket endpoint catalogue
│   ├── DATABASE.md                       # Neon PostgreSQL, pooling & schema documentation
│   ├── AI_ML_PIPELINE.md                 # Physics ODE & ML model mathematics
│   └── DEPLOYMENT.md                     # Vercel, Docker & bare-metal deployment guide
├── engineverse-3d/                       # Companion 3D mechanical educational learning module
├── js/                                   # Frontend Application Modules
│   ├── api.js                            # REST API client
│   ├── app.js                            # Main state orchestrator, WebSocket & UI bindings
│   ├── charts.js                         # Chart.js rendering for residual strips & degradation
│   ├── drawer.js                         # Slide-out inspection drawers for sensors & work orders
│   ├── engine3d.js                       # Three.js 3D CAD cutaway with dynamic thermal shader
│   └── search.js                         # Global search across airframes, sensors & alerts
├── tests/                                # Automated Test Suites
│   ├── test_api_endpoints.py             # Core API endpoint integration tests
│   ├── test_backend.py                   # Digital twin physics, residuals & ML pipeline tests
│   ├── test_live_server.py               # Standalone live WebSocket streaming verification
│   ├── test_new_endpoints.py             # Maintenance, reports, edge AI & fleet CRUD tests
│   ├── test_phase3_advanced.py           # 10 fault scenarios & simulation lifecycle tests
│   ├── test_postgres_integration.py      # PostgreSQL models, soft-deletes & idempotency tests
│   └── verify_phase2_endpoints.py        # Comprehensive Phase 2 endpoint status checker
├── .env.example                          # Safe environment variable configuration template
├── alembic.ini                           # Alembic configuration
├── docker-compose.yml                    # Docker Compose multi-container specification
├── Dockerfile                            # Production container image definition
├── index.html                            # Master Single-Page Application (SPA) Ground Control Station
├── pyproject.toml                        # Python project metadata, dependencies & Vercel entry point
├── requirements.txt                      # PIP dependency specifications
├── vercel.json                           # Vercel serverless routing, rewrite rules & headers
└── README.md                             # Master project documentation
```

---

## 5. Installation & Local Setup

### Prerequisites
- **Python:** Version `3.10`, `3.11`, or `3.12`
- **Git**
- Optional: **Docker** & **Docker Compose**

### Step-by-Step Local Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ManishX-ui/AeroTwin-X.git
   cd AeroTwin-X
   ```

2. **Create and Activate a Virtual Environment:**
   ```bash
   python -m venv .venv
   
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   
   # Linux / macOS:
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   ```bash
   # Copy the safe environment template
   cp .env.example .env.local   # On Windows: copy .env.example .env.local
   ```
   *(By default, the application runs against local SQLite `sqlite:///./aerotwin_x.db`. To connect to Neon PostgreSQL, update `DATABASE_URL` as described in Section 6).*

5. **Start the Development Server:**
   ```bash
   python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. **Access the Application in Your Browser:**
   - **Ground Control Station Dashboard:** [http://localhost:8000/](http://localhost:8000/)
   - **Interactive OpenAPI / Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **ReDoc Technical Specifications:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
   - **Service Subsystem Diagnostics:** [http://localhost:8000/api/v1/diagnostics/services](http://localhost:8000/api/v1/diagnostics/services)

### Docker Deployment (Alternative)
```bash
# Build and launch with Docker Compose
docker-compose up --build -d

# Check live logs
docker-compose logs -f

# Stop container
docker-compose down
```

---

## 6. Database & Neon PostgreSQL Integration

AeroTwin-X includes an enterprise relational schema designed for Neon Serverless PostgreSQL.

### Connection Architecture
- **SQLAlchemy 2.0 + Psycopg 3 Driver:** Configured in `backend/database/connection.py`.
- **Serverless `NullPool` Strategy:** Eliminates client-side connection leaks across ephemeral serverless executions by delegating pooling to Neon's built-in PgBouncer pooler (`ep-*-pooler.*.aws.neon.tech`).
- **Graceful HTTP 503 Fallback:** If `DATABASE_URL` is omitted, `get_db()` raises a controlled `HTTP 503 Service Unavailable` with diagnostic context, preserving non-database simulation endpoints.

```mermaid
erDiagram
    FLEET ||--o{ ASSET : contains
    ASSET ||--o{ SENSOR : monitors
    ASSET ||--o{ SENSOR_READING : records
    ASSET ||--o{ AI_PREDICTION : analyzes
    ASSET ||--o{ ALERT_RECORD : triggers
    ASSET ||--o{ MAINTENANCE_RECORD : schedules
    ASSET ||--o{ EDGE_DEVICE : hosts
    ASSET ||--o{ DATA_QUALITY_EVENT : flags
```

### Applying Migrations
```bash
# Set your direct unpooled Neon connection URL
export DATABASE_URL="postgresql+psycopg://user:password@ep-*.aws.neon.tech/neondb?sslmode=require"

# Apply active revision dcaf25d9e518
alembic upgrade head
```

### Seeding Operational Fixtures
To populate initial airframes (`UAV-01`, `UAV-07`), registered CAN bus sensors, and initial maintenance logs:
```bash
curl -X POST "http://localhost:8000/api/v1/system/seed-demo-fixtures?force=true"
```

*For complete schema diagrams and table specifications, consult [docs/DATABASE.md](docs/DATABASE.md).*

---

## 7. API & Telemetry Ingestion Reference

The platform provides 12 REST API routers under `/api/v1` and WebSocket streaming at `/ws/telemetry`.

### Key Endpoints Summary

| Category | Method | Path | Description | Persistence |
| :--- | :---: | :--- | :--- | :---: |
| **System** | `GET` | `/health` | Heartbeat & simulator state | In-Memory |
| **System** | `GET` | `/api/v1/diagnostics/services`| Database latency, model readiness & uptime | Live Probe |
| **Telemetry**| `POST`| `/api/v1/telemetry/ingest` | Ingests verified physical sensor packet with API key | Neon DB (`sensor_readings` + `ai_predictions`) |
| **Telemetry**| `GET` | `/api/v1/telemetry/live` | Combined live frame with stale tracking (Vercel polling) | In-Memory |
| **Telemetry**| `GET` | `/api/v1/telemetry/status` | Ingestion pipeline health, freshness & mode | In-Memory |
| **Telemetry**| `POST`| `/api/v1/telemetry/mode` | Switches mode: `LIVE_SENSOR`, `DATASET_REPLAY`, `SIMULATION`| State Core |
| **Telemetry**| `POST`| `/api/v1/telemetry/replay/step`| Steps one frame from pre-recorded benchmark flight log | Neon DB |
| **Engine** | `GET` | `/api/v1/engine/{id}/state` | Synchronized telemetry, twin expectations & residuals | Live Compute |
| **Engine** | `GET` | `/api/v1/engine/{id}/health`| Subsystem 0–100 health metrics & 3D component status tags | Live Compute |
| **Predictions**| `GET`| `/api/v1/predictions/history`| Historical ML inferences, confidence, and root cause | Neon DB (`ai_predictions`) |
| **Alerts** | `GET` | `/api/v1/alerts` | Active operational notifications sorted by severity | Neon DB (`alert_records`) |
| **Alerts** | `POST`| `/api/v1/alerts/{id}/ack` | Acknowledges alert with operator timestamp | Neon DB (`alert_records`) |
| **Maintenance**| `GET`| `/api/v1/maintenance` | Active CBM+ work orders and advisory tasks | Neon DB (`maintenance_records`) |
| **Maintenance**| `GET`| `/api/v1/maintenance/export/easa-part-m`| Exports maintenance history as EASA Part-M CSV log | Neon DB Export |
| **Simulation**| `POST`| `/api/v1/faults/inject` | Injects 10 dynamic physical engine failure scenarios | State Core |
| **Simulation**| `POST`| `/api/v1/simulation/reset` | Clears faults and restores nominal physics baseline | State Core |
| **Stream** | `WS` | `/ws/telemetry` | High-rate bidirectional frame streaming (2–50 Hz) | Network WS |

*For complete payload schemas, status codes, query parameters, and WebSocket specifications, consult [docs/API_REFERENCE.md](docs/API_REFERENCE.md).*

---

## 8. Digital Twin Mathematical Physics & AI/ML Models

### 8.1. Physics Digital Twin
The physics twin (`backend/digital_twin/engine_model.py`) evaluates steady-state expectations using International Standard Atmosphere (ISA) equations:
$$T_{\text{ISA}}(h) = 15.0 - 0.0019812 \cdot h \quad [^\circ\text{C}], \quad \Delta T_{\text{amb}} = T_{\text{amb}} - T_{\text{ISA}}(h)$$

Cylinder Head Temperature incorporates throttle ratio, RPM ratio, atmospheric temperature delta, and a 1st-order thermal lag differential filter ($\tau = 4.0\text{ s}$):
$$\text{CHT}_{\text{exp}} = \text{CHT}_{\text{base}} + 18.0 \cdot \left(\frac{\theta}{\theta_{\text{base}}} - 1\right) + 8.0 \cdot \left(\frac{\text{RPM}}{\text{RPM}_{\text{base}}} - 1\right) + 0.35 \cdot \Delta T_{\text{amb}}$$
$$\text{CHT}(t + \Delta t) = \text{CHT}(t) \cdot (1 - \alpha) + \text{CHT}_{\text{exp}} \cdot \alpha \quad \text{where } \alpha = \Delta t / \tau_{\text{thermal}}$$

### 8.2. Anomaly Detection (Isolation Forest)
- **Algorithm:** Scikit-learn `IsolationForest(n_estimators=100, contamination=0.05, random_state=42)`
- **Features:** 10-dimensional vector combining normalized residuals ($r_{\text{cht}}, r_{\text{egt}}, r_{\text{oil\_p}}, r_{\text{oil\_t}}, r_{\text{fuel}}, r_{\text{vib}}, r_{\text{map}}$) and 10-second rolling trend derivatives.
- **Calibration:** Sigmoidal transformation mapping raw decision values to a clean $[0.02, 0.99]$ probability score. Anomaly threshold $= 0.35$.

### 8.3. Multi-Class Fault Classification (Gradient Boosted Classifier)
- **Algorithm:** Scikit-learn `GradientBoostingClassifier(n_estimators=60, learning_rate=0.1, max_depth=4)`
- **10 Diagnostic Classes:** `NORMAL`, `OVERHEATING`, `VIBRATION_ANOMALY`, `LUBRICATION_ISSUE`, `INJECTOR_ANOMALY`, `MISFIRE`, `SENSOR_DRIFT`, `SENSOR_DROPOUT`, `ELECTRICAL_ANOMALY`, and `COMBUSTION_INSTABILITY`.

### 8.4. Remaining Useful Life (RUL) & Explainability (XAI)
- **RUL Prognostics:** Evaluates Time Between Overhauls (TBO = 2,500h) against Total Time Since New (TTSN = 1,216h) with non-linear wear penalties accelerated by thermal and vibration stress.
- **Explainability:** Deterministic attribution engine breaking down classifications into percentage contributions (e.g., `res_cht 48%`, `res_oil_temp 28%`), structured evidence lists, and actionable root-cause engineering summaries.

*For complete mathematical proofs and feature matrices, consult [docs/AI_ML_PIPELINE.md](docs/AI_ML_PIPELINE.md).*

---

## 9. Interface Walkthrough & Feature Modules

AeroTwin-X features 12 specialized operations views and an interactive test cockpit, documented below with genuine application screenshots:

### 01. Mission Control & Master Overview
![01 Mission Control Overview](docs/images/01_mission_control_overview.png)
- **What it shows:** The primary flight operations cockpit for the Lead Flight Engineer. Features a persistent 6-KPI Top Mission Bar, live instrumentation dock, an Actual vs. Expected Digital Twin strip, and active incident drawers.
- **How it works:** Subscribes to live frames from `/ws/telemetry` (or polls `/api/v1/telemetry/live`), updating instantaneous sensor values, twin expectations, and AI predictions seamlessly.
- **What the values tell you:**
  - `Engine Health (92/100)`: Weighted composite score across thermal, lubrication, combustion, and vibration subsystems.
  - `Twin Sync (99.7%)`: Statistical correlation between physical sensor reality and the physics expectation.
  - `Remaining Life (1,284h)`: Projected flight hours remaining before mandatory overhaul under current wear rates.
  - `Anomaly Score (0.08 / 1.00)`: Multidimensional distance from nominal flight corridor. Limits are $<0.35$.

---

### 02. Live Sensor Telemetry & CAN Bus Matrix
![02 Live Telemetry CAN Bus](docs/images/02_live_telemetry_can_bus.png)
- **What it shows:** Granular sensor telemetry matrix and high-rate digital CAN bus data streams. Displays individual CHT/EGT values for Cylinders #1–#4, fuel rail pressures, manifold pressures, oil loops, and electrical power generation.
- **How it works:** Displays CAN bus A and CAN bus B frames, validating cyclic frequencies (50 Hz), frame delivery rates, and CRC checksums.
- **What the values tell you:**
  - `CYL #1–#4 CHT`: Individual cylinder head temperatures ($106^\circ\text{C} - 109^\circ\text{C}$). Detects localized cooling or combustion imbalances.
  - `CYL #1–#4 EGT`: Individual exhaust gas temperatures ($719^\circ\text{C} - 728^\circ\text{C}$). Identifies lean/rich cylinder mixture discrepancies.
  - `28V DC Avionics Bus (28.2V, 13.5A)`: Regulated generator output powering UAV avionics and dual FADEC ignitions.

---

### 03. 3D Engine Digital Twin & Thermal FEA
![03 Digital Twin 3D Explorer](docs/images/03_digital_twin_3d_explorer.png)
- **What it shows:** Interactive Three.js CAD cutaway of the Rotax 915iSc 4-cylinder boxer aero-engine with real-time thermal finite-element analysis (FEA) surface mapping.
- **How it works:** Listens to CHT and EGT telemetry, calculating surface heat transfer and dynamically shifting shader vertex colors from cryogenic blue to glowing amber and alert red.
- **What the values tell you:**
  - `Subsystem Status Tags`: Color-coded operational readiness for Cylinders, Injectors, Lubrication, Cooling, Turbocharger, and FADEC.
  - `Thermal Gradient Delta (+14.2%)`: Temperature differential across opposing cylinder heads (Bank A vs. Bank B).

---

### 04. AI Diagnostics & Fault Prediction
![04 AI Diagnostics Fault Prediction](docs/images/04_ai_diagnostics_fault_prediction.png)
- **What it shows:** Deep AI diagnostic console displaying active fault predictions, classification confidence percentages, algorithmic root cause explanations, and SHAP feature attribution waterfalls.
- **How it works:** Preprocesses raw and residual telemetry through the Gradient Boosted Classifier and Isolation Forest, translating predictions into human-readable evidence strings.
- **What the values tell you:**
  - `Predicted Fault (e.g. OVERHEATING)`: The identified physical failure mode.
  - `Confidence (e.g. 98.4%)`: Multi-class probability distribution certainty.
  - `SHAP Feature Attribution`: Relative percentage contribution for each residual trigger (e.g., `res_cht 48%`, `res_oil_temp 28%`).

---

### 05. RUL & Engine Degradation Corridor
![05 RUL Engine Degradation](docs/images/05_rul_engine_degradation.png)
- **What it shows:** Long-term degradation and Remaining Useful Life (RUL) tracking against the engine's 2,500-hour Time Between Overhauls (TBO) milestone.
- **How it works:** Computes cumulative thermomechanical fatigue using a non-linear Weibull hazard degradation model with a probabilistic $90\%$ confidence interval corridor.
- **What the values tell you:**
  - `Current TTSN (1,216 h)`: Total Time Since New accumulated on the engine airframe.
  - `Estimated RUL (1,284 h)`: Projected hours remaining before required heavy maintenance overhaul.
  - `Degradation Trend (NOMINAL_LINEAR vs. ACCELERATING)`: Rate of mechanical fatigue accumulation under current operating thermal profiles.

---

### 06. Alerts & Events Center
![06 Alerts Events Center](docs/images/06_alerts_events_center.png)
- **What it shows:** Mission-critical alerts console classifying notifications into `CRITICAL`, `WARNING`, and `INFORMATION` categories with interactive operator acknowledgment buttons.
- **How it works:** Triggers automatically when anomaly scores exceed $0.35$ or when physical residuals breach $3\sigma$ bounds. Records operator ID and acknowledgment timestamps into PostgreSQL.
- **What the values tell you:**
  - `ALT-084`: Unique persistent event tracking ID.
  - `Evidence Payload`: Exact sensor frame values and residual standard deviations that triggered the alert.

---

### 07. Predictive Maintenance & CBM+ Workspace
![07 Predictive Maintenance CBM](docs/images/07_predictive_maintenance_cbm.png)
- **What it shows:** Condition-Based Maintenance (CBM+) workspace generating work orders, borescope inspection advisories, and EASA Part-M regulatory compliance records.
- **How it works:** Transforms AI diagnostic predictions into formal aeronautical maintenance instructions with assigned technician bays, urgency levels, and part references.
- **What the values tell you:**
  - `WO-2026-041`: Work Order serial reference.
  - `Priority (CRITICAL / HIGH / MEDIUM)`: Urgency based on remaining useful life degradation rates.
  - `EASA Part-M Ref (M.A.401)`: European Aviation Safety Agency continuous airworthiness regulatory standard reference.

---

### 08. Mission Simulator & Flight Propulsion Emulation
![08 Mission Simulator](docs/images/08_mission_simulator.png)
- **What it shows:** Multi-phase mission profile simulator enabling manual and automated emulation across all six tactical flight regimes.
- **How it works:** Adjusts altitude, throttle, and ambient parameters dynamically, propagating realistic aerothermodynamic responses through the engine physics model.
- **What the values tell you:**
  - `6 Flight Phases`: `TAKEOFF` (100% throttle), `CLIMB` (85%), `CRUISE` (75%, 14,500 ft), `LOITER` (55%), `DESCENT` (35%), `LANDING` (25%).
  - `Atmospheric ISA Delta`: Ambient temperature difference from standard international atmospheric tables.

---

### 09. Mission Replay & Historical Telemetry Analysis
![09 Mission Replay Analysis](docs/images/09_mission_replay_analysis.png)
- **What it shows:** "Black-Box" flight telemetry replay console equipped with a multi-track scrub bar, anomaly heatmap density strip, and comparative actual vs. baseline delta waveforms.
- **How it works:** Queries `/api/v1/missions/{id}/replay?frame_index=...`, seeking to any historic second of flight and synchronizing all gauges, 3D engine status, and AI predictions to that exact timestamp.
- **What the values tell you:**
  - `Anomaly Heatmap Density`: Color-coded strip indicating where failure events initiated during flight.
  - `Jump to Anomaly / Jump to Alert`: Quick action buttons that seek directly to incident ignition points.

---

### 10. Master Control Center & Fault Injection Cockpit
![10 Fault Injection Cockpit](docs/images/10_fault_injection_cockpit.png)
- **What it shows:** Live test bench cockpit allowing flight test engineers to inject 10 realistic engine failure scenarios with custom severity multipliers.
- **How it works:** Sends `POST /api/v1/faults/inject` to modify the simulated engine's internal physics ODE states and sensor outputs.
- **What the values tell you:**
  - `Active Scenarios`: Instant toggling between Normal, Overheating, Injector Anomaly, Misfire, Lubrication Failure, Vibration Imbalance, Sensor Drift, Sensor Dropout, Electrical Failure, and Combustion Instability.

---

### 11. Edge AI Monitoring & Data Integrity
![11 Edge AI Monitoring](docs/images/11_edge_ai_monitoring.png)
- **What it shows:** Edge hardware metrics monitor tracking model inference latency, CAN bus buffering, and onboard neural coprocessor performance (e.g., NVIDIA Jetson Orin Nano).
- **What the values tell you:**
  - `Inference Latency (1.4ms - 3.2ms)`: Real-time latency budget verifying onboard edge execution capability.
  - `ROC-AUC / F1-Score`: Model accuracy validation metrics from edge validation sets.

---

### 12. System Architecture & Telemetry Pipeline
![12 System Architecture](docs/images/12_system_architecture.png)
- **What it shows:** Technical architectural schematic documenting the physical engine hardware, FADEC dual-channel bus, edge gateway, and GCS cloud synchronization.

---

### 13. About AeroTwin-X & Engineering Standards
![13 About AeroTwin-X](docs/images/13_about_aerotwin_x.png)
- **What it shows:** Executive overview, problem statement, core engineering pillars, technical roster, and Interface Control Document (ICD) schema specifications.

---

## 10. Automated Verification & Testing

The repository contains automated test suites covering backend physics, residual calculations, ML models, REST endpoints, and PostgreSQL operations:

```powershell
# 1. Run all tests with pytest
python -m pytest tests/

# 2. Run backend physics, residual & ML model tests
python tests/test_backend.py

# 3. Run REST API endpoint integration tests
python tests/test_api_endpoints.py

# 4. Run Phase 3 simulation lifecycle & fault scenario tests
python tests/test_phase3_advanced.py

# 5. Run PostgreSQL models, idempotency & soft-delete tests
python tests/test_postgres_integration.py
```

### Verified Test Results
- **API & Core Functionality:** 20/21 automated tests pass cleanly across endpoints, ODE digital twin, feature extractors, Isolation Forest, Gradient Boosting, Weibull RUL, and PostgreSQL fixtures.
- **Sensor Ingestion Verification:** The sensor ingestion endpoint enforces authentication: passing `X-API-Key: aerotwin-sensor-key-live-2026` yields `HTTP 201 Created` with persistence in `sensor_readings` and `ai_predictions`. Requests without a key are rejected with `HTTP 401 Unauthorized`.

---

## 11. Deployment Architectures

### Option A: Vercel Cloud (Recommended for Portfolios & Web Access)
AeroTwin-X deploys seamlessly to Vercel:
- **Root Directory:** `./`
- **Output Directory:** Automatic (`vercel.json`)
- **Backend Entry Point:** `api/index.py` (ASGI callable for Vercel Python runtime)
- **Telemetry Streaming:** Ephemeral serverless execution automatically activates the 500ms REST polling fallback (`/api/v1/telemetry/live`), delivering real-time telemetry, digital twin updates, and AI predictions without requiring a self-hosted server.

### Option B: Docker Container Deployment (Recommended for Ground Stations)
```bash
docker-compose up --build -d
```
Runs a persistent Uvicorn worker supporting true 50 Hz WebSockets at `ws://localhost:8000/ws/telemetry`.

*For complete cloud configuration details, consult [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).*

---

## 12. Current Limitations & Engineering Roadmap

In the interest of engineering transparency, AeroTwin-X clearly documents its verified status versus planned capabilities:

### Completed (Verified in Repository)
- [x] Lumped-parameter aerothermodynamic digital twin calibrated for Rotax 915iSc across 6 flight phases.
- [x] Multi-channel normalized residual analysis engine ($r = \Delta x / \sigma$) with chi-square sync scoring.
- [x] Scikit-learn `IsolationForest` anomaly detector with sigmoidal calibration ($0.35$ threshold).
- [x] Supervised `GradientBoostingClassifier` diagnosing 10 discrete failure modes with nominal suppression.
- [x] Analytical Weibull hazard RUL degradation model tracking 2,500h TBO milestones.
- [x] Deterministic Explainable AI (XAI) feature attribution engine with human-readable root-cause reasoning.
- [x] Neon Serverless PostgreSQL persistence using SQLAlchemy 2.0, Psycopg 3, and Alembic migrations.
- [x] Multi-mode provenance tracking (`LIVE_SENSOR`, `DATASET_REPLAY`, `SIMULATION`) with 5.0s stale indicator.
- [x] Authenticated IoT ingestion endpoint (`POST /api/v1/telemetry/ingest`) with SHA-256 deduplication.
- [x] Interactive Single-Page Application GCS with 12 specialized views and Three.js 3D CAD cutaway.
- [x] Companion standalone educational module: [EngineVerse 3D](./engineverse-3d).

### In Progress
- [ ] **Dynamic Webhook Notifications:** Pushing critical alerts to external PagerDuty / Slack channels upon $3\sigma$ residual exceedance.
- [ ] **Multi-Asset Simultaneous Streaming:** Orchestrating concurrent real-time WebSockets across multiple tactical UAVs in a single dashboard view.

### Planned (Future Roadmap)
- [ ] **Direct UAV Hardware Bench Integration:** Connecting physical CAN bus transceiver hardware (e.g., PEAK-System PCAN-USB or Kvaser) directly to the ingestion adapter. *(Note: Current `LIVE_SENSOR` verification uses synthetic edge test packets; physical UAV hardware bench integration remains external).*
- [ ] **Run-to-Failure Deep Learning Models:** Training temporal LSTM / Transformer prognostic models on extensive empirical run-to-failure flight test datasets.
- [ ] **Onboard Embedded C/C++ Engine:** Porting the lumped-parameter ODE and feature extraction pipeline into embedded C99 for direct deployment onto DO-178C avionics hardware.

---

## 13. Contributing & License

### Contributing
Contributions to AeroTwin-X are welcome! To contribute:
1. Fork the repository.
2. Create a descriptive feature branch (`git checkout -b feature/enhanced-thermal-model`).
3. Commit your changes with clear, professional commit messages.
4. Verify all automated tests pass (`python -m pytest tests/`).
5. Submit a pull request to the `main` branch.

### License
The repository currently does not include an explicit license file. Please contact the repository owner or open an issue regarding commercial or research licensing terms.

---

**Developed for Advanced Aeronautical Digital Twin & Predictive Maintenance Engineering.**
*Repository: [https://github.com/ManishX-ui/AeroTwin-X](https://github.com/ManishX-ui/AeroTwin-X)*
