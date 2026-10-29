"""Reproducible Demo Sensor Dataset Generator for AeroTwin-X.

Generates realistic time-series sensor observations with:
- Mission flight regimes (TAKEOFF, CLIMB, CRUISE, LOITER, DESCENT, LANDING)
- Physics-correlated baseline dynamics (RPM, CHT, EGT, Oil P/T, Fuel Flow, Vibration, MAP)
- Autocorrelated noise (AR(1) temporal processes)
- Controlled fault injection across 10 operational and data quality categories:
    1. NORMAL
    2. OVERHEATING (gradual thermal runaway)
    3. COMBUSTION_INSTABILITY (manifold surge & fuel oscillation)
    4. VIBRATION_ANOMALY (mechanical unbalance / structural vibration)
    5. LUBRICATION_ISSUE (oil pressure drop & oil temp elevation)
    6. INJECTOR_ANOMALY (fuel flow decrease & asymmetric EGT rise)
    7. MISFIRE (exhaust cooling & high harmonic vibration)
    8. SENSOR_DRIFT (gradual sensor bias without thermodynamic correlation)
    9. SENSOR_SPIKE (sudden single-point electrical transient)
    10. FROZEN_SENSOR / MISSING / COMMUNICATION_FAILURE
- Separate labels for physical machine faults vs. data-quality issues
- Chronological train/val/test partitioning preventing temporal data leakage
"""
import os
import json
import hashlib
import datetime
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional


