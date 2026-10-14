# AeroTwin-X: Database Architecture & Neon PostgreSQL Integration

This document outlines the database architecture, connection pooling strategies, relational schema, and data persistence guarantees for **AeroTwin-X**.

---

## 1. Relational Architecture & Hosting

AeroTwin-X uses **PostgreSQL** as its enterprise time-series and metadata persistence layer, hosted on **Neon Serverless PostgreSQL** (AWS `us-east-2` region).

```mermaid
erDiagram
    FLEET ||--o{ ASSET : "contains"
    ASSET ||--o{ SENSOR : "monitors"
    ASSET ||--o{ SENSOR_READING : "records"
    SENSOR ||--o{ SENSOR_READING : "captures"
    ASSET ||--o{ AI_PREDICTION : "analyzes"
    ASSET ||--o{ ALERT_RECORD : "triggers"
    ASSET ||--o{ MAINTENANCE_RECORD : "schedules"
    ASSET ||--o{ EDGE_DEVICE : "hosts"
    ASSET ||--o{ DATA_QUALITY_EVENT : "flags"

    FLEET {
        string id PK
        string name
        string organization
        string base_station
        boolean is_active
        boolean is_deleted
        datetime created_at
    }

    ASSET {
        string id PK "e.g. UAV-01, UAV-07"
        string fleet_id FK
        string tail_number
        string callsign
        string engine_model
        float health_index
        string operational_status
        float flight_hours_ttsn
        boolean is_deleted
    }

    SENSOR {
        string id PK "e.g. UAV-01-RPM"
        string asset_id FK
        string sensor_code "RPM, CHT, EGT, etc."
        string unit "RPM, degC, bar, etc."
        float nominal_min
        float nominal_max
        string status "HEALTHY, STALE, DRIFTING"
    }

    SENSOR_READING {
        bigint id PK
        string asset_id FK
        string sensor_id FK
        datetime timestamp "Source measurement timestamp"
        string sensor_code
        float reading_value
        string unit
        string quality_flag "VALID, DEGRADED, DROPOUT"
        string idempotency_hash "SHA-256 deduplication"
        datetime created_at "Server ingestion timestamp"
    }

    AI_PREDICTION {
        string id PK "e.g. PRED-..."
        string asset_id FK
        string engine_id
        datetime timestamp
        string model_identifier
        string model_version
        string predicted_class "NORMAL, OVERHEATING, etc."
        float confidence
        float anomaly_score
        float health_index
        float rul_hours
        text supporting_features "JSON feature vector"
        text root_cause_explanation
        float latency_ms
    }

    ALERT_RECORD {
        string id PK "e.g. ALT-..."
        string asset_id FK
        string severity "CRITICAL, WARNING, INFO"
        string title
        text description
        text evidence
        boolean acknowledged
        datetime acknowledged_at
    }

    MAINTENANCE_RECORD {
        string id PK "e.g. TSK-..."
        string asset_id FK
        string task_order UK
        string title
        string subsystem
        string priority "CRITICAL, HIGH, MEDIUM, LOW"
        string status "OPEN, IN_PROGRESS, CLOSED"
        string easa_part_m_ref
    }
```

---

## 2. Connection Lifecycle & Serverless Pooling Strategy

AeroTwin-X uses **SQLAlchemy 2.0** with the modern **Psycopg 3** driver (`psycopg[binary]>=3.1.0`).

### The Serverless Connection Challenge
In serverless environments (such as Vercel Functions or AWS Lambda), container instances spin up and down dynamically. Using standard client-side connection pools (e.g., `QueuePool` with 20 persistent connections) quickly exhausts database socket limits, as dozens of ephemeral workers attempt to hold open idle connections.

### The Solution: Serverless `NullPool` + Neon PgBouncer
1. **Application Layer (`backend/database/connection.py`)**:
   - The SQLAlchemy engine is configured with `poolclass=NullPool`.
   - Connections are opened on demand when a database session is needed and closed immediately upon completion of the request.
2. **Neon Infrastructure Layer**:
   - Connection strings point to Neon's built-in **PgBouncer connection pooler** (`ep-*-pooler.*.aws.neon.tech`).
   - Neon transparently maintains pooled backend sockets to PostgreSQL, serving thousands of serverless requests without connection spikes or socket leaks.
3. **Local Development Fallback**:
   - If `DATABASE_URL` is omitted, the system falls back to a local SQLite database (`sqlite:///./aerotwin_x.db`), allowing full local testing without requiring external credentials.
4. **Controlled HTTP 503 Handling**:
   - If database operations fail or `DATABASE_URL` is unconfigured, the `get_db()` dependency raises a clean `HTTP 503 Service Unavailable` with diagnostic instructions, ensuring non-database endpoints (such as physics simulation and health checks) remain fully operational.

---

## 3. Database Migration Management with Alembic

Database migrations are tracked using Alembic. 

- **Active Migration Revision:** `dcaf25d9e518` (`initial_neon_relational_schema`)
- **Location:** `alembic/versions/dcaf25d9e518_initial_neon_relational_schema.py`

### Running Migrations
To apply schema updates to Neon PostgreSQL:

```bash
# Set unpooled direct connection URL for DDL migrations
export DATABASE_URL="postgresql+psycopg://USER:PASSWORD@ep-damp-boat-b4lt8bu9.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Execute migration
alembic upgrade head
```

> **Important:** DDL schema migrations (such as `CREATE TABLE` and `ALTER TABLE`) should be executed against Neon's **direct unpooled endpoint** (`DATABASE_URL_UNPOOLED`) rather than through the PgBouncer pooler, as transaction pooling can restrict certain transactional DDL locks.

---

## 4. Idempotency & Time-Series Data Integrity

High-frequency sensor telemetry streams frequently suffer from network retries, packet duplication, and out-of-order delivery.

### SHA-256 Deduplication Hash
When a telemetry frame is received at `/api/v1/telemetry/ingest`, an idempotency hash is computed across key fields:

$$\text{hash} = \text{SHA-256}(\text{asset\_id} + \text{timestamp} + \text{RPM} + \text{CHT} + \text{EGT})$$

Before inserting new rows into `sensor_readings`, the database checks for an existing record with identical `idempotency_hash`. If found:
- The duplicate observation is safely discarded.
- The API responds with `HTTP 200 OK` and `"status": "DUPLICATE_IGNORED"`.
- Zero duplicate rows are created.

### Dual Timestamp Tracking
AeroTwin-X records two independent timestamps for every observation:
1. `timestamp`: The exact measurement time recorded by the airborne sensor or FADEC clock.
2. `created_at`: The server ingestion time recorded when the packet was verified by FastAPI.

This distinction ensures flight test analysts can accurately identify telemetry transit latency, telemetry transmission dropouts, and ground station buffering delays.
