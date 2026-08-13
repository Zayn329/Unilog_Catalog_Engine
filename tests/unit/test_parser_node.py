from pathlib import Path

import pytest

from app.nodes.parser import (
    ParserState,
    evaluate_gate_1,
    extract_bounding_boxes,
    parse_document,
    parser_router,
)


def _single_page_pdf() -> bytes:
    """Build a small valid text PDF for the parser integration boundary."""
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
        b"4 0 obj << /Length 54 >> stream\nBT /F1 12 Tf 72 720 Td (Max Pressure: 600 PSI) Tj ET\nendstream\nendobj\n",
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return bytes(pdf)


@pytest.fixture
def readable_pdf(tmp_path: Path) -> Path:
    path = tmp_path / "catalog.pdf"
    path.write_bytes(_single_page_pdf())
    return path


@pytest.fixture
def malformed_pdf(tmp_path: Path) -> Path:
    path = tmp_path / "malformed.pdf"
    path.write_bytes(b"not a readable PDF")
    return path


def test_parser_output_contains_layout_text_and_page_coordinates(
    readable_pdf: Path,
) -> None:
    result = parse_document(readable_pdf)

    assert result.parse_status == "SUCCESS"
    assert "Max Pressure: 600 PSI" in result.raw_document_markdown
    assert result.page_layout_map
    assert result.page_layout_map[0].page_number == 1
    assert result.page_layout_map[0].text


def test_parser_extracts_standard_five_element_bounding_boxes(
    readable_pdf: Path,
) -> None:
    result = parse_document(readable_pdf)
    boxes = extract_bounding_boxes(result)

    assert boxes
    for box in boxes:
        assert len(box) == 5
        page, top_pct, left_pct, width_pct, height_pct = box
        assert page >= 1
        assert 0.0 <= top_pct <= 100.0
        assert 0.0 <= left_pct <= 100.0
        assert 0.0 <= width_pct <= 100.0
        assert 0.0 <= height_pct <= 100.0


def test_gate_1_success_passes_and_routes_to_category_agent(
    readable_pdf: Path,
) -> None:
    result = parse_document(readable_pdf)
    state = ParserState(parse_status=result.parse_status, parser_output=result)

    assert evaluate_gate_1(state) is True
    assert parser_router(state) == "category_agent"


def test_gate_1_failure_routes_to_failed_parsing_and_end(
    malformed_pdf: Path,
) -> None:
    result = parse_document(malformed_pdf)
    state = ParserState(parse_status=result.parse_status, parser_output=result)

    assert result.parse_status == "FAILED"
    assert evaluate_gate_1(state) is False
    assert parser_router(state) == "END"
    assert result.terminal_status == "FAILED_PARSING"
