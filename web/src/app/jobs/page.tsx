"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, FolderOpen, Sparkles } from "lucide-react";

const jobs = [
  {
    id: "JOB-1042",
    title: "PVC Schedule 40 Pressure Fitting",
    owner: "Senior Auditor",
    status: "Requires review",
    updated: "8 minutes ago",
    confidence: "94%",
  },
  {
    id: "JOB-1048",
    title: "Stainless Steel Ball Valve",
    owner: "PIM Admin",
    status: "Ready to publish",
    updated: "17 minutes ago",
    confidence: "97%",
  },
  {
    id: "JOB-1053",
    title: "EPDM Gasket Pack",
    owner: "Senior Auditor",
    status: "Awaiting evidence",
    updated: "1 hour ago",
    confidence: "81%",
  },
];

export default function JobsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300">
              <FolderOpen className="h-3.5 w-3.5" />
              Work queue
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Jobs and review operations</h1>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Switch role
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {[
            ["Queued jobs", "03"],
            ["Ready to publish", "01"],
            ["Requires validation", "02"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">{label}</div>
              <div className="mt-3 text-3xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <BriefcaseBusiness className="h-4 w-4 text-emerald-300" />
              Active jobs
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Evidence-first processing
            </div>
          </div>

          <div className="divide-y divide-zinc-800">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-zinc-400">{job.id}</span>
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                      {job.owner}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-white">{job.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span>{job.updated}</span>
                    <span>•</span>
                    <span>{job.confidence} confidence</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    job.status === "Ready to publish"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : job.status === "Requires review"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        : "border-rose-500/20 bg-rose-500/10 text-rose-300"
                  }`}>
                    {job.status === "Ready to publish" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {job.status}
                  </span>

                  <Link
                    href={`/review/${job.id.toLowerCase().replace("job-", "").replace("JOB-", "")}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
                  >
                    Open job
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
