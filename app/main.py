"""FastAPI main entrypoint for Unilog Catalog Engine."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.jobs import router as jobs_router
from app.api.v1.review import router as review_router
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Unilog Catalog Engine API",
    description="AI-assisted industrial catalog extraction, validation, enrichment, and human-in-the-loop review.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router, prefix="/api/v1")
app.include_router(review_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
