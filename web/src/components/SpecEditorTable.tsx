"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Hash,
  HelpCircle,
  Key,
  Lock,
  LockOpen,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Undo2,
} from "lucide-react";
import { ReasonCodeModal } from "@/components/ReasonCodeModal";
import type { AttributeRecord, ModifiedAttributePayload } from "@/types/domain";

interface SpecEditorTableProps {
  attributes: AttributeRecord[];
  modifiedAttributes: Map<string, ModifiedAttributePayload>;
  auditReasons: Map<string, string>;
  selectedAttributeId: string | null;
  onSelectAttribute: (attributeId: string) => void;
  onUpdateAttribute: (
    attributeId: string,
    updated: ModifiedAttributePayload,
    auditReason: string
  ) => void;
  onResetAttribute?: (attributeId: string) => void;
}

export function SpecEditorTable({
  attributes,
  modifiedAttributes,
  auditReasons,
  selectedAttributeId,
  onSelectAttribute,
  onUpdateAttribute,
  onResetAttribute,
}: SpecEditorTableProps) {
  // Inline editing state
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"raw_value" | "normalized_value" | "unit" | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    attributeId: string;
    attributeKey: string;
    field: "raw_value" | "normalized_value" | "unit" | "is_human_locked";
    previousValue: string;
    newValue: string;
    payload: ModifiedAttributePayload;
  } | null>(null);

  const getGateBadge = (attr: AttributeRecord) => {
    // Check confidence and validation
    const isModified = modifiedAttributes.has(attr.attribute_id);
    const confidence = attr.attribute_confidence;

    if (attr.requires_human_review || confidence < 0.60) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3 h-3" />
          Violation
        </span>
      );
    }

    if (confidence < 0.85 || isModified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" />
          Warning
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        Passed
      </span>
    );
  };

  const startEditing = (attr: AttributeRecord, field: "raw_value" | "normalized_value" | "unit") => {
    setEditingAttrId(attr.attribute_id);
    setEditingField(field);
    const currentValue =
      field === "unit"
        ? attr.unit || ""
        : field === "normalized_value"
        ? attr.normalized_value || ""
        : attr.raw_value || "";
    setDraftValue(currentValue);
  };

  const handleSaveInline = (attr: AttributeRecord) => {
    if (!editingField) return;

    const currentMod = modifiedAttributes.get(attr.attribute_id);
    const previousValue =
      editingField === "unit"
        ? currentMod?.unit ?? attr.unit ?? ""
        : editingField === "normalized_value"
        ? currentMod?.normalized_value ?? attr.normalized_value ?? ""
        : currentMod?.raw_value ?? attr.raw_value ?? "";

    if (draftValue === previousValue) {
      setEditingAttrId(null);
      setEditingField(null);
      return;
    }

    const payload: ModifiedAttributePayload = {
      attribute_id: attr.attribute_id,
      canonical_key: attr.canonical_key,
      raw_key: attr.raw_key,
      raw_value: editingField === "raw_value" ? draftValue : currentMod?.raw_value ?? attr.raw_value,
      normalized_value: editingField === "normalized_value" ? draftValue : currentMod?.normalized_value ?? attr.normalized_value,
      numeric_value: attr.numeric_value,
      unit: editingField === "unit" ? draftValue : currentMod?.unit ?? attr.unit,
      is_human_locked: currentMod?.is_human_locked ?? attr.is_human_locked ?? true,
      evidence_id: attr.evidence_id ?? attr.evidence?.evidence_id,
    };

    setPendingChange({
      attributeId: attr.attribute_id,
      attributeKey: attr.canonical_key,
      field: editingField,
      previousValue,
      newValue: draftValue,
      payload,
    });

    setEditingAttrId(null);
    setEditingField(null);
    setModalOpen(true);
  };

  const toggleHumanLock = (attr: AttributeRecord) => {
    const currentMod = modifiedAttributes.get(attr.attribute_id);
    const currentLock = currentMod?.is_human_locked ?? attr.is_human_locked;
    const newLock = !currentLock;

    const payload: ModifiedAttributePayload = {
      attribute_id: attr.attribute_id,
      canonical_key: attr.canonical_key,
      raw_key: attr.raw_key,
      raw_value: currentMod?.raw_value ?? attr.raw_value,
      normalized_value: currentMod?.normalized_value ?? attr.normalized_value,
      numeric_value: attr.numeric_value,
      unit: currentMod?.unit ?? attr.unit,
      is_human_locked: newLock,
      evidence_id: attr.evidence_id ?? attr.evidence?.evidence_id,
    };

    setPendingChange({
      attributeId: attr.attribute_id,
      attributeKey: attr.canonical_key,
      field: "is_human_locked",
      previousValue: currentLock ? "LOCKED" : "UNLOCKED",
      newValue: newLock ? "LOCKED" : "UNLOCKED",
      payload,
    });

    setModalOpen(true);
  };

  const handleConfirmReason = (reasonCode: string) => {
    if (pendingChange) {
      onUpdateAttribute(pendingChange.attributeId, pendingChange.payload, reasonCode);
      setPendingChange(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
        <div>
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-500" />
            Specification Attributes
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Review, correct values, and toggle Gate 8 human-lock controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            {attributes.length} attributes
          </span>
          {modifiedAttributes.size > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
              {modifiedAttributes.size} modified
            </span>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur-xs text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 z-10">
            <tr>
              <th className="py-2.5 px-3 font-semibold">Attribute</th>
              <th className="py-2.5 px-3 font-semibold">Raw Value</th>
              <th className="py-2.5 px-3 font-semibold">Normalized</th>
              <th className="py-2.5 px-3 font-semibold">Unit</th>
              <th className="py-2.5 px-2 font-semibold">Conf.</th>
              <th className="py-2.5 px-2 font-semibold">Gate Status</th>
              <th className="py-2.5 px-2 font-semibold text-center">Lock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200 font-sans">
            {attributes.map((attr) => {
              const isSelected = selectedAttributeId === attr.attribute_id;
              const modified = modifiedAttributes.get(attr.attribute_id);
              const isModified = !!modified;
              const auditReason = auditReasons.get(attr.attribute_id);

              const rawVal = modified?.raw_value ?? attr.raw_value;
              const normVal = modified?.normalized_value ?? attr.normalized_value ?? "—";
              const unitVal = modified?.unit ?? attr.unit ?? "—";
              const isLocked = modified?.is_human_locked ?? attr.is_human_locked;

              return (
                <tr
                  key={attr.attribute_id}
                  onClick={() => onSelectAttribute(attr.attribute_id)}
                  className={`group cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-amber-500/10 dark:bg-amber-500/15"
                      : isModified
                      ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  {/* Canonical Key & Evidence Info */}
                  <td className="py-3 px-3 align-top">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono flex items-center gap-1.5">
                      {attr.canonical_key}
                      {isModified && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Modified" />
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-sans mt-0.5 flex items-center gap-1">
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded font-mono text-[9px]">
                        {attr.evidence?.evidence_type || attr.evidence_type || "SOURCE"}
                      </span>
                      {attr.evidence?.page_number && (
                        <span>p.{attr.evidence.page_number}</span>
                      )}
                    </div>
                    {auditReason && (
                      <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-sans italic truncate max-w-[150px]" title={auditReason}>
                        Audit: {auditReason}
                      </div>
                    )}
                  </td>

                  {/* Raw Value (Inline Editable) */}
                  <td className="py-3 px-3 align-top font-mono">
                    {editingAttrId === attr.attribute_id && editingField === "raw_value" ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveInline(attr);
                            if (e.key === "Escape") setEditingAttrId(null);
                          }}
                          className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-zinc-950 border border-amber-500 focus:outline-hidden ring-1 ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInline(attr)}
                          className="p-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px]"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(attr, "raw_value");
                        }}
                        className="flex items-center justify-between group/edit rounded px-1.5 py-0.5 -mx-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Click to edit raw value"
                      >
                        <span className="truncate max-w-[140px]">{rawVal || "—"}</span>
                        <Edit2 className="w-3 h-3 text-zinc-400 opacity-0 group-hover/edit:opacity-100 transition-opacity ml-1 shrink-0" />
                      </div>
                    )}
                  </td>

                  {/* Normalized Value (Inline Editable) */}
                  <td className="py-3 px-3 align-top font-mono">
                    {editingAttrId === attr.attribute_id && editingField === "normalized_value" ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveInline(attr);
                            if (e.key === "Escape") setEditingAttrId(null);
                          }}
                          className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-zinc-950 border border-amber-500 focus:outline-hidden ring-1 ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInline(attr)}
                          className="p-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px]"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(attr, "normalized_value");
                        }}
                        className="flex items-center justify-between group/edit rounded px-1.5 py-0.5 -mx-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Click to edit normalized value"
                      >
                        <span className="truncate max-w-[140px]">{normVal}</span>
                        <Edit2 className="w-3 h-3 text-zinc-400 opacity-0 group-hover/edit:opacity-100 transition-opacity ml-1 shrink-0" />
                      </div>
                    )}
                  </td>

                  {/* Unit (Inline Editable) */}
                  <td className="py-3 px-3 align-top font-mono">
                    {editingAttrId === attr.attribute_id && editingField === "unit" ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveInline(attr);
                            if (e.key === "Escape") setEditingAttrId(null);
                          }}
                          className="w-20 px-2 py-1 text-xs rounded bg-white dark:bg-zinc-950 border border-amber-500 focus:outline-hidden ring-1 ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInline(attr)}
                          className="p-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px]"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(attr, "unit");
                        }}
                        className="flex items-center justify-between group/edit rounded px-1.5 py-0.5 -mx-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Click to edit unit"
                      >
                        <span>{unitVal}</span>
                        <Edit2 className="w-3 h-3 text-zinc-400 opacity-0 group-hover/edit:opacity-100 transition-opacity ml-1 shrink-0" />
                      </div>
                    )}
                  </td>

                  {/* Confidence */}
                  <td className="py-3 px-2 align-top font-mono text-[11px]">
                    <div className="flex items-center gap-1">
                      <span>{(attr.attribute_confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>

                  {/* Gate Status Badge */}
                  <td className="py-3 px-2 align-top">
                    {getGateBadge(attr)}
                  </td>

                  {/* Human Lock Toggle */}
                  <td className="py-3 px-2 align-top text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHumanLock(attr);
                      }}
                      className={`p-1.5 rounded-lg transition-all ${
                        isLocked
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                          : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      title={isLocked ? "Gate 8 Human Locked" : "Unlocked (Click to Lock)"}
                    >
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <LockOpen className="w-3.5 h-3.5 opacity-60" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reason Code Modal */}
      {pendingChange && (
        <ReasonCodeModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setPendingChange(null);
          }}
          attributeKey={pendingChange.attributeKey}
          previousValue={pendingChange.previousValue}
          newValue={pendingChange.newValue}
          onConfirm={handleConfirmReason}
        />
      )}
    </div>
  );
}
