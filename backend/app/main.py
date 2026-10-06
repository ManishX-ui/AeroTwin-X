"""AeroTwin-X FastAPI Application Main Entry Point."""
import os
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.get("/")
async def serve_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>AeroTwin-X Backend API is Online. Frontend build in progress...</h1>")
