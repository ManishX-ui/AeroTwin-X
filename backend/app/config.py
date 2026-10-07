"""AeroTwin-X configuration."""
import os

class Settings:
    PROJECT_NAME: str = "AeroTwin-X"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    # Writable SQLite on Vercel serverless functions
    if os.getenv("VERCEL") and not os.getenv("DATABASE_URL"):
        DATABASE_URL: str = "sqlite:////tmp/aerotwin_x.db"
    else:
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./aerotwin_x.db")
    TELEMETRY_HZ: float = float(os.getenv("TELEMETRY_HZ", "2.0"))
    DEFAULT_UAV_ID: str = "UAV-01"
    DEFAULT_ENGINE_ID: str = "AE-03"
    BACKEND_CORS_ORIGINS: list = ["*"]
    MODEL_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../models"))

settings = Settings()
