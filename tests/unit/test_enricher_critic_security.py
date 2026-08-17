from uuid import uuid4

import pytest

from app.models.domain import (
    BoundingBox,
    Evidence,
    ProductAttribute,
    ValidationReport,
)
from app.nodes.critic_node import CriticInput, MAX_RETRIES, process_critic
from app.nodes.enricher_node import EnricherInput, enrich_attributes
from app.nodes.extractor_node import ExtractorInput, extract_attributes
from app.nodes.normalizer_node import NormalizerInput, normalize_attributes
from app.security.gate8 import (
    LockedAttributeMutationError,
    SecurityException,
    compute_locked_state_hash,
    verify_locked_attribute_mutation,
)
from app.tools.docling_parser import LayoutBox, PageLayout


def source_attribute(
    canonical_key: str,
    raw_value: str,
    *,
    numeric_value: float | None = None,
    unit: str | None = None,
) -> ProductAttribute:
    evidence_id = uuid4()
    return ProductAttribute(
        attribute_id=uuid4(),
        canonical_key=canonical_key,
        raw_key=canonical_key,
        raw_value=raw_value,
        numeric_value=numeric_value,
        unit=unit,
        normalization_method="REGEX",
        evidence_id=evidence_id,
        evidence=Evidence(
            evidence_id=evidence_id,
            evidence_type="SOURCE",
            source_text=raw_value,
            page_number=1,
            bounding_box=BoundingBox(
                page_number=1,
                top_pct=10.0,
                left_pct=10.0,
                width_pct=20.0,
                height_pct=5.0,
            ),
            confidence_score=1.0,
        ),
    )


def test_enricher_injects_corrosion_resistance_with_rule_evidence() -> None:
    attributes = [source_attribute("material", "stainless steel")]

    result = enrich_attributes(
        EnricherInput(category_id="PIPING", attributes=attributes)
    )

    derived = next(
        attribute
        for attribute in result.attributes
        if attribute.canonical_key == "is_corrosion_resistant"
    )
    assert derived.is_derived is True
    assert derived.evidence.evidence_type == "RULE"
    assert derived.evidence.rule_id


def test_critic_routes_fourth_failure_to_review_required() -> None:
    assert MAX_RETRIES == 3
    report = ValidationReport(
        report_id=uuid4(),
        attribute_id=uuid4(),
        passed=False,
        rule_name="PVC_MAX_OPERATING_TEMP",
        severity="CRITICAL",
        error_message="PVC operating temperature exceeds 60 degC",
    )

    result = process_critic(
        CriticInput(validation_reports=[report], retry_count=MAX_RETRIES)
    )

    assert result.retry_count == MAX_RETRIES + 1
    assert result.route == "REVIEW_REQUIRED"


def test_gate8_rejects_mutation_of_human_locked_attribute() -> None:
    locked = source_attribute("dimensions", "0.5 IN")
    locked = locked.model_copy(update={"is_human_locked": True})
    locked = locked.model_copy(
        update={"locked_state_hash": compute_locked_state_hash(locked)}
    )
    mutated = locked.model_copy(update={"raw_value": "0.75 IN"})

    with pytest.raises(LockedAttributeMutationError):
        verify_locked_attribute_mutation(locked, mutated)


def test_gate8_hash_includes_normalized_value() -> None:
    attribute = source_attribute("dimensions", "0.5 IN")
    first = compute_locked_state_hash(attribute)
    changed = attribute.model_copy(update={"normalized_value": "12.7 mm"})

    assert compute_locked_state_hash(changed) != first


def test_normalizer_rejects_invalid_locked_state_hash() -> None:
    locked = source_attribute("diameter", "0.5 IN", numeric_value=0.5, unit="in")
    locked = locked.model_copy(
        update={"is_human_locked": True, "locked_state_hash": "invalid"}
    )

    with pytest.raises(SecurityException):
        normalize_attributes(NormalizerInput(attributes=[locked]))


def test_extractor_rejects_invalid_locked_state_hash_before_skipping_attribute() -> None:
    locked = source_attribute("pressure_rating", "600 PSI")
    locked = locked.model_copy(
        update={"is_human_locked": True, "locked_state_hash": "invalid"}
    )
    page_layout = PageLayout(
        page_number=1,
        text="Max Pressure: 600 PSI",
        bounding_boxes=[
            LayoutBox(
                text="Max Pressure: 600 PSI",
                coordinates=(1, 10.0, 10.0, 20.0, 5.0),
            )
        ],
    )

    with pytest.raises(SecurityException):
        extract_attributes(
            ExtractorInput(
                category_id="CAT_PIPING_001",
                raw_document_markdown="Max Pressure: 600 PSI",
                page_layout_map=[page_layout],
                existing_attributes=[locked],
            )
        )
