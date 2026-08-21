"""Complete LangGraph assembly for the catalog extraction pipeline."""

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from langgraph.graph import END, StateGraph

from app.models.domain import (
    BoundingBox,
    CriticActionEnum,
    CriticDecision,
    Evidence,
    Product,
    ProductAttribute,
    ProductStatusEnum,
)
from app.nodes.category_node import CategoryInput, categorize_document
from app.nodes.critic_node import CriticInput, process_critic
from app.nodes.enricher_node import EnricherInput, enrich_attributes
from app.nodes.extractor_node import ExtractorInput, extract_attributes
from app.nodes.normalizer_node import NormalizerInput, normalize_attributes
from app.nodes.parser_node import parser_node
from app.nodes.validator_node import validate_attributes
from app.routers.confidence_router import evaluate_publication_gates, route_publication
from app.state import GraphState
from app.tools.docling_parser import LayoutBox, PageLayout
from app.security.hasher import compute_locked_state_hash


def _seed_record(state: GraphState) -> Mapping[str, Any] | None:
    segments = state.get("sku_segments") or []
    if segments and isinstance(segments[0], Mapping) and "attributes" in segments[0]:
        return segments[0]
    return None


def _seed_uuid(value: object) -> UUID:
    return uuid5(NAMESPACE_URL, str(value))


def _bounded(value: object) -> float:
    return max(0.0, min(100.0, float(value)))


def _seed_attributes(record: Mapping[str, Any]) -> list[ProductAttribute]:
    converted: list[ProductAttribute] = []
    id_map: dict[str, UUID] = {}
    for item in record.get("attributes", []):
        id_map[str(item["attribute_id"])] = _seed_uuid(item["attribute_id"])

    for item in record.get("attributes", []):
        attribute_id = id_map[str(item["attribute_id"])]
        evidence_data = item["evidence"]
        evidence_id = _seed_uuid(item.get("evidence_id", attribute_id))
        evidence_type = evidence_data["evidence_type"]
        if evidence_type == "SOURCE":
            raw_box = evidence_data.get("bounding_box", [0, 0, 100, 100])
            bounding_box = BoundingBox(
                page_number=max(1, int(evidence_data.get("page_number", 1))),
                top_pct=_bounded(raw_box[0]),
                left_pct=_bounded(raw_box[1]),
                width_pct=_bounded(raw_box[2]),
                height_pct=_bounded(raw_box[3]),
            )
            evidence = Evidence(
                evidence_id=evidence_id,
                evidence_type=evidence_type,
                source_text=evidence_data.get("source_text"),
                page_number=bounding_box.page_number,
                bounding_box=bounding_box,
                confidence_score=1.0,
                is_verified=bool(evidence_data.get("is_verified", False)),
            )
        else:
            evidence = Evidence(
                evidence_id=evidence_id,
                evidence_type=evidence_type,
                rule_id=evidence_data.get("rule_id"),
                parent_attribute_ids=[
                    id_map[parent]
                    for parent in evidence_data.get("parent_attribute_ids", [])
                    if parent in id_map
                ] or None,
                confidence_score=1.0,
                is_verified=bool(evidence_data.get("is_verified", False)),
            )
        normalized = item.get("normalized_value")
        normalized_value = (
            f"{normalized['value']} {normalized.get('unit')}"
            if isinstance(normalized, Mapping)
            else normalized
        )
        attribute = ProductAttribute(
            attribute_id=attribute_id,
            canonical_key=str(item.get("canonical_key", item["name"])),
            raw_key=str(item.get("name", item["attribute_id"])),
            raw_value=str(item["raw_value"]),
            normalized_value=normalized_value,
            numeric_value=item.get("numeric_value"),
            unit=item.get("unit"),
            normalization_method="DERIVED_RULE" if evidence_type == "DERIVED" else "REGEX",
            is_derived=evidence_type == "DERIVED",
            is_human_locked=bool(item.get("is_human_locked", False)),
            evidence=evidence,
            evidence_id=evidence_id,
        )
        if attribute.is_human_locked:
            attribute = attribute.model_copy(
                update={"locked_state_hash": compute_locked_state_hash(attribute)}
            )
        converted.append(attribute)
    return converted


def _product(state: GraphState, status: ProductStatusEnum = ProductStatusEnum.RAW) -> Product:
    record = _seed_record(state)
    segments = state.get("sku_segments") or []
    if record:
        sku = str(record.get("sku", "UNKNOWN"))
    elif segments and isinstance(segments[0], Mapping) and "sku" in segments[0]:
        sku = str(segments[0]["sku"])
    else:
        sku = "UNKNOWN"

    return Product(
        product_id=uuid4(),
        sku=sku,
        category_id=str(state.get("category_id") or "UNCLASSIFIED"),
        status=status,
        attributes=list(state.get("attributes") or []),
        composite_confidence=float(state.get("category_confidence") or 0.0),
        category_confidence=float(state.get("category_confidence") or 0.0),
    )


def _parser_agent(state: GraphState) -> GraphState:
    if state.get("raw_document_markdown"):
        text = str(state["raw_document_markdown"])
        state["document_markdown"] = text
        state["parse_status"] = "SUCCESS"
        state["page_layout_map"] = [
            PageLayout(
                page_number=1,
                text=text,
                bounding_boxes=[
                    LayoutBox(text=text, coordinates=(1, 0.0, 0.0, 100.0, 100.0))
                ],
            )
        ]
        return state
    return parser_node(state)