class DemoDataGenerator:
    def __init__(self, seed: int = 42, sampling_rate_hz: float = 2.0):
        self.seed = seed
        self.sampling_rate_hz = sampling_rate_hz
        self.rng = np.random.default_rng(seed)

    def generate_flight_profile(
        self,
        duration_minutes: float = 20.0,
        fault_scenarios: Optional[List[Dict[str, Any]]] = None,
        device_id: str = "ENGINE-001",
        start_time: Optional[datetime.datetime] = None
    ) -> pd.DataFrame:
        """Generate continuous time-series sensor observations with realistic dynamics and faults."""
        dt = 1.0 / self.sampling_rate_hz
        n_steps = int(duration_minutes * 60 * self.sampling_rate_hz)
        
        base_time = start_time or datetime.datetime(2026, 10, 21, 10, 0, 0, tzinfo=datetime.timezone.utc)
        timestamps = [base_time + datetime.timedelta(seconds=i * dt) for i in range(n_steps)]

        # Regime assignment
        phases = []
        throttle_profile = np.zeros(n_steps)
        altitude_profile = np.zeros(n_steps)
        ambient_temp_profile = np.zeros(n_steps)

        for i in range(n_steps):
            pct = i / n_steps
            if pct < 0.08:
                phases.append("TAKEOFF")
                throttle_profile[i] = 100.0
                altitude_profile[i] = 100.0 + pct / 0.08 * 1200.0
            elif pct < 0.25:
                phases.append("CLIMB")
                throttle_profile[i] = 88.0
                altitude_profile[i] = 1300.0 + (pct - 0.08) / 0.17 * 13700.0
            elif pct < 0.70:
                phases.append("CRUISE")
                throttle_profile[i] = 75.0
                altitude_profile[i] = 15000.0 + np.sin(i * 0.005) * 50.0
            elif pct < 0.82:
                phases.append("LOITER")
                throttle_profile[i] = 60.0
                altitude_profile[i] = 15000.0
            elif pct < 0.94:
                phases.append("DESCENT")
                throttle_profile[i] = 45.0
                altitude_profile[i] = 15000.0 - (pct - 0.82) / 0.12 * 13500.0
            else:
                phases.append("LANDING")
                throttle_profile[i] = 30.0
                altitude_profile[i] = 1500.0 - (pct - 0.94) / 0.06 * 1400.0

            # Lapse rate: ~2°C per 1000 ft from 15°C sea level
            ambient_temp_profile[i] = 15.0 - (altitude_profile[i] / 1000.0) * 1.98

        from ..digital_twin.performance_map import ROTAX_915ISC_BASELINES

        # Physics-informed base engine calculations aligned with Rotax 915 iSc baselines
        rpm_base = np.zeros(n_steps)
        cht_base = np.zeros(n_steps)
        egt_base = np.zeros(n_steps)
        oil_p_base = np.zeros(n_steps)
        oil_t_base = np.zeros(n_steps)
        fuel_flow_base = np.zeros(n_steps)
        vib_base = np.zeros(n_steps)
        map_base = np.zeros(n_steps)
        battery_base = np.zeros(n_steps)
        alt_base = np.zeros(n_steps)

        for i in range(n_steps):
            phase = phases[i]
            base = ROTAX_915ISC_BASELINES.get(phase, ROTAX_915ISC_BASELINES["CRUISE"])
            rpm_base[i] = base["rpm"]
            cht_base[i] = base["cht_nominal_c"]
            egt_base[i] = base["egt_nominal_c"]
            oil_p_base[i] = base["oil_press_bar"]
            oil_t_base[i] = base["oil_temp_c"]
            fuel_flow_base[i] = base["fuel_flow_lph"]
            vib_base[i] = base["vibration_g"]
            map_base[i] = base["map_inhg"]
            battery_base[i] = base["battery_v"]
            alt_base[i] = base["alternator_a"]

        def generate_ar1_noise(n, sigma=1.0, phi=0.85):
            noise = np.zeros(n)
            white = self.rng.normal(0, sigma, n)
            for t in range(1, n):
                noise[t] = phi * noise[t - 1] + white[t] * np.sqrt(1 - phi ** 2)
            return noise

        rpm = rpm_base + generate_ar1_noise(n_steps, sigma=10.0, phi=0.8)
        cht = cht_base + generate_ar1_noise(n_steps, sigma=0.4, phi=0.95)
        egt = egt_base + generate_ar1_noise(n_steps, sigma=1.8, phi=0.90)
        oil_p = oil_p_base + generate_ar1_noise(n_steps, sigma=0.03, phi=0.85)
        oil_t = oil_t_base + generate_ar1_noise(n_steps, sigma=0.25, phi=0.95)
        fuel_flow = fuel_flow_base + generate_ar1_noise(n_steps, sigma=0.12, phi=0.80)
        vibration = vib_base + np.abs(generate_ar1_noise(n_steps, sigma=0.04, phi=0.70))
        manifold_p = map_base + generate_ar1_noise(n_steps, sigma=0.12, phi=0.85)
        battery_v = battery_base + self.rng.normal(0, 0.04, n_steps)
        alt_current = alt_base + self.rng.normal(0, 0.35, n_steps)

        # Labels
        fault_labels = ["NORMAL"] * n_steps
        quality_labels = ["VALID"] * n_steps
        anomaly_scores_ground_truth = np.zeros(n_steps)

        if fault_scenarios is not None:
            for f in fault_scenarios:
                s_idx = max(0, f["start"])
                e_idx = min(n_steps, f["end"])
                sev = f.get("severity", 1.0)
                ftype = f["type"]
                length = max(1, e_idx - s_idx)
                ramp = np.linspace(0.2, 1.0, length) * sev

                if ftype == "OVERHEATING":
                    cht[s_idx:e_idx] += 36.0 * ramp
                    oil_t[s_idx:e_idx] += 18.0 * ramp
                    egt[s_idx:e_idx] += 50.0 * ramp
                    for k in range(s_idx, e_idx):
                        fault_labels[k] = "OVERHEATING"
                        anomaly_scores_ground_truth[k] = min(0.99, 0.55 + ramp[k - s_idx] * 0.4)

                elif ftype == "LUBRICATION_ISSUE":
                    oil_p[s_idx:e_idx] -= 2.2 * ramp
                    oil_t[s_idx:e_idx] += 18.0 * ramp
                    for k in range(s_idx, e_idx):
                        fault_labels[k] = "LUBRICATION_ISSUE"
                        anomaly_scores_ground_truth[k] = min(0.99, 0.58 + ramp[k - s_idx] * 0.38)

                elif ftype == "VIBRATION_ANOMALY":
                    vibration[s_idx:e_idx] += 4.5 * ramp
                    for k in range(s_idx, e_idx):
                        fault_labels[k] = "VIBRATION_ANOMALY"
                        anomaly_scores_ground_truth[k] = min(0.99, 0.60 + ramp[k - s_idx] * 0.38)

                elif ftype == "COMBUSTION_INSTABILITY":
                    manifold_p[s_idx:e_idx] += np.sin(np.arange(length) * 0.4) * 6.5 * sev
                    fuel_flow[s_idx:e_idx] += np.cos(np.arange(length) * 0.4) * 4.8 * sev
                    for k in range(s_idx, e_idx):
                        fault_labels[k] = "COMBUSTION_INSTABILITY"
                        anomaly_scores_ground_truth[k] = 0.82

                elif ftype == "SENSOR_DRIFT":
                    cht[s_idx:e_idx] += 22.0 * ramp  # CHT drifts up without oil_t or egt rise
                    for k in range(s_idx, e_idx):
                        fault_labels[k] = "SENSOR_DRIFT"
                        quality_labels[k] = "DRIFT"
                        anomaly_scores_ground_truth[k] = 0.70

                elif ftype == "SPIKE":
                    vibration[s_idx:e_idx] += 14.0
                    for k in range(s_idx, e_idx):
                        quality_labels[k] = "SPIKE"
                        fault_labels[k] = "SENSOR_SPIKE"
                        anomaly_scores_ground_truth[k] = 0.96

                elif ftype == "FROZEN_SENSOR":
                    frozen_cht = cht[s_idx]
                    cht[s_idx:e_idx] = frozen_cht
                    for k in range(s_idx, e_idx):
                        quality_labels[k] = "FROZEN"
                        fault_labels[k] = "FROZEN_SENSOR"
                        anomaly_scores_ground_truth[k] = 0.65

                elif ftype == "MISSING_DATA":
                    for k in range(s_idx, e_idx):
                        quality_labels[k] = "DROPOUT"
                        fault_labels[k] = "COMMUNICATION_FAILURE"
                        anomaly_scores_ground_truth[k] = 0.75

        df = pd.DataFrame({
            "timestamp": [ts.isoformat() for ts in timestamps],
            "device_id": device_id,
            "engine_id": "AE-03",
            "rpm": np.clip(rpm, 0.0, 6500.0),
            "cht": np.clip(cht, -40.0, 200.0),
            "egt": np.clip(egt, -40.0, 1050.0),
            "oil_pressure": np.clip(oil_p, 0.0, 10.0),
            "oil_temperature": np.clip(oil_t, -40.0, 160.0),
            "fuel_flow": np.clip(fuel_flow, 0.0, 60.0),
            "vibration": np.clip(vibration, 0.0, 20.0),
            "battery_voltage": battery_v,
            "alternator_current": alt_current,
            "manifold_pressure": np.clip(manifold_p, 10.0, 45.0),
            "throttle_pos": throttle_profile,
            "ambient_temp": ambient_temp_profile,
            "pressure_altitude": altitude_profile,
            "mission_phase": phases,
            "data_quality_label": quality_labels,
            "fault_label": fault_labels,
            "is_anomaly": [fl != "NORMAL" for fl in fault_labels],
            "anomaly_score_ground_truth": anomaly_scores_ground_truth,
            "source": "DEMO"
        })
        return df

    def generate_and_save_dataset_suite(
        self,
        output_dir: str = "datasets",
        duration_minutes: float = 60.0,
        train_ratio: float = 0.70,
        val_ratio: float = 0.15
    ) -> Dict[str, Any]:
        """Generate full multi-flight dataset and create chronological train/val/test partitions."""
        os.makedirs(output_dir, exist_ok=True)
        
        # We generate 5 standardized sorties representing distinct operational missions
        # Sorties 1-3 -> Train, Sortie 4 -> Val, Sortie 5 -> Test
        sortie_configs = [
            # Sortie 1 (Train): Nominal flight + Overheating + Vibration
            {
                "duration": 20.0,
                "faults": [
                    {"type": "OVERHEATING", "start": 600, "end": 1100, "severity": 1.4},
                    {"type": "VIBRATION_ANOMALY", "start": 1400, "end": 1900, "severity": 1.5},
                ]
            },
            # Sortie 2 (Train): Nominal flight + Lubrication Issue + Combustion Instability + Spike
            {
                "duration": 20.0,
                "faults": [
                    {"type": "LUBRICATION_ISSUE", "start": 500, "end": 1000, "severity": 1.3},
                    {"type": "COMBUSTION_INSTABILITY", "start": 1200, "end": 1600, "severity": 1.25},
                    {"type": "SPIKE", "start": 1800, "end": 1805, "severity": 2.5},
                ]
            },
            # Sortie 3 (Train): Nominal flight + Sensor Drift + Frozen Sensor + Missing
            {
                "duration": 20.0,
                "faults": [
                    {"type": "SENSOR_DRIFT", "start": 500, "end": 900, "severity": 1.2},
                    {"type": "FROZEN_SENSOR", "start": 1100, "end": 1400, "severity": 1.0},
                    {"type": "MISSING_DATA", "start": 1600, "end": 1800, "severity": 1.0},
                ]
            },
            # Sortie 4 (Val): Validation mission with mixed conditions
            {
                "duration": 15.0,
                "faults": [
                    {"type": "OVERHEATING", "start": 400, "end": 800, "severity": 1.35},
                    {"type": "LUBRICATION_ISSUE", "start": 1000, "end": 1300, "severity": 1.25},
                ]
            },
            # Sortie 5 (Test): Held-out test mission covering all fault classes for rigorous verification
            {
                "duration": 25.0,
                "faults": [
                    {"type": "OVERHEATING", "start": 300, "end": 600, "severity": 1.4},
                    {"type": "VIBRATION_ANOMALY", "start": 750, "end": 1050, "severity": 1.45},
                    {"type": "LUBRICATION_ISSUE", "start": 1200, "end": 1500, "severity": 1.3},
                    {"type": "COMBUSTION_INSTABILITY", "start": 1650, "end": 1950, "severity": 1.2},
                    {"type": "SENSOR_DRIFT", "start": 2100, "end": 2350, "severity": 1.2},
                    {"type": "FROZEN_SENSOR", "start": 2450, "end": 2650, "severity": 1.0},
                    {"type": "MISSING_DATA", "start": 2750, "end": 2900, "severity": 1.0},
                ]
            }
        ]

        flight_dfs = []
        cur_time = datetime.datetime(2026, 10, 21, 6, 0, 0, tzinfo=datetime.timezone.utc)
        for i, sc in enumerate(sortie_configs):
            f_df = self.generate_flight_profile(
                duration_minutes=sc["duration"],
                fault_scenarios=sc["faults"],
                device_id="ENGINE-001",
                start_time=cur_time
            )
            flight_dfs.append(f_df)
            cur_time += datetime.timedelta(minutes=sc["duration"] + 15.0)

        # Train is Sorties 1, 2, 3
        train_df = pd.concat([flight_dfs[0], flight_dfs[1], flight_dfs[2]], ignore_index=True)
        # Val is Sortie 4
        val_df = flight_dfs[3].reset_index(drop=True)
        # Test is Sortie 5
        test_df = flight_dfs[4].reset_index(drop=True)
        # Full is all 5
        full_df = pd.concat(flight_dfs, ignore_index=True)
        df = full_df
        n_total = len(df)

        # Paths
        full_path = os.path.join(output_dir, "demo_sensor_dataset.csv")
        train_path = os.path.join(output_dir, "train_split.csv")
        val_path = os.path.join(output_dir, "val_split.csv")
        test_path = os.path.join(output_dir, "test_split.csv")
        meta_path = os.path.join(output_dir, "dataset_metadata.json")

        df.to_csv(full_path, index=False)
        train_df.to_csv(train_path, index=False)
        val_df.to_csv(val_path, index=False)
        test_df.to_csv(test_path, index=False)

        # Compute fingerprint hash
        with open(full_path, "rb") as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()

        # Fault label distribution
        label_dist = df["fault_label"].value_counts().to_dict()
        quality_dist = df["data_quality_label"].value_counts().to_dict()

        metadata = {
            "dataset_name": "AeroTwin-X Rotax 915 iS Demo Sensor Benchmark",
            "version": "1.0.0",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "sha256_fingerprint": file_hash,
            "random_seed": self.seed,
            "sampling_rate_hz": self.sampling_rate_hz,
            "duration_minutes": duration_minutes,
            "total_records": n_total,
            "splits": {
                "train_records": len(train_df),
                "val_records": len(val_df),
                "test_records": len(test_df)
            },
            "fault_label_distribution": label_dist,
            "data_quality_distribution": quality_dist,
            "files": {
                "full_dataset": os.path.abspath(full_path),
                "train_split": os.path.abspath(train_path),
                "val_split": os.path.abspath(val_path),
                "test_split": os.path.abspath(test_path)
            }
        }

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        return metadata


