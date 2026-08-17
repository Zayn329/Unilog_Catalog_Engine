"""FastAPI main entrypoint for Unilog Catalog Engine."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.jobs import router as jobs_router
from app.api.v1.products import router as products_router
from app.api.v1.review import router as review_router
from app.db.session import DATABASE_URL, init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Unilog Catalog Engine API...")
    await init_db()

    llm_configured = bool(os.getenv("GROQ_API_KEY"))
    qdrant_configured = bool(os.getenv("QDRANT_HOST"))
    db_type = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"

    logger.info("Service configurations:")
    logger.info("  - Database Backend: %s", db_type.upper())
    logger.info("  - Groq LLM: %s", "CONFIGURED" if llm_configured else "NOT_CONFIGURED")
    logger.info("  - Qdrant Vector Store: %s", "CONFIGURED" if qdrant_configured else "NOT_CONFIGURED")

    yield
    logger.info("Shutting down Unilog Catalog Engine API...")


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
app.include_router(products_router, prefix="/api/v1")
app.include_router(review_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, Any]:
    """Health check endpoint with service configuration diagnostics."""
    db_type = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"
    return {
        "status": "ok",
        "database": db_type,
        "llm_configured": bool(os.getenv("GROQ_API_KEY")),
        "vector_store_configured": bool(os.getenv("QDRANT_HOST")),
    }