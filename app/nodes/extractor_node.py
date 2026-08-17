import re
from typing import Any
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import BoundingBox, Evidence, ProductAttribute
from app.security.gate8 import verify_locked_attribute_mutation
from app.tools.docling_parser import PageLayout


class ExtractorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: str = Field(min_length=1)
    sku_segment: str | None = None
    raw_document_markdown: str = Field(min_length=1)
    page_layout_map: list[PageLayout]
    existing_attributes: list[ProductAttribute] = Field(default_factory=list)


class ExtractorOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_sku: str | None = None
    attributes: list[ProductAttribute]


_SKU_PATTERNS = (
    r"SKU\s*:\s*(?P<sku>[A-Z0-9-]+)",
    r"Item\s*(?:#|No\.?)\s*:\s*(?P<sku>[A-Z0-9-]+)",
    r"Part\s*(?:#|No\.?)\s*:\s*(?P<sku>[A-Z0-9-]+)",
)

_ATTRIBUTE_PATTERNS = (
    ("pressure_rating", r"(?P<key>Max\s+Pressure|Pressure)\s*:\s*(?P<value>[^\n\s]+(?:\s*(?:PSI|bar|kPa))?)"),
    ("material", r"(?P<key>Body\s+Material|Material)\s*:\s*(?P<value>[^\n]+?)(?=\s+(?:Voltage|Current|Power|Weight|Max)|$)"),
    ("voltage_rating", r"(?P<key>Voltage)\s*:\s*(?P<value>[^\n\s]+(?:\s*V(?:\s*AC|\s*DC)?)?)"),
    ("current_rating", r"(?P<key>Current)\s*:\s*(?P<value>[^\n\s]+(?:\s*A)?)"),
    ("power_rating", r"(?P<key>Power\s+Rating|Power)\s*:\s*(?P<value>[^\n\s]+(?:\s*(?:HP|kW))?)"),
    ("weight", r"(?P<key>Weight)\s*:\s*(?P<value>[^\n\s]+(?:\s*(?:kg|lbs|g))?)"),
)


def extract_attributes(state: ExtractorInput) -> ExtractorOutput:
    if not isinstance(state, ExtractorInput):
        raise TypeError("extract_attributes requires ExtractorInput")
    markdown = state.raw_document_markdown
    attributes: list[ProductAttribute] = []
    
    extracted_sku: str | None = None
    for sku_pattern in _SKU_PATTERNS:
        sku_match = re.search(sku_pattern, markdown, flags=re.IGNORECASE)
        if sku_match:
            extracted_sku = sku_match.group("sku").strip()
            break

    locked_by_key = {
        attribute.canonical_key: attribute
        for attribute in state.existing_attributes
        if attribute.is_human_locked
    }
    for locked_attribute in locked_by_key.values():
        verify_locked_attribute_mutation(locked_attribute, locked_attribute)

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
        extracted = ProductAttribute(
            attribute_id=uuid4(),
            canonical_key=canonical_key,
            raw_key=match.group("key"),
            raw_value=raw_value,
            normalization_method="REGEX",
            evidence=evidence,
            evidence_id=evidence_id,
        )
        locked_attribute = locked_by_key.get(canonical_key)
        if locked_attribute is not None:
            proposed = extracted.model_copy(
                update={
                    "attribute_id": locked_attribute.attribute_id,
                    "evidence": locked_attribute.evidence,
                    "evidence_id": locked_attribute.evidence_id,
                    "normalized_value": (
                        extracted.normalized_value
                        if extracted.normalized_value is not None
                        else locked_attribute.normalized_value
                    ),
                    "numeric_value": (
                        extracted.numeric_value
                        if extracted.numeric_value is not None
                        else locked_attribute.numeric_value
                    ),
                    "unit": extracted.unit or locked_attribute.unit,
                }
            )
            verify_locked_attribute_mutation(locked_attribute, proposed)
            attributes.append(locked_attribute)
        else:
            attributes.append(extracted)

    return ExtractorOutput(extracted_sku=extracted_sku, attributes=attributes)


def _find_source_box(page_layout_map: list[PageLayout], source_text: str):
    normalized_source = " ".join(source_text.casefold().split())
    for page in page_layout_map:
        for box in page.bounding_boxes:
            if normalized_source in " ".join(box.text.casefold().split()):
                return box
    return None