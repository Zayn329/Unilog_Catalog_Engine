import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitCompare,
  ShieldCheck,
  X,
} from "lucide-react";

export interface SpecComparison {
  key: string;
  targetValue: string;
  competitorValue: string;
  isMatch: boolean;
}

export interface CompetitorMatch {
  id: string;
  brand: string;
  partNumber: string;
  parityScore: number; // 0 to 100
  matchStatus: "exact" | "equivalent" | "divergent";
  datasheetUrl?: string;
  specDifferences: SpecComparison[];
}

interface CrossRefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetPartNumber: string;
  competitorMatches: CompetitorMatch[];
}

const ProgressRing = ({ value }: { value: number }) => {
  const size = 88;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex h-[110px] w-[110px] items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={value >= 90 ? "#34d399" : value >= 75 ? "#fbbf24" : "#fb7185"}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold text-zinc-100">{Math.round(value)}%</span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Parity</span>
      </div>
    </div>
  );
};

export const CrossRefDrawer: React.FC<CrossRefDrawerProps> = ({
  isOpen,
  onClose,
  targetPartNumber,
  competitorMatches,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(competitorMatches[0]?.id || "");

  const activeMatch =
    competitorMatches.find((match) => match.id === selectedMatchId) || competitorMatches[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/75 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl border-l border-white/10 bg-zinc-900/95 text-zinc-100 shadow-[0_0_40px_rgba(0,0,0,0.45)] transition-transform duration-300">
        <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2 text-emerald-300">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Equivalent Candidate Review</h2>
              <p className="font-mono text-[11px] text-zinc-400">
                Target: <span className="text-emerald-300">{targetPartNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            aria-label="Close equivalent candidates"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-[calc(100%-73px)] flex-col overflow-y-auto p-5">
          <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {competitorMatches.map((match) => {
              const isSelected = match.id === activeMatch?.id;
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => setSelectedMatchId(match.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-100">{match.brand}</div>
                      <div className="font-mono text-[10px] text-zinc-400">{match.partNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-emerald-300">{match.parityScore}%</div>
                      <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">score</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {activeMatch && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(9,9,11,0.96)_55%)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <ProgressRing value={activeMatch.parityScore} />
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Spec-Parity</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-2xl font-bold text-zinc-100">{activeMatch.parityScore}%</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                          <ShieldCheck className="h-3 w-3" />
                          {activeMatch.matchStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {activeMatch.datasheetUrl && (
                    <a
                      href={activeMatch.datasheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-emerald-500/35 hover:text-emerald-200"
                    >
                      Datasheet
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Brand</div>
                  <div className="mt-2 text-sm font-semibold text-zinc-100">{activeMatch.brand}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Part</div>
                  <div className="mt-2 font-mono text-sm text-zinc-100">{activeMatch.partNumber}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Matched</div>
                  <div className="mt-2 text-sm font-semibold text-zinc-100">
                    {activeMatch.specDifferences.filter((item) => item.isMatch).length}/{activeMatch.specDifferences.length} attrs
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950/35 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Specification Delta</div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {activeMatch.specDifferences.filter((item) => !item.isMatch).length} conflicting values
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead className="bg-zinc-900/80 text-zinc-400">
                      <tr>
                        <th className="px-3 py-2.5">Attribute</th>
                        <th className="px-3 py-2.5">Target</th>
                        <th className="px-3 py-2.5">Equivalent</th>
                        <th className="px-3 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-zinc-950/30">
                      {activeMatch.specDifferences.map((spec, index) => (
                        <tr
                          key={`${spec.key}-${index}`}
                          className={spec.isMatch ? "bg-emerald-500/[0.03]" : "bg-rose-500/[0.05]"}
                        >
                          <td className="px-3 py-2.5 font-medium text-zinc-200">{spec.key}</td>
                          <td className="px-3 py-2.5 font-mono text-zinc-300">{spec.targetValue}</td>
                          <td className="px-3 py-2.5 font-mono text-zinc-300">{spec.competitorValue}</td>
                          <td className="px-3 py-2.5 text-right">
                            {spec.isMatch ? (
                              <span className="inline-flex items-center gap-1 text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Match
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-300">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Diff
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};