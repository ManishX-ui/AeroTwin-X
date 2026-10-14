# AeroTwin-X: Complete REST & WebSocket API Reference

The AeroTwin-X backend exposes a modular REST API prefixed with `/api/v1` along with high-rate WebSocket streaming at `/ws/telemetry`. All schemas are validated at runtime with Pydantic.

Interactive API documentation is automatically served at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## Table of Contents
1. [Authentication & Security](#1-authentication--security)
2. [System Health & Diagnostics](#2-system-health--diagnostics)
3. [Telemetry & IoT Sensor Ingestion](#3-telemetry--iot-sensor-ingestion)
4. [Engine Digital Twin & State](#4-engine-digital-twin--state)
5. [AI Diagnostics & Predictions](#5-ai-diagnostics--predictions)
6. [Alerts & Events Management](#6-alerts--events-management)
7. [Predictive Maintenance (CBM+)](#7-predictive-maintenance-cbm)
8. [Fleet & Asset Management](#8-fleet--asset-management)
9. [Sensor Data Quality](#9-sensor-data-quality)
10. [Edge AI Hardware Monitoring](#10-edge-ai-hardware-monitoring)
11. [Missions & Replay](#11-missions--replay)
12. [Flight Simulator & Fault Injection](#12-flight-simulator--fault-injection)
13. [Reports & Compliance Export](#13-reports--compliance-export)
14. [Real-Time WebSocket Specification](#14-real-time-websocket-specification)

---

## 1. Authentication & Security

IoT sensor telemetry ingestion endpoints require authentication via an API key.

| Header Name | Format | Description |
| :--- | :--- | :--- |
| `X-API-Key` | `<key>` | Direct API key matching `AEROTWIN_INGEST_API_KEY` (Default: `aerotwin-sensor-key-live-2026`). |
| `Authorization` | `Bearer <key>` | Standard Bearer token authentication containing the ingestion API key. |

Requests without a valid key receive `HTTP 401 Unauthorized`:
```json
{
  "detail": "Unauthorized: Invalid or missing telemetry ingestion API key. Provide valid X-API-Key or Bearer token."
}
```

---

## 2. System Health & Diagnostics

### `GET /health` | `GET /api/v1/health`
Basic service liveness and operational heartbeat.

- **Response:** `200 OK`
```json
{
  "status": "HEALTHY",
  "service": "AeroTwin-X",
  "version": "1.0.0",
  "mode": "SIMULATION",
  "active_mission": "MSN-ISR-0814",
  "flight_phase": "CRUISE",
  "telemetry_hz": 2.0,
  "is_simulator_running": true,
  "active_fault": "NORMAL",
  "active_connections": 1
}
```

### `GET /api/v1/diagnostics/services`
Subsystem connectivity, database latency, and AI/ML model readiness.

- **Response:** `200 OK`
```json
{
  "timestamp": "2026-10-14T12:00:00.000000Z",
  "overall_status": "OPTIMAL",
  "services": {
    "fastapi_backend": { "status": "CONNECTED", "version": "1.0.0", "environment": "Production Vercel / Cloud" },
    "database": { "name": "Neon Serverless PostgreSQL", "status": "CONNECTED", "latency_ms": 18.4, "pool": "Serverless NullPool" },
    "websocket_telemetry": { "status": "CONNECTED", "active_clients": 1, "endpoint": "/ws/telemetry" },
    "digital_twin": { "name": "Aero-Piston ODE Digital Twin", "status": "RUNNING", "tolerance_deg_c": 1.2 },
    "anomaly_detector": { "name": "Isolation Forest Anomaly Detector", "status": "READY", "threshold": 0.35 },
    "fault_classifier": { "name": "Propulsion Fault Classifier", "status": "READY", "supported_classes": 10 }
  }
}
```

---

## 3. Telemetry & IoT Sensor Ingestion

### `POST /api/v1/telemetry/ingest`
Ingests a verified physical sensor frame into PostgreSQL, executes the digital twin and ML diagnostic pipeline, and persists the resulting AI prediction.

- **Headers:** `X-API-Key: aerotwin-sensor-key-live-2026`
- **Request Body (`TelemetryPacket`):**
```json
{
  "timestamp": "2026-10-14T12:00:00Z",
  "uav_id": "UAV-01",
  "engine_id": "AE-03",
  "rpm": 2552.0,
  "cht": 108.4,
  "cht_cylinders": [108.0, 108.8, 107.9, 108.5],
  "egt": 726.0,
  "egt_cylinders": [724.0, 728.5, 725.0, 726.5],
  "oil_pressure": 4.22,
  "oil_temperature": 88.4,
  "fuel_flow": 18.2,
  "vibration": 1.15,
  "battery_voltage": 28.2,
  "alternator_current": 13.0,
  "throttle_pos": 75.0,
  "manifold_pressure": 31.4,
  "ambient_temp": 14.5,
  "pressure_altitude": 14500.0,
  "mission_phase": "CRUISE",
  "quality": "VALID"
}
```
- **Responses:**
  - `201 Created`: Observation persisted in `sensor_readings`, prediction committed to `ai_predictions`.
  - `200 OK`: Duplicate packet detected (idempotent ignore, returns existing reading ID).
  - `401 Unauthorized`: Missing or invalid API key.
  - `404 Not Found`: Asset identifier not registered in database.
  - `422 Unprocessable Entity`: Numeric field outside physical bounds (e.g., CHT $> 250^\circ\text{C}$, RPM $> 7500$).

### `GET /api/v1/telemetry/live`
Retrieves the most recent combined state frame (telemetry, twin, and predictions) with source mode and stale indicators. Used as a high-reliability polling fallback on serverless hosts.

### `GET /api/v1/telemetry/status`
Returns ingestion pipeline freshness, current source mode, and seconds since the last live packet.

### `POST /api/v1/telemetry/mode`
Switches the active telemetry data source.
- **Request Body:** `{"mode": "LIVE_SENSOR" | "DATASET_REPLAY" | "SIMULATION"}`

### `POST /api/v1/telemetry/replay/step`
Steps one frame forward from the pre-recorded benchmark flight log (`datasets/flight_logs/rotax_915_flight_log_nominal_and_thermal.json`) and triggers full pipeline execution.

---

## 4. Engine Digital Twin & State

### `GET /api/v1/engine/{id}/state`
Returns the synchronized state combining actual telemetry, physics expectations, and residual deviations.

### `GET /api/v1/engine/{id}/health`
Returns composite 0–100 health metrics and individual 3D CAD component tags (`cylinders`, `lubrication`, `cooling`, `combustion`, `gearbox_vibration`, `electrical`).

---

## 5. AI Diagnostics & Predictions

### `GET /api/v1/predictions`
Returns the active prediction summary from the latest processed frame.

### `GET /api/v1/predictions/history`
Queries historical ML inferences stored in Neon PostgreSQL.
- **Query Parameters:**
  - `asset_id` (string, optional): Filter by UAV ID (e.g., `UAV-01`).
  - `predicted_class` (string, optional): Filter by fault class (e.g., `OVERHEATING`, `NORMAL`).
  - `limit` (integer, default: 50): Page limit (1–500).

---

## 6. Alerts & Events Management

### `GET /api/v1/alerts`
Lists registered operational alerts sorted by severity (`CRITICAL`, `WARNING`, `INFORMATION`).

### `POST /api/v1/alerts/{id}/ack`
Acknowledges an alert by ID, recording operator timestamp and status into PostgreSQL.

---

## 7. Predictive Maintenance (CBM+)

### `GET /api/v1/maintenance`
Lists active Condition-Based Maintenance work orders and advisory tasks.

### `POST /api/v1/maintenance`
Creates a new maintenance work order.
- **Payload:** `title`, `subsystem`, `priority`, `advisory_text`, `assigned_tech`, `easa_part_m_ref`.

### `PUT /api/v1/maintenance/{id}`
Updates priority, advisory text, or subsystem details.

### `POST /api/v1/maintenance/{id}/status`
Transitions work order status (`OPEN` → `IN_PROGRESS` → `CLOSED`).

### `GET /api/v1/maintenance/export/easa-part-m`
Exports all maintenance work orders as an EASA Part-M compliant CSV log.

---

## 8. Fleet & Asset Management

### `GET /api/v1/fleet/fleets`
Lists tactical UAV squadrons and fleet groupings.

### `GET /api/v1/fleet/assets`
Lists registered UAV airframes, engine models, operational statuses, and current flight hours.

### `GET /api/v1/fleet/assets/{id}`
Retrieves detailed asset metadata, base station, pilot in command, and health index.

### `GET /api/v1/fleet/assets/{id}/sensors`
Lists all registered telemetry sensors for a specific airframe (e.g., `UAV-01-RPM`, `UAV-01-CHT`).

### `GET /api/v1/fleet/assets/{id}/readings`
Queries historical time-series sensor readings from `sensor_readings` in Neon PostgreSQL.
- **Query Parameters:** `sensor_code` (e.g. `RPM`, `CHT`), `limit` (default: 50).

---

## 9. Sensor Data Quality

### `GET /api/v1/data-quality/sensors`
Returns data quality scores ($0–100\%$), noise sigmas, and channel statuses (`HEALTHY`, `STALE`, `DRIFTING`).

### `GET /api/v1/data-quality/sensors/{id}/compare`
Returns side-by-side time-series comparison of raw observations versus digital twin validated values.

### `GET /api/v1/data-quality/incidents`
Lists data quality incidents (e.g. `SPIKE_DETECTED`, `STALE_DATA`).

### `POST /api/v1/data-quality/incidents/{id}/resolve`
Marks a data quality incident as resolved with resolution notes.

---

## 10. Edge AI Hardware Monitoring

### `GET /api/v1/edge/devices`
Lists onboard neural edge compute nodes (e.g., NVIDIA Jetson Orin Nano).

### `GET /api/v1/edge/devices/{id}`
Returns real-time edge CPU utilization, memory consumption, inference latency, and thermal state.

### `PUT /api/v1/edge/devices/{id}/config`
Updates edge operating configuration (telemetry frequency, inference batch size, anomaly threshold).

---

## 11. Missions & Replay

### `GET /api/v1/missions`
Lists registered mission flight profiles.

### `GET /api/v1/missions/{id}/replay`
Retrieves mission telemetry tracks or seeks to a specific timestamp frame (`?frame_index=142`).

---

## 12. Flight Simulator & Fault Injection

### `GET /api/v1/simulation/scenarios`
Lists all 10 available fault injection scenarios (`NORMAL`, `OVERHEATING`, `INJECTOR_ANOMALY`, `MISFIRE`, `LUBRICATION_ISSUE`, `ABNORMAL_VIBRATION`, `SENSOR_DRIFT`, `SENSOR_DROPOUT`, `ELECTRICAL_FAULT`, `COMBUSTION_INSTABILITY`).

### `POST /api/v1/faults/inject`
Injects dynamic physical faults into the simulated engine.
- **Payload:** `{"fault_type": "OVERHEATING", "severity": 1.3}`

### `POST /api/v1/simulation/reset`
Restores simulator to nominal steady-state baseline.

### `POST /api/v1/simulation/phase`
Transitions mission phase (`TAKEOFF`, `CLIMB`, `CRUISE`, `LOITER`, `DESCENT`, `LANDING`).

---

## 13. Reports & Compliance Export

### `GET /api/v1/reports`
Lists generated fleet intelligence reports.

### `POST /api/v1/reports/generate`
Triggers generation of a new CBM reliability, propulsion health, or regulatory audit report.

### `GET /api/v1/reports/{id}/download`
Downloads report artifact formatted as JSON or CSV.

---

## 14. Real-Time WebSocket Specification

- **Endpoint:** `ws://localhost:8000/ws/telemetry`
- **Output Frame Structure:**
```json
{
  "type": "TELEMETRY_FRAME",
  "source_mode": "LIVE_SENSOR",
  "is_stale": false,
  "telemetry": {
    "timestamp": "2026-10-14T12:00:00Z",
    "uav_id": "UAV-01",
    "engine_id": "AE-03",
    "rpm": 2550.0,
    "cht": 108.2,
    "egt": 725.5,
    "oil_pressure": 4.22,
    "oil_temperature": 88.0,
    "fuel_flow": 18.2,
    "vibration": 1.15,
    "manifold_pressure": 31.4,
    "quality": "VALID"
  },
  "twin": {
    "twin_sync_percent": 99.4,
    "channels": {
      "cht": { "actual": 108.2, "expected": 107.5, "residual": 0.7, "unit": "°C", "status": "NORMAL" },
      "oil_pressure": { "actual": 4.22, "expected": 4.18, "residual": 0.04, "unit": "bar", "status": "NORMAL" }
    }
  },
  "prediction": {
    "timestamp": "2026-10-14T12:00:00Z",
    "anomaly": { "anomaly_score": 0.08, "anomaly_status": "NORMAL", "is_anomaly": false, "threshold": 0.35 },
    "fault": { "fault": "NORMAL", "confidence": 0.98 },
    "health": { "engine_health": 95.0 },
    "rul": { "rul_hours": 1284.0, "degradation_trend": "NOMINAL_LINEAR" }
  },
  "mission": {
    "phase": "CRUISE",
    "engine_id": "AE-03",
    "uav_id": "UAV-01"
  }
}
```

- **Client Control Commands:** Clients can send JSON commands over the WebSocket to control simulation states:
  - `{"action": "INJECT_FAULT", "fault": "OVERHEATING", "severity": 1.2}`
  - `{"action": "RESET"}`
  - `{"action": "SET_PHASE", "phase": "LOITER"}`
