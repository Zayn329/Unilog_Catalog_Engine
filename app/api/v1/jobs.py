"""API endpoints for job lifecycle management."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.models import AttributeRecord, ProductRecord, ProcessingJob
from app.db.session import async_session_factory, get_session, init_db
from app.graph import build_graph
from app.models.domain import Product, ProductStatusEnum

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class RetryJobRequest(BaseModel):
    """Request to re-run extraction on an existing job."""
    force_category_id: str | None = None
    skip_category_validation: bool = False


def _utc_now_naive() -> datetime:
    """Returns current UTC time without timezone metadata for asyncpg compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _jsonable(value: object) -> object:
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, (UUID, datetime)):
        return str(value)
    return value


def _product_status(product: Product) -> str:
    status_value = product.status
    if hasattr(status_value, "value"):
        return str(status_value.value)
    return str(status_value)


async def _persist_product(
    session: AsyncSession,
    job_id: UUID,
    product: Product,
) -> None:
    product_record = ProductRecord(
        product_id=product.product_id,
        job_id=job_id,
        sku=product.sku,
        category_id=product.category_id,
        status=_product_status(product),
        composite_confidence=product.composite_confidence,
        category_confidence=product.category_confidence,
        created_at=_utc_now_naive(),
    )
    session.add(product_record)
    for attribute in product.attributes:
        evidence = attribute.evidence
        bounding_box_json = None
        if evidence.bounding_box is not None:
            bounding_box_json = json.dumps(
                [
                    evidence.bounding_box.page_number,
                    evidence.bounding_box.top_pct,
                    evidence.bounding_box.left_pct,
                    evidence.bounding_box.width_pct,
                    evidence.bounding_box.height_pct,
                ]
            )
        parent_ids_json = (
            json.dumps([str(parent_id) for parent_id in evidence.parent_attribute_ids])
            if evidence.parent_attribute_ids
            else None
        )
        
        norm_method = attribute.normalization_method
        norm_method_str = norm_method.value if hasattr(norm_method, "value") else str(norm_method)

        evidence_type = evidence.evidence_type
        evidence_type_str = evidence_type.value if hasattr(evidence_type, "value") else str(evidence_type)

        session.add(
            AttributeRecord(
                attribute_id=attribute.attribute_id,
                product_id=product.product_id,
                canonical_key=attribute.canonical_key,
                raw_key=attribute.raw_key,
                raw_value=attribute.raw_value,
                normalized_value=attribute.normalized_value,
                numeric_value=attribute.numeric_value,
                unit=attribute.unit,
                attribute_confidence=attribute.attribute_confidence,
                normalization_method=norm_method_str,
                is_derived=attribute.is_derived,
                is_human_locked=attribute.is_human_locked,
                locked_state_hash=attribute.locked_state_hash,
                requires_human_review=attribute.requires_human_review,
                evidence_id=evidence.evidence_id,
                evidence_type=evidence_type_str,
                source_text=evidence.source_text,
                page_number=evidence.page_number,
                bounding_box_json=bounding_box_json,
                rule_id=evidence.rule_id,
                parent_attribute_ids_json=parent_ids_json,
                evidence_confidence=evidence.confidence_score,
                evidence_is_verified=evidence.is_verified,
            )
        )