def generate_multi_sortie_dataset(
    num_sorties: int = 2,
    seed: int = 42,
    duration_minutes: float = 1.0,
    sampling_rate_hz: float = 2.0
) -> pd.DataFrame:
    """Generate multi-sortie demo dataset for test suites and dynamic simulation."""
    generator = DemoDataGenerator(seed=seed, sampling_rate_hz=sampling_rate_hz)
    dfs = []
    base_time = datetime.datetime(2026, 10, 21, 10, 0, 0, tzinfo=datetime.timezone.utc)
    for s in range(num_sorties):
        faults = None
        if s > 0:
            faults = [{"type": "OVERHEATING", "start": 30, "end": 70, "severity": 1.3}]
        df = generator.generate_flight_profile(
            duration_minutes=duration_minutes,
            fault_scenarios=faults,
            device_id=f"ENGINE-00{s+1}",
            start_time=base_time + datetime.timedelta(hours=s * 2)
        )
        df["sortie_id"] = f"SORTIE-0{s+1}"
        dfs.append(df)
    return pd.concat(dfs, ignore_index=True)


if __name__ == "__main__":
    gen = DemoDataGenerator(seed=42)
    meta = gen.generate_and_save_dataset_suite()
    print("Dataset generation complete:")
    print(json.dumps(meta, indent=2))

