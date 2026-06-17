import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.util.init_db import create_tables
from app.routers.auth import authRouter
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput

@asynccontextmanager
async def lifespan(app : FastAPI):
    create_tables()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router=authRouter, tags=["auth"], prefix="/auth")
# /auth/login
# /auth/signup

@app.get("/health")
def health():
    return {"status" : "Running...."}

@app.get("/protected")
def read_protected(user : UserOutput = Depends(get_current_user)):
    return {"data" : user}