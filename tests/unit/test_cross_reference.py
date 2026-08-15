from uuid import UUID, uuid4

import pytest

from app.models.domain import (
    BoundingBox,
    Evidence,
    EvidenceTypeEnum,
    NormalizationMethodEnum,
    Product,
    ProductAttribute,
    ProductStatusEnum,
)
from app.nodes.cross_reference_node import (
    CrossReferenceInput,
    compare_specifications,
)
from app.tools.qdrant_search import (
    QdrantSearchService,
    generate_spec_embedding,
)


def _source_attribute(
    canonical_key: str,
    raw_value: str,
    numeric_value: float,
    unit: str,
) -> ProductAttribute:
    evidence_id = uuid4()
    return ProductAttribute(
        attribute_id=uuid4(),
        canonical_key=canonical_key,
        raw_key=canonical_key,
        raw_value=raw_value,
        normalized_value=f"{numeric_value:g} {unit}",
        numeric_value=numeric_value,
        unit=unit,
        normalization_method=NormalizationMethodEnum.PINT,
        attribute_confidence=0.98,
        evidence_id=evidence_id,
        evidence=Evidence(
            evidence_id=evidence_id,
            evidence_type=EvidenceTypeEnum.SOURCE,
            source_text=f"{canonical_key}: {raw_value}",
            page_number=1,
            bounding_box=BoundingBox(
                page_number=1,
                top_pct=10.0,
                left_pct=10.0,
                width_pct=20.0,
                height_pct=5.0,
            ),
            confidence_score=0.98,
            is_verified=True,
        ),
    )


def _published_product(
    sku: str,
    *,
    length_mm: float = 50.8,
    pressure_mpa: float = 1.0,
) -> Product:
    return Product(
        product_id=uuid4(),
        sku=sku,
        category_id="CAT_PIPING_001",
        status=ProductStatusEnum.PUBLISHED,
        composite_confidence=0.96,
        attributes=[
            _source_attribute("length", f"{length_mm:g} mm", length_mm, "mm"),
            _source_attribute("pressure", f"{pressure_mpa:g} MPa", pressure_mpa, "MPa"),
        ],
    )


def test_published_product_specification_generates_deterministic_embedding() -> None:
    product = _published_product("SKU-CANDIDATE")

    first = generate_spec_embedding(product)
    second = generate_spec_embedding(product)

    assert first.product_id == product.product_id
    assert first.vector
    assert all(isinstance(value, float) for value in first.vector)
    assert first.vector == second.vector


def test_qdrant_stores_and_queries_published_product_embeddings() -> None:
    product = _published_product("SKU-CANDIDATE")
    competitor = _published_product("SKU-COMPETITOR", length_mm=51.0)
    service = QdrantSearchService(collection_name="published_product_specs", location=":memory:")

    service.upsert_product(product)
    service.upsert_product(competitor)
    matches = service.search_similar(product, limit=3)

    assert len(matches) <= 3
    assert matches
    assert all(isinstance(match.product_id, UUID) for match in matches)
    assert matches[0].product_id == product.product_id


def test_cross_reference_generates_attribute_by_attribute_delta_matrix() -> None:
    candidate = _published_product("SKU-CANDIDATE", length_mm=50.8, pressure_mpa=1.0)
    competitor = _published_product("SKU-COMPETITOR", length_mm=60.0, pressure_mpa=1.0)

    result = compare_specifications(
        CrossReferenceInput(
            target_product=candidate,
            candidate_products=[competitor],
        )
    )

    assert result.comparisons
    comparison = result.comparisons[0]
    assert comparison.competitor_product_id == competitor.product_id
    assert comparison.delta_matrix["length"].candidate_value == "50.8 mm"
    assert comparison.delta_matrix["length"].competitor_value == "60 mm"
    assert comparison.delta_matrix["pressure"].is_equal is True
    assert 0.0 <= comparison.parity_score <= 1.0

