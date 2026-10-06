import os

base_dir = r"c:\Users\Manish\Desktop\navomesh Projects\AeroTwin-X"
subdirs = [
    "backend/app/api",
    "backend/app/schemas",
    "backend/app/services",
    "backend/app/websocket",
    "backend/digital_twin",
    "backend/ml",
    "backend/simulation",
    "backend/database",
    "frontend/css",
    "frontend/js",
    "frontend/assets",
    "models",
    "datasets",
    "tests",
    "docs"
]

for sd in subdirs:
    p = os.path.join(base_dir, sd)
    os.makedirs(p, exist_ok=True)
    # create __init__.py if python package
    if "backend" in sd:
        init_file = os.path.join(p, "__init__.py")
        if not os.path.exists(init_file):
            with open(init_file, "w", encoding="utf-8") as f:
                f.write('"""AeroTwin-X package."""\n')

print("All directories and __init__.py files created successfully.")
