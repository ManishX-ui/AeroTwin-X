"""
Controlled Test Suite for AeroTwin-X RUL & Weibull Hazard Analysis Subsystem.
Audits Phase 3, Phase 4, Phase 6, and Phase 7 requirements.
Compares actual RULModel output against theoretical Weibull survival & hazard equations.
"""
import sys
import os
import json
import math
import numpy as np
from scipy import integrate, stats

# Set project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ml.rul_model import RULModel
from backend.ml.inference import get_inference_service

def theoretical_weibull_metrics(t, beta=1.82, eta=2800.0):
    """Compute true theoretical Weibull metrics."""
    if t <= 0:
        return {"survival_prob": 1.0, "hazard_rate": 0.0, "cum_hazard": 0.0, "conditional_rul_hours": round(eta * math.gamma(1 + 1/beta), 1)}
    
    # Cumulative hazard
    H_t = (t / eta) ** beta
    # Survival probability S(t) = exp(-H(t))
    S_t = math.exp(-H_t)
    # Instantaneous hazard rate h(t) = (beta / eta) * (t / eta)**(beta - 1)
    h_t = (beta / eta) * ((t / eta) ** (beta - 1))
    
    # Conditional Expected Remaining Life: E[T - t | T > t] = (1 / S(t)) * int_t^inf S(u) du
    def s_func(u):
        return math.exp(-((u / eta) ** beta))
    
    integral_val, _ = integrate.quad(s_func, t, t + 5 * eta)
    conditional_rul = integral_val / max(1e-12, S_t)
    
    return {
        "survival_prob": round(S_t, 4),
        "hazard_rate": round(h_t, 6),
        "cum_hazard": round(H_t, 4),
        "conditional_rul_hours": round(conditional_rul, 1)
    }

