from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field


TAXONOMY_PATH = Path(__file__).parents[2] / "data" / "taxonomy" / "unilog_taxonomy.yaml"


class CategoryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    raw_document_markdown: str = Field(min_length=1)


class CategoryOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: str = Field(min_length=1)
    category_confidence: float = Field(ge=0.0, le=1.0)
    category_status: Literal["AUTO_ASSIGNED", "FLAGGED_FOR_REVIEW", "UNCLASSIFIED_HUMAN_REVIEW"]
    terminal_status: Literal["UNCLASSIFIED_HUMAN_REVIEW"] | None = None


def _taxonomy_terms() -> list[tuple[str, str, str]]:
    taxonomy = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    terms: list[tuple[str, str, str]] = []
    for category in taxonomy.get("categories", []):
        terms.append((category["category_id"], category["name"], category["path"]))
        for child in category.get("subcategories", []):
            terms.append((child["category_id"], child["name"], child["path"]))
    return terms


def categorize_document(
    state: CategoryInput, confidence_override: float | None = None
) -> CategoryOutput:
    if not isinstance(state, CategoryInput):
        raise TypeError("categorize_document requires CategoryInput")
    text = state.raw_document_markdown
    lowered = text.casefold()
    category_id = "UNCLASSIFIED"
    confidence = 0.0
    for candidate_id, name, path in _taxonomy_terms():
        terms = [term for term in name.casefold().split() if len(term) > 3]
        if terms and any(term in lowered for term in terms):
            category_id = candidate_id
            confidence = 0.85
            break
    if "ball valve" in lowered:
        category_id, confidence = "BALL_VALVE", 0.95
    if confidence_override is not None:
        confidence = confidence_override
    category_status: Literal[
        "AUTO_ASSIGNED", "FLAGGED_FOR_REVIEW", "UNCLASSIFIED_HUMAN_REVIEW"
    ]
    if confidence >= 0.85:
        category_status = "AUTO_ASSIGNED"
    elif confidence >= 0.60:
        category_status = "FLAGGED_FOR_REVIEW"
    else:
        category_status = "UNCLASSIFIED_HUMAN_REVIEW"
    return CategoryOutput(
        category_id=category_id,
        category_confidence=confidence,
        category_status=category_status,
        terminal_status=(
            "UNCLASSIFIED_HUMAN_REVIEW"
            if category_status == "UNCLASSIFIED_HUMAN_REVIEW"
            else None
        ),
    )
