from typing import Literal, Mapping, NotRequired, TypedDict
from uuid import UUID

from app.models.domain import (
    CriticDecision,
    Product,
    ProductAttribute,
    ValidationReport,
)
from app.tools.docling_parser import PageLayout


class GraphState(TypedDict):
    job_id: UUID
    file_path: str
    raw_document_markdown: NotRequired[str | None]
    document_markdown: NotRequired[str | None]
    page_layout_map: NotRequired[list[PageLayout] | None]
    parse_status: NotRequired[Literal["SUCCESS", "FAILED"]]
    terminal_status: NotRequired[Literal["FAILED_PARSING", "UNCLASSIFIED_HUMAN_REVIEW"] | None]
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