from typing import Any

from pydantic import BaseModel, ConfigDict

from app.state import GraphState
from app.tools.docling_parser import ParserOutput, parse_pdf


class ParserState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parse_status: str
    parser_output: ParserOutput


def parser_node(state: GraphState) -> GraphState:
    """Run the parser and update the in-memory graph state for Gate 1."""
    result = parse_pdf(state["file_path"])
    state["raw_document_markdown"] = result.raw_document_markdown
    state["document_markdown"] = result.raw_document_markdown  # type: ignore[typeddict-item]
    state["page_layout_map"] = result.page_layout_map
    state["parse_status"] = result.parse_status  # type: ignore[typeddict-item]
    state["terminal_status"] = result.terminal_status  # type: ignore[typeddict-item]
    return state


def evaluate_gate_1(state: ParserState | dict[str, Any]) -> bool:
    return state.parse_status == "SUCCESS" if isinstance(state, ParserState) else state["parse_status"] == "SUCCESS"


def extract_bounding_boxes(result: ParserOutput) -> list[tuple[int, float, float, float, float]]:
    return [box.coordinates for page in result.page_layout_map for box in page.bounding_boxes]