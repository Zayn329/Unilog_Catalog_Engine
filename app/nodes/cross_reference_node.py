"""Typed, synchronous cross-reference comparison service boundary."""

from __future__ import annotations

from math import isclose
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import Product
from app.tools.qdrant_search import QdrantSearchService, SearchMatch


class CrossReferenceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_product: Product
    candidate_products: list[Product] = Field(default_factory=list, max_length=3)


class AttributeDelta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_value: str | None = None
    competitor_value: str | None = None
    is_equal: bool
    numeric_delta: float | None = None


class ProductComparison(BaseModel):
    model_config = ConfigDict(extra="forbid")

    competitor_product_id: UUID
    competitor_sku: str
    parity_score: Annotated[float, Field(ge=0.0, le=1.0)]
    delta_matrix: dict[str, AttributeDelta]


class CrossReferenceOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_product_id: UUID
    comparisons: list[ProductComparison]


def _display_value(attribute: object) -> str | None:
    value = getattr(attribute, "normalized_value", None) or getattr(attribute, "raw_value", None)
    return str(value) if value is not None else None


def _compare_pair(target: Product, competitor: Product) -> ProductComparison:
    target_attributes = {attribute.canonical_key: attribute for attribute in target.attributes}
    competitor_attributes = {
        attribute.canonical_key: attribute for attribute in competitor.attributes
    }
    delta_matrix: dict[str, AttributeDelta] = {}
    for key in sorted(target_attributes.keys() | competitor_attributes.keys()):
        target_attribute = target_attributes.get(key)
        competitor_attribute = competitor_attributes.get(key)
        target_value = _display_value(target_attribute) if target_attribute else None
        competitor_value = _display_value(competitor_attribute) if competitor_attribute else None

        numeric_delta = None
        equal = target_value == competitor_value
        if target_attribute and competitor_attribute:
            same_unit = target_attribute.unit == competitor_attribute.unit
            if (
                same_unit
                and target_attribute.numeric_value is not None
                and competitor_attribute.numeric_value is not None
            ):
                numeric_delta = competitor_attribute.numeric_value - target_attribute.numeric_value
                equal = isclose(numeric_delta, 0.0, abs_tol=1e-9)
        delta_matrix[key] = AttributeDelta(
            candidate_value=target_value,
            competitor_value=competitor_value,
            is_equal=equal,
            numeric_delta=numeric_delta,
        )

    parity_score = (
        sum(delta.is_equal for delta in delta_matrix.values()) / len(delta_matrix)
        if delta_matrix
        else 1.0
    )
    return ProductComparison(
        competitor_product_id=competitor.product_id,
        competitor_sku=competitor.sku,
        parity_score=parity_score,
        delta_matrix=delta_matrix,
    )


def compare_specifications(payload: CrossReferenceInput) -> CrossReferenceOutput:
    if not isinstance(payload, CrossReferenceInput):
        raise TypeError("compare_specifications requires CrossReferenceInput")
    return CrossReferenceOutput(
        target_product_id=payload.target_product.product_id,
        comparisons=[
            _compare_pair(payload.target_product, competitor)
            for competitor in payload.candidate_products
            if competitor.product_id != payload.target_product.product_id
        ],
    )


def cross_reference_product(
    product: Product,
    search_service: QdrantSearchService,
    *,
    limit: int = 3,
) -> CrossReferenceOutput:
    matches: list[SearchMatch] = search_service.search_similar(product, limit=limit + 1)
    candidates = [match.product for match in matches if match.product_id != product.product_id][:limit]
    return compare_specifications(
        CrossReferenceInput(target_product=product, candidate_products=candidates)
    )
