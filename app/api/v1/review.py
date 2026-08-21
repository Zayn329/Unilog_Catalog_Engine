"""API endpoints for human review workbench."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, List, Literal, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from app.db.models import AttributeRecord, AuditLog, ProcessingJob
from app.db.session import get_session

router = APIRouter(prefix="/review", tags=["review"])


class ModifiedAttributePayload(BaseModel):
    attribute_id: Optional[UUID] = None
    canonical_key: Optional[str] = None
    raw_key: Optional[str] = None
    raw_value: Optional[str] = None
    normalized_value: Optional[str] = None
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    is_human_locked: bool = False
    locked_state_hash: Optional[str] = None
    evidence_id: Optional[UUID] = None


class ReviewSubmitRequest(BaseModel):
    job_id: UUID
    action: Literal["ACCEPT_AND_SUBMIT", "SAVE_DRAFT"]
    modified_attributes: List[ModifiedAttributePayload] = Field(
        default_factory=list,
        alias="attribute_updates",  # Allows both 'attribute_updates' and 'modified_attributes'
    )
    audit_reason: Optional[str] = None

    model_config = {"populate_by_name": True}


@router.get("/queue", status_code=status.HTTP_200_OK)
async def get_review_queue(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Return jobs requiring human review."""
    review_statuses = ["REVIEW_REQUIRED", "UNCLASSIFIED_HUMAN_REVIEW"]
    statement = select(ProcessingJob).where(
        col(ProcessingJob.status).in_(review_statuses)
    )
    result = await session.execute(statement)
    jobs = result.scalars().all()

    queue = []
    for job in jobs:
        queue.append(
            {
                "job_id": str(job.job_id),
                "status": job.status,
                "file_path": job.file_path,
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
        )
    return queue


def _compute_payload_hash(attr: ModifiedAttributePayload) -> str:
    evidence_id_str = str(attr.evidence_id or attr.attribute_id or "")
    parts = (
        str(attr.canonical_key or ""),
        str(attr.raw_value or ""),
        str(attr.normalized_value),
        str(attr.numeric_value),
        str(attr.unit),
        evidence_id_str,
    )
    return sha256("|".join(parts).encode("utf-8")).hexdigest()


def _get_utc_now_naive() -> datetime:
    """Return current UTC time without tzinfo for TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.post("/submit", status_code=status.HTTP_200_OK)
async def submit_review(
    payload: ReviewSubmitRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Process human review actions with Gate 8 protection and audit logging."""
    now = _get_utc_now_naive()

    if payload.action == "ACCEPT_AND_SUBMIT":
        if not payload.audit_reason or not payload.audit_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="audit_reason is required for ACCEPT_AND_SUBMIT",
            )

        # Gate 8 human-lock verification
        for attr in payload.modified_attributes:
            if attr.is_human_locked:
                expected_hash = _compute_payload_hash(attr)
                received_hash = attr.locked_state_hash or ""
                clean_received = received_hash.removeprefix("sha256:")
                if clean_received != expected_hash:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            f"Gate 8 rejected mutation of locked attribute "
                            f"{attr.attribute_id}: hash mismatch"
                        ),
                    )

                if attr.attribute_id:
                    stmt = select(AttributeRecord).where(
                        AttributeRecord.attribute_id == attr.attribute_id
                    )
                    res = await session.execute(stmt)
                    existing = res.scalar_one_or_none()
                    if existing and existing.is_human_locked:
                        existing_hash = (existing.locked_state_hash or "").removeprefix("sha256:")
                        if existing_hash and existing_hash != expected_hash:
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail=(
                                    f"Gate 8 rejected mutation of locked attribute "
                                    f"{attr.attribute_id}"
                                ),
                            )

        # Write immutable audit log
        audit_id = uuid4()
        audit_log = AuditLog(
            audit_id=audit_id,
            job_id=payload.job_id,
            user_id="human_reviewer",
            action="ACCEPT_AND_SUBMIT",
            reason_code=payload.audit_reason,
            timestamp=now,
            details_json=json.dumps(
                [a.model_dump(mode="json") for a in payload.modified_attributes]
            ),
        )
        session.add(audit_log)

        # Update job status
        job_stmt = select(ProcessingJob).where(ProcessingJob.job_id == payload.job_id)
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()
        if job:
            job.status = "COMPLETED"
            job.completed_at = now
            session.add(job)

            # Update product status directly in database
            product_id = getattr(job, "product_id", None)
            if product_id:
                await session.execute(
                    text("UPDATE productrecord SET status = 'PUBLISHED' WHERE product_id = :pid"),
                    {"pid": str(product_id)},
                )

        await session.commit()

        return {
            "status": "ACCEPTED",
            "job_id": str(payload.job_id),
            "audit_log_id": str(audit_id),
            "revalidation_triggered": False,
        }

    elif payload.action == "SAVE_DRAFT":
        job_stmt = select(ProcessingJob).where(ProcessingJob.job_id == payload.job_id)
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()
        if job:
            existing_state = {}
            if job.graph_state_json:
                try:
                    existing_state = json.loads(job.graph_state_json)
                except Exception:
                    existing_state = {}
            existing_state["modified_attributes"] = [
                a.model_dump(mode="json") for a in payload.modified_attributes
            ]
            existing_state["draft_saved_at"] = now.isoformat()
            job.graph_state_json = json.dumps(existing_state)
            session.add(job)
            await session.commit()

        return {
            "status": "DRAFT_SAVED",
            "job_id": str(payload.job_id),
            "audit_log_id": None,
            "revalidation_triggered": False,
        }

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported action: {payload.action}",
    )