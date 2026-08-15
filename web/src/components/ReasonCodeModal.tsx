"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Check, ShieldCheck, X } from "lucide-react";

export const STANDARD_REASON_CODES = [
  { code: "OCR_TYPO", label: "OCR Typo", description: "Source document text was misread during extraction." },
  { code: "WRONG_BOUNDING_BOX", label: "Wrong Bounding Box", description: "Extracted region does not match the specification." },
  { code: "WRONG_CATEGORY", label: "Category Correction", description: "Taxonomy classification was incorrect." },
  { code: "INVALID_SOURCE", label: "Invalid Source", description: "Extracted data is not supported by the document." },
  { code: "UNITS_NORMALIZATION_CORRECTION", label: "Unit/Normalization Error", description: "Unit conversion or format standard was incorrect." },
  { code: "MANUAL_SPEC_ENTRY", label: "Manual Spec Override", description: "Verified specification provided directly by reviewer." },
] as const;

export type ReasonCode = typeof STANDARD_REASON_CODES[number]["code"];

interface ReasonCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  attributeKey: string;
  previousValue: string;
  newValue: string;
  onConfirm: (reasonCode: string, note?: string) => void;
}

export function ReasonCodeModal({
  isOpen,
  onClose,
  attributeKey,
  previousValue,
  newValue,
  onConfirm,
}: ReasonCodeModalProps) {
  const [selectedCode, setSelectedCode] = useState<string>("OCR_TYPO");
  const [customNote, setCustomNote] = useState<string>("");

  const handleConfirm = () => {
    const fullReason = customNote.trim()
      ? `${selectedCode}: ${customNote.trim()}`
      : selectedCode;
    onConfirm(fullReason, customNote.trim() || undefined);
    setCustomNote("");
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 focus:outline-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Audit Reason Required
                </Dialog.Title>
                <Dialog.Description className="text-xs text-zinc-500 dark:text-zinc-400">
                  Gate 8 requires immutable provenance for manual edits.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Change Summary */}
          <div className="mt-4 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 text-xs space-y-1.5">
            <div className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
              Attribute: {attributeKey}
            </div>
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span className="text-zinc-500">Previous:</span>
              <span className="font-mono bg-zinc-200/60 dark:bg-zinc-700/60 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                {previousValue || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span className="text-zinc-500">Proposed:</span>
              <span className="font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                {newValue || "—"}
              </span>
            </div>
          </div>

          {/* Reason Code Selection */}
          <div className="mt-5 space-y-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Select Reason Code
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {STANDARD_REASON_CODES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSelectedCode(item.code)}
                  className={`flex items-start gap-3 p-2.5 rounded-lg text-left text-xs transition-all border ${
                    selectedCode === item.code
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCode === item.code
                        ? "border-white dark:border-zinc-900 bg-white/20 dark:bg-zinc-900/20"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {selectedCode === item.code && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <div className="font-semibold">{item.label}</div>
                    <div
                      className={`text-[11px] leading-tight mt-0.5 ${
                        selectedCode === item.code
                          ? "text-zinc-300 dark:text-zinc-600"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {item.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Additional Details (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Verified against manufacturer specification table on page 1"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors shadow-xs"
            >
              Accept & Log Edit
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
