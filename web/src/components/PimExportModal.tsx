"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  FileCode,
  Layers,
  Sparkles,
  X,
} from "lucide-react";

export type SchemaTarget = "Unilog CX1 PIM" | "ETIM 8.0" | "UNSPSC";
type PreviewMode = "dual" | "canonical" | "mapped";

interface PimExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedData?: Record<string, unknown>;
  partNumber?: string;
  productName?: string;
}

const defaultExtractedData: Record<string, unknown> = {
  sku: "UNILOG-CTR-2405",
  title: "PVC Schedule 40 Pressure Fitting",
  material: "PVC",
  temperature_rating_f: 140,
  pressure_rating_psi: 180,
  diameter_in: 2,
  wall_thickness_in: 0.154,
  standard: "ASTM D2467",
  category: "Plumbing / Fittings",
  status: "Validated",
};

const schemaMap: Record<SchemaTarget, Record<string, unknown>> = {
  "Unilog CX1 PIM": {
    sku: "UNILOG-CTR-2405",
    product_name: "PVC Schedule 40 Pressure Fitting",
    product_type: "industrial_fitting",
    attributes: {
      material: "PVC",
      max_temp_f: 140,
      pressure_rating_psi: 180,
      diameter_in: 2,
    },
    taxonomy: { family: "plumbing_fittings", department: "materials" },
  },
  "ETIM 8.0": {
    etim_class_id: "EC000123",
    class_description: "Pressure fitting",
    material_group: "PVC",
    max_operating_temp_c: 60,
    nominal_size_mm: 50.8,
    compliance: ["EN 1452", "DIN 8079"],
  },
  UNSPSC: {
    unspsc_code: "40171502",
    commodity_name: "PVC pipe fittings",
    segment: "Plumbing fixtures and accessories",
    family: "pipe fittings",
    class: "plastic pipe fittings",
  },
};

export const PimExportModal: React.FC<PimExportModalProps> = ({
  isOpen,
  onClose,
  extractedData = defaultExtractedData,
  partNumber = "UNILOG-CTR-2405",
  productName = "PVC Schedule 40 Pressure Fitting",
}) => {
  const [selectedSchema, setSelectedSchema] = useState<SchemaTarget>("Unilog CX1 PIM");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("dual");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "published">("idle");

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const canonicalJson = useMemo(
    () => JSON.stringify({ sku: partNumber, product_name: productName, ...extractedData }, null, 2),
    [extractedData, partNumber, productName],
  );

  const mappedJson = useMemo(
    () => JSON.stringify({ target_schema: selectedSchema, ...schemaMap[selectedSchema], source_sku: partNumber }, null, 2),
    [partNumber, selectedSchema],
  );

  const handleCopy = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  };

  const handlePublish = () => {
    setCopyState("published");
    window.setTimeout(() => setCopyState("idle"), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pim-export-title"
        className="relative flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h2 id="pim-export-title" className="text-base font-semibold text-zinc-100">
                Schema adapter preview
              </h2>
              <p className="text-xs text-zinc-400">Canonical model to downstream PIM contract</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close export modal"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-800 bg-zinc-950/60 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              <Layers className="h-3.5 w-3.5" />
              Target destination
            </div>

            <div className="flex flex-wrap gap-2">
              {(["Unilog CX1 PIM", "ETIM 8.0", "UNSPSC"] as SchemaTarget[]).map((schema) => (
                <button
                  key={schema}
                  type="button"
                  onClick={() => setSelectedSchema(schema)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    selectedSchema === schema
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                  aria-pressed={selectedSchema === schema}
                >
                  {schema}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-800 bg-zinc-900/40 px-5 py-3">
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            {(["dual", "canonical", "mapped"] as PreviewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  previewMode === mode
                    ? "bg-zinc-800 text-white shadow-inner"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-pressed={previewMode === mode}
              >
                {mode === "dual" ? "Dual view" : mode === "canonical" ? "Canonical" : "Target JSON"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-950/80 px-4 py-4">
          {(previewMode === "dual" || previewMode === "canonical") && (
            <div className={`${previewMode === "canonical" ? "block" : "mb-4 block"}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">Canonical JSON</span>
                <button
                  type="button"
                  onClick={() => handleCopy(canonicalJson)}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              <pre className="max-h-[24vh] overflow-auto rounded-xl border border-zinc-800 bg-[#0b1120] p-4 text-[11px] leading-6 text-emerald-300/90 shadow-inner shadow-emerald-900/20">
                {canonicalJson}
              </pre>
            </div>
          )}

          {(previewMode === "dual" || previewMode === "mapped") && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                  {selectedSchema} mapped JSON
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(mappedJson)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200 hover:border-emerald-400/40 hover:bg-emerald-500/15"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy mapped
                </button>
              </div>
              <pre className="max-h-[24vh] overflow-auto rounded-xl border border-zinc-800 bg-[#0a101d] p-4 text-[11px] leading-6 text-sky-300/90 shadow-inner shadow-sky-900/20">
                {mappedJson}
              </pre>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/70 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Validation status: ready for downstream hand-off
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(mappedJson)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              {copyState === "copied" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copyState === "copied" ? "Copied" : "Copy JSON"}
            </button>

            <button
              type="button"
              onClick={handlePublish}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              {copyState === "published" ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              {copyState === "published" ? "Published" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};