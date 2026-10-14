"""Central State and Pipeline Coordination Service.

Coordinates:
- Sensor Ingestion & Provenance Tracking (LIVE_SENSOR, DATASET_REPLAY, SIMULATION)
- Digital Twin Physics State Estimation & Residual Calculation
- Multi-Model AI/ML Pipeline (Anomaly Detection, Fault Classification, Health, RUL, Explainability)
- Time-series persistence into PostgreSQL (AIPredictionRecord)
- WebSocket distribution & live polling fallback
"""
import asyncio
import datetime
import uuid
import json
import logging
import os
from collections import deque
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..config import settings
from ..websocket.connection_manager import manager
from ...simulation.engine_simulator import EngineSimulator
from ...digital_twin.engine_model import AeroPistonDigitalTwin
from ...digital_twin.residuals import ResidualAnalyzer
from ...ml.preprocessing import FeatureExtractor
from ...ml.anomaly_detector import AnomalyDetector
from ...ml.fault_classifier import FaultClassifier
from ...ml.health_model import HealthModel
from ...ml.rul_model import RULModel
from ...ml.explainability import ExplainabilityEngine
from ..schemas.telemetry import TelemetryPacket
from ..schemas.digital_twin import DigitalTwinState
from ..schemas.predictions import AIPredictionSummary
from ..schemas.alerts import AlertItem, MaintenanceTask
from ...database.connection import SessionLocal
from ...database.models import (
    TelemetryRecord, PredictionRecord, AlertRecord, MaintenanceRecord, MissionRecord, ModelRegistryRecord, AIPredictionRecord
)

logger = logging.getLogger("aerotwin.state")

