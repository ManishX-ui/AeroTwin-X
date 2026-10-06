"""Central State and Pipeline Coordination Service."""
import asyncio
import datetime
import uuid
import json
import logging
from collections import deque
from typing import Dict, Any, List, Optional

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
    TelemetryRecord, PredictionRecord, AlertRecord, MaintenanceRecord, MissionRecord, ModelRegistryRecord
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

        # In-Memory Cache & Circular Buffer for fast replay
        self.telemetry_history: deque = deque(maxlen=600) # ~5-10 minutes history
        self.alerts: List[AlertItem] = []
        self.maintenance_tasks: List[MaintenanceTask] = []

        # Current Snapshots
        self.latest_telemetry: Optional[TelemetryPacket] = None
        self.latest_twin: Optional[DigitalTwinState] = None
        self.latest_prediction: Optional[AIPredictionSummary] = None

        self.is_loop_running: bool = False
        self._seed_initial_records()

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

    async def start_streaming_loop(self):
        """Asynchronous continuous simulation and telemetry loop."""
        if self.is_loop_running:
            return
        self.is_loop_running = True
        logger.info("Starting AeroTwin-X real-time telemetry streaming loop...")

        dt = 1.0 / settings.TELEMETRY_HZ

        while self.is_loop_running:
            try:
                # 1. Step simulation
                packet, m_ctx = self.simulator.generate_step(dt=dt)
                telemetry_dict = packet.model_dump()

                # 2. Digital Twin Physics estimation
                expected_dict = self.twin.compute_expected_state(
                    rpm=packet.rpm,
                    throttle_pct=packet.throttle_pos,
                    altitude_ft=packet.pressure_altitude,
                    ambient_temp_c=packet.ambient_temp,
                    mission_phase=packet.mission_phase,
                    dt_seconds=dt
                )

                # 3. Residual calculation
                twin_state = self.residual_analyzer.compute_residuals(
                    actual_telemetry=telemetry_dict,
                    expected_telemetry=expected_dict,
                    timestamp=packet.timestamp
                )

                # 4. Feature Extraction
                features = self.feature_extractor.extract_features(
                    telemetry=telemetry_dict,
                    residuals=twin_state.model_dump()
                )

                # 5. AI / ML Anomaly Detection & Fault Classification
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

                        # Generate maintenance advisory
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
                    "telemetry": telemetry_dict,
                    "twin": twin_state.model_dump(),
                    "prediction": prediction_summary.model_dump(),
                    "mission": m_ctx
                }

                self.telemetry_history.append(combined_frame)

                # 8. Broadcast over WebSocket
                await manager.broadcast_json(combined_frame)

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
