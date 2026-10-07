import re
from bs4 import BeautifulSoup

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()
    soup = BeautifulSoup(content, 'html.parser')

buttons = soup.find_all('button')
print(f"Total buttons: {len(buttons)}")

categories = {}
for i, btn in enumerate(buttons):
    text = ' '.join(btn.get_text().split())
    onclick = btn.get('onclick', '')
    btn_id = btn.get('id', '')
    btn_cls = ' '.join(btn.get('class', []))
    key = text if text else f"[ICON: {btn_cls[:30]}]"
    categories[key] = categories.get(key, 0) + 1

print("\n--- BUTTON SAMPLES (Unique Texts) ---")
for k, count in sorted(categories.items(), key=lambda x: -x[1])[:40]:
    print(f"  ({count}x) {k}")

selects = soup.find_all('select')
print(f"\n--- SELECT ELEMENTS ({len(selects)}) ---")
for s in selects:
    opts = [o.get_text(strip=True) for o in s.find_all('option')]
    print(f"  ID: {s.get('id')} | Name: {s.get('name')} | Options: {opts[:5]}")

inputs = soup.find_all('input')
print(f"\n--- INPUT ELEMENTS ({len(inputs)}) ---")
for inp in inputs:
    print(f"  Type: {inp.get('type')} | ID: {inp.get('id')} | Placeholder: {inp.get('placeholder')} | Value: {inp.get('value')}")
