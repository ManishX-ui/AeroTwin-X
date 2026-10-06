"""Fault Classification Model using Gradient Boosting / Ensemble."""
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from typing import Dict, Any, Tuple, List
from ..app.schemas.predictions import FaultPrediction

FAULT_CLASSES = [
    "NORMAL",
    "OVERHEATING",
    "VIBRATION_ANOMALY",
    "LUBRICATION_ISSUE",
    "INJECTOR_ANOMALY",
    "MISFIRE",
    "SENSOR_DRIFT",
    "SENSOR_DROPOUT",
    "ELECTRICAL_ANOMALY",
    "COMBUSTION_INSTABILITY"
]

class FaultClassifier:
    def __init__(self):
        self.classes = FAULT_CLASSES
        self.feature_names = [
            "res_cht", "res_egt", "res_oil_pressure", "res_oil_temperature",
            "res_fuel_flow", "res_vibration", "res_manifold_pressure",
            "trend_cht", "trend_egt", "trend_vibration",
            "raw_battery_voltage", "raw_alternator_current"
        ]
        self.model = GradientBoostingClassifier(
            n_estimators=60,
            learning_rate=0.1,
            max_depth=4,
            random_state=42
        )
        self._train_prototype_model()

    def _train_prototype_model(self):
        """Train classifier on representative synthetic physical fault signatures."""
        np.random.seed(42)
        X_train = []
        y_train = []

        samples_per_class = 60

        for class_idx, class_name in enumerate(self.classes):
            for _ in range(samples_per_class):
                # Baseline zero residuals + nominal noise
                vec = np.random.normal(loc=0.0, scale=0.4, size=len(self.feature_names))
                vec[10] = 28.2 + np.random.normal(0, 0.1) # batt volt
                vec[11] = 13.5 + np.random.normal(0, 0.5) # alt amp

                if class_name == "OVERHEATING":
                    vec[0] += np.random.uniform(3.5, 7.0)  # res_cht
                    vec[1] += np.random.uniform(2.0, 4.5)  # res_egt
                    vec[3] += np.random.uniform(3.0, 6.0)  # res_oil_temp
                    vec[7] += np.random.uniform(1.5, 4.0)  # trend_cht
                elif class_name == "VIBRATION_ANOMALY":
                    vec[5] += np.random.uniform(4.0, 9.0)  # res_vibration
                    vec[9] += np.random.uniform(1.0, 3.0)  # trend_vibration
                elif class_name == "LUBRICATION_ISSUE":
                    vec[2] -= np.random.uniform(3.5, 8.0)  # negative res_oil_pressure
                    vec[3] += np.random.uniform(2.5, 5.5)  # elevated oil_temp
                elif class_name == "INJECTOR_ANOMALY":
                    vec[1] += np.random.uniform(2.5, 5.0)  # delta EGT
                    vec[4] -= np.random.uniform(1.5, 3.5)  # low fuel flow
                    vec[5] += np.random.uniform(1.2, 2.5)  # unbalance vib
                elif class_name == "MISFIRE":
                    vec[5] += np.random.uniform(3.0, 6.0)  # high vib
                    vec[1] -= np.random.uniform(2.0, 5.0)  # cold exhaust unbalance
                elif class_name == "SENSOR_DRIFT":
                    vec[0] += np.random.uniform(2.5, 5.0)  # drift on cht
                    vec[7] += np.random.uniform(0.8, 2.0)  # steady positive trend
                    vec[3] += np.random.normal(0, 0.3)     # but oil temp normal!
                elif class_name == "SENSOR_DROPOUT":
                    vec[0] -= np.random.uniform(8.0, 15.0) # sensor reads 0
                elif class_name == "ELECTRICAL_ANOMALY":
                    vec[10] -= np.random.uniform(4.0, 7.0) # batt drops
                    vec[11] -= np.random.uniform(8.0, 12.0)# alt drops
                elif class_name == "COMBUSTION_INSTABILITY":
                    vec[6] += np.random.uniform(2.5, 5.5)  # MAP surging
                    vec[4] += np.random.uniform(1.5, 3.5)  # fuel swing

                X_train.append(vec)
                y_train.append(class_idx)

        self.model.fit(np.array(X_train), np.array(y_train))

    def predict(self, feature_dict: Dict[str, float]) -> FaultPrediction:
        """Classify fault and compute confidence probability."""
        # Safeguard guardrail: if all physical residuals are within 1.4 sigma, engine is NOMINAL
        critical_residuals = ["cht", "egt", "oil_pressure", "oil_temperature", "fuel_flow", "vibration", "manifold_pressure"]
        max_norm_res = max(abs(feature_dict.get(f"res_{k}", 0.0)) for k in critical_residuals)
        
        if max_norm_res < 1.4 and feature_dict.get("raw_battery_voltage", 28.0) > 26.5:
            return FaultPrediction(
                fault="NORMAL",
                probability=0.965,
                confidence=96.5,
                model_name="GradientBoosted-EdgeClassifier",
                model_version="v2.1-aerotwin"
            )

        x = np.array([[feature_dict.get(fn, 0.0) for fn in self.feature_names]])
        probs = self.model.predict_proba(x)[0]
        top_idx = int(np.argmax(probs))
        top_prob = float(probs[top_idx])
        predicted_class = self.classes[top_idx]

        return FaultPrediction(
            fault=predicted_class,
            probability=round(top_prob, 3),
            confidence=round(top_prob * 100.0, 1),
            model_name="GradientBoosted-EdgeClassifier",
            model_version="v2.1-aerotwin"
        )
