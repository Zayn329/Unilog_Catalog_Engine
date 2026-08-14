from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LayoutBox(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    coordinates: tuple[int, float, float, float, float]


class PageLayout(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_number: int = Field(ge=1)
    text: str
    bounding_boxes: list[LayoutBox] = Field(default_factory=list)


class ParserOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parse_status: Literal["SUCCESS", "FAILED"]
    raw_document_markdown: str | None = None
    page_layout_map: list[PageLayout] = Field(default_factory=list)
    terminal_status: Literal["FAILED_PARSING"] | None = None
    error_message: str | None = None


class DoclingParser:
    """Docling adapter that exposes markdown and percentage-based provenance."""

    def __init__(self) -> None:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption

        pipeline_options = PdfPipelineOptions(
            do_ocr=False,
            do_table_structure=False,
            force_backend_text=True,
        )
        self._converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            },
        )

    def parse(self, file_path: str | Path) -> ParserOutput:
        try:
            conversion = self._converter.convert(Path(file_path))
            if conversion.has_errors:
                return self._parse_with_pdfium(file_path, str(conversion.errors))

            page_layout_map = self._page_layouts(conversion)
            return ParserOutput(
                parse_status="SUCCESS",
                raw_document_markdown=conversion.document.export_to_markdown(),
                page_layout_map=page_layout_map,
            )
        except Exception as exc:
            return self._parse_with_pdfium(file_path, str(exc))

    @staticmethod
    def _parse_with_pdfium(file_path: str | Path, parser_error: str) -> ParserOutput:
        """Use Docling's PDF coordinate conventions when its model pipeline is unavailable."""
        try:
            import pypdfium2 as pdfium

            pdf = pdfium.PdfDocument(str(file_path))
            page_layout_map: list[PageLayout] = []
            for page_index in range(len(pdf)):
                page = pdf[page_index]
                width, height = page.get_size()
                text_page = page.get_textpage()
                text_parts: list[str] = []
                boxes: list[LayoutBox] = []
                for index in range(text_page.count_rects()):
                    left, bottom, right, top = text_page.get_rect(index)
                    text = text_page.get_text_bounded(left, bottom, right, top).strip()
                    if not text:
                        continue
                    text_parts.append(text)
                    boxes.append(
                        LayoutBox(
                            text=text,
                            coordinates=(
                                page_index + 1,
                                (height - top) / height * 100.0,
                                left / width * 100.0,
                                (right - left) / width * 100.0,
                                (top - bottom) / height * 100.0,
                            )
                        )
                    )
                page_layout_map.append(
                    PageLayout(
                        page_number=page_index + 1,
                        text="\n".join(text_parts),
                        bounding_boxes=boxes,
                    )
                )
                text_page.close()
                page.close()
            pdf.close()
            markdown = "\n\n".join(page.text for page in page_layout_map if page.text)
            if not markdown or not page_layout_map:
                raise ValueError("PDF contained no readable text")
            return ParserOutput(
                parse_status="SUCCESS",
                raw_document_markdown=markdown,
                page_layout_map=page_layout_map,
            )
        except Exception as fallback_error:
            return ParserOutput(
                parse_status="FAILED",
                terminal_status="FAILED_PARSING",
                error_message=f"Docling: {parser_error}; PDF fallback: {fallback_error}",
            )

    @staticmethod
    def _page_layouts(conversion: object) -> list[PageLayout]:
        document = conversion.document
        page_layouts: dict[int, PageLayout] = {}
        for item, _ in document.iterate_items():
            text = getattr(item, "text", "")
            provenance = getattr(item, "prov", [])
            for source in provenance:
                page_number = source.page_no
                page = document.pages.get(page_number)
                if page is None or page.size is None or not text:
                    continue
                layout = page_layouts.setdefault(
                    page_number,
                    PageLayout(page_number=page_number, text=""),
                )
                layout.text = f"{layout.text}\n{text}".strip()
                bbox = source.bbox
                width = page.size.width
                height = page.size.height
                if width <= 0 or height <= 0:
                    continue
                layout.bounding_boxes.append(
                    LayoutBox(
                        text=text,
                        coordinates=(
                            page_number,
                            bbox.t / height * 100.0,
                            bbox.l / width * 100.0,
                            (bbox.r - bbox.l) / width * 100.0,
                            (bbox.b - bbox.t) / height * 100.0,
                        )
                    )
                )
        return [page_layouts[number] for number in sorted(page_layouts)]


def parse_pdf(file_path: str | Path) -> ParserOutput:
    return DoclingParser().parse(file_path)
