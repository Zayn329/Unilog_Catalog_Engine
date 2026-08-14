"""Deterministic, rule-backed enrichment of missing attributes."""

import json
import re
from pathlib import Path
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import (
    Evidence,
    EvidenceTypeEnum,
    NormalizationMethodEnum,
    ProductAttribute,
)


_RULES_PATH = Path(__file__).parents[2] / "data" / "rules" / "enrichment_rules.json"


class EnrichmentRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_id: str = Field(min_length=1)
    category_id: str = Field(min_length=1)
    source_attribute: str = Field(min_length=1)
    source_pattern: str = Field(min_length=1)
    derived_attribute: str = Field(min_length=1)
    derived_value: str


class EnricherInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: str = Field(min_length=1)
    attributes: list[ProductAttribute]


class EnricherOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attributes: list[ProductAttribute]
    has_been_enriched: bool


def _load_rules() -> list[EnrichmentRule]:
    raw_rules = json.loads(_RULES_PATH.read_text(encoding="utf-8"))
    return [EnrichmentRule.model_validate(rule) for rule in raw_rules]


def _derived_attribute(rule: EnrichmentRule, parent: ProductAttribute) -> ProductAttribute:
    evidence_id = uuid4()
    evidence = Evidence(
        evidence_id=evidence_id,
        evidence_type=EvidenceTypeEnum.RULE,
        rule_id=rule.rule_id,
        parent_attribute_ids=[parent.attribute_id],
        confidence_score=1.0,
        is_verified=True,
    )
    return ProductAttribute(
        attribute_id=uuid4(),
        canonical_key=rule.derived_attribute,
        raw_key=rule.derived_attribute,
        raw_value=rule.derived_value,
        normalized_value=rule.derived_value,
        normalization_method=NormalizationMethodEnum.DERIVED_RULE,
        is_derived=True,
        evidence=evidence,
        evidence_id=evidence_id,
    )


def enrich_attributes(payload: EnricherInput) -> EnricherOutput:
    """Apply matching rules only when their derived attribute is absent."""
    attributes = list(payload.attributes)
    existing_keys = {attribute.canonical_key for attribute in attributes}
    changed = False

    for rule in _load_rules():
        if rule.category_id != payload.category_id:
            continue
        if rule.derived_attribute in existing_keys:
            continue
        parent = next(
            (
                attribute
                for attribute in attributes
                if attribute.canonical_key == rule.source_attribute
                and re.search(rule.source_pattern, attribute.raw_value, re.IGNORECASE)
            ),
            None,
        )
        if parent is None:
            continue
        attributes.append(_derived_attribute(rule, parent))
        existing_keys.add(rule.derived_attribute)
        changed = True

    return EnricherOutput(attributes=attributes, has_been_enriched=changed)

