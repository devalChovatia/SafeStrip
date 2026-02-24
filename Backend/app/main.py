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

orig_host = ""  
app.add_middleware(
    CORSMiddleware,
    allow_origins=[orig_host],
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
