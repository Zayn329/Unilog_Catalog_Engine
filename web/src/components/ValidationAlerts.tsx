import React, { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

export interface ValidationAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  specKey: string;
  extractedValue: string;
  physicsRule: string;
  ruleId: string;
  pdfPage?: number;
}

interface ValidationAlertsProps {
  alerts: ValidationAlert[];
  onFocusEvidence?: (alert: ValidationAlert) => void;
  onTriggerReExtraction?: (alert: ValidationAlert) => void;
}

export const ValidationAlerts: React.FC<ValidationAlertsProps> = ({
  alerts,
  onFocusEvidence,
  onTriggerReExtraction,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(alerts[0]?.id || null);

  const getSeverityStyles = (severity: ValidationAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return {
          shell: "border-rose-500/35 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.18),_rgba(9,9,11,0.94)_55%)]",
          badge: "border-rose-500/30 bg-rose-500/12 text-rose-300",
          soft: "bg-rose-500/10 text-rose-200 border-rose-500/20",
          icon: <AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" />,
        };
      case "warning":
        return {
          shell: "border-amber-500/30 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_rgba(9,9,11,0.94)_58%)]",
          badge: "border-amber-500/30 bg-amber-500/12 text-amber-200",
          soft: "bg-amber-500/10 text-amber-100 border-amber-500/20",
          icon: <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" />,
        };
      default:
        return {
          shell: "border-sky-500/30 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_rgba(9,9,11,0.94)_58%)]",
          badge: "border-sky-500/30 bg-sky-500/12 text-sky-200",
          soft: "bg-sky-500/10 text-sky-100 border-sky-500/20",
          icon: <Info className="h-5 w-5 shrink-0 text-sky-300" />,
        };
    }
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-emerald-300" />
          <p className="text-sm font-medium text-emerald-100">
            Physics gate passed: no material, temperature, or dimensional violations detected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 w-full rounded-2xl border border-white/10 bg-zinc-950/55 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 text-rose-300" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Validation alerts
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
            {alerts.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => {
          const isExpanded = expandedId === alert.id;
          const styles = getSeverityStyles(alert.severity);

          return (
            <div
              key={alert.id}
              className={`rounded-2xl border backdrop-blur-md transition-all duration-200 ${styles.shell}`}
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                className="flex cursor-pointer items-center justify-between gap-3 p-3.5"
                aria-expanded={isExpanded}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {styles.icon}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-100">{alert.title}</span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] ${styles.badge}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                      <span className="font-mono text-zinc-300">{alert.specKey}</span>
                      <span className="text-zinc-600">=</span>
                      <span className="font-mono text-zinc-200">{alert.extractedValue}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {alert.pdfPage && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onFocusEvidence?.(alert);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/55 px-2.5 py-1.5 text-[10px] font-medium text-zinc-200 transition hover:border-amber-500/40 hover:bg-zinc-800"
                    >
                      <Eye className="h-3.5 w-3.5 text-amber-300" />
                      Page {alert.pdfPage}
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/10 px-4 pb-4 pt-3 text-xs text-zinc-300">
                  <p className="leading-6 text-zinc-200">{alert.description}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono ${styles.soft}`}>
                      Rule ID: {alert.ruleId}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-zinc-900/60 px-2.5 py-1 font-mono text-zinc-300">
                      Violation: {alert.physicsRule}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="max-w-[70%] text-[11px] leading-5 text-zinc-300">
                      Review the source evidence and apply a bounded re-extraction instead of publishing a non-physical specification.
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTriggerReExtraction?.(alert);
                      }}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100 transition hover:border-amber-400/60 hover:bg-amber-500/15"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Trigger Bounded Re-Extraction
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

