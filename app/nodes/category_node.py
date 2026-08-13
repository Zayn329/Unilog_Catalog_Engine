from pathlib import Path
from typing import Any

import yaml


TAXONOMY_PATH = Path(__file__).parents[2] / "data" / "taxonomy" / "unilog_taxonomy.yaml"


def _taxonomy_terms() -> list[tuple[str, str, str]]:
    taxonomy = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    terms: list[tuple[str, str, str]] = []
    for category in taxonomy.get("categories", []):
        terms.append((category["category_id"], category["name"], category["path"]))
        for child in category.get("subcategories", []):
            terms.append((child["category_id"], child["name"], child["path"]))
    return terms


def categorize_document(
    state: dict[str, Any], confidence_override: float | None = None
) -> dict[str, Any]:
    text = str(state.get("raw_document_markdown") or "")
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
    result = dict(state)
    result["category_id"] = category_id
    result["category_confidence"] = confidence
    if confidence >= 0.85:
        result["category_status"] = "AUTO_ASSIGNED"
    elif confidence >= 0.60:
        result["category_status"] = "FLAGGED_FOR_REVIEW"
    else:
        result["category_status"] = "UNCLASSIFIED_HUMAN_REVIEW"
        result["terminal_status"] = "UNCLASSIFIED_HUMAN_REVIEW"
    return result

