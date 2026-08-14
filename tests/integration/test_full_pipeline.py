import json
from pathlib import Path
from uuid import uuid4

import pytest

from app.graph import build_graph
from app.state import GraphState


SEED_PATH = Path(__file__).parents[2] / "data" / "seed" / "benchmark_skus.json"


@pytest.fixture(scope="module")
def benchmark_skus() -> list[dict[str, object]]:
    payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    return payload["benchmark_skus"]


def state_for_seed(record: dict[str, object]) -> GraphState:
    """Build a typed graph input from one deterministic benchmark record."""
    return GraphState(
        job_id=uuid4(),
        file_path=str(SEED_PATH),
        raw_document_markdown=json.dumps(record),
        document_markdown=json.dumps(record),
        sku_segments=[record],
    )


def test_full_pipeline_publishes_clean_benchmark_sku(
    benchmark_skus: list[dict[str, object]],
) -> None:
    clean_record = benchmark_skus[0]

    result = build_graph().invoke(state_for_seed(clean_record))

    assert result["parse_status"] == "SUCCESS"
    assert result["product"].status == "PUBLISHED"
    assert result.get("terminal_status") is None


def test_full_pipeline_routes_physics_error_to_review_required(
    benchmark_skus: list[dict[str, object]],
) -> None:
    invalid_record = json.loads(json.dumps(benchmark_skus[0]))
    invalid_record["category_confidence"] = 0.75
    invalid_record["attributes"][0]["raw_value"] = "-50 mm"
    invalid_record["attributes"][0]["numeric_value"] = -50.0

    result = build_graph().invoke(state_for_seed(invalid_record))

    assert result["has_critical_failures"] is True
    assert result["product"].status == "REVIEW_REQUIRED"


def test_full_pipeline_routes_unclassified_benchmark_sku_to_human_review(
    benchmark_skus: list[dict[str, object]],
) -> None:
    unclassified_record = benchmark_skus[1]

    result = build_graph().invoke(state_for_seed(unclassified_record))

    assert result["category_confidence"] < 0.60
    assert result["terminal_status"] == "UNCLASSIFIED_HUMAN_REVIEW"
    assert result["product"].status == "UNCLASSIFIED_HUMAN_REVIEW"

