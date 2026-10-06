import os
import re
import json

files_to_check = {
    'Overview': '23_Mission Control _ Overview Dashboard _Ai_c79d5ee8.html',
    '3D Engine Explorer': '05_3D Engine Digital Twin Explorer_97b5f472.html',
    'Live Telemetry': '32_Screen 10_ Live Telemetry _ CAN Bus_26295ed4.html',
    'AI Diagnostics': '19_Screen 04_ AI Diagnostics _ Fault Predic_88451337.html',
    'RUL & Degradation': '02_Screen 05_ RUL _ Engine Degradation_7f7479c8.html',
    'Alerts Center': '10_Screen 06_ Alerts _ Events Center_211b10e2.html',
    'Predictive Maint': '24_Screen 07_ Predictive Maintenance _ CBM__9a0c66f4.html',
    'Mission Sim': '15_Screen 08_ Mission Simulator_9f1d8582.html',
    'Mission Replay': '27_Screen 09_ Mission Replay _ Historical T_1dab415f.html',
    'Edge AI / Models': '22_Screen 11_ Edge AI Monitoring_d9a3858f.html',
    'About': '03_Screen 16_ About AeroTwin-X_a19983d2.html'
}

audit_inventory = {}

for name, fname in files_to_check.items():
    path = os.path.join(r'c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X\stitch_raw_screens', fname)
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        c = f.read()

    m_main = re.search(r'<main[^>]*>(.*?)</main>', c, re.DOTALL | re.IGNORECASE)
    main_content = m_main.group(1) if m_main else c

    # Extract all section comments or headings
    comments = re.findall(r'<!--\s*(.*?)\s*-->', main_content)
    meaningful_comments = [
        re.sub(r'^[=\s*]+|[=\s*]+$', '', cmt).strip()
        for cmt in comments
        if len(cmt) > 5 and not cmt.startswith('!') and not 'http' in cmt
    ]

    # Buttons
    btn_matches = re.findall(r'<button[^>]*>(.*?)</button>', main_content, re.DOTALL | re.IGNORECASE)
    buttons = [re.sub(r'<[^>]+>', ' ', b).strip() for b in btn_matches if re.sub(r'<[^>]+>', ' ', b).strip()]
    buttons = list(dict.fromkeys(buttons))

    # Cards / Panels: look for headings inside cards
    headings = re.findall(r'<h[1234][^>]*>(.*?)</h[1234]>', main_content, re.DOTALL | re.IGNORECASE)
    headings = [re.sub(r'<[^>]+>', ' ', h).strip() for h in headings if re.sub(r'<[^>]+>', ' ', h).strip()]

    # Table headers
    th_matches = re.findall(r'<th[^>]*>(.*?)</th>', main_content, re.DOTALL | re.IGNORECASE)
    th_headers = [re.sub(r'<[^>]+>', ' ', th).strip() for th in th_matches if re.sub(r'<[^>]+>', ' ', th).strip()]

    # Specific indicators / KPIs (spans with numbers or metrics)
    metrics_found = re.findall(r'\b(RPM|CHT|EGT|OIL PRESSURE|OIL TEMP|VIBRATION|MAP|FUEL FLOW|BATTERY|ALTERNATOR|INJECTION TIMING|RUL|HEALTH INDEX|RESIDUAL|ANOMALY SCORE|CONFIDENCE|SHAP|EVIDENCE|DEGRADATION)\b', main_content, re.IGNORECASE)
    metrics_found = sorted(list(set(m.upper() for m in metrics_found)))

    audit_inventory[name] = {
        'file': fname,
        'size_chars': len(main_content),
        'sections': [s for s in meaningful_comments if any(k in s.lower() for k in ['section', 'panel', 'col', 'kpi', 'chart', 'widget', 'grid', 'table', 'control', 'timeline', 'header', 'strip', 'card'])][:10],
        'headings': headings[:10],
        'buttons': buttons[:12],
        'table_headers': th_headers[:8],
        'metrics': metrics_found
    }

print(json.dumps(audit_inventory, indent=2))
with open(r'c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X\audit_inventory.json', 'w', encoding='utf-8') as out_f:
    json.dump(audit_inventory, out_f, indent=2)
