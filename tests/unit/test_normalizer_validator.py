from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.domain import BoundingBox, Evidence, ProductAttribute
from app.nodes.normalizer_node import normalize_scalar, normalize_temperature
from app.nodes.validator_node import validate_attributes


def source_attribute(
    canonical_key: str,
    raw_value: str,
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
            is_verified=True,
        ),
    )


@pytest.mark.parametrize(
    ("value", "from_unit", "to_unit", "expected"),
    [
        (10.0, "bar", "MPa", 1.0),
        (2.0, "inch", "mm", 50.8),
    ],
)
def test_normalize_scalar_uses_pint_for_unit_conversion(
    value: float,
    from_unit: str,
    to_unit: str,
    expected: float,
) -> None:
    result = normalize_scalar(value, from_unit, to_unit)

    assert result.value == pytest.approx(expected)
    assert result.unit == to_unit


def test_normalize_temperature_performs_affine_conversions() -> None:
    fahrenheit = normalize_temperature(100.0, "degC", "degF")
    kelvin = normalize_temperature(100.0, "degC", "K")

    assert fahrenheit.value == pytest.approx(212.0)
    assert fahrenheit.unit == "degF"
    assert kelvin.value == pytest.approx(373.15)
    assert kelvin.unit == "K"


def test_validator_flags_pvc_above_60_celsius_as_critical() -> None:
    attributes = [
        source_attribute("material", "PVC"),
        source_attribute("max_operating_temp", "80 degC", 80.0, "degC"),
    ]

    reports = validate_attributes(attributes, category_id="PIPING")

    assert any(
        report.passed is False
        and report.severity == "CRITICAL"
        and "PVC" in report.error_message
        for report in reports
    )


def test_validator_returns_typed_reports_for_valid_physical_values() -> None:
    attributes = [
        source_attribute("length", "10 mm", 10.0, "mm"),
        source_attribute("width", "5 mm", 5.0, "mm"),
    ]

    reports = validate_attributes(attributes, category_id="PIPING")

    assert reports
    assert all(report.attribute_id for report in reports)
    assert all(report.rule_name for report in reports)

