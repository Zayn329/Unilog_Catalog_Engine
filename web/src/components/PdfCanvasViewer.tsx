"use client";

/**
 * PdfCanvasViewer.tsx — Sub-stage 13C PDF Datasheet & Evidence Viewer
 *
 * Renders an authentic industrial catalog datasheet page (612x792 pt standard Letter)
 * with pixel-perfect, scale-invariant evidence bounding box overlays.
 *
 * Invariants & Architecture:
 *  - Supports raw PDF point coordinates ([x0, y0, x1, y1]), Docling 5-tuples,
 *    and normalized percentage objects via coordinateTransform.ts.
 *  - Overlay container is anchored directly to the rendered PDF page with
 *    `absolute inset-0 w-full h-full pointer-events-none`, guaranteeing exact alignment
 *    regardless of container resizing, split-screen ratios, or browser window dimensions.
 *  - Zoom scaling uses hardware-accelerated CSS transforms with center-top origin.
 *  - Interactive: clicking any bounding box selects the attribute, highlights its
 *    provenance, and triggers linked dashboard actions.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  FileText,
  Layers,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

import type { AttributeRecord } from "@/types/domain";
import {
  normalizeBoundingBox,
  DEFAULT_PDF_PAGE_SIZE,
  type NormalizedBox,
} from "@/utils/coordinateTransform";

interface PdfCanvasViewerProps {
  filePath?: string;
  totalPages?: number;
  attributes: AttributeRecord[];
  selectedAttributeId: string | null;
  onSelectAttribute: (attributeId: string) => void;
  documentMarkdown?: string;
  /** Optional custom page size in points (defaults to 612x792 US Letter) */
  pageSize?: { width: number; height: number };
}

interface RenderedBoxItem {
  attributeId: string;
  canonicalKey: string;
  rawValue: string;
  confidence: number;
  isHumanLocked: boolean;
  isCriticalAlert?: boolean;
  box: NormalizedBox;
}

