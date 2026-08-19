"use client";

/**
 * SpecForgeDashboard.tsx — Sub-stage 13C
 *
 * Unified Master Engineering Workbench for SpecForge:
 *
 * Layout Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ Top Header: SKU Title, Compliance Badge, Quick Actions (Cross-Ref, Export) │
 * ├──────────────────────────────────────┬──────────────────────────────────────┤
 * │ LEFT COLUMN (40% width):             │ RIGHT COLUMN (60% width):            │
 * │  - Tab Switcher (PDF / Spec Editor)  │  - 3D Parametric CAD & Physics       │
 * │  - PdfCanvasViewer w/ Bounding Boxes │    Stress Viewport (R3F + WebGL)     │
 * │  - SpecEditorTable w/ Provenance     │  - Real-Time Stress Analysis Overlay │
 * │                                      │  - ValidationAlerts Banner           │
 * │                                      │  - Interactive Simulation Controls   │
 * └──────────────────────────────────────┴──────────────────────────────────────┘
 *
 * Inter-Component State Synchronization:
 *  - Clicking a ValidationAlert (e.g. 450°F on PVC) auto-arms Stress Simulator
 *    Mode in the 3D viewport and drives temperature/pressure sliders to the
 *    failing values in real-time.
 *  - "Cross-Ref" launches the CrossRefDrawer with competitor parity scoring.
 *  - "Export PIM" opens the multi-taxonomy PimExportModal.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  FileText,
  Flame,
  Gauge,
  GitCompare,
  Layers,
  RotateCcw,
  ShieldAlert,
  Table,
  Zap,
} from "lucide-react";

import { Parametric3DViewer } from "@/components/Parametric3DViewer";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { SpecEditorTable } from "@/components/SpecEditorTable";
import {
  ValidationAlerts,
  type ValidationAlert,
} from "@/components/ValidationAlerts";
import {
  CrossRefDrawer,
  type CompetitorMatch,
} from "@/components/CrossRefDrawer";
import { PimExportModal } from "@/components/PimExportModal";
import type {
  AttributeRecord,
  ModifiedAttributePayload,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Mock Demo Data: Industrial High-Pressure PVC Valve with Temperature Defect
// ---------------------------------------------------------------------------

const DEMO_SKU = "PV-200-HP-UNION";
const DEMO_PRODUCT_NAME = "True Union Industrial Ball Valve 2-Inch High Pressure";

const DEMO_EXTRACTED_SPECS: Record<string, string> = {
  "Product Name": DEMO_PRODUCT_NAME,
  "Part Number": DEMO_SKU,
  "Material": "PVC",
  "Outer Diameter": "2.375 in",
  "Inner Diameter": "2.0 in",
  "Length": "5.5 in",
  "Flange Diameter": "4.75 in",
  "Port Size": "1.5 in",
  "Pressure Rating": "235 PSI",
  "Max Operating Temperature": "450 °F", // Intentionally unsafe! PVC max is 140°F
  "End Connection": "Flanged ANSI 150#",
  "Seat Material": "PTFE",
  "O-Ring Material": "EPDM",
  "Standard": "ASTM D1785 / ANSI B16.5",
};

const DEMO_ATTRIBUTES: AttributeRecord[] = [
  {
    attribute_id: "attr-mat",
    canonical_key: "body_material",
    raw_key: "Material",
    raw_value: "PVC Schedule 80",
    normalized_value: "PVC",
    numeric_value: null,
    unit: null,
    attribute_confidence: 0.98,
    normalization_method: "DICTIONARY",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: false,
    page_number: 1,
    evidence: {
      evidence_id: "ev-mat-1",
      evidence_type: "SOURCE",
      source_text: "Body Material: Rigid Polyvinyl Chloride (PVC Type 1, Grade 1)",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 18,
        left_pct: 12,
        width_pct: 45,
        height_pct: 6,
      },
      confidence_score: 0.98,
    },
  },
  {
    attribute_id: "attr-temp",
    canonical_key: "max_operating_temperature_f",
    raw_key: "Max Operating Temperature",
    raw_value: "450 °F",
    normalized_value: "450",
    numeric_value: 450,
    unit: "°F",
    attribute_confidence: 0.94,
    normalization_method: "REGEX",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: true,
    page_number: 1,
    evidence: {
      evidence_id: "ev-temp-1",
      evidence_type: "SOURCE",
      source_text: "Max Operating Temp: 450 °F (Continuous Service Rating)",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 26,
        left_pct: 12,
        width_pct: 42,
        height_pct: 5,
      },
      confidence_score: 0.94,
    },
  },
  {
    attribute_id: "attr-press",
    canonical_key: "max_working_pressure_psi",
    raw_key: "Pressure Rating",
    raw_value: "235 PSI @ 73°F",
    normalized_value: "235",
    numeric_value: 235,
    unit: "PSI",
    attribute_confidence: 0.96,
    normalization_method: "PINT",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: false,
    page_number: 1,
    evidence: {
      evidence_id: "ev-press-1",
      evidence_type: "SOURCE",
      source_text: "Working Pressure: 235 PSI Non-Shock Water @ 73°F",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 33,
        left_pct: 12,
        width_pct: 46,
        height_pct: 5,
      },
      confidence_score: 0.96,
    },
  },
  {
    attribute_id: "attr-od",
    canonical_key: "outer_diameter_in",
    raw_key: "Outer Diameter",
    raw_value: "2.375 in",
    normalized_value: "2.375",
    numeric_value: 2.375,
    unit: "in",
    attribute_confidence: 0.99,
    normalization_method: "PINT",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: false,
    page_number: 1,
    evidence: {
      evidence_id: "ev-od-1",
      evidence_type: "SOURCE",
      source_text: "Pipe O.D. Dimension: 2.375 inches (60.33 mm)",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 41,
        left_pct: 12,
        width_pct: 38,
        height_pct: 5,
      },
      confidence_score: 0.99,
    },
  },
  {
    attribute_id: "attr-id",
    canonical_key: "inner_diameter_in",
    raw_key: "Inner Diameter",
    raw_value: "2.000 in",
    normalized_value: "2.0",
    numeric_value: 2.0,
    unit: "in",
    attribute_confidence: 0.97,
    normalization_method: "PINT",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: false,
    page_number: 1,
    evidence: {
      evidence_id: "ev-id-1",
      evidence_type: "SOURCE",
      source_text: "Nominal Flow Bore (I.D.): 2.000 inches full port",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 48,
        left_pct: 12,
        width_pct: 40,
        height_pct: 5,
      },
      confidence_score: 0.97,
    },
  },
  {
    attribute_id: "attr-len",
    canonical_key: "overall_length_in",
    raw_key: "Length",
    raw_value: "5.50 in",
    normalized_value: "5.5",
    numeric_value: 5.5,
    unit: "in",
    attribute_confidence: 0.98,
    normalization_method: "PINT",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: false,
    page_number: 1,
    evidence: {
      evidence_id: "ev-len-1",
      evidence_type: "SOURCE",
      source_text: "Face-to-Face Overall Length (L): 5.50 in",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 55,
        left_pct: 12,
        width_pct: 35,
        height_pct: 5,
      },
      confidence_score: 0.98,
    },
  },
  {
    attribute_id: "attr-flange",
    canonical_key: "flange_diameter_in",
    raw_key: "Flange Diameter",
    raw_value: "4.75 in",
    normalized_value: "4.75",
    numeric_value: 4.75,
    unit: "in",
    attribute_confidence: 0.95,
    normalization_method: "PINT",
    is_derived: false,
    is_human_locked: false,
    requires_human_review: false,
    page_number: 1,
    evidence: {
      evidence_id: "ev-flange-1",
      evidence_type: "SOURCE",
      source_text: "Mounting Flange Outside Diameter: 4.75 in (4-hole bolt circle)",
      page_number: 1,
      bounding_box: {
        page_number: 1,
        top_pct: 62,
        left_pct: 12,
        width_pct: 48,
        height_pct: 5,
      },
      confidence_score: 0.95,
    },
  },
];

const DEMO_VALIDATION_ALERTS: ValidationAlert[] = [
  {
    id: "alert-temp-pvc",
    severity: "critical",
    title: "Thermal Failure: PVC Continuous Service Limit Exceeded",
    description:
      "Datasheet extracts 450 °F service temperature on rigid PVC body. ASTM D1785 / ASTM F441 establish maximum continuous operating threshold for PVC at 140 °F (60 °C). Thermal softening and catastrophic rupture will occur.",
    specKey: "Max Operating Temperature",
    extractedValue: "450 °F",
    physicsRule: "ASTM D1785 §6.2 — PVC Heat Deflection Point is 140°F",
    ruleId: "RULE-PHYS-PVC-TEMP-01",
    pdfPage: 1,
  },
  {
    id: "alert-pressure-derate",
    severity: "warning",
    title: "Thermal Pressure Derating Warning",
    description:
      "Working pressure of 235 PSI is rated at 73 °F. If service temperature exceeds 100 °F, working pressure must be derated by 50% per ASME B31.3 Chapter VII.",
    specKey: "Pressure Rating",
    extractedValue: "235 PSI",
    physicsRule: "ASME B31.3 §A302.3.2 Thermoplastic Pressure Derating Table",
    ruleId: "RULE-PHYS-DERATE-02",
    pdfPage: 1,
  },
];

const DEMO_COMPETITOR_MATCHES: CompetitorMatch[] = [
  {
    id: "comp-1",
    brand: "Nibco",
    partNumber: "S-585-70-66",
    parityScore: 94,
    matchStatus: "equivalent",
    datasheetUrl: "https://example.com/nibco-s585",
    specDifferences: [
      {
        key: "Body Material",
        targetValue: "PVC Type 1",
        competitorValue: "PVC Type 1",
        isMatch: true,
      },
      {
        key: "Pressure Rating",
        targetValue: "235 PSI",
        competitorValue: "250 PSI",
        isMatch: false,
      },
      {
        key: "End Connection",
        targetValue: "ANSI 150# Flanged",
        competitorValue: "ANSI 150# Flanged",
        isMatch: true,
      },
      {
        key: "Port Diameter",
        targetValue: "2.0 in",
        competitorValue: "2.0 in",
        isMatch: true,
      },
    ],
  },
  {
    id: "comp-2",
    brand: "Spears Manufacturing",
    partNumber: "2322-020",
    parityScore: 88,
    matchStatus: "equivalent",
    datasheetUrl: "https://example.com/spears-2322",
    specDifferences: [
      {
        key: "Body Material",
        targetValue: "PVC Type 1",
        competitorValue: "PVC Type 1",
        isMatch: true,
      },
      {
        key: "Pressure Rating",
        targetValue: "235 PSI",
        competitorValue: "235 PSI",
        isMatch: true,
      },
      {
        key: "Overall Length",
        targetValue: "5.50 in",
        competitorValue: "5.75 in",
        isMatch: false,
      },
    ],
  },
  {
    id: "comp-3",
    brand: "Georg Fischer (+GF+)",
    partNumber: "Type 546 Pro",
    parityScore: 72,
    matchStatus: "divergent",
    datasheetUrl: "https://example.com/gf-546",
    specDifferences: [
      {
        key: "Body Material",
        targetValue: "PVC",
        competitorValue: "CPVC",
        isMatch: false,
      },
      {
        key: "Max Temperature",
        targetValue: "140 °F",
        competitorValue: "200 °F",
        isMatch: false,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function SpecForgeDashboard() {
  // Navigation / Tab state
  const [leftTab, setLeftTab] = useState<"pdf" | "specs">("pdf");

  // Selection state
  const [selectedAttrId, setSelectedAttrId] = useState<string>("attr-temp");

  // Modals & Drawers
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCrossRefOpen, setIsCrossRefOpen] = useState(false);

  // Synchronized 3D Stress Viewport state
  const [stressModeActive, setStressModeActive] = useState(false);
  const [targetPSI, setTargetPSI] = useState<number | undefined>(undefined);
  const [targetTempF, setTargetTempF] = useState<number | undefined>(undefined);

  // Editable Attributes state
  const [modifiedAttributes, setModifiedAttributes] = useState<
    Map<string, ModifiedAttributePayload>
  >(new Map());
  const [auditReasons, setAuditReasons] = useState<Map<string, string>>(
    new Map()
  );

  const handleUpdateAttribute = useCallback(
    (
      attributeId: string,
      updated: ModifiedAttributePayload,
      auditReason: string
    ) => {
      setModifiedAttributes((prev) => {
        const next = new Map(prev);
        next.set(attributeId, updated);
        return next;
      });
      setAuditReasons((prev) => {
        const next = new Map(prev);
        next.set(attributeId, auditReason);
        return next;
      });
    },
    []
  );

  // Inter-Component Synchronization: Clicking a validation alert
  const handleFocusAlert = useCallback((alert: ValidationAlert) => {
    // 1. Highlight the relevant attribute
    const matched = DEMO_ATTRIBUTES.find(
      (a) => a.raw_key === alert.specKey || a.canonical_key.includes("temp")
    );
    if (matched) {
      setSelectedAttrId(matched.attribute_id);
    }

    // 2. Automatically trigger Physics Stress Simulator Mode
    setStressModeActive(true);

    // 3. Set failing value on the respective slider
    if (alert.specKey.toLowerCase().includes("temp")) {
      const match = alert.extractedValue.match(/(\d+)/);
      if (match) {
        setTargetTempF(parseInt(match[1], 10));
      }
    } else if (alert.specKey.toLowerCase().includes("press")) {
      const match = alert.extractedValue.match(/(\d+)/);
      if (match) {
        setTargetPSI(parseInt(match[1], 10));
      }
    }
  }, []);

  const handleResetSimulator = useCallback(() => {
    setStressModeActive(false);
    setTargetPSI(undefined);
    setTargetTempF(undefined);
  }, []);

  const selectedAttribute = useMemo(
    () => DEMO_ATTRIBUTES.find((a) => a.attribute_id === selectedAttrId),
    [selectedAttrId]
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ── Top Master Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/85 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Layers className="h-5 w-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white sm:text-base">
                  SpecForge Workbench
                </span>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-sky-300">
                  Sub-stage 13C
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-xs sm:max-w-md">
                {DEMO_SKU} &middot; {DEMO_PRODUCT_NAME}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick status pill */}
          <div className="hidden items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 md:flex">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            <span>Physics Gate Alert: 1 Critical</span>
          </div>

          {/* Cross Reference Drawer Button */}
          <button
            type="button"
            onClick={() => setIsCrossRefOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:bg-zinc-800"
          >
            <GitCompare className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cross-Ref Matrix</span>
          </button>

          {/* Export PIM Modal Button */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition hover:border-emerald-400 hover:bg-emerald-500/25"
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export PIM</span>
          </button>
        </div>
      </header>

      {/* ── Main Split-Screen Workspace ──────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* ── LEFT COLUMN (40% width): PDF Evidence & Spec Table ───────────── */}
        <section className="flex flex-col border-b border-zinc-800/80 lg:w-[42%] lg:border-b-0 lg:border-r">
          {/* Column Tab Bar */}
          <div className="flex h-12 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/40 px-3">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-950/60 p-1">
              <button
                type="button"
                onClick={() => setLeftTab("pdf")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                  leftTab === "pdf"
                    ? "bg-zinc-800 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-sky-400" />
                Datasheet PDF (Evidence)
              </button>
              <button
                type="button"
                onClick={() => setLeftTab("specs")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                  leftTab === "specs"
                    ? "bg-zinc-800 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Table className="h-3.5 w-3.5 text-emerald-400" />
                Extracted Specs Table ({DEMO_ATTRIBUTES.length})
              </button>
            </div>

            <span className="text-[11px] font-mono text-zinc-500">
              Page 1 of 1
            </span>
          </div>

          {/* Column Body */}
          <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 480 }}>
            {leftTab === "pdf" ? (
              <div className="h-full space-y-3">
                <PdfCanvasViewer
                  filePath="sample_catalog.pdf"
                  totalPages={1}
                  attributes={DEMO_ATTRIBUTES}
                  selectedAttributeId={selectedAttrId}
                  onSelectAttribute={(id) => setSelectedAttrId(id)}
                />

                {/* Evidence Callout for Selected Attribute */}
                {selectedAttribute && (
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs backdrop-blur-md">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
                      <span className="font-semibold text-zinc-200">
                        Provenance Inspector: {selectedAttribute.raw_key}
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                        {Math.round(selectedAttribute.attribute_confidence * 100)}% Conf
                      </span>
                    </div>
                    <p className="mt-2 text-zinc-300 font-mono text-[11px] bg-black/30 p-2 rounded-lg border border-white/5">
                      &ldquo;{selectedAttribute.evidence?.source_text || selectedAttribute.raw_value}&rdquo;
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500">
                      <span>Method: {selectedAttribute.normalization_method}</span>
                      <span>&bull;</span>
                      <span>Page: {selectedAttribute.page_number}</span>
                      <span>&bull;</span>
                      <span className="text-sky-400">Bounding Box Synchronized</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <SpecEditorTable
                attributes={DEMO_ATTRIBUTES}
                modifiedAttributes={modifiedAttributes}
                auditReasons={auditReasons}
                selectedAttributeId={selectedAttrId}
                onSelectAttribute={(id) => setSelectedAttrId(id)}
                onUpdateAttribute={handleUpdateAttribute}
                productSku={DEMO_SKU}
              />
            )}
          </div>
        </section>

        {/* ── RIGHT COLUMN (58% width): 3D CAD, Physics & Validation Alerts ── */}
        <section className="flex flex-col lg:w-[58%] overflow-y-auto">
          {/* Top Half: 3D Parametric CAD & Stress Viewport */}
          <div className="p-3 pb-1.5 flex-1 flex flex-col min-h-[440px]">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Parametric 3D CAD & Stress Viewport
                </span>
              </div>

              {stressModeActive && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-300">
                    <Flame className="h-3 w-3 text-red-400 animate-pulse" />
                    Physics Simulation Active
                  </span>
                  <button
                    type="button"
                    onClick={handleResetSimulator}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* 3D WebGL Canvas Viewport with Stress Simulator Sync */}
            <div className="relative flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden min-h-[400px]">
              <Parametric3DViewer
                extractedSpecs={DEMO_EXTRACTED_SPECS}
                className="h-full w-full"
                externalStressMode={stressModeActive}
                externalPSI={targetPSI}
                externalTempF={targetTempF}
                onStressModeChange={(active) => setStressModeActive(active)}
                onPSIChange={(psi) => setTargetPSI(psi)}
                onTempChange={(temp) => setTargetTempF(temp)}
              />
            </div>
          </div>

          {/* Bottom Half: Physics Validation Alerts Banner & Action Bar */}
          <div className="p-3 pt-1.5 space-y-3">
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Deterministic Physics Validation Engine
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">
                  ASME B31.3 / ASTM Guardrails
                </span>
              </div>

              {/* Validation Alerts List with Click-to-Simulate Sync */}
              <ValidationAlerts
                alerts={DEMO_VALIDATION_ALERTS}
                onFocusEvidence={handleFocusAlert}
                onTriggerReExtraction={(alert) => {
                  if (alert.severity === "critical") {
                    handleFocusAlert(alert);
                  }
                }}
              />

              {/* Quick Anomaly Trigger Bar */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-2.5">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Quick Test Failure Anomaly:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStressModeActive(true);
                      setTargetTempF(450);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-200 hover:bg-red-500/20"
                  >
                    <Flame className="h-3 w-3 text-red-400" />
                    Inject 450°F Thermal Failure
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStressModeActive(true);
                      setTargetPSI(550);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
                  >
                    <Gauge className="h-3 w-3 text-amber-400" />
                    Inject 550 PSI Over-Pressure
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Slide-Over Drawers & Modals ──────────────────────────────────── */}
      <CrossRefDrawer
        isOpen={isCrossRefOpen}
        onClose={() => setIsCrossRefOpen(false)}
        targetPartNumber={DEMO_SKU}
        competitorMatches={DEMO_COMPETITOR_MATCHES}
      />

      <PimExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        extractedData={{
          sku: DEMO_SKU,
          product_name: DEMO_PRODUCT_NAME,
          ...DEMO_EXTRACTED_SPECS,
        }}
        partNumber={DEMO_SKU}
        productName={DEMO_PRODUCT_NAME}
      />
    </div>
  );
}
