"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ReviewQueueItem } from "@/types/domain";

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api.getReviewQueue();
      setQueue(items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Failed to load review queue: ${err.message} (HTTP ${err.status})`);
      } else {
        setError("Unable to connect to the backend server. Please verify the API is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchQueue(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REVIEW_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Review Required
          </span>
        );
      case "UNCLASSIFIED_HUMAN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Unclassified Category
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  const formatFilename = (filePath: string) => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Human-In-The-Loop Review Queue
              </h1>
              {!loading && (
                <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {queue.length} {queue.length === 1 ? "job" : "jobs"}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Inspect, correct, and audit vendor catalog products requiring human verification.
            </p>
          </div>

          <button
            onClick={fetchQueue}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </button>
        </div>

        {/* Content */}
        <div className="mt-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
              <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Fetching review queue...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <h3 className="mt-3 text-base font-semibold text-red-800 dark:text-red-300">
                Failed to Load Queue
              </h3>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 max-w-md mx-auto">
                {error}
              </p>
              <button
                onClick={fetchQueue}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold">Queue is Empty</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                No catalog items currently require manual review. High-confidence products have been automatically processed.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {queue.map((item) => (
                  <li
                    key={item.job_id}
                    className="p-5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="font-semibold text-base font-mono">
                            {formatFilename(item.file_path)}
                          </h4>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-mono">ID: {item.job_id}</span>
                          {item.created_at && (
                            <>
                              <span>•</span>
                              <span>
                                {new Date(item.created_at).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/review/${item.job_id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors self-start sm:self-auto shrink-0"
                    >
                      Start Review
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
