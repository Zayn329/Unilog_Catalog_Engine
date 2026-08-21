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
    r"Model\s*:\s*(?P<sku>[A-Z0-9-]+)",
    r"SKU\s*:\s*(?P<sku>[A-Z0-9-]+)",
    r"Item\s*(?:#|No\.?)\s*:\s*(?P<sku>[A-Z0-9-]+)",
    r"Part\s*(?:#|No\.?|Number)?\s*:\s*(?P<sku>[A-Z0-9-]+)",
    r"Series\s*:\s*(?P<sku>[A-Z0-9-]+)",
)

_ATTRIBUTE_PATTERNS = (
    ("pressure_rating", r"(?P<key>Max(?:\s+Working)?\s+Pressure|Pressure(?:\s+Rating)?)\s*:\s*\n*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:PSI|bar|kPa|MPa)(?:\s*@[^\n]+)?)"),
    ("max_operating_temperature_f", r"(?P<key>Max(?:\s+Operating)?\s+Temperature|Operating\s+Temp(?:erature)?)\s*:\s*\n*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:[°ºA\s]*[FC]))"),
    ("body_material", r"(?P<key>Body\s+Material(?:\s*\([^)]*\))?|Material)\s*:\s*(?P<value>[^\n|]+?)(?=\s*(?:Seat|O-Ring|End|Voltage|Current|Power|Weight|Max|\(Rigid|\||$))"),
    ("seat_material", r"(?P<key>Seat\s+Material)\s*:\s*(?P<value>[^\n|]+?)(?=\s*(?:O-Ring|End|Body|Material|\(Poly|\||$))"),
    ("seal_material", r"(?P<key>O-Ring\s+Seals?|Seal\s+Material)\s*:\s*(?P<value>[^\n|]+?)(?=\s*(?:End|Seat|Body|Material|Dual|\||$))"),
    ("end_connection", r"(?P<key>End\s+Connection)\s*:\s*(?P<value>[^\n|]+?)(?=\s*(?:Seat|O-Ring|Body|Material|\||$))"),
    ("outer_diameter", r"(?P<key>Outer\s+Diameter(?:\s*\([^)]*\))?)\s+[A-Za-z0-9\s]*?\s*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:in|mm|cm))"),
    ("inner_diameter", r"(?P<key>Inner\s+Diameter(?:\s*\([^)]*\))?)\s+[A-Za-z0-9\s]*?\s*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:in|mm|cm))"),
    ("length", r"(?P<key>Overall\s+Length(?:\s*\([^)]*\))?|Length)\s+[A-Za-z0-9\s]*?\s*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:in|mm|cm))"),
    ("flange_diameter", r"(?P<key>Flange\s+Diameter)\s+[A-Za-z0-9\s]*?\s*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:in|mm|cm))"),
    ("port_size", r"(?P<key>Nominal\s+Port\s+Size|Port\s+Size)\s+[A-Za-z0-9\s]*?\s*(?P<value>[0-9]+(?:\.[0-9]+)?\s*(?:in|mm|cm))"),
    ("voltage_rating", r"(?P<key>Voltage(?:\s+Rating)?)\s*:\s*(?P<value>[^\n\s]+(?:\s*V(?:\s*AC|\s*DC)?)?)"),
    ("current_rating", r"(?P<key>Current(?:\s+Rating)?)\s*:\s*(?P<value>[^\n\s]+(?:\s*A)?)"),
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
        raw_key = match.group("key").strip()
        raw_value = match.group("value").strip()
        coords = _find_source_box(state.page_layout_map, match.group(0), raw_key, raw_value)

        evidence_id = uuid4()
        evidence = Evidence(
            evidence_id=evidence_id,
            evidence_type="SOURCE",
            source_text=match.group(0).strip(),
            page_number=int(coords[0]),
            bounding_box=BoundingBox(
                page_number=int(coords[0]),
                top_pct=float(coords[1]),
                left_pct=float(coords[2]),
                width_pct=float(coords[3]),
                height_pct=float(coords[4]),
            ),
            confidence_score=0.95,
            is_verified=True,
        )
        extracted = ProductAttribute(
            attribute_id=uuid4(),
            canonical_key=canonical_key,
            raw_key=raw_key,
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


def _find_source_box(
    page_layout_map: list[PageLayout],
    source_text: str,
    raw_key: str = "",
    raw_value: str = "",
) -> tuple[int, float, float, float, float]:
    norm_source = " ".join(source_text.casefold().split())
    # 1. Exact or substring match in a single box
    for page in page_layout_map:
        for box in page.bounding_boxes:
            box_text = " ".join(box.text.casefold().split())
            if norm_source in box_text or box_text in norm_source:
                return box.coordinates

    # 2. Key text match
    if raw_key:
        norm_key = " ".join(raw_key.casefold().split())
        for page in page_layout_map:
            for box in page.bounding_boxes:
                if norm_key in " ".join(box.text.casefold().split()):
                    return box.coordinates

    # 3. Value text match
    if raw_value:
        norm_val = " ".join(raw_value.casefold().split())
        for page in page_layout_map:
            for box in page.bounding_boxes:
                if norm_val in " ".join(box.text.casefold().split()):
                    return box.coordinates

    # 4. Fallback to first box on the page
    if page_layout_map and page_layout_map[0].bounding_boxes:
        return page_layout_map[0].bounding_boxes[0].coordinates

    return (1, 10.0, 10.0, 80.0, 5.0)