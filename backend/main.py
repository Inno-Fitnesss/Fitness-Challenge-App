import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.util.init_db import create_tables, seed_exercises, seed_preset_challenges, sync_schema
from app.routers.auth import authRouter
from app.routers.admin import adminRouter
from app.routers.challenges import challengeRouter
from app.routers.exercises import exerciseRouter
from app.routers.me import meRouter
from app.routers.public import publicRouter
from app.routers.steps import stepsRouter
from app.routers.withings import withingsRouter
from app.util.protectRoute import get_current_user
from app.db.schema.user import UserOutput

@asynccontextmanager
async def lifespan(app : FastAPI):
    create_tables()
    sync_schema()
    seed_exercises()
    seed_preset_challenges()
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
app.include_router(router=adminRouter, tags=["admin"], prefix="/admin")
app.include_router(router=challengeRouter, tags=["challenges"], prefix="/challenges")
app.include_router(router=exerciseRouter, tags=["exercises"], prefix="/exercises")
app.include_router(router=meRouter, tags=["me"], prefix="/me")
app.include_router(router=publicRouter, tags=["public"], prefix="/public")
app.include_router(router=stepsRouter, tags=["steps"], prefix="/me/steps")
app.include_router(router=withingsRouter, tags=["withings"], prefix="/me/withings")

@app.get("/health")
def health():
    return {"status" : "Running...."}

@app.get("/protected")
def read_protected(user : UserOutput = Depends(get_current_user)):
    return {"data" : user}
