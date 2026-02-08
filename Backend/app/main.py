from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models 
from .database import engine
from .routers import null_router

app = FastAPI()

orig_host = ""  
app.add_middleware(
    CORSMiddleware,
    allow_origins=[orig_host],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)


app.include_router(null_router.router)
