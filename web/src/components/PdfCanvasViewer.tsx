"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  FileText,
  Layers,
  Sparkles,
} from "lucide-react";
import type { AttributeRecord, BoundingBox } from "@/types/domain";

interface PdfCanvasViewerProps {
  filePath?: string;
  totalPages?: number;
  attributes: AttributeRecord[];
  selectedAttributeId: string | null;
  onSelectAttribute: (attributeId: string) => void;
  documentMarkdown?: string;
}

export function PdfCanvasViewer({
  filePath,
  totalPages = 1,
  attributes,
  selectedAttributeId,
  onSelectAttribute,
  documentMarkdown,
}: PdfCanvasViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showBoxes, setShowBoxes] = useState(true);

  const numPages = Math.max(1, totalPages);

  // Extract all bounding boxes mapped to their attribute
  const pageBoxes = useMemo(() => {
    return attributes
      .map((attr) => {
        let box: BoundingBox | null = null;
        if (attr.evidence?.bounding_box) {
          box = attr.evidence.bounding_box;
        } else if (attr.bounding_box_json) {
          try {
            const raw = JSON.parse(attr.bounding_box_json);
            if (Array.isArray(raw) && raw.length >= 5) {
              box = {
                page_number: raw[0],
                top_pct: raw[1],
                left_pct: raw[2],
                width_pct: raw[3],
                height_pct: raw[4],
              };
            }
          } catch {
            // Ignore parse error
          }
        }
        return {
          attributeId: attr.attribute_id,
          canonicalKey: attr.canonical_key,
          rawValue: attr.raw_value,
          confidence: attr.attribute_confidence,
          isHumanLocked: attr.is_human_locked,
          box,
        };
      })
      .filter(
        (item): item is typeof item & { box: BoundingBox } =>
          item.box !== null && item.box.page_number === currentPage
      );
  }, [attributes, currentPage]);

  const activeBox = pageBoxes.find((b) => b.attributeId === selectedAttributeId);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoom(100);

  const formatFilename = (path?: string) => {
    if (!path) return "catalog.pdf";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-lg select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/90 border-b border-zinc-800 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          <span className="font-mono truncate max-w-[200px]" title={filePath}>
            {formatFilename(filePath)}
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
          <span className="font-mono text-zinc-200">
            Page {currentPage} of {numPages}
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
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Toggle Bounding Boxes"
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
          <span className="font-mono w-10 text-center text-[11px] text-zinc-400">
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
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-zinc-950/60">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center top",
            transition: "transform 0.15s ease-out",
          }}
          className="relative w-[612px] min-h-[792px] bg-white text-zinc-900 rounded-sm shadow-2xl overflow-hidden border border-zinc-200"
        >
          {/* Simulated PDF Document Page Canvas */}
          <div className="p-8 font-serif text-sm leading-relaxed select-text space-y-4">
            <div className="border-b border-zinc-300 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-sans tracking-tight text-zinc-900">
                  INDUSTRIAL CATALOG SPECIFICATION
                </h2>
                <p className="text-xs text-zinc-500 font-sans mt-0.5">
                  Page {currentPage} — High-Pressure Valving & Fluid Control
                </p>
              </div>
              <div className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded border border-zinc-200">
                DOC-ID: {filePath ? formatFilename(filePath) : "CATALOG-01"}
              </div>
            </div>

            {/* Render document content if available */}
            {documentMarkdown ? (
              <div className="font-mono text-xs whitespace-pre-wrap text-zinc-700 bg-zinc-50 p-4 rounded border border-zinc-200/80 leading-5">
                {documentMarkdown}
              </div>
            ) : (
              <div className="space-y-4 text-xs text-zinc-700 font-sans">
                <div className="p-3 bg-zinc-50 rounded border border-zinc-200">
                  <h3 className="font-semibold text-zinc-900 mb-2">Technical Overview</h3>
                  <p className="leading-5 text-zinc-600">
                    Series engineered for severe industrial chemical and fluid handling applications.
                    All components comply with ASME/ANSI B16.34 standards with full material traceability.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wider">
                    Extracted Document Data Points
                  </h4>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    {attributes.map((attr) => (
                      <div
                        key={attr.attribute_id}
                        onClick={() => onSelectAttribute(attr.attribute_id)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          selectedAttributeId === attr.attribute_id
                            ? "bg-amber-50 border-amber-400 text-amber-950 ring-2 ring-amber-400/30"
                            : "bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        <div className="text-[10px] text-zinc-400">{attr.canonical_key}:</div>
                        <div className="font-semibold text-zinc-900 truncate">
                          {attr.raw_value || "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bounding Box Visual Overlay */}
          {showBoxes && (
            <div className="absolute inset-0 pointer-events-none">
              {pageBoxes.map((item) => {
                const isSelected = selectedAttributeId === item.attributeId;
                const { top_pct, left_pct, width_pct, height_pct } = item.box;

                return (
                  <div
                    key={item.attributeId}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAttribute(item.attributeId);
                    }}
                    style={{
                      top: `${top_pct}%`,
                      left: `${left_pct}%`,
                      width: `${Math.max(width_pct, 4)}%`,
                      height: `${Math.max(height_pct, 3)}%`,
                    }}
                    className={`absolute pointer-events-auto cursor-pointer rounded transition-all group ${
                      isSelected
                        ? "border-2 border-amber-500 bg-amber-500/25 ring-4 ring-amber-500/20 z-30 animate-pulse"
                        : "border border-blue-500/70 bg-blue-500/10 hover:bg-blue-500/25 hover:border-blue-600 z-10"
                    }`}
                  >
                    {/* Bounding Box Floating Tag */}
                    <div
                      className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold whitespace-nowrap shadow-xs pointer-events-none transition-opacity ${
                        isSelected
                          ? "bg-amber-500 text-zinc-950 opacity-100 font-bold"
                          : "bg-blue-600 text-white opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {item.canonicalKey}: {item.rawValue} ({(item.confidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2 bg-zinc-950/90 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span>
            {pageBoxes.length} {pageBoxes.length === 1 ? "evidence box" : "evidence boxes"} on page {currentPage}
          </span>
        </div>
        {activeBox && (
          <div className="flex items-center gap-2 font-mono text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Active: {activeBox.canonicalKey}</span>
          </div>
        )}
      </div>
    </div>
  );
}
