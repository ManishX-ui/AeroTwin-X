import os
import glob
import re
import json

screen_dir = r"c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X\stitch_raw_screens"
html_files = sorted(glob.glob(os.path.join(screen_dir, "*.html")))
print(f"Total HTML files found: {len(html_files)}")

screens_audit = []

for hf in html_files:
    fname = os.path.basename(hf)
    with open(hf, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    m_title = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE)
    title = m_title.group(1).strip() if m_title else fname

    has_tailwind = "tailwind" in content.lower() or "cdn.tailwindcss.com" in content.lower()
    has_three = "three" in content.lower()
    has_charts = any(k in content.lower() for k in ["chart.js", "echarts", "apexcharts", "canvas", "<svg"])

    # Search for button texts
    btn_matches = re.findall(r"<button[^>]*>(.*?)</button>", content, re.DOTALL | re.IGNORECASE)
    clean_btns = [re.sub(r"<[^>]+>", "", b).strip() for b in btn_matches if re.sub(r"<[^>]+>", "", b).strip()]
    # deduplicate buttons while preserving order
    clean_btns = list(dict.fromkeys(clean_btns))

    # Search for nav links
    a_matches = re.findall(r"<a[^>]*>(.*?)</a>", content, re.DOTALL | re.IGNORECASE)
    clean_links = [re.sub(r"<[^>]+>", "", a).strip() for a in a_matches if re.sub(r"<[^>]+>", "", a).strip()]
    clean_links = list(dict.fromkeys(clean_links))[:10]

    # Search for key telemetry words
    metrics = re.findall(r"\b(RPM|CHT|EGT|Oil Pressure|Oil Temperature|Vibration|MAP|Fuel Flow|Battery|Alternator|RUL|Health Index|Residual|Manifold|Inlet Temp|Exhaust)\b", content, re.IGNORECASE)
    metrics_unique = sorted(list(set(m.upper() for m in metrics)))

    # Forms, inputs, selects
    inputs = re.findall(r"<input[^>]*>", content, re.IGNORECASE)
    selects = re.findall(r"<select[^>]*>", content, re.IGNORECASE)
    modals = re.findall(r"(modal|dialog|drawer|overlay|popup)", content, re.IGNORECASE)

    screens_audit.append({
        "file": fname,
        "title": title,
        "size_kb": round(len(content) / 1024, 1),
        "has_tailwind": has_tailwind,
        "has_three": has_three,
        "has_charts": has_charts,
        "num_inputs": len(inputs),
        "num_selects": len(selects),
        "num_buttons": len(clean_btns),
        "metrics": metrics_unique,
        "buttons": clean_btns[:8],
        "links": clean_links[:6]
    })

print(f"{'File':<40} | {'Title':<35} | {'KB':<6} | {'Btns':<4} | {'Inputs':<4} | {'Metrics'}")
print("-" * 115)
for s in screens_audit:
    m_str = ", ".join(s["metrics"][:4])
    print(f"{s['file'][:39]:<40} | {s['title'][:34]:<35} | {s['size_kb']:<6} | {s['num_buttons']:<4} | {s['num_inputs']:<4} | {m_str}")

with open(r"c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X\stitch_raw_screens\audit_results.json", "w", encoding="utf-8") as f:
    json.dump(screens_audit, f, indent=2)
print("\nAudit saved to audit_results.json successfully.")
