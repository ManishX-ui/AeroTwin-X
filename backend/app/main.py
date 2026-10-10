"""AeroTwin-X FastAPI Application Main Entry Point."""
import os
import json
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from .config import settings
from .websocket.connection_manager import manager
from .services.state_service import state_service
from ..database.connection import engine, Base

# Import all API routers
from .api.telemetry import router as telemetry_router
from .api.engines import router as engines_router
from .api.predictions import router as predictions_router
from .api.alerts import router as alerts_router
from .api.missions import router as missions_router
from .api.simulation import router as simulation_router
from .api.maintenance import router as maintenance_router
from .api.models import router as models_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("aerotwin.main")

# Initialize database schema
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch background telemetry loop
    logger.info("Initializing AeroTwin-X background simulator & digital twin...")
    loop_task = asyncio.create_task(state_service.start_streaming_loop())
    yield
    # Shutdown
    state_service.is_loop_running = False
    loop_task.cancel()
    logger.info("AeroTwin-X background simulator terminated.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="AI-enabled Real-Time Digital Twin for Health Monitoring, Fault Prediction and Mission Reliability of Aero-Piston Engines for MALE UAVs.",
    lifespan=lifespan
)

import time
import datetime
from sqlalchemy import text

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "https://aero-twin-x.vercel.app",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(telemetry_router, prefix=settings.API_V1_STR, tags=["Telemetry"])
app.include_router(engines_router, prefix=settings.API_V1_STR, tags=["Engines"])
app.include_router(predictions_router, prefix=settings.API_V1_STR, tags=["Predictions"])
app.include_router(alerts_router, prefix=settings.API_V1_STR, tags=["Alerts"])
app.include_router(missions_router, prefix=settings.API_V1_STR, tags=["Missions"])
app.include_router(simulation_router, prefix=settings.API_V1_STR, tags=["Simulation"])
app.include_router(maintenance_router, prefix=settings.API_V1_STR, tags=["Maintenance"])
app.include_router(models_router, prefix=settings.API_V1_STR, tags=["Models"])

# System Health & Operational Status Endpoints
@app.get("/health", tags=["Status"])
@app.get(f"{settings.API_V1_STR}/health", tags=["Status"])
async def system_health_status():
    """System health check and operational status."""
    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "mode": state_service.simulator.mode,
        "active_mission": state_service.simulator.mission.mission_id,
        "flight_phase": state_service.simulator.mission.phase,
        "telemetry_hz": settings.TELEMETRY_HZ,
        "is_simulator_running": state_service.simulator.mission.is_running,
        "active_fault": state_service.simulator.fault_injector.active_fault,
        "active_connections": len(manager.active_connections)
    }

@app.get("/diagnostics/services", tags=["Diagnostics"])
@app.get(f"{settings.API_V1_STR}/diagnostics/services", tags=["Diagnostics"])
async def get_service_diagnostics():
    """Real-time connection and subsystem service health diagnostics."""
    # 1. Database check
    db_status = "CONNECTED"
    db_latency_ms = 0.0
    try:
        t0 = time.time()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
    except Exception as e:
        logger.warning(f"Database health check warning: {e}")
        db_status = "DEGRADED"

    # 2. Simulator state
    sim_running = state_service.simulator.mission.is_running if hasattr(state_service.simulator, "mission") else False
    sim_mode = state_service.simulator.mode if hasattr(state_service.simulator, "mode") else "SIMULATION"
    active_fault = state_service.simulator.fault_injector.active_fault if hasattr(state_service.simulator, "fault_injector") else "NORMAL"
    
    # 3. Model statuses
    last_inference_ts = state_service.latest_prediction.timestamp if state_service.latest_prediction else None

    services = {
        "fastapi_backend": {
            "name": "FastAPI Backend Gateway",
            "status": "CONNECTED",
            "version": settings.PROJECT_VERSION,
            "uptime_mode": "Active Uvicorn Worker",
            "environment": "Production Vercel / Cloud" if os.environ.get("VERCEL") else "Local / Dedicated Host"
        },
        "websocket_telemetry": {
            "name": "CAN Bus Telemetry WebSocket",
            "status": "CONNECTED" if len(manager.active_connections) > 0 else "IDLE",
            "active_clients": len(manager.active_connections),
            "frequency_hz": settings.TELEMETRY_HZ,
            "endpoint": "/ws/telemetry"
        },
        "database": {
            "name": "SQLite Core Operational DB",
            "status": db_status,
            "latency_ms": db_latency_ms,
            "pool": "SQLAlchemy ThreadSafe"
        },
        "digital_twin": {
            "name": "Aero-Piston ODE Digital Twin",
            "status": "RUNNING" if state_service.is_loop_running else "STOPPED",
            "model_type": "Aerothermodynamic Lumped Parameter (Euler/RK4)",
            "tolerance_deg_c": 1.2,
            "features_tracked": 8
        },
        "simulator": {
            "name": "Telemetry Flight Simulator",
            "status": "RUNNING" if sim_running else "STOPPED",
            "mode": sim_mode,
            "active_fault": active_fault,
            "mission_id": state_service.simulator.mission.mission_id,
            "phase": state_service.simulator.mission.phase
        },
        "anomaly_detector": {
            "name": "Isolation Forest Anomaly Detector",
            "status": "READY",
            "version": "v1.2-edge",
            "threshold": getattr(state_service.anomaly_detector, "threshold", 0.35),
            "last_inference": last_inference_ts
        },
        "fault_classifier": {
            "name": "Propulsion Fault Classifier",
            "status": "READY",
            "version": "v2.1-aerotwin",
            "supported_classes": 10,
            "last_inference": last_inference_ts
        },
        "health_estimator": {
            "name": "Subsystem Health Estimator",
            "status": "READY",
            "version": "v1.5-weibull",
            "last_inference": last_inference_ts
        },
        "rul_model": {
            "name": "Remaining Useful Life (RUL) Predictor",
            "status": "READY",
            "version": "v1.0-certified",
            "last_inference": last_inference_ts
        }
    }

    return {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "overall_status": "OPTIMAL" if db_status == "CONNECTED" else "DEGRADED",
        "services": services
    }

# WebSocket Endpoint
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive and receive optional client commands over WS
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "INJECT_FAULT":
                    state_service.inject_fault(msg.get("fault", "NORMAL"), msg.get("severity", 1.0))
                elif msg.get("action") == "RESET":
                    state_service.reset_nominal()
                elif msg.get("action") == "SET_PHASE":
                    state_service.set_mission_phase(msg.get("phase", "CRUISE"))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Frontend Static Files Mount
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    js_dir = os.path.join(frontend_dir, "js")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    css_dir = os.path.join(frontend_dir, "css")
    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")

@app.get("/")
async def serve_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>AeroTwin-X Backend API is Online. Frontend build in progress...</h1>")

@app.get("/favicon.ico")
async def serve_favicon():
    favicon_path = os.path.join(frontend_dir, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return FileResponse(os.path.join(frontend_dir, "assets", "logo.png"))
