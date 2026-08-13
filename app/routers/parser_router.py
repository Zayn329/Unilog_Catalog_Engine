from typing import Any

from app.nodes.parser_node import ParserState, evaluate_gate_1


def parser_router(state: ParserState | dict[str, Any]) -> str:
    return "category_agent" if evaluate_gate_1(state) else "END"

