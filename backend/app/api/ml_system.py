"""Machine Learning System, Training, Device Status, and Demo Generation Endpoints."""
import os
import uuid
import datetime
import threading
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, status, Depends
from pydantic import BaseModel, Field

from ...ml.inference import inference_service
from ...ml.train import train_models_from_splits, ARTIFACTS_DIR
from ...ml.demo_data_generator import DemoDataGenerator
from ..services.telemetry_service import telemetry_pipeline
from ..services.state_service import state_service

router = APIRouter()

# In-memory training jobs tracker
TRAINING_JOBS: Dict[str, Dict[str, Any]] = {}


class DemoGenerateRequest(BaseModel):
    duration_minutes: float = Field(20.0, ge=1.0, le=120.0, description="Duration in flight minutes (1 to 120)")
    seed: int = Field(42, ge=0, le=999999, description="Reproducible random seed")
    output_dir: str = Field("datasets", description="Output directory")


class DataSourceRequest(BaseModel):
    source: Optional[str] = Field(None, description="Target source: 'DEMO', 'LIVE_SENSOR', or 'SIMULATION'")
    mode: Optional[str] = Field(None, description="Alias for source")

    def get_source(self) -> str:
        raw = self.source or self.mode or "DEMO"
        return raw.strip().upper()



class TrainModelRequest(BaseModel):
    datasets_dir: str = Field("datasets", description="Directory containing training dataset splits")


def run_training_job_worker(job_id: str, datasets_dir: str):
    """Background worker executing model training and updating job status."""
    try:
        TRAINING_JOBS[job_id]["status"] = "RUNNING"
        res = train_models_from_splits(datasets_dir=datasets_dir, artifacts_dir=ARTIFACTS_DIR)
        # Reload active inference service artifacts
        inference_service.load_artifacts()

        TRAINING_JOBS[job_id]["status"] = "COMPLETED"
        TRAINING_JOBS[job_id]["completion_time"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        TRAINING_JOBS[job_id]["model_version"] = res["model_version"]
        TRAINING_JOBS[job_id]["evaluation_summary"] = {
            "accuracy": res["metrics"]["supervised_classification"]["accuracy"],
            "macro_f1": res["metrics"]["supervised_classification"]["macro_f1"],
            "anomaly_roc_auc": res["metrics"]["anomaly_detection"]["roc_auc"],
            "anomaly_f1": res["metrics"]["anomaly_detection"]["f1_score"]
        }
    except Exception as e:
        TRAINING_JOBS[job_id]["status"] = "FAILED"
        TRAINING_JOBS[job_id]["completion_time"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        TRAINING_JOBS[job_id]["error_details"] = str(e)


@router.get("/ml/status", tags=["Machine Learning"])
async def get_ml_model_status():
    """Retrieve active ML model runtime status, version, training timestamp, and feature schema."""
    return inference_service.get_status()


@router.get("/ml/metrics", tags=["Machine Learning"])
async def get_ml_metrics():
    """Retrieve saved model evaluation report calculated on held-out test data."""
    return inference_service.get_metrics()


@router.post("/ml/train", status_code=status.HTTP_202_ACCEPTED, tags=["Machine Learning"])
async def trigger_model_training(req: TrainModelRequest, background_tasks: BackgroundTasks):
    """Trigger a machine learning training job on configured sensor datasets."""
    job_id = f"JOB-TRAIN-{uuid.uuid4().hex[:8].upper()}"
    start_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

    TRAINING_JOBS[job_id] = {
        "job_id": job_id,
        "status": "QUEUED",
        "start_time": start_time,
        "completion_time": None,
        "model_version": None,
        "evaluation_summary": None,
        "error_details": None
    }

    # Execute in background thread so HTTP response is returned immediately
    background_tasks.add_task(run_training_job_worker, job_id, req.datasets_dir)

    return {
        "status": "ACCEPTED",
        "job_id": job_id,
        "message": f"Training job {job_id} scheduled successfully."
    }


@router.get("/ml/training-jobs/{job_id}", tags=["Machine Learning"])
async def get_training_job_status(job_id: str):
    """Retrieve status, duration, model version, and evaluation summary of a training job."""
    if job_id not in TRAINING_JOBS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training job '{job_id}' not found."
        )
    return TRAINING_JOBS[job_id]


@router.get("/ml/predictions/latest", tags=["Machine Learning"])
async def get_latest_ml_prediction():
    """Get latest ML prediction summary from the active trained model."""
    if state_service.latest_prediction:
        return state_service.latest_prediction.model_dump()
    if telemetry_pipeline.last_prediction:
        return telemetry_pipeline.last_prediction.model_dump()
    return {"status": "NO_PREDICTION_AVAILABLE", "message": "No telemetry readings have been processed yet."}


@router.get("/devices/status", tags=["Devices & Ingestion"])
async def get_devices_status(device_id: str = Query("ENGINE-001", description="Device ID")):
    """Get live hardware connection status, data freshness, and quality health."""
    return telemetry_pipeline.get_device_status(device_id)


@router.post("/demo/generate", tags=["Demo Mode"])
async def generate_demo_dataset(req: DemoGenerateRequest):
    """Generate realistic demo sensor data with documented normal and abnormal flight conditions."""
    generator = DemoDataGenerator(seed=req.seed)
    metadata = generator.generate_and_save_dataset_suite(
        output_dir=req.output_dir,
        duration_minutes=req.duration_minutes
    )
    return {
        "status": "SUCCESS",
        "message": f"Generated demo sensor dataset with {metadata['total_records']} observations.",
        "metadata": metadata
    }


@router.get("/system/data-source", tags=["System Mode"])
async def get_system_data_source():
    """Get current configured telemetry data source."""
    return {
        "mode": telemetry_pipeline.current_source_mode,
        "active_source": telemetry_pipeline.current_source_mode,
        "is_waiting_for_sensor": telemetry_pipeline.is_waiting_for_sensor,
        "last_received": telemetry_pipeline.last_live_sensor_received_at.isoformat() if telemetry_pipeline.last_live_sensor_received_at else None
    }


@router.post("/system/data-source", tags=["System Mode"])
async def set_system_data_source(req: DataSourceRequest):
    """Switch active data source: 'DEMO' or 'LIVE_SENSOR'."""
    clean_src = req.get_source()
    if clean_src not in ("DEMO", "LIVE_SENSOR", "SIMULATION"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid data source '{clean_src}'. Supported values: DEMO, LIVE_SENSOR, SIMULATION."
        )

    new_mode = telemetry_pipeline.set_source_mode(clean_src)
    state_service.set_source_mode(clean_src)

    return {
        "status": "SUCCESS",
        "current_mode": new_mode,
        "active_source": new_mode,
        "message": f"System telemetry source switched to {new_mode}."
    }

