"""Deterministic evaluation of the eight publication gates."""

from pathlib import Path
from typing import Mapping

import yaml
from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import Product, ProductAttribute
from app.security.gate8 import verify_locked_attribute_mutation


TAXONOMY_PATH = Path(__file__).parents[2] / "data" / "taxonomy" / "unilog_taxonomy.yaml"


class PublicationGateResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: Product
    gates: dict[str, bool]
    failed_gates: list[str] = Field(default_factory=list)
    all_gates_passed: bool


def _required_attributes(category_id: str) -> set[str]:
    taxonomy = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    for category in taxonomy.get("categories", []):
        candidates = [category, *category.get("subcategories", [])]
        for candidate in candidates:
            if candidate.get("category_id") == category_id:
                return set(candidate.get("required_attributes", []))
    return set()


def _gate_provenance(attributes: list[ProductAttribute]) -> bool:
    return all(
        attribute.evidence is not None
        and attribute.evidence.evidence_type.value in {"SOURCE", "RULE", "DERIVED"}
        for attribute in attributes
    )


def _gate_derived_integrity(
    attributes: list[ProductAttribute], validation_reports: list[object]
) -> bool:
    failed_ids = {
        report.attribute_id
        for report in validation_reports
        if not report.passed
    }
    return all(
        not attribute.is_derived
        or (
            attribute.evidence.rule_id is not None
            and attribute.attribute_id not in failed_ids
        )
        for attribute in attributes
    )


def _gate_locked_integrity(attributes: list[ProductAttribute]) -> bool:
    for attribute in attributes:
        if not attribute.is_human_locked:
            continue
        try:
            verify_locked_attribute_mutation(attribute, attribute)
        except PermissionError:
            return False
    return True


def evaluate_publication_gates(
    product: Product,
    *,
    validation_reports: list[object],
    has_critical_failures: bool,
    taxonomy_complete_override: bool | None = None,
) -> PublicationGateResult:
    """Evaluate every publication gate from the same immutable state snapshot."""
    attributes = product.attributes
    passed_reports = all(report.passed for report in validation_reports)
    required = _required_attributes(product.category_id)
    present = {attribute.canonical_key for attribute in attributes}
    taxonomy_complete = required.issubset(present)
    if taxonomy_complete_override is not None:
        taxonomy_complete = taxonomy_complete_override
    gates = {
        "GATE_1_NO_CRITICAL_FAILURES": not has_critical_failures,
        "GATE_2_PROVENANCE_COVERAGE": _gate_provenance(attributes),
        "GATE_3_VALIDATED_ENRICHMENT": _gate_derived_integrity(attributes, validation_reports),
        "GATE_4_TAXONOMY_COMPLETENESS": taxonomy_complete,
        "GATE_5_NO_UNVERIFIED_EVIDENCE": all(
            attribute.evidence.is_verified for attribute in attributes
        ) and passed_reports,
        "GATE_6_NO_PENDING_ESCALATIONS": all(
            not attribute.requires_human_review for attribute in attributes
        ),
        "GATE_7_THRESHOLD_TRUST_SCORE": product.composite_confidence >= 0.90,
        "GATE_8_LOCK_PROTECTION": _gate_locked_integrity(attributes),
    }
    failed = [name for name, passed in gates.items() if not passed]
    return PublicationGateResult(
        product=product,
        gates=gates,
        failed_gates=failed,
        all_gates_passed=not failed,
    )


def route_publication(result: PublicationGateResult) -> Product:
    """Assign the final deterministic product status after gate evaluation."""
    if result.all_gates_passed:
        return result.product.model_copy(update={"status": "PUBLISHED"})
    return result.product.model_copy(update={"status": "REVIEW_REQUIRED"})
