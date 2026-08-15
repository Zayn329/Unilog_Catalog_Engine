"""API endpoints for job lifecycle management."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.models import ProcessingJob
from app.db.session import get_session

router = APIRouter(prefix="/jobs", tags=["jobs"])

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_job(
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Upload a PDF file and initialize a catalog extraction job."""
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are supported for upload.",
        )

    job_id = uuid4()
    saved_filename = f"{job_id}_{filename}"
    saved_path = UPLOAD_DIR / saved_filename

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    saved_path.write_bytes(content)

    initial_state = {
        "job_id": str(job_id),
        "file_path": str(saved_path),
        "parse_status": None,
        "category_id": None,
        "attributes": [],
    }

    job = ProcessingJob(
        job_id=job_id,
        status="PENDING",
        file_path=str(saved_path),
        created_at=datetime.now(timezone.utc),
        graph_state_json=json.dumps(initial_state),
    )

    session.add(job)
    await session.commit()
    await session.refresh(job)

    return {
        "job_id": str(job.job_id),
        "status": job.status,
        "file_path": job.file_path,
        "created_at": job.created_at.isoformat(),
    }


@router.get("/{job_id}", status_code=status.HTTP_200_OK)
async def get_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Retrieve job status and processing state."""
    statement = select(ProcessingJob).where(ProcessingJob.job_id == job_id)
    result = await session.execute(statement)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    state = {}
    if job.graph_state_json:
        try:
            state = json.loads(job.graph_state_json)
        except Exception:
            state = {}
    else:
        state = {
            "job_id": str(job.job_id),
            "file_path": job.file_path,
            "parse_status": None,
            "category_id": None,
            "attributes": [],
        }

    return {
        "job_id": str(job.job_id),
        "status": job.status,
        "file_path": job.file_path,
        "total_pages": job.total_pages,
        "skus_found": job.skus_found,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "state": state,
    }
