"""Missions and Replay API Endpoints."""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from ..services.state_service import state_service

router = APIRouter()

@router.get("/missions")
async def list_missions():
    """List available simulated missions."""
    return [
        {
            "id": "MSN-ISR-0814",
            "name": "Ghost Hawk Tactical Reconnaissance",
            "uav_id": "UAV-01",
            "engine_id": "AE-03",
            "status": "ACTIVE",
            "phase": state_service.simulator.mission.phase,
            "flight_ceiling_ft": 14500,
            "total_recorded_frames": len(state_service.telemetry_history)
        },
        {
            "id": "MSN-MAR-0720",
            "name": "Coastal Maritime Sector Patrol",
            "uav_id": "UAV-02",
            "engine_id": "AE-04",
            "status": "COMPLETED",
            "phase": "LANDING",
            "flight_ceiling_ft": 8500,
            "total_recorded_frames": 420
        }
    ]

@router.post("/missions")
async def create_mission(mission_data: Dict[str, Any]):
    """Configure or restart mission simulation profile."""
    name = mission_data.get("name", "New ISR Mission")
    state_service.simulator.mission.phase = "CRUISE"
    return {"status": "CREATED", "mission_id": "MSN-ISR-0814", "name": name}

@router.get("/missions/{mission_id}/replay")
async def get_mission_replay(
    mission_id: str,
    time_offset: Optional[float] = Query(None, description="Time index offset in seconds"),
    frame_index: Optional[int] = Query(None, description="Direct frame index to seek")
):
    """Retrieve full mission telemetry timeline for scrubbing or specific frame state."""
    frames = list(state_service.telemetry_history)
    total_frames = len(frames)

    if total_frames == 0:
        # If no history yet, generate dummy baseline snapshot
        p, m = state_service.simulator.generate_step(0.1)
        return {
            "mission_id": mission_id,
            "total_frames": 1,
            "frame": {
                "telemetry": p.model_dump(),
                "twin": state_service.latest_twin.model_dump() if state_service.latest_twin else {},
                "prediction": state_service.latest_prediction.model_dump() if state_service.latest_prediction else {}
            }
        }

    if frame_index is not None:
        idx = max(0, min(total_frames - 1, frame_index))
        return {
            "mission_id": mission_id,
            "total_frames": total_frames,
            "seek_index": idx,
            "frame": frames[idx]
        }

    # Return summary timeline tracks (for drawing the scrubber heatmap)
    timeline_summary = []
    step_skip = max(1, total_frames // 60)
    for i in range(0, total_frames, step_skip):
        f = frames[i]
        pred = f.get("prediction", {})
        anom = pred.get("anomaly", {})
        timeline_summary.append({
            "frame_index": i,
            "timestamp": f.get("telemetry", {}).get("timestamp", ""),
            "anomaly_score": anom.get("anomaly_score", 0.08),
            "predicted_fault": pred.get("fault", {}).get("fault", "NORMAL"),
            "health_index": pred.get("health", {}).get("engine_health", 95.0),
            "mission_phase": f.get("telemetry", {}).get("mission_phase", "CRUISE")
        })

    return {
        "mission_id": mission_id,
        "total_frames": total_frames,
        "timeline_tracks": timeline_summary,
        "latest_frame": frames[-1]
    }