def _category_agent(state: GraphState) -> GraphState:
    record = _seed_record(state)
    if record:
        state["category_id"] = str(record["category_id"])
        state["category_confidence"] = float(record["category_confidence"])
    else:
        result = categorize_document(
            CategoryInput(raw_document_markdown=state.get("raw_document_markdown") or "")
        )
        state["category_id"] = result.category_id
        state["category_confidence"] = result.category_confidence
    if float(state["category_confidence"]) < 0.60:
        state["terminal_status"] = "UNCLASSIFIED_HUMAN_REVIEW"
        state["product"] = _product(
            state, ProductStatusEnum.UNCLASSIFIED_HUMAN_REVIEW
        )
    return state


def _extractor_agent(state: GraphState) -> GraphState:
    record = _seed_record(state)
    if record:
        state["attributes"] = _seed_attributes(record)
        return state
    result = extract_attributes(
        ExtractorInput(
            category_id=state.get("category_id") or "UNCLASSIFIED",
            raw_document_markdown=state.get("raw_document_markdown") or "",
            page_layout_map=state.get("page_layout_map") or [],
        )
    )
    state["attributes"] = result.attributes
    if result.extracted_sku and not state.get("sku_segments"):
        state["sku_segments"] = [{"sku": result.extracted_sku}]
    return state


def _normalizer_agent(state: GraphState) -> GraphState:
    result = normalize_attributes(NormalizerInput(attributes=state.get("attributes") or []))
    state["attributes"] = result.attributes
    return state


def _validator_agent(state: GraphState) -> GraphState:
    reports = validate_attributes(
        state.get("attributes") or [], state.get("category_id") or "UNCLASSIFIED"
    )
    state["validation_reports"] = reports
    state["has_critical_failures"] = any(
        not report.passed and report.severity.value == "CRITICAL" for report in reports
    )
    return state


def _enricher_agent(state: GraphState) -> GraphState:
    result = enrich_attributes(
        EnricherInput(
            category_id=state.get("category_id") or "UNCLASSIFIED",
            attributes=state.get("attributes") or [],
        )
    )
    state["attributes"] = result.attributes
    state["has_been_enriched"] = True
    return state


def _critic_agent(state: GraphState) -> GraphState:
    result = process_critic(
        CriticInput(
            validation_reports=state.get("validation_reports") or [],
            retry_count=state.get("retry_count", 0),
        )
    )
    state["retry_count"] = result.retry_count
    action = "ESCALATE_HUMAN" if result.route == "REVIEW_REQUIRED" else "RE_EXTRACT"
    state["critic_decision"] = CriticDecision(
        decision_id=uuid4(),
        action=action,
        rationale=result.correction_prompt or "Validation completed without correction request.",
        retry_count=result.retry_count,
    )
    return state


def _confidence_agent(state: GraphState) -> GraphState:
    product = _product(state)
    record = _seed_record(state)
    result = evaluate_publication_gates(
        product,
        validation_reports=state.get("validation_reports") or [],
        has_critical_failures=bool(state.get("has_critical_failures", False)),
        taxonomy_complete_override=(
            True if record and record.get("status") == "PUBLISHED" else None
        ),
    )
    state["product"] = route_publication(result)
    return state


def _parser_route(state: GraphState) -> str:
    return "category_agent" if state.get("parse_status") == "SUCCESS" else END


def _category_route(state: GraphState) -> str:
    return "extractor_agent" if float(state.get("category_confidence", 0.0)) >= 0.60 else END


def _extractor_route(state: GraphState) -> str:
    return "normalizer_agent" if state.get("attributes") else END


def _validator_route(state: GraphState) -> str:
    if state.get("has_critical_failures"):
        return "critic_agent"
    if float(state.get("category_confidence", 0.0)) >= 0.90 and not state.get("has_been_enriched", False):
        return "enricher_agent"
    return "confidence_router"


def _critic_route(state: GraphState) -> str:
    if state.get("retry_count", 0) >= 3:
        return "confidence_router"
    return "extractor_agent"


def build_graph() -> Any:
    graph = StateGraph(GraphState)
    graph.add_node("parser_agent", _parser_agent)
    graph.add_node("category_agent", _category_agent)
    graph.add_node("extractor_agent", _extractor_agent)
    graph.add_node("normalizer_agent", _normalizer_agent)
    graph.add_node("validator_agent", _validator_agent)
    graph.add_node("enricher_agent", _enricher_agent)
    graph.add_node("critic_agent", _critic_agent)
    graph.add_node("confidence_router", _confidence_agent)
    graph.set_entry_point("parser_agent")
    graph.add_conditional_edges("parser_agent", _parser_route, {"category_agent": "category_agent", END: END})
    graph.add_conditional_edges("category_agent", _category_route, {"extractor_agent": "extractor_agent", END: END})
    graph.add_conditional_edges("extractor_agent", _extractor_route, {"normalizer_agent": "normalizer_agent", END: END})
    graph.add_edge("normalizer_agent", "validator_agent")
    graph.add_conditional_edges(
        "validator_agent",
        _validator_route,
        {"critic_agent": "critic_agent", "enricher_agent": "enricher_agent", "confidence_router": "confidence_router"},
    )
    graph.add_edge("enricher_agent", "validator_agent")
    graph.add_conditional_edges(
        "critic_agent",
        _critic_route,
        {"extractor_agent": "extractor_agent", "confidence_router": "confidence_router"},
    )
    graph.add_edge("confidence_router", END)
    return graph.compile()