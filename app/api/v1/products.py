"""Catalog product and synchronous cross-reference endpoints."""

from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.db.models import ProductRecord
from app.db.session import get_session
from app.models.domain import (
    BoundingBox,
    Evidence,
    EvidenceTypeEnum,
    NormalizationMethodEnum,
    Product,
    ProductAttribute,
    ProductStatusEnum,
)
from app.nodes.cross_reference_node import (
    AttributeDelta,
    cross_reference_product,
)
from app.tools.qdrant_search import QdrantSearchService

router = APIRouter(prefix="/products", tags=["products"])
_search_service: QdrantSearchService | None = None


class CrossReferenceCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_product_id: UUID
    sku: str
    parity_percentage: float
    delta_summary: dict[str, AttributeDelta]


class CrossReferenceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidates: list[CrossReferenceCandidate]


def _get_search_service() -> QdrantSearchService:
    global _search_service
    if _search_service is None:
        # Local development remains usable without a running Qdrant daemon;
        # deployments set QDRANT_URL for the persistent service.
        location = None if os.getenv("QDRANT_URL") else ":memory:"
        _search_service = QdrantSearchService(location=location)
    return _search_service


def _decode_box(raw: str | None, page_number: int | None) -> BoundingBox:
    if not raw:
        raise ValueError("SOURCE evidence is missing bounding_box_json")
    value: Any = json.loads(raw)
    if isinstance(value, list):
        if len(value) == 5:
            page_number = int(value[0])
            value = value[1:]
        if len(value) != 4:
            raise ValueError("bounding_box_json must contain four or five coordinates")
        value = {
            "page_number": page_number or 1,
            "top_pct": value[0],
            "left_pct": value[1],
            "width_pct": value[2],
            "height_pct": value[3],
        }
    return BoundingBox.model_validate(value)


def _record_to_product(record: ProductRecord) -> Product:
    attributes: list[ProductAttribute] = []
    for item in record.attributes:
        evidence_type = EvidenceTypeEnum(item.evidence_type)
        parent_ids = (
            [UUID(value) for value in json.loads(item.parent_attribute_ids_json)]
            if item.parent_attribute_ids_json
            else None
        )
        evidence = Evidence(
            evidence_id=item.evidence_id,
            evidence_type=evidence_type,
            source_text=item.source_text,
            page_number=item.page_number,
            bounding_box=_decode_box(item.bounding_box_json, item.page_number)
            if evidence_type is EvidenceTypeEnum.SOURCE
            else None,
            rule_id=item.rule_id,
            parent_attribute_ids=parent_ids,
            confidence_score=item.evidence_confidence,
            is_verified=item.evidence_is_verified,
        )
        attributes.append(
            ProductAttribute(
                attribute_id=item.attribute_id,
                canonical_key=item.canonical_key,
                raw_key=item.raw_key,
                raw_value=item.raw_value,
                normalized_value=item.normalized_value,
                numeric_value=item.numeric_value,
                unit=item.unit,
                attribute_confidence=item.attribute_confidence,
                normalization_method=NormalizationMethodEnum(item.normalization_method),
                is_derived=item.is_derived,
                is_human_locked=item.is_human_locked,
                locked_state_hash=item.locked_state_hash,
                requires_human_review=item.requires_human_review,
                evidence=evidence,
                evidence_id=item.evidence_id,
            )
        )
    return Product(
        product_id=record.product_id,
        sku=record.sku,
        category_id=record.category_id,
        status=ProductStatusEnum(record.status),
        attributes=attributes,
        composite_confidence=record.composite_confidence,
        category_confidence=record.category_confidence,
    )


@router.get(
    "/{product_id}/cross-reference",
    response_model=CrossReferenceResponse,
    status_code=status.HTTP_200_OK,
)
async def get_cross_reference(
    product_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> CrossReferenceResponse:
    statement = (
        select(ProductRecord)
        .where(ProductRecord.product_id == product_id)
        .options(selectinload(ProductRecord.attributes))
    )
    result = await session.execute(statement)
    target_record = result.scalar_one_or_none()
    if target_record is None:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

    target = _record_to_product(target_record)
    if target.status is not ProductStatusEnum.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cross-reference is available only for PUBLISHED products",
        )

    published_statement = (
        select(ProductRecord)
        .where(ProductRecord.status == ProductStatusEnum.PUBLISHED.value)
        .options(selectinload(ProductRecord.attributes))
    )
    published_result = await session.execute(published_statement)
    service = _get_search_service()
    for record in published_result.scalars().all():
        service.upsert_product(_record_to_product(record))

    comparison = cross_reference_product(target, service, limit=3)
    return CrossReferenceResponse(
        candidates=[
            CrossReferenceCandidate(
                candidate_product_id=item.competitor_product_id,
                sku=item.competitor_sku,
                parity_percentage=item.parity_score * 100.0,
                delta_summary=item.delta_matrix,
            )
            for item in comparison.comparisons
        ]
    )