def run_rul_audit():
    print("================================================================================")
    print("AEROTWIN-X: RUL & WEIBULL HAZARD MODEL CONTROLLED AUDIT")
    print("Component: RULModel (backend/ml/rul_model.py)")
    print("================================================================================\n")

    rul_default = RULModel()
    inference_svc = get_inference_service()

    results = {}

    # --------------------------------------------------------------------------
    # PHASE 2 & 4: FORMULA VERIFICATION UNDER VARYING FAULTS & HEALTH SCORES
    # --------------------------------------------------------------------------
    print(">>> Testing Actual RUL Formula Behavior across Fault Categories...")
    formula_checks = []
    fault_scenarios = [
        ("NORMAL", 98.9, 0.08),
        ("OVERHEATING", 55.5, 0.99),
        ("LUBRICATION_ISSUE", 55.5, 0.95),
        ("VIBRATION_ANOMALY", 55.5, 0.99),
        ("MISFIRE", 65.0, 0.70),
        ("SENSOR_DRIFT", 80.0, 0.45)
    ]

    for fault, health, anom in fault_scenarios:
        pred = rul_default.estimate_rul(health, fault, anom)
        formula_checks.append({
            "fault": fault,
            "health_score": health,
            "anomaly_score": anom,
            "rul_hours": pred.rul_hours,
            "confidence": pred.confidence,
            "trend": pred.degradation_trend,
            "estimated_wear_pct": pred.estimated_wear_pct
        })
    results["formula_behavior"] = formula_checks

    # --------------------------------------------------------------------------
    # PHASE 6: CONTROLLED TESTS (A through L)
    # --------------------------------------------------------------------------
    print(">>> Executing Phase 6 Controlled Tests A through L...")
    controlled_tests = []

    # Case A: Zero / near-zero elapsed age (TTSN = 0.0)
    m_a = RULModel(tbo_hours=2500.0, current_ttsn_hours=0.0)
    pred_a = m_a.estimate_rul(99.0, "NORMAL", 0.05)
    weib_a = theoretical_weibull_metrics(0.0)
    controlled_tests.append({
        "case": "A. Zero Elapsed Age (TTSN = 0.0h)",
        "model_rul": pred_a.rul_hours,
        "theoretical_weibull_rul": weib_a["conditional_rul_hours"],
        "difference": round(pred_a.rul_hours - weib_a["conditional_rul_hours"], 1),
        "pass": pred_a.rul_hours == 2500.0
    })

    # Case B: Nominal elapsed age (TTSN = 1216.0h)
    m_b = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    pred_b = m_b.estimate_rul(98.9, "NORMAL", 0.08)
    weib_b = theoretical_weibull_metrics(1216.0)
    controlled_tests.append({
        "case": "B. Nominal Elapsed Age (TTSN = 1216.0h)",
        "model_rul": pred_b.rul_hours,
        "theoretical_weibull_rul": weib_b["conditional_rul_hours"],
        "theoretical_survival_prob": weib_b["survival_prob"],
        "theoretical_hazard_rate": weib_b["hazard_rate"],
        "pass": pred_b.rul_hours == 1284.0
    })

    # Case C: Advanced elapsed age (TTSN = 2450.0h, near TBO)
    m_c = RULModel(tbo_hours=2500.0, current_ttsn_hours=2450.0)
    pred_c = m_c.estimate_rul(95.0, "NORMAL", 0.10)
    weib_c = theoretical_weibull_metrics(2450.0)
    controlled_tests.append({
        "case": "C. Advanced Elapsed Age (TTSN = 2450.0h, 50h before TBO)",
        "model_rul": pred_c.rul_hours,
        "theoretical_weibull_rul": weib_c["conditional_rul_hours"],
        "pass": pred_c.rul_hours == 50.0
    })

    # Case D & E: Testing Weibull Shape (beta) and Scale (eta) Support in RULModel
    has_beta = hasattr(rul_default, "beta") or hasattr(rul_default, "shape")
    has_eta = hasattr(rul_default, "eta") or hasattr(rul_default, "scale")
    controlled_tests.append({
        "case": "D & E. Parametric Weibull Shape (beta) and Scale (eta) Inspection",
        "has_beta_parameter": has_beta,
        "has_eta_parameter": has_eta,
        "observation": "RULModel does NOT define or accept beta or eta parameters. The parameters mentioned in UI (beta=1.82) are hardcoded text strings.",
        "pass": False # Exposes absence of parametric model
    })

    # Case F: Health deteriorates while elapsed age is constant
    m_f = RULModel(tbo_hours=2500.0, current_ttsn_hours=1216.0)
    scores_f = [98.9, 80.0, 60.0, 40.0, 20.0, 10.0]
    ruls_f = [m_f.estimate_rul(h, "OVERHEATING", 0.90).rul_hours for h in scores_f]
    controlled_tests.append({
        "case": "F. Health Deteriorating while Age is Constant (1216h)",
        "health_sweep": scores_f,
        "rul_sweep": ruls_f,
        "monotonic_drop": all(ruls_f[i] >= ruls_f[i+1] for i in range(len(ruls_f)-1)),
        "pass": all(ruls_f[i] >= ruls_f[i+1] for i in range(len(ruls_f)-1))
    })

    # Case G: Elapsed age increasing while health is constant (98.9%)
    ages_g = [500.0, 1000.0, 1500.0, 2000.0, 2400.0]
    ruls_g = [RULModel(tbo_hours=2500.0, current_ttsn_hours=age).estimate_rul(98.9, "NORMAL", 0.08).rul_hours for age in ages_g]
    controlled_tests.append({
        "case": "G. Age Increasing while Health is Constant (98.9%)",
        "ages_sweep": ages_g,
        "ruls_sweep": ruls_g,
        "linear_decrement": [2500.0 - a for a in ages_g] == ruls_g,
        "pass": [2500.0 - a for a in ages_g] == ruls_g
    })

    # Case H: Sudden severe fault (Overheating + Vibration simultaneously)
    pred_h = rul_default.estimate_rul(35.0, "OVERHEATING", 0.99)
    controlled_tests.append({
        "case": "H. Sudden Severe Fault (Health=35%, Anomaly=0.99, OVERHEATING)",
        "rul_hours": pred_h.rul_hours,
        "wear_pct": pred_h.estimated_wear_pct,
        "trend": pred_h.degradation_trend,
        "clamped_at_floor": pred_h.rul_hours >= 80.0,
        "pass": pred_h.rul_hours >= 80.0
    })

    # Case I: Missing health data (health_score = None or NaN)
    try:
        pred_i_none = rul_default.estimate_rul(None, "NORMAL", 0.08)
        res_i = "Unhandled"
    except TypeError as e:
        res_i = f"TypeError caught: {e}"
    
    pred_i_nan = rul_default.estimate_rul(float('nan'), "NORMAL", 0.08)
    controlled_tests.append({
        "case": "I. Missing / Invalid Health Data",
        "none_input_result": res_i,
        "nan_input_rul": pred_i_nan.rul_hours,
        "observation": "Passing None raises unhandled TypeError; passing NaN propagates NaN wear.",
        "pass": False # Deficient error handling
    })

    # Case J: Invalid or negative elapsed age (TTSN = -100.0h)
    m_j = RULModel(tbo_hours=2500.0, current_ttsn_hours=-100.0)
    pred_j = m_j.estimate_rul(99.0, "NORMAL", 0.05)
    controlled_tests.append({
        "case": "J. Negative Elapsed Age (TTSN = -100.0h)",
        "result_rul": pred_j.rul_hours,
        "observation": "RUL expands to 2600.0h without input boundary validation.",
        "pass": False
    })

    # Case K: Beyond TBO Elapsed Age (TTSN = 2800.0h > 2500.0h TBO)
    m_k = RULModel(tbo_hours=2500.0, current_ttsn_hours=2800.0)
    pred_k = m_k.estimate_rul(99.0, "NORMAL", 0.05)
    controlled_tests.append({
        "case": "K. Beyond TBO Age (TTSN = 2800.0h > 2500.0h)",
        "result_rul": pred_k.rul_hours,
        "nominal_rul": m_k.nominal_rul,
        "observation": "Clamps to max(0.0, tbo - ttsn) = 0.0h successfully.",
        "pass": pred_k.rul_hours == 0.0
    })

    # Case L: Extreme values (health_score = 1e6 or -1e6)
    pred_l_neg = rul_default.estimate_rul(-500.0, "OVERHEATING", 0.99)
    controlled_tests.append({
        "case": "L. Extreme Negative Health Score (-500%)",
        "result_rul": pred_l_neg.rul_hours,
        "wear_pct": pred_l_neg.estimated_wear_pct,
        "observation": "health_ratio clamped to max(0.1, score/100) = 0.1, preventing negative division.",
        "pass": pred_l_neg.rul_hours >= 80.0
    })

    results["controlled_tests"] = controlled_tests

    # --------------------------------------------------------------------------
    # THEORETICAL COMPARISON TABLE: RUL MODEL VS WEIBULL
    # --------------------------------------------------------------------------
    comp_table = []
    sample_ages = [200.0, 600.0, 1000.0, 1216.0, 1600.0, 2000.0, 2400.0]
    for age in sample_ages:
        m_sim = RULModel(tbo_hours=2500.0, current_ttsn_hours=age)
        rul_sim_nom = m_sim.estimate_rul(98.9, "NORMAL", 0.08).rul_hours
        rul_sim_flt = m_sim.estimate_rul(55.5, "OVERHEATING", 0.99).rul_hours
        w_sim = theoretical_weibull_metrics(age, beta=1.82, eta=2800.0)
        comp_table.append({
            "age_ttsn": age,
            "actual_code_rul_normal": rul_sim_nom,
            "actual_code_rul_overheat": rul_sim_flt,
            "weibull_survival_prob": w_sim["survival_prob"],
            "weibull_hazard_rate_per_hour": w_sim["hazard_rate"],
            "weibull_conditional_rul": w_sim["conditional_rul_hours"],
            "delta_nominal_vs_weibull": round(rul_sim_nom - w_sim["conditional_rul_hours"], 1)
        })
    results["weibull_comparison_table"] = comp_table

    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    run_rul_audit()
