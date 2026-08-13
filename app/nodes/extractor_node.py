import re
from typing import Any
from uuid import uuid4

from app.models.domain import BoundingBox, Evidence, ProductAttribute


_ATTRIBUTE_PATTERNS = (
    ("pressure_rating", r"(?P<key>Max\s+Pressure)\s*:\s*(?P<value>[^\n]+)"),
    ("material", r"(?P<key>Body\s+Material|Material)\s*:\s*(?P<value>[^\n]+)"),
    ("voltage_rating", r"(?P<key>Voltage)\s*:\s*(?P<value>[^\n]+)"),
    ("current_rating", r"(?P<key>Current)\s*:\s*(?P<value>[^\n]+)"),
)


def extract_attributes(state: dict[str, Any]) -> list[ProductAttribute]:
    markdown = str(state.get("raw_document_markdown") or "")
    attributes: list[ProductAttribute] = []
    for canonical_key, pattern in _ATTRIBUTE_PATTERNS:
        match = re.search(pattern, markdown, flags=re.IGNORECASE)
        if match is None:
            continue
        raw_value = match.group("value").strip()
        evidence_id = uuid4()
        evidence = Evidence(
            evidence_id=evidence_id,
            evidence_type="SOURCE",
            source_text=match.group(0),
            page_number=1,
            bounding_box=BoundingBox(
                page_number=1,
                top_pct=0.0,
                left_pct=0.0,
                width_pct=100.0,
                height_pct=100.0,
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
    return attributes