async def process_job_background(
    job_id: UUID,
    file_path: str,
    force_category_id: str | None = None,
    skip_category_validation: bool = False,
) -> None:
    """Execute one uploaded document using an independent database session."""
    await init_db()
    async with async_session_factory() as session:
        job = await session.get(ProcessingJob, job_id)
        if job is None:
            logger.error("Background job %s disappeared before processing", job_id)
            return
        job.status = "PROCESSING"
        session.add(job)
        await session.commit()

    try:
        graph = build_graph()
        initial_state = {
            "job_id": job_id,
            "file_path": file_path,
            "raw_document_markdown": None,
            "document_markdown": None,
            "page_layout_map": None,
            "parse_status": None,
            "terminal_status": None,
            "category_id": force_category_id,
            "category_confidence": 0.0,
            "sku_segments": [],
            "attributes": [],
            "validation_reports": [],
            "retry_count": 0,
            "has_critical_failures": False,
            "has_been_enriched": False,
            "product": None,
            "force_category_id": force_category_id,
            "skip_category_validation": skip_category_validation,
        }
        final_state = graph.invoke(initial_state)
        product = final_state.get("product")
        if product is not None and not isinstance(product, Product):
            raise TypeError("Graph returned an invalid Product state")

        parse_status = final_state.get("parse_status")
        terminal_status = final_state.get("terminal_status")
        if parse_status != "SUCCESS":
            job_status = "FAILED_PARSING"
            error_code = "FAILED_PARSING"
            error_message = (
                final_state.get("error_message")
                or "PDF parsing failed before a product could be extracted."
            )
        elif terminal_status == "UNCLASSIFIED_HUMAN_REVIEW":
            job_status = "UNCLASSIFIED_HUMAN_REVIEW"
            error_code = None
            error_message = None
        elif product is not None and _product_status(product) == "REVIEW_REQUIRED":
            job_status = "REVIEW_REQUIRED"
            error_code = None
            error_message = None
        else:
            job_status = "COMPLETED"
            error_code = None
            error_message = None

        page_layout_map = final_state.get("page_layout_map") or []
        sku_segments = final_state.get("sku_segments") or []
        async with async_session_factory() as session:
            job = await session.get(ProcessingJob, job_id)
            if job is None:
                logger.error("Background job %s disappeared during persistence", job_id)
                return
            job.status = job_status
            job.total_pages = len(page_layout_map)
            job.skus_found = len(sku_segments) or (1 if product is not None else 0)
            job.completed_at = _utc_now_naive()
            job.error_code = error_code
            job.error_message = error_message
            job.graph_state_json = json.dumps(_jsonable(final_state))
            session.add(job)
            if product is not None:
                await _persist_product(session, job_id, product)
            await session.commit()
    except Exception as exc:
        logger.exception("Graph execution failed for job %s", job_id)
        async with async_session_factory() as session:
            job = await session.get(ProcessingJob, job_id)
            if job is not None:
                job.status = "FAILED"
                job.completed_at = _utc_now_naive()
                job.error_code = "GRAPH_EXECUTION_FAILED"
                job.error_message = str(exc) or "Graph execution failed."
                session.add(job)
                await session.commit()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_job(
    file: UploadFile,
    background_tasks: BackgroundTasks,
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
        "raw_document_markdown": None,
        "document_markdown": None,
        "page_layout_map": None,
        "category_id": None,
        "category_confidence": 0.0,
        "attributes": [],
        "validation_reports": [],
        "terminal_status": None,
    }

    job = ProcessingJob(
        job_id=job_id,
        status="PENDING",
        file_path=str(saved_path),
        created_at=_utc_now_naive(),
        graph_state_json=json.dumps(initial_state),
    )

    session.add(job)
    await session.commit()
    await session.refresh(job)
    background_tasks.add_task(process_job_background, job_id, str(saved_path))

    return {
        "job_id": str(job.job_id),
        "status": job.status,
        "file_path": job.file_path,
        "created_at": job.created_at.isoformat(),
    }


@router.post("/{job_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_job(
    job_id: UUID,
    request: RetryJobRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Re-run extraction on an existing job with optional overrides."""
    job = await session.get(ProcessingJob, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    file_path = job.file_path
    if not Path(file_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file no longer exists on disk",
        )

    job.status = "PROCESSING"
    job.completed_at = None
    job.error_code = None
    job.error_message = None
    session.add(job)
    await session.commit()

    background_tasks.add_task(
        process_job_background,
        job_id,
        file_path,
        force_category_id=request.force_category_id,
        skip_category_validation=request.skip_category_validation,
    )

    return {
        "job_id": str(job_id),
        "status": "PROCESSING",
        "message": "Extraction retry started",
    }


@router.get("", status_code=status.HTTP_200_OK)
async def list_jobs(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    """Return all processing jobs."""
    statement = select(ProcessingJob).order_by(ProcessingJob.created_at.desc())
    result = await session.execute(statement)
    jobs = result.scalars().all()

    jobs_list = []
    for job in jobs:
        jobs_list.append(
            {
                "job_id": str(job.job_id),
                "status": job.status,
                "file_path": job.file_path,
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
        )
    return jobs_list


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