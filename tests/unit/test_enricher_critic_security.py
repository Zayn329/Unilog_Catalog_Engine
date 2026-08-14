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
from app.security.gate8 import (
    LockedAttributeMutationError,
    compute_locked_state_hash,
    verify_locked_attribute_mutation,
)


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

