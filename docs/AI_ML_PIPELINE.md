# AeroTwin-X: Physics Digital Twin & AI/ML Diagnostic Pipeline

This document provides a detailed breakdown of the machine learning algorithms, aerothermodynamic physics models, degradation estimators, and explainability mechanisms implemented in **AeroTwin-X**.

---

## 1. Pipeline Overview

AeroTwin-X adopts a **hybrid physics-informed machine learning** architecture. Rather than feeding raw, noisy sensor data directly to a machine learning model, the system first passes measurements through an aerothermodynamic physics twin to calculate normalized residuals.

```
+---------------------------------------------------------------------------------------------------+
|                                  PHYSICAL / REPLAY SENSOR STREAM                                  |
|   RPM: 2550 | CHT: 142.5°C | EGT: 820°C | Oil Press: 4.2 bar | Vibration: 3.4g | Altitude: 14.5k ft |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                  DIGITAL TWIN PHYSICS ESTIMATION                                  |
|   Calibrated Rotax 915iSc baselines, ISA lapse rate, and throttle-altitude thermodynamic maps     |
|   Expected: CHT: 108.0°C | EGT: 725.0°C | Oil Press: 4.2 bar | Vibration: 1.15g                  |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                     MULTI-CHANNEL RESIDUALS                                       |
|   Raw Residual: Δx = Actual - Expected                                                            |
|   Normalized Residual: r = Δx / σ_scale                                                           |
|   r_cht: +5.75σ | r_egt: +6.33σ | r_vibration: +9.0σ | r_oil_press: +0.0σ                         |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+-------------------------------------------------+ +-----------------------------------------------+
|     UNSUPERVISED ANOMALY DETECTION (IFOREST)    | |     SUPERVISED FAULT CLASSIFICATION (GBDT)    |
|   Isolation Forest (100 Trees, 5% Contamination)| |   Gradient Boosted Decision Trees (60 Trees)  |
|   Sigmoidal Probability Calibration             | |   Multi-Class Probability Distribution        |
|   Output: Anomaly Score = 0.88 (ANOMALOUS)      | |   Output: OVERHEATING (Confidence: 98.4%)       |
+------------------------+------------------------+ +----------------------+------------------------+
                         |                                                 |
                         +------------------------+------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                              PROGNOSTICS & SYSTEM HEALTH ASSESSMENT                               |
|   Composite Subsystem Health Index: 52.4 / 100 (Thermal: 34%, Lube: 95%, Comb: 88%, Vib: 45%)      |
|   Weibull Hazard RUL Projection: 384.0 hours remaining (Accelerating Thermal Degradation)          |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                   EXPLAINABLE AI (XAI) LAYER                                      |
|   Attribution: res_cht (48%) | res_egt (28%) | trend_cht (18%) | cross_thermal_ratio (6%)         |
|   Root Cause: Thermal dissipation limit exceeded. Likely radiator duct restriction or cavitation. |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Digital Twin Aerothermodynamics

The physics model represents a turbocharged 4-stroke aero-engine operating across standard tactical UAV flight envelopes (Takeoff, Climb, Cruise, Loiter, Descent, Landing).

### Atmospheric Boundary Conditions
Ambient atmospheric temperature decreases with altitude according to the tropospheric standard lapse rate:

$$T_{\text{ISA}}(h) = 15.0 - (0.0019812 \cdot h) \quad [^\circ\text{C}]$$

The temperature deviation $\Delta T_{\text{amb}} = T_{\text{amb}} - T_{\text{ISA}}(h)$ directly impacts turbocharger intercooler efficiency and cylinder cooling air density.

### Thermal Inertia Differential Equation
Because engine aluminum cylinder blocks possess physical thermal mass, instantaneous temperature steps do not occur in reality. AeroTwin-X models cylinder thermal inertia as a first-order lag filter:

$$\frac{d(\text{CHT})}{dt} = \frac{\text{CHT}_{\text{expected}} - \text{CHT}(t)}{\tau_{\text{thermal}}}$$

$$\text{CHT}(t + \Delta t) = \text{CHT}(t) \cdot (1 - \alpha) + \text{CHT}_{\text{expected}} \cdot \alpha \quad \text{where } \alpha = \frac{\Delta t}{\tau_{\text{thermal}}}, \, \tau_{\text{thermal}} = 4.0\text{ s}$$

---

## 3. Anomaly Detection (Isolation Forest)

- **Module:** `backend/ml/anomaly_detector.py`
- **Algorithm:** Scikit-learn `IsolationForest`
- **Hyperparameters:**
  - `n_estimators`: 100
  - `contamination`: 0.05
  - `random_state`: 42
- **Input Features (10-Dimensional Vector):**
  1. `res_cht`: Normalized CHT residual ($r_{\text{cht}}$)
  2. `res_egt`: Normalized EGT residual ($r_{\text{egt}}$)
  3. `res_oil_pressure`: Normalized oil pressure residual ($r_{\text{oil\_p}}$)
  4. `res_oil_temperature`: Normalized oil temperature residual ($r_{\text{oil\_t}}$)
  5. `res_fuel_flow`: Normalized fuel flow residual ($r_{\text{fuel}}$)
  6. `res_vibration`: Normalized vibration residual ($r_{\text{vib}}$)
  7. `res_manifold_pressure`: Normalized MAP residual ($r_{\text{map}}$)
  8. `trend_cht`: CHT first derivative over 10-second rolling window
  9. `trend_egt`: EGT first derivative over 10-second rolling window
  10. `trend_vibration`: Vibration rate of change

### Sigmoidal Calibration
Raw `decision_function()` scores from Isolation Forest are centered near zero for boundary points. AeroTwin-X calibrates this raw score using a sigmoidal transformation:

$$\text{Score}_{\text{anomaly}} = \frac{1}{1 + \exp\left(-12.0 \cdot (0.05 - \text{raw\_score})\right)}$$

- Inliers (nominal flight) produce scores between $0.02$ and $0.20$.
- Outliers (abnormal conditions) exceed $0.35$ (warning threshold) and climb above $0.70$ for severe failures.

---

## 4. Multi-Class Fault Classification

- **Module:** `backend/ml/fault_classifier.py`
- **Algorithm:** Scikit-learn `GradientBoostingClassifier`
- **Hyperparameters:**
  - `n_estimators`: 60
  - `learning_rate`: 0.1
  - `max_depth`: 4
  - `random_state`: 42
- **Supported Failure Modes (10 Discrete Classes):**
  1. `NORMAL`: Steady-state operation within nominal flight corridor.
  2. `OVERHEATING`: Severe thermal runaway driven by radiator blockage or coolant loss.
  3. `VIBRATION_ANOMALY`: Mechanical harmonic excitation from propeller reduction gearbox (PRGB) wear.
  4. `LUBRICATION_ISSUE`: Oil pressure loss or oil viscosity thinning.
  5. `INJECTOR_ANOMALY`: Asymmetric exhaust gas temperature indicating localized cylinder fuel restriction.
  6. `MISFIRE`: Cyclic ignition dropouts causing torque ripple and RPM dips.
  7. `SENSOR_DRIFT`: Unilateral thermocouple calibration drift contradicted by secondary channels.
  8. `SENSOR_DROPOUT`: CAN bus wire disconnect or power loss producing discontinuous zero frames.
  9. `ELECTRICAL_ANOMALY`: Alternator open circuit or 28V DC bus battery depletion.
  10. `COMBUSTION_INSTABILITY`: Turbocharger compressor surge and manifold pressure oscillation.

---

## 5. Subsystem Health Scoring & RUL Prognostics

### Subsystem Health Indices
Engine health is decomposed into five physical subsystems ($0–100$ scale):
- $H_{\text{therm}}$: Thermal health derived from CHT and EGT residuals.
- $H_{\text{lube}}$: Lubrication health derived from oil pressure delta and crankcase thermal coupling.
- $H_{\text{comb}}$: Combustion health derived from fuel flow balance and manifold pressure stability.
- $H_{\text{vib}}$: Mechanical vibration health derived from RMS acceleration harmonics.
- $H_{\text{elec}}$: Electrical health derived from 28V DC avionics bus voltage regulation.

Composite engine health is a weighted combination:
$$\text{Health}_{\text{engine}} = 0.25 H_{\text{therm}} + 0.25 H_{\text{lube}} + 0.20 H_{\text{comb}} + 0.20 H_{\text{vib}} + 0.10 H_{\text{elec}}$$

### Remaining Useful Life (RUL) Prognostics
- **Standard Baseline:** 2,500 flight hours Time Between Overhauls (TBO).
- **Nominal Airframe Time:** 1,216 flight hours Total Time Since New (TTSN), leaving nominal baseline RUL of 1,284 hours.
- **Degradation Acceleration:** Under abnormal operating conditions, wear penalties accelerate exponentially:
  $$\text{RUL} = \text{RUL}_{\text{nominal}} - \beta \cdot (1 - \text{Health Ratio}) \cdot (1 + \text{Anomaly Score})$$
  where $\beta = 320\text{ hours}$ for thermal/lubrication stress, and $\beta = 210\text{ hours}$ for severe vibration fatigue.

---

## 6. Explainable AI (XAI) & Root Cause Diagnostics

- **Module:** `backend/ml/explainability.py`
- **Output:** Human-readable evidence lists, feature contribution percentages, and root-cause advisory strings.

When a failure is diagnosed, operators require transparent reasoning before aborting a mission or grounding an airframe. The Explainability Engine ranks the physical drivers:

```json
{
  "fault": "OVERHEATING",
  "confidence": 0.984,
  "evidence": [
    "Elevated CHT Residual: +5.8σ exceedance over physics expectation",
    "Progressive CHT temperature rise (+18.4°C trend window)",
    "Secondary thermal coupling: Oil temperature elevated +3.4σ",
    "Cooling radiator delta-T reduction detected"
  ],
  "feature_attributions": [
    { "feature": "res_cht", "impact": "+ Positive", "contribution": 0.48 },
    { "feature": "res_oil_temperature", "impact": "+ Positive", "contribution": 0.28 },
    { "feature": "trend_cht", "impact": "+ Positive", "contribution": 0.18 },
    { "feature": "cross_thermal_ratio", "impact": "+ Positive", "contribution": 0.06 }
  ],
  "root_cause_explanation": "Thermal dissipation limit exceeded. Likely radiator duct restriction or coolant circulation cavitation."
}
```
