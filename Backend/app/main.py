from pathlib import Path
import os
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models 
from .database import engine
from .routers import (
    null_router,
    sensor_log_router,
    sensor_readings_router,
    workspaces_router,
    devices_router,
)

app = FastAPI()

# CORS
# In dev we allow localhost / Expo dev tools. In prod, tighten this.
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:8000",
    "http://localhost:8081",   # Metro bundler
    "http://localhost:19006",  # Expo web
    "http://localhost:19000",  # Expo dev app
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Only run create_all when explicitly requested (e.g. local dev with empty DB).
# On Render + Supabase, leave unset so we use your existing tables and never run create_all.
if os.getenv("RUN_CREATE_TABLES", "").lower() in ("1", "true", "yes"):
    models.Base.metadata.create_all(bind=engine)

app.include_router(null_router.router)
app.include_router(sensor_log_router.router)
app.include_router(sensor_readings_router.router)
app.include_router(workspaces_router.router)
app.include_router(devices_router.router)
