import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Layers3,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const featureCards = [
  {
    title: "Evidence-first extraction",
    description: "Every attribute is tied to a source span, page, and bounding box before it reaches a review queue.",
    accent: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  {
    title: "Rule-based validation",
    description: "Physics and domain constraints flag noncompliant specs before a SKU reaches downstream publishing.",
    accent: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  },
  {
    title: "Human-in-the-loop review",
    description: "Auditors resolve edge cases with reason codes, locked values, and full audit traceability.",
    accent: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  },
  {
    title: "Cross-reference parity",
    description: "Equivalent catalog candidates are compared against spec drift, match quality, and conflict summaries.",
    accent: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
];

const platformFeatures = [
  "Multi-agent document intelligence",
  "Deterministic taxonomy normalization",
  "Schema adapter routing for CX1, ETIM, and UNSPSC",
  "Bias-resistant validation and provenance tracking",
  "Operational dashboards for catalog ops and PIM teams",
  "Audit logs, policy gating, and publish controls",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.10),_transparent_35%),linear-gradient(135deg,#09090b_0%,#101827_55%,#111827_100%)] px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:px-10 lg:px-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Evidence-first catalog intelligence
              </div>

              <h1 className="max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Turn raw vendor specs into publication-ready catalog data.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
                Unilog Catalog Engine orchestrates extraction, validation, enrichment, and human review so industrial catalogs stay accurate, traceable, and ready for downstream PIM workflows.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                >
                  Launch workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/jobs"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/70 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800"
                >
                  View jobs
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-zinc-300">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> 7.4s avg. review triage</div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Rule-backed validation</div>
                <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-emerald-300" /> 10 downstream adapters</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4 shadow-2xl">
              <div className="rounded-[20px] border border-white/10 bg-zinc-900 p-4">
                <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  <span>Pipeline status</span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">Live</span>
                </div>

                <div className="space-y-4">
                  {[
                    ["Document intake", "Validated", "99.2% confidence"],
                    ["Attribute extraction", "Validated", "1,386 attributes resolved"],
                    ["Physics checks", "2 warnings", "PVC temp > 140°F"],
                    ["Schema mapping", "Ready", "CX1 / ETIM / UNSPSC"],
                  ].map(([label, state, detail]) => (
                    <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-200">{label}</span>
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-300">{state}</span>
                      </div>
                      <div className="mt-2 text-xs text-zinc-400">{detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Platform capabilities</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Ten features built for industrial catalog operations.</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 transition hover:border-zinc-700 hover:bg-zinc-900">
                <div className={`mb-4 inline-flex rounded-lg border px-2.5 py-2 ${card.accent}`}>
                  <Workflow className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-7">
            <p className="text-[11px] uppercase tracking-[0.2em] text-violet-300">Why teams switch</p>
            <h2 className="mt-3 text-3xl font-bold text-white">Operational clarity from intake to publish.</h2>
            <div className="mt-6 space-y-4">
              {platformFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
                  <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /></div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-7">
            <div className="flex items-center gap-3 text-emerald-300">
              <FileCheck2 className="h-5 w-5" />
              <span className="text-[11px] uppercase tracking-[0.2em]">Quality controls</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-white">Built around human trust and measurable evidence.</h3>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Reviewers approve edits, lock critical values, and publish only when the evidence trail and schema mapping satisfy the rule set for the destination market.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="text-2xl font-bold text-white">94%</div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">first-pass accuracy</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="text-2xl font-bold text-white">24/7</div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">batch throughput</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
