from datetime import datetime, timezone
from typing import get_type_hints
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.domain import (
    BoundingBox,
    CriticDecision,
    Evidence,
    ProcessingJob,
    Product,
    ProductAttribute,
    ValidationReport,
)
from app.state import GraphState


def source_evidence(**overrides) -> Evidence:
    values = {
        "evidence_id": uuid4(),
        "evidence_type": "SOURCE",
        "source_text": "Max Pressure: 600 PSI",
        "page_number": 1,
        "bounding_box": BoundingBox(
            page_number=1,
            top_pct=10.0,
            left_pct=20.0,
            width_pct=30.0,
            height_pct=15.0,
        ),
        "confidence_score": 0.98,
        "is_verified": True,
    }
    values.update(overrides)
    return Evidence(**values)


def test_processing_job_validates_identity_status_and_timestamps() -> None:
    created_at = datetime.now(timezone.utc)
    completed_at = datetime.now(timezone.utc)

    job = ProcessingJob(
        job_id=uuid4(),
        status="PROCESSING",
        file_path="vendor/catalog.pdf",
        created_at=created_at,
        completed_at=completed_at,
    )

    assert job.job_id
    assert job.status == "PROCESSING"
    assert job.created_at == created_at
    assert job.completed_at == completed_at


def test_product_attribute_preserves_canonical_value_and_evidence() -> None:
    evidence = source_evidence()
    attribute = ProductAttribute(
        attribute_id=uuid4(),
        canonical_key="pressure_rating",
        raw_key="Max Pressure",
        raw_value="600 PSI",
        normalized_value="600 PSI",
        numeric_value=600.0,
        unit="PSI",
        attribute_confidence=0.98,
        normalization_method="PINT",
        is_human_locked=True,
        locked_state_hash="sha256:locked-value",
        evidence=evidence,
    )
    product = Product(
        product_id=uuid4(),
        sku="VALVE-600",
        category_id="BALL_VALVE",
        status="VALIDATED",
        attributes=[attribute],
        composite_confidence=0.96,
    )

    assert product.attributes[0].canonical_key == "pressure_rating"
    assert product.attributes[0].numeric_value == 600.0
    assert product.attributes[0].unit == "PSI"
    assert product.attributes[0].evidence.evidence_id == evidence.evidence_id
    assert product.attributes[0].is_human_locked is True
    assert product.attributes[0].locked_state_hash == "sha256:locked-value"


@pytest.mark.parametrize(
    "field,value",
    [
        ("page_number", 0),
        ("top_pct", -0.01),
        ("top_pct", 100.01),
        ("left_pct", -0.01),
        ("left_pct", 100.01),
        ("width_pct", -0.01),
        ("width_pct", 100.01),
        ("height_pct", -0.01),
        ("height_pct", 100.01),
    ],
)
def test_bounding_box_rejects_invalid_coordinates(field: str, value: float) -> None:
    with pytest.raises(ValidationError):
        values = {
            "page_number": 1,
            "top_pct": 10.0,
            "left_pct": 20.0,
            "width_pct": 30.0,
            "height_pct": 15.0,
        }
        values[field] = value
        BoundingBox(**values)


def test_evidence_rejects_confidence_outside_unit_interval() -> None:
    with pytest.raises(ValidationError):
        source_evidence(confidence_score=1.01)

    with pytest.raises(ValidationError):
        source_evidence(confidence_score=-0.01)


def test_source_evidence_requires_source_location() -> None:
    with pytest.raises(ValidationError):
        source_evidence(bounding_box=None)


def test_validation_report_and_critic_decision_are_typed() -> None:
    attribute_id = uuid4()
    report = ValidationReport(
        report_id=uuid4(),
        attribute_id=attribute_id,
        passed=False,
        rule_name="PVC_MAX_TEMPERATURE",
        severity="CRITICAL",
        error_message="PVC cannot operate at 300 Celsius.",
    )
    decision = CriticDecision(
        decision_id=uuid4(),
        action="ESCALATE_HUMAN",
        target_attributes=[attribute_id],
        rationale="Critical validation failure remains after bounded retries.",
    )

    assert report.attribute_id == attribute_id
    assert report.severity == "CRITICAL"
    assert decision.action == "ESCALATE_HUMAN"
    assert decision.target_attributes == [attribute_id]


def test_graph_state_matches_architecture_typed_dict_structure() -> None:
    expected_keys = {
        "job_id",
        "file_path",
        "raw_document_markdown",
        "page_layout_map",
        "category_id",
        "category_confidence",
        "sku_segments",
        "attributes",
        "validation_reports",
        "critic_decision",
        "retry_count",
        "has_critical_failures",
        "has_been_enriched",
        "product",
    }

    assert set(get_type_hints(GraphState)) == expected_keys
