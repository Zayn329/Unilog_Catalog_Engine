from app.nodes.category_node import CategoryOutput


def category_router(state: CategoryOutput) -> str:
    if not isinstance(state, CategoryOutput):
        raise TypeError("category_router requires CategoryOutput")
    
    # Allow override: if skip_category_validation is True, proceed to extraction
    skip_validation = state.get("skip_category_validation", False) if isinstance(state, dict) else False
    if skip_validation:
        return "extractor_agent"
    
    # Proceed if confidence meets threshold
    if state.category_confidence >= 0.60:
        return "extractor_agent"
    
    # Otherwise, mark as unclassified and stop
    state.terminal_status = "UNCLASSIFIED_HUMAN_REVIEW"
    return "END"
