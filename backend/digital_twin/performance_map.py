"""Rotax 915iSc Aero-Piston Engine Baseline Performance Maps."""

# Standard Atmospheric Model (ISA) approximations
ISA_SEA_LEVEL_TEMP_C = 15.0
ISA_TEMP_LAPSE_RATE = 0.0019812 # °C per foot
ISA_SEA_LEVEL_PRESSURE_HPA = 1013.25

# Baseline Operating Bounds for Rotax 915iSc
# 4-cylinder, 4-stroke, turbocharged aero-piston engine
# Max continuous RPM: 5500 (prop reduction 2.54:1 -> prop RPM ~2165)
# Cruise RPM: 4800 - 5200 (direct engine RPM) or GCS display 2500-2800 (prop / scaled)

ROTAX_915ISC_BASELINES = {
    "TAKEOFF": {
        "throttle": 100.0,
        "rpm": 2740.0, # GCS prop/output shaft display
        "map_inhg": 39.5,
        "cht_nominal_c": 115.0,
        "egt_nominal_c": 790.0,
        "oil_press_bar": 4.8,
        "oil_temp_c": 92.0,
        "fuel_flow_lph": 28.5,
        "vibration_g": 1.45,
        "battery_v": 27.8,
        "alternator_a": 16.2
    },
    "CLIMB": {
        "throttle": 85.0,
        "rpm": 2650.0,
        "map_inhg": 35.0,
        "cht_nominal_c": 118.0,
        "egt_nominal_c": 765.0,
        "oil_press_bar": 4.5,
        "oil_temp_c": 94.0,
        "fuel_flow_lph": 24.0,
        "vibration_g": 1.30,
        "battery_v": 28.1,
        "alternator_a": 14.5
    },
    "CRUISE": {
        "throttle": 75.0,
        "rpm": 2550.0,
        "map_inhg": 31.5,
        "cht_nominal_c": 108.0,
        "egt_nominal_c": 725.0,
        "oil_press_bar": 4.2,
        "oil_temp_c": 88.0,
        "fuel_flow_lph": 18.2,
        "vibration_g": 1.15,
        "battery_v": 28.2,
        "alternator_a": 12.8
    },
    "LOITER": {
        "throttle": 55.0,
        "rpm": 2350.0,
        "map_inhg": 26.0,
        "cht_nominal_c": 98.0,
        "egt_nominal_c": 690.0,
        "oil_press_bar": 3.8,
        "oil_temp_c": 82.0,
        "fuel_flow_lph": 13.5,
        "vibration_g": 0.95,
        "battery_v": 28.2,
        "alternator_a": 11.2
    },
    "DESCENT": {
        "throttle": 35.0,
        "rpm": 2100.0,
        "map_inhg": 21.0,
        "cht_nominal_c": 88.0,
        "egt_nominal_c": 640.0,
        "oil_press_bar": 3.4,
        "oil_temp_c": 76.0,
        "fuel_flow_lph": 9.8,
        "vibration_g": 0.85,
        "battery_v": 28.3,
        "alternator_a": 9.5
    },
    "LANDING": {
        "throttle": 25.0,
        "rpm": 1950.0,
        "map_inhg": 18.5,
        "cht_nominal_c": 82.0,
        "egt_nominal_c": 610.0,
        "oil_press_bar": 3.1,
        "oil_temp_c": 72.0,
        "fuel_flow_lph": 7.5,
        "vibration_g": 0.80,
        "battery_v": 28.1,
        "alternator_a": 9.0
    }
}

# Sensor Nominal Standard Deviations (Scale factor for normalized residuals)
SENSOR_SCALES = {
    "cht": 6.0,          # °C
    "egt": 18.0,         # °C
    "oil_pressure": 0.35, # bar
    "oil_temperature": 3.5, # °C
    "fuel_flow": 1.2,    # L/h
    "vibration": 0.20,   # g RMS
    "battery_voltage": 0.5, # V
    "alternator_current": 1.5, # A
    "rpm": 45.0,
    "manifold_pressure": 1.0
}