export function PdfCanvasViewer({
  filePath,
  totalPages = 1,
  attributes,
  selectedAttributeId,
  onSelectAttribute,
  documentMarkdown,
  pageSize = DEFAULT_PDF_PAGE_SIZE,
}: PdfCanvasViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showBoxes, setShowBoxes] = useState(true);

  const numPages = Math.max(1, totalPages);

  // Transform and normalize all bounding boxes
  const pageBoxes = useMemo<RenderedBoxItem[]>(() => {
    const list: RenderedBoxItem[] = [];
    for (const attr of attributes) {
      const rawBox =
        attr.evidence?.bounding_box || attr.bounding_box_json || null;
      const normalized = normalizeBoundingBox(rawBox, pageSize, true);
      if (!normalized || normalized.pageNumber !== currentPage) {
        continue;
      }
      const isCriticalAlert =
        attr.canonical_key.toLowerCase().includes("temp") &&
        (attr.raw_value.includes("450") ||
          (attr.numeric_value !== undefined &&
            attr.numeric_value !== null &&
            attr.numeric_value > 200));

      list.push({
        attributeId: attr.attribute_id,
        canonicalKey: attr.canonical_key,
        rawValue: attr.raw_value,
        confidence: attr.attribute_confidence,
        isHumanLocked: attr.is_human_locked,
        isCriticalAlert,
        box: normalized,
      });
    }
    return list;
  }, [attributes, currentPage, pageSize]);

  const activeBox = pageBoxes.find((b) => b.attributeId === selectedAttributeId);

  // Auto-switch page if selected attribute is on another page
  useEffect(() => {
    const selected = attributes.find(
      (a) => a.attribute_id === selectedAttributeId
    );
    const page =
      selected?.evidence?.page_number ?? selected?.page_number ?? undefined;
    if (page && page !== currentPage && page <= numPages) {
      const frame = window.requestAnimationFrame(() => {
        setCurrentPage(page);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [attributes, currentPage, numPages, selectedAttributeId]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoom(100);

  const formatFilename = (path?: string) => {
    if (!path) return "sample_catalog.pdf";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl select-none">
      {/* ── Top Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/90 border-b border-zinc-800 text-xs text-zinc-300">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
          <span
            className="font-mono text-zinc-200 truncate max-w-[160px] sm:max-w-[220px]"
            title={filePath}
          >
            {formatFilename(filePath)}
          </span>
          <span className="hidden sm:inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
            612 &times; 792 pt
          </span>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-zinc-200 text-xs">
            {currentPage} / {numPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom & Overlay Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`p-1.5 rounded-md transition-colors ${
              showBoxes
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title={showBoxes ? "Hide Evidence Boxes" : "Show Evidence Boxes"}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-zinc-800 mx-1" />
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono w-9 text-center text-[11px] text-zinc-400">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Canvas Scroll Area ──────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center bg-zinc-950/70">
        <div
          style={{
            width: `${pageSize.width}px`,
            height: `${pageSize.height}px`,
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center top",
            transition: "transform 0.15s ease-out",
          }}
          className="relative bg-white text-zinc-900 rounded-sm shadow-2xl overflow-hidden border border-zinc-300 shrink-0 select-text"
        >
          {/* Document Content */}
          {documentMarkdown ? (
            <div className="p-8 font-mono text-xs whitespace-pre-wrap text-zinc-800 bg-white leading-relaxed">
              {documentMarkdown}
            </div>
          ) : (
            /* Authentic Engineering Datasheet Layout */
            <div className="relative w-full h-full font-sans text-xs text-zinc-800">
              {/* Header Banner */}
              <div className="absolute top-[4%] left-[6%] right-[6%] border-b-2 border-zinc-900 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                    Industrial Flow Systems &bull; Specification Datasheet
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500">
                    DOC: DS-PV200-REV4 &bull; Page {currentPage}
                  </span>
                </div>
                <h1 className="text-base font-black tracking-tight text-zinc-950 uppercase mt-1">
                  True Union Industrial Ball Valve &bull; 200 Series
                </h1>
                <p className="text-[10px] text-zinc-600 font-mono">
                  Model: PV-200-HP-UNION &bull; Standards: ASTM D1785 / ANSI B16.5 / ASME B31.3
                </p>
              </div>

              {/* ── Section 1: Materials of Construction ─────────────────────────
                   Single-column grid layout: each row occupies its own horizontal
                   band. label=180px fixed, value=1fr remaining. No shared y-coords.
                   ──────────────────────────────────────────────────────────────── */}
              <div className="absolute top-[12%] left-[6%] right-[6%]">
                {/* Section header */}
                <div className="bg-zinc-900 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs">
                  1.0 Materials of Construction
                </div>
                {/* Key-value grid rows — divide-y enforces one row per field */}
                <div className="divide-y divide-zinc-200 border-b border-zinc-200">
                  {/* Body Material — annotated (bounding box top≈14%, height≈3%) */}
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">Body Material (Primary):</span>
                    <span className="font-mono font-medium text-zinc-950">
                      PVC Schedule 80{" "}
                      <span className="text-zinc-500 text-[10px] font-sans">(Rigid Type 1, Grade 1)</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">Seat Material:</span>
                    <span className="font-mono text-zinc-800">PTFE (Polytetrafluoroethylene Virgin)</span>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">O-Ring Seals:</span>
                    <span className="font-mono text-zinc-800">EPDM Fluoroelastomer Dual Stem Seals</span>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">End Connection:</span>
                    <span className="font-mono text-zinc-800">ANSI Class 150# Flanged Pattern</span>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Pressure & Temperature Operating Envelope ──────────
                   Same single-column grid layout as Section 1. Starts after Section
                   1 block (~27% from top). Annotated rows at matching bounding-box
                   percentages within this block.
                   ──────────────────────────────────────────────────────────────── */}
              <div className="absolute top-[27%] left-[6%] right-[6%]">
                {/* Section header */}
                <div className="bg-zinc-900 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs">
                  2.0 Pressure &amp; Temperature Operating Envelope
                </div>
                {/* Key-value grid rows */}
                <div className="divide-y divide-zinc-200 border-b border-zinc-200">
                  {/* Max Operating Temperature — annotated (bounding box top≈29%, height≈3%) */}
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-rose-700 shrink-0">Max Operating Temperature:</span>
                    <span className="font-mono font-bold text-rose-700">
                      450 &deg;F{" "}
                      <span className="text-rose-600 text-[10px] font-sans">(Continuous Service Rating)</span>
                    </span>
                  </div>
                  {/* Max Working Pressure — annotated (bounding box top≈32%, height≈3%) */}
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">Max Working Pressure:</span>
                    <span className="font-mono font-bold text-zinc-950">
                      235 PSI @ 73&deg;F{" "}
                      <span className="text-zinc-500 text-[10px] font-sans">(1.62 MPa Non-Shock Water)</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">Hydrostatic Shell Test:</span>
                    <span className="font-mono text-zinc-800">350 PSI Shell Test</span>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] px-2 py-1.5 items-start text-[11px]">
                    <span className="font-semibold text-zinc-600 shrink-0">Applicable Standard:</span>
                    <span className="font-mono text-zinc-800">ASTM D1785, ASTM F441, ASME B31.3</span>
                  </div>
                </div>
              </div>

              {/* ── Section 3: Physical Dimensions Table ─────────────────────────
                   Unchanged pattern. Shifted to top-[42%] to start below the
                   expanded single-column Sections 1 and 2.
                   ──────────────────────────────────────────────────────────────── */}
              <div className="absolute top-[42%] left-[6%] right-[6%] bg-zinc-900 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs flex items-center">
                3.0 Physical Dimensions &amp; Piping Specifications
              </div>

              {/* Section 3 Table Header */}
              <div className="absolute top-[45%] left-[12%] right-[6%] h-[3%] flex items-center font-bold text-zinc-700 bg-zinc-100 px-2 text-[10px] uppercase border-b border-zinc-300">
                <div className="grid grid-cols-[170px_50px_150px_1fr] w-full items-center">
                  <span>Parameter</span>
                  <span>Sym</span>
                  <span>Datasheet Dimension</span>
                  <span>Metric Eq.</span>
                </div>
              </div>

              {/* Section 3 Rows — top percentages shifted +7.5% from original */}
              {/* Row 1 (Outer Diameter) (Matches bounding box: top: 48%, left: 12%, width: 38%, height: 5%) */}
              <div className="absolute top-[48%] left-[12%] right-[6%] h-[5%] flex items-center text-[11px] border-b border-zinc-200 px-2 font-mono">
                <div className="grid grid-cols-[170px_50px_150px_1fr] w-full items-center">
                  <span className="font-sans font-medium text-zinc-700">Outer Diameter (O.D.)</span>
                  <span className="text-zinc-400">D_o</span>
                  <span className="font-bold text-zinc-950">2.375 in</span>
                  <span className="text-zinc-500">60.33 mm</span>
                </div>
              </div>

              {/* Row 2 (Inner Diameter) (Matches bounding box: top: 55%, left: 12%, width: 40%, height: 5%) */}
              <div className="absolute top-[55%] left-[12%] right-[6%] h-[5%] flex items-center text-[11px] border-b border-zinc-200 px-2 font-mono">
                <div className="grid grid-cols-[170px_50px_150px_1fr] w-full items-center">
                  <span className="font-sans font-medium text-zinc-700">Inner Diameter (I.D.)</span>
                  <span className="text-zinc-400">D_i</span>
                  <span className="font-bold text-zinc-950">2.000 in</span>
                  <span className="text-zinc-500">50.80 mm</span>
                </div>
              </div>

              {/* Row 3 (Overall Length) (Matches bounding box: top: 62%, left: 12%, width: 35%, height: 5%) */}
              <div className="absolute top-[62%] left-[12%] right-[6%] h-[5%] flex items-center text-[11px] border-b border-zinc-200 px-2 font-mono">
                <div className="grid grid-cols-[170px_50px_150px_1fr] w-full items-center">
                  <span className="font-sans font-medium text-zinc-700">Overall Length (F-to-F)</span>
                  <span className="text-zinc-400">L</span>
                  <span className="font-bold text-zinc-950">5.50 in</span>
                  <span className="text-zinc-500">139.70 mm</span>
                </div>
              </div>

              {/* Row 4 (Flange Diameter) (Matches bounding box: top: 69%, left: 12%, width: 48%, height: 5%) */}
              <div className="absolute top-[69%] left-[12%] right-[6%] h-[5%] flex items-center text-[11px] border-b border-zinc-200 px-2 font-mono">
                <div className="grid grid-cols-[170px_50px_150px_1fr] w-full items-center">
                  <span className="font-sans font-medium text-zinc-700">Flange Diameter</span>
                  <span className="text-zinc-400">D_f</span>
                  <span className="font-bold text-zinc-950">4.75 in</span>
                  <span className="text-zinc-500">120.65 mm</span>
                </div>
              </div>

              {/* Row 5 (Nominal Port Size) (top: 76%) */}
              <div className="absolute top-[76%] left-[12%] right-[6%] h-[5%] flex items-center text-[11px] border-b border-zinc-200 px-2 font-mono">
                <div className="grid grid-cols-[170px_50px_150px_1fr] w-full items-center">
                  <span className="font-sans font-medium text-zinc-700">Nominal Port Size</span>
                  <span className="text-zinc-400">d_p</span>
                  <span className="font-bold text-zinc-950">1.50 in</span>
                  <span className="text-zinc-500">38.10 mm</span>
                </div>
              </div>

              {/* Section 4: Compliance Footer */}
              <div className="absolute top-[92%] left-[6%] right-[6%] border-t-2 border-zinc-900 pt-2 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Unilog Catalog Engine &bull; Gate 5 Provenance Anchored</span>
                </div>
                <div>ISO 9001:2015 Registered &bull; ASME B31.3 Piping Code</div>
              </div>
            </div>
          )}

          {/* ── Bounding Box Visual Overlay Layer ───────────────────────── */}
          {showBoxes && (
            <div className="absolute inset-0 w-full h-full pointer-events-none">
              {pageBoxes.map((item) => {
                const isSelected = selectedAttributeId === item.attributeId;
                const { topPct, leftPct, widthPct, heightPct } = item.box;

                const isAnomaly = item.isCriticalAlert;

                return (
                  <div
                    key={item.attributeId}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAttribute(item.attributeId);
                    }}
                    style={{
                      top: `${topPct}%`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    className={`absolute pointer-events-auto cursor-pointer rounded-sm transition-all group ${
                      isAnomaly
                        ? isSelected
                          ? "border-2 border-rose-500 bg-rose-500/25 ring-4 ring-rose-500/30 z-30 animate-pulse"
                          : "border-2 border-rose-500/80 bg-rose-500/15 hover:bg-rose-500/30 z-20"
                        : isSelected
                          ? "border-2 border-amber-500 bg-amber-500/25 ring-4 ring-amber-500/25 z-30 animate-pulse"
                          : "border border-sky-500/80 bg-sky-500/10 hover:bg-sky-500/25 hover:border-sky-400 z-10"
                    }`}
                  >
                    {/* Floating Provenance Tooltip */}
                    <div
                      className={`absolute -top-5.5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold whitespace-nowrap shadow-md pointer-events-none transition-opacity ${
                        isAnomaly
                          ? "bg-rose-600 text-white opacity-100"
                          : isSelected
                            ? "bg-amber-500 text-zinc-950 opacity-100 font-bold"
                            : "bg-sky-700 text-white opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {item.canonicalKey}: {item.rawValue} (
                      {(item.confidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Status Bar ────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-zinc-950/90 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
          <span>
            {pageBoxes.length}{" "}
            {pageBoxes.length === 1 ? "provenance anchor" : "provenance anchors"}{" "}
            anchored on page {currentPage}
          </span>
        </div>
        {activeBox && (
          <div className="flex items-center gap-2 font-mono text-amber-400">
            {activeBox.isCriticalAlert ? (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              Active: {activeBox.canonicalKey} = {activeBox.rawValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
