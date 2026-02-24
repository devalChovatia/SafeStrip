"""Run from Backend folder: python scripts/test_db_connection.py"""
from pathlib import Path
import sys
import os

# Load Backend/.env into os.environ (no extra package required)
_env_file = Path(__file__).resolve().parent.parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().strip().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

sys.path.insert(0, str(_env_file.parent))
from sqlalchemy import text
from app.database import engine


def main():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection OK")
    except Exception as e:
        print("Connection failed:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
