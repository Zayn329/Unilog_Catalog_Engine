from typing import Mapping, NotRequired, TypedDict
from uuid import UUID

from app.models.domain import (
    CriticDecision,
    Product,
    ProductAttribute,
    ValidationReport,
)


class GraphState(TypedDict):
    job_id: UUID
    file_path: str
    raw_document_markdown: NotRequired[str | None]
    page_layout_map: NotRequired[Mapping[str, object] | None]
    category_id: NotRequired[str | None]
    category_confidence: NotRequired[float]
    sku_segments: NotRequired[list[Mapping[str, object]]]
    attributes: NotRequired[list[ProductAttribute]]
    validation_reports: NotRequired[list[ValidationReport]]
    critic_decision: NotRequired[CriticDecision | None]
    retry_count: NotRequired[int]
    has_critical_failures: NotRequired[bool]
    has_been_enriched: NotRequired[bool]
    product: NotRequired[Product | None]
