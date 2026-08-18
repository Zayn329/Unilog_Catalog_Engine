"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, FolderOpen, Sparkles, Upload, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Job {
  job_id: string;
  status: string;
  file_path: string;
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/jobs`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch jobs");
        }

        const data = await response.json();
        setJobs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const formatFilename = (filePath: string) => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusStyle = (status: string) => {
    if (status === "PUBLISHED")
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    if (status === "REVIEW_REQUIRED")
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    if (status === "FAILED_PARSING")
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PROCESSING: "Processing...",
      REVIEW_REQUIRED: "Requires review",
      PUBLISHED: "Published",
      FAILED_PARSING: "Parse failed",
      UNCLASSIFIED_HUMAN_REVIEW: "Awaiting classification",
    };
    return labels[status] || status;
  };

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

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              Upload new
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              Switch role
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {[
            ["Total jobs", jobs.length.toString()],
            ["Published", jobs.filter((j) => j.status === "PUBLISHED").length.toString()],
            ["Requires review", jobs.filter((j) => j.status === "REVIEW_REQUIRED").length.toString()],
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
              All jobs
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Evidence-first processing
            </div>
          </div>

          <div className="divide-y divide-zinc-800">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading jobs...
              </div>
            ) : error ? (
              <div className="rounded-none border-0 px-5 py-6 text-center">
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-none border-0 px-5 py-12 text-center">
                <p className="text-sm text-zinc-400 mb-4">No jobs yet. Upload a PDF to get started.</p>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
                >
                  Upload catalog
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.job_id} className="flex flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center hover:bg-zinc-800/50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-zinc-400">{job.job_id}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-white truncate">
                      {formatFilename(job.file_path)}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      <span>{formatDate(job.created_at)}</span>
                      <span>•</span>
                      <span>{job.file_path}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                        job.status
                      )}`}
                    >
                      {job.status === "PUBLISHED" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : null}
                      {getStatusLabel(job.status)}
                    </span>

                    <Link
                      href={`/review/${job.job_id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
                    >
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
