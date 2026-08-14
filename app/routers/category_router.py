from app.nodes.category_node import CategoryOutput


def category_router(state: CategoryOutput) -> str:
    if not isinstance(state, CategoryOutput):
        raise TypeError("category_router requires CategoryOutput")
    if state.category_confidence >= 0.60:
        return "extractor_agent"
    state.terminal_status = "UNCLASSIFIED_HUMAN_REVIEW"
    return "END"
