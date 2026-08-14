import re
from typing import Any
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import BoundingBox, Evidence, ProductAttribute
from app.tools.docling_parser import PageLayout


class ExtractorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: str = Field(min_length=1)
    sku_segment: str | None = None
    raw_document_markdown: str = Field(min_length=1)
    page_layout_map: list[PageLayout]


class ExtractorOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attributes: list[ProductAttribute]


_ATTRIBUTE_PATTERNS = (
    ("pressure_rating", r"(?P<key>Max\s+Pressure)\s*:\s*(?P<value>[^\n]+)"),
    ("material", r"(?P<key>Body\s+Material|Material)\s*:\s*(?P<value>[^\n]+)"),
    ("voltage_rating", r"(?P<key>Voltage)\s*:\s*(?P<value>[^\n]+)"),
    ("current_rating", r"(?P<key>Current)\s*:\s*(?P<value>[^\n]+)"),
)


def extract_attributes(state: ExtractorInput) -> ExtractorOutput:
    if not isinstance(state, ExtractorInput):
        raise TypeError("extract_attributes requires ExtractorInput")
    markdown = state.raw_document_markdown
    attributes: list[ProductAttribute] = []
    for canonical_key, pattern in _ATTRIBUTE_PATTERNS:
        match = re.search(pattern, markdown, flags=re.IGNORECASE)
        if match is None:
            continue
        raw_value = match.group("value").strip()
        source_box = _find_source_box(state.page_layout_map, match.group(0))
        if source_box is None:
            continue
        evidence_id = uuid4()
        evidence = Evidence(
            evidence_id=evidence_id,
            evidence_type="SOURCE",
            source_text=match.group(0),
            page_number=1,
            bounding_box=BoundingBox(
                page_number=source_box.coordinates[0],
                top_pct=source_box.coordinates[1],
                left_pct=source_box.coordinates[2],
                width_pct=source_box.coordinates[3],
                height_pct=source_box.coordinates[4],
            ),
            confidence_score=1.0,
            is_verified=True,
        )
        attributes.append(
            ProductAttribute(
                attribute_id=uuid4(),
                canonical_key=canonical_key,
                raw_key=match.group("key"),
                raw_value=raw_value,
                normalization_method="REGEX",
                evidence=evidence,
                evidence_id=evidence_id,
            )
        )
    return ExtractorOutput(attributes=attributes)


def _find_source_box(page_layout_map: list[PageLayout], source_text: str):
    normalized_source = " ".join(source_text.casefold().split())
    for page in page_layout_map:
        for box in page.bounding_boxes:
            if normalized_source in " ".join(box.text.casefold().split()):
                return box
    return None