class AeroTwinStateService:
    def __init__(self):
        # Simulation & Physics Engines
        self.simulator = EngineSimulator()
        self.twin = AeroPistonDigitalTwin()
        self.residual_analyzer = ResidualAnalyzer()

        # AI/ML Engines
        self.feature_extractor = FeatureExtractor(window_size=12)
        self.anomaly_detector = AnomalyDetector(threshold=0.35)
        self.fault_classifier = FaultClassifier()
        self.health_model = HealthModel()
        self.rul_model = RULModel()
        self.explainability = ExplainabilityEngine()

        # Telemetry Source Modes: LIVE_SENSOR, DATASET_REPLAY, SIMULATION
        self.current_source_mode: str = "SIMULATION"
        self.last_live_sensor_received_at: Optional[datetime.datetime] = None
        self.is_stale: bool = False
        self.replay_index: int = 0
        self.replay_dataset: List[Dict[str, Any]] = self._load_replay_dataset()

        # In-Memory Cache & Circular Buffer for fast replay
        self.telemetry_history: deque = deque(maxlen=600)  # ~5-10 minutes history
        self.alerts: List[AlertItem] = []
        self.maintenance_tasks: List[MaintenanceTask] = []

        # Current Snapshots
        self.latest_telemetry: Optional[TelemetryPacket] = None
        self.latest_twin: Optional[DigitalTwinState] = None
        self.latest_prediction: Optional[AIPredictionSummary] = None

        self.is_loop_running: bool = False
        self._seed_initial_records()

    def _load_replay_dataset(self) -> List[Dict[str, Any]]:
        """Load nominal and fault transition benchmark flight dataset."""
        possible_paths = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../datasets/flight_logs/rotax_915_flight_log_nominal_and_thermal.json")),
            os.path.abspath("datasets/flight_logs/rotax_915_flight_log_nominal_and_thermal.json")
        ]
        for p in possible_paths:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        logger.info(f"Loaded {len(data)} benchmark frames for DATASET_REPLAY from {p}")
                        return data
                except Exception as e:
                    logger.warning(f"Failed to parse replay dataset {p}: {e}")
        return []

    def set_source_mode(self, mode: str) -> str:
        """Switch active telemetry source mode."""
        clean_mode = mode.strip().upper()
        if clean_mode not in ["LIVE_SENSOR", "DATASET_REPLAY", "SIMULATION"]:
            clean_mode = "SIMULATION"
        
        self.current_source_mode = clean_mode
        if clean_mode == "LIVE_SENSOR":
            self.is_stale = False
        elif clean_mode == "DATASET_REPLAY":
            self.replay_index = 0
            self.is_stale = False
        
        logger.info(f"Telemetry source mode switched to: {clean_mode}")
        return self.current_source_mode

    def _seed_initial_records(self):
        """Seed initial alerts, maintenance tasks, and model records."""
        iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.alerts = [
            AlertItem(
                id="ALT-084",
                timestamp=iso_now,
                engine_id="AE-03",
                severity="INFORMATION",
                title="Telemetry Link Synchronized",
                description="CAN Bus A/B primary differential link established at 50 Hz.",
                evidence=["FADEC node ACK received", "Zero CRC frame drops across 1000 cycles"],
                acknowledged=True
            )
        ]

        self.maintenance_tasks = [
            MaintenanceTask(
                id="TSK-401",
                task_order="WO-2026-041",
                title="Borescope Inspection — Cyl #1 - #4 Valves",
                subsystem="Thermal & Combustion",
                priority="MEDIUM",
                advisory_text="Perform optical borescope inspection of exhaust valve seats at next turnaround.",
                evidence_triggers=["CBM+ predictive schedule trigger", "TTSN 1,216 flight hours milestone"],
                status="OPEN",
                created_at=iso_now,
                assigned_tech="Powertrain Bay 2",
                easa_part_m_ref="M.A.401 / SB-915-021"
            )
        ]

    def process_telemetry_frame(
        self,
        packet: TelemetryPacket,
        source_override: Optional[str] = None,
        persist_to_db: bool = False,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """Unified processing pipeline:
        1. Validated measurement packet
        2. ODE Physics Digital Twin estimation
        3. Residual analysis
        4. Time-series feature extraction
        5. AI/ML Inference (Isolation Forest, GradientBoosting, Health, Weibull RUL, Explainability)
        6. Optional PostgreSQL persistence for AI predictions
        7. In-memory caching and real-time WebSocket distribution
        """
        source = source_override or packet.source or self.current_source_mode
        self.current_source_mode = source
        packet.source = source

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        if source == "LIVE_SENSOR":
            self.last_live_sensor_received_at = now_utc
            self.is_stale = False

        telemetry_dict = packet.model_dump()

        # 1. Digital Twin Physics estimation
        expected_dict = self.twin.compute_expected_state(
            rpm=packet.rpm,
            throttle_pct=packet.throttle_pos,
            altitude_ft=packet.pressure_altitude,
            ambient_temp_c=packet.ambient_temp,
            mission_phase=packet.mission_phase,
            dt_seconds=0.1
        )

        # 2. Residual calculation
        twin_state = self.residual_analyzer.compute_residuals(
            actual_telemetry=telemetry_dict,
            expected_telemetry=expected_dict,
            timestamp=packet.timestamp
        )

        # 3. Feature Extraction
        features = self.feature_extractor.extract_features(
            telemetry=telemetry_dict,
            residuals=twin_state.model_dump()
        )

        # 4. AI / ML Inference
        anomaly_pred = self.anomaly_detector.predict(features)
        fault_pred = self.fault_classifier.predict(features)
        health_pred = self.health_model.compute_health(features, anomaly_pred.anomaly_score)
        rul_pred = self.rul_model.estimate_rul(
            health_score=health_pred.engine_health,
            fault_type=fault_pred.fault,
            anomaly_score=anomaly_pred.anomaly_score
        )
        evidence, attributions, root_cause = self.explainability.explain(
            fault_type=fault_pred.fault,
            features=features
        )

        prediction_summary = AIPredictionSummary(
            timestamp=packet.timestamp,
            anomaly=anomaly_pred,
            fault=fault_pred,
            health=health_pred,
            rul=rul_pred,
            evidence=evidence,
            feature_attributions=attributions,
            root_cause_explanation=root_cause
        )

        # 5. Persist Prediction to Neon PostgreSQL when requested
        pred_record_id = None
        if persist_to_db and db:
            try:
                try:
                    ts = datetime.datetime.fromisoformat(packet.timestamp.replace("Z", "+00:00"))
                except Exception:
                    ts = now_utc

                pred_record_id = f"PRED-{uuid.uuid4().hex[:8].upper()}"
                confidence_val = float(fault_pred.confidence * 100.0) if fault_pred.confidence <= 1.0 else float(fault_pred.confidence)

                pred_record = AIPredictionRecord(
                    id=pred_record_id,
                    asset_id=packet.uav_id,
                    engine_id=packet.engine_id,
                    timestamp=ts,
                    model_identifier="AEROTWIN_X_ENSEMBLE",
                    model_version="v2.1-aerotwin",
                    predicted_class=fault_pred.fault,
                    confidence=confidence_val,
                    anomaly_score=float(anomaly_pred.anomaly_score),
                    health_index=float(health_pred.engine_health),
                    rul_hours=float(rul_pred.rul_hours),
                    supporting_features=json.dumps(features),
                    root_cause_explanation=root_cause,
                    latency_ms=1.5,
                    created_at=now_utc
                )
                db.add(pred_record)
                db.commit()
            except Exception as pe:
                logger.error(f"Failed to persist AI prediction: {pe}", exc_info=True)
                db.rollback()

        # 6. Alert & Maintenance Generation Trigger
        if anomaly_pred.is_anomaly and fault_pred.fault != "NORMAL":
            severity = "CRITICAL" if anomaly_pred.anomaly_score > 0.6 else "WARNING"
            existing_open = [a for a in self.alerts if a.title == f"Fault Detected: {fault_pred.fault}" and not a.acknowledged]
            if not existing_open:
                new_alert = AlertItem(
                    id=f"ALT-{len(self.alerts) + 85}",
                    timestamp=packet.timestamp,
                    engine_id=packet.engine_id,
                    severity=severity,
                    title=f"Fault Detected: {fault_pred.fault}",
                    description=root_cause,
                    evidence=evidence,
                    acknowledged=False
                )
                self.alerts.insert(0, new_alert)

                new_task = MaintenanceTask(
                    id=f"TSK-{len(self.maintenance_tasks) + 402}",
                    task_order=f"WO-2026-{len(self.maintenance_tasks) + 42:03d}",
                    title=f"AI Advisory: {fault_pred.fault.replace('_', ' ').title()}",
                    subsystem="Propulsion & Thermal" if "OVERHEATING" in fault_pred.fault else "Lubrication / Mechanical",
                    priority="CRITICAL" if severity == "CRITICAL" else "HIGH",
                    advisory_text=f"Inspect related subsystems immediately. {root_cause}",
                    evidence_triggers=evidence,
                    status="OPEN",
                    created_at=packet.timestamp,
                    assigned_tech="Rapid Response Bay",
                    easa_part_m_ref="EASA Part-M / Emergency Advisory"
                )
                self.maintenance_tasks.insert(0, new_task)

        # 7. Store latest in memory
        self.latest_telemetry = packet
        self.latest_twin = twin_state
        self.latest_prediction = prediction_summary

        combined_frame = {
            "type": "TELEMETRY_FRAME",
            "source_mode": self.current_source_mode,
            "is_stale": False,
            "telemetry": telemetry_dict,
            "twin": twin_state.model_dump(),
            "prediction": prediction_summary.model_dump(),
            "mission": {
                "phase": packet.mission_phase,
                "engine_id": packet.engine_id,
                "uav_id": packet.uav_id
            },
            "prediction_record_id": pred_record_id
        }

        self.telemetry_history.append(combined_frame)

        # 8. Non-blocking WebSocket broadcast if loop active
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast_json(combined_frame))
        except RuntimeError:
            pass

        return combined_frame

    def step_replay(self, persist_to_db: bool = False, db: Optional[Session] = None) -> Dict[str, Any]:
        """Step one frame from pre-recorded benchmark flight log."""
        if not self.replay_dataset:
            # Fallback packet if file missing
            iso_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            fallback_dict = {
                "timestamp": iso_now,
                "uav_id": "UAV-01",
                "engine_id": "AE-03",
                "rpm": 2550.0,
                "cht": 108.0,
                "egt": 725.0,
                "oil_pressure": 4.2,
                "oil_temperature": 88.0,
                "fuel_flow": 18.2,
                "vibration": 1.15,
                "battery_voltage": 28.2,
                "alternator_current": 12.8,
                "throttle_pos": 75.0,
                "mission_phase": "CRUISE",
                "quality": "VALID",
                "source": "DATASET_REPLAY",
                "is_synthetic": False
            }
            packet = TelemetryPacket(**fallback_dict)
        else:
            frame_data = dict(self.replay_dataset[self.replay_index % len(self.replay_dataset)])
            frame_data["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            frame_data["source"] = "DATASET_REPLAY"
            frame_data["is_synthetic"] = False
            self.replay_index += 1
            packet = TelemetryPacket(**frame_data)

        return self.process_telemetry_frame(
            packet=packet,
            source_override="DATASET_REPLAY",
            persist_to_db=persist_to_db,
            db=db
        )

    def get_live_frame(self) -> Dict[str, Any]:
        """Retrieve live state snapshot with stale tracking for HTTP polling / Vercel."""
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Check staleness if in LIVE_SENSOR mode
        if self.current_source_mode == "LIVE_SENSOR":
            if self.last_live_sensor_received_at is None or (now - self.last_live_sensor_received_at).total_seconds() > 5.0:
                self.is_stale = True

        if self.latest_telemetry and self.latest_twin and self.latest_prediction:
            t_dict = self.latest_telemetry.model_dump()
            if self.is_stale:
                t_dict["quality"] = "STALE"
            
            stale_sec = None
            if self.last_live_sensor_received_at:
                stale_sec = round((now - self.last_live_sensor_received_at).total_seconds(), 1)

            return {
                "type": "TELEMETRY_FRAME",
                "source_mode": self.current_source_mode,
                "is_stale": self.is_stale,
                "stale_duration_sec": stale_sec,
                "telemetry": t_dict,
                "twin": self.latest_twin.model_dump(),
                "prediction": self.latest_prediction.model_dump(),
                "mission": {
                    "phase": self.latest_telemetry.mission_phase,
                    "engine_id": self.latest_telemetry.engine_id,
                    "uav_id": self.latest_telemetry.uav_id,
                    "status": "STALE_SENSOR_DISCONNECTED" if self.is_stale else "ACTIVE"
                }
            }

        # If nothing generated yet, run one nominal simulation frame to initialize
        packet, m_ctx = self.simulator.generate_step(0.1)
        packet.source = self.current_source_mode
        return self.process_telemetry_frame(packet, source_override=self.current_source_mode, persist_to_db=False)

    async def start_streaming_loop(self):
        """Asynchronous continuous simulation and telemetry loop."""
        if self.is_loop_running:
            return
        self.is_loop_running = True
        logger.info("Starting AeroTwin-X real-time telemetry streaming loop...")

        dt = 1.0 / settings.TELEMETRY_HZ

        while self.is_loop_running:
            try:
                now = datetime.datetime.now(datetime.timezone.utc)

                if self.current_source_mode == "LIVE_SENSOR":
                    # In LIVE_SENSOR mode, DO NOT fabricate simulated numbers!
                    # Only check for sensor staleness and broadcast stale status if disconnected.
                    if self.last_live_sensor_received_at is None or (now - self.last_live_sensor_received_at).total_seconds() > 5.0:
                        self.is_stale = True
                        if self.latest_telemetry and self.latest_twin and self.latest_prediction:
                            stale_dict = self.latest_telemetry.model_dump()
                            stale_dict["quality"] = "STALE"
                            stale_frame = {
                                "type": "TELEMETRY_FRAME",
                                "source_mode": "LIVE_SENSOR",
                                "is_stale": True,
                                "stale_duration_sec": round((now - self.last_live_sensor_received_at).total_seconds(), 1) if self.last_live_sensor_received_at else None,
                                "telemetry": stale_dict,
                                "twin": self.latest_twin.model_dump(),
                                "prediction": self.latest_prediction.model_dump(),
                                "mission": {
                                    "phase": self.latest_telemetry.mission_phase,
                                    "status": "STALE_SENSOR_DISCONNECTED",
                                    "engine_id": self.latest_telemetry.engine_id,
                                    "uav_id": self.latest_telemetry.uav_id
                                }
                            }
                            await manager.broadcast_json(stale_frame)
                    await asyncio.sleep(dt)
                    continue

                elif self.current_source_mode == "DATASET_REPLAY":
                    # In DATASET_REPLAY mode, sleep between steps
                    await asyncio.sleep(dt)
                    continue

                else:
                    # SIMULATION mode: Step simulator
                    packet, m_ctx = self.simulator.generate_step(dt=dt)
                    packet.source = "SIMULATION"
                    packet.is_synthetic = True
                    self.process_telemetry_frame(packet, source_override="SIMULATION", persist_to_db=False)

            except Exception as e:
                logger.error(f"Error in telemetry loop: {e}", exc_info=True)

            await asyncio.sleep(dt)

    def inject_fault(self, fault_type: str, severity: float = 1.0):
        self.simulator.fault_injector.set_fault(fault_type, severity)
        logger.info(f"Injected fault: {fault_type} (severity: {severity})")

    def reset_nominal(self):
        self.simulator.fault_injector.reset()
        logger.info("Reset simulator to nominal baseline.")

    def set_mission_phase(self, phase: str):
        self.simulator.mission.set_phase(phase)

    def acknowledge_alert(self, alert_id: str) -> bool:
        for a in self.alerts:
            if a.id == alert_id:
                a.acknowledged = True
                return True
        return False

# Singleton instance
state_service = AeroTwinStateService()
