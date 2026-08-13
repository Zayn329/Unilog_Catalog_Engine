from typing import Any


def category_router(state: dict[str, Any]) -> str:
    if float(state.get("category_confidence", 0.0)) >= 0.60:
        return "extractor_node"
    state["terminal_status"] = "UNCLASSIFIED_HUMAN_REVIEW"
    return "END"

