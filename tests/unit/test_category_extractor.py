from uuid import uuid4

import pytest

from app.models.domain import BoundingBox, ProductAttribute
from app.nodes.category_node import CategoryInput, categorize_document
from app.nodes.extractor_node import ExtractorInput, ExtractorOutput, extract_attributes
from app.routers.category_router import category_router


@pytest.mark.parametrize(
    ("confidence", "expected_target", "expected_status"),
    [
        (0.85, "extractor_agent", None),
        (0.90, "extractor_agent", None),
        (0.60, "extractor_agent", None),
        (0.84, "extractor_agent", None),
        (0.59, "END", "UNCLASSIFIED_HUMAN_REVIEW"),
        (0.0, "END", "UNCLASSIFIED_HUMAN_REVIEW"),
    ],
)
def test_category_router_applies_confidence_thresholds(
    confidence: float,
    expected_target: str,
    expected_status: str | None,
) -> None:
    from app.nodes.category_node import CategoryOutput

    state = CategoryOutput(
        category_confidence=confidence,
        category_id="BALL_VALVE",
        category_status="AUTO_ASSIGNED" if confidence >= 0.85 else "FLAGGED_FOR_REVIEW",
    )

    assert category_router(state) == expected_target
    if expected_status is not None:
        assert state.terminal_status == expected_status


def test_category_node_returns_auto_assigned_category_at_high_confidence() -> None:
    state = {"raw_document_markdown": "Stainless steel ball valve, 600 PSI"}

    result = categorize_document(CategoryInput(**state))

    assert result.category_confidence >= 0.85
    assert result.category_id
    assert result.category_status == "AUTO_ASSIGNED"


def test_category_node_flags_medium_confidence_for_review() -> None:
    state = CategoryInput(
        raw_document_markdown="Industrial valve with incomplete category signals"
    )

    result = categorize_document(state, confidence_override=0.60)

    assert 0.60 <= result.category_confidence <= 0.84
    assert result.category_status == "FLAGGED_FOR_REVIEW"


def test_category_node_routes_low_confidence_to_unclassified_review() -> None:
    state = CategoryInput(
        raw_document_markdown="Unreadable or unclassifiable product text"
    )

    result = categorize_document(state, confidence_override=0.59)

    assert result.category_confidence < 0.60
    assert result.terminal_status == "UNCLASSIFIED_HUMAN_REVIEW"


def test_extractor_rejects_orphan_attributes_and_preserves_source_evidence() -> None:
    state = ExtractorInput(
        category_id="BALL_VALVE",
        sku_segment="VALVE-600",
        raw_document_markdown="Max Pressure: 600 PSI",
        page_layout_map=[
            {
                "page_number": 1,
                "text": "Max Pressure: 600 PSI",
                "bounding_boxes": [
                    {
                        "text": "Max Pressure: 600 PSI",
                        "coordinates": (1, 10.0, 20.0, 30.0, 5.0),
                    }
                ],
            }
        ],
    )

    result = extract_attributes(state)
    assert isinstance(result, ExtractorOutput)
    attributes = result.attributes

    assert attributes
    assert all(isinstance(attribute, ProductAttribute) for attribute in attributes)
    assert all(attribute.evidence is not None for attribute in attributes)
    assert all(attribute.evidence.evidence_type == "SOURCE" for attribute in attributes)
    assert all(attribute.evidence.source_text for attribute in attributes)
    assert all(attribute.evidence.bounding_box is not None for attribute in attributes)
    assert all(
        isinstance(attribute.evidence.bounding_box, BoundingBox)
        for attribute in attributes
    )
    assert all(
        attribute.evidence_id == attribute.evidence.evidence_id
        for attribute in attributes
    )


def test_extractor_output_cannot_contain_an_attribute_without_evidence() -> None:
    orphan_attribute = {
        "attribute_id": uuid4(),
        "canonical_key": "pressure_rating",
        "raw_key": "Max Pressure",
        "raw_value": "600 PSI",
        "normalization_method": "REGEX",
        "evidence": None,
    }

    with pytest.raises(ValueError):
        ProductAttribute(**orphan_attribute)


def test_category_and_extractor_nodes_reject_untyped_dict_boundaries() -> None:
    with pytest.raises(TypeError):
        categorize_document({"raw_document_markdown": "Fasteners"})

    with pytest.raises(TypeError):
        extract_attributes({
            "category_id": "CAT_FAST_001",
            "raw_document_markdown": "Thread Size: 1/4 in",
            "page_layout_map": [],
        })
