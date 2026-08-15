"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { SpecEditorTable } from "@/components/SpecEditorTable";
import type {
  AttributeRecord,
  JobDetailResponse,
  ModifiedAttributePayload,
} from "@/types/domain";

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default function ReviewWorkbenchPage({ params }: PageProps) {
  const { jobId } = use(params);

  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [attributes, setAttributes] = useState<AttributeRecord[]>([]);
  const [modifiedAttributes, setModifiedAttributes] = useState<
    Map<string, ModifiedAttributePayload>
  >(new Map());
  const [auditReasons, setAuditReasons] = useState<Map<string, string>>(new Map());
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getJob(jobId);
      setJob(data);

      // Extract attributes from graph state
      const stateAttrs = (data.state?.attributes as AttributeRecord[]) || [];
      setAttributes(stateAttrs);
      if (stateAttrs.length > 0 && !selectedAttributeId) {
        setSelectedAttributeId(stateAttrs[0].attribute_id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError(`Job "${jobId}" was not found.`);
        } else {
          setError(`Failed to load job: ${err.message} (HTTP ${err.status})`);
        }
      } else {
        setError("Unable to connect to the backend server. Please verify the API is running.");
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, selectedAttributeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchJob(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchJob]);

  const handleUpdateAttribute = (
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
  }, [jobId, selectedAttributeId]);

  const handleSubmit = async (action: "ACCEPT_AND_SUBMIT" | "SAVE_DRAFT") => {
    setSubmitting(true);
    setToast(null);
    try {
      const response = await api.submitReview({
        job_id: jobId,
        action,
        modified_attributes: Array.from(modifiedAttributes.values()),
        audit_reason: Array.from(auditReasons.values()).join("; ") || null,
      });
      setToast({
        type: "success",
        message:
          action === "SAVE_DRAFT"
            ? "Draft saved without triggering graph re-validation."
            : `Review submitted: ${response.status}. Audit log recorded.`,
      });
      await fetchJob();
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "Unable to submit review. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [jobId, selectedAttributeId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REVIEW_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Review Required
          </span>
        );
      case "UNCLASSIFIED_HUMAN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Unclassified Review
          </span>
        );
      case "COMPLETED":
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
        <p className="mt-4 text-sm font-medium">Loading review workbench for job {jobId}...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center shadow-lg">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Workbench Error
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{error || "Job not found."}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/review"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Queue
            </Link>
            <button
              onClick={fetchJob}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categoryId = (job.state?.category_id as string) || "UNCLASSIFIED";
  const documentMarkdown = (job.state?.document_markdown as string) || (job.state?.raw_document_markdown as string) || undefined;

  return (
    <div className="flex-1 flex flex-col bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
      {/* Workbench Sub-Header */}
      <div className="px-6 py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/review"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Queue
          </Link>
          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
              Job: {job.job_id.slice(0, 8)}...
            </h2>
            {getStatusBadge(job.status)}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Tag className="w-3 h-3 text-zinc-400" />
              {categoryId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            {attributes.length} attributes extracted
          </span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("SAVE_DRAFT")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Save className="h-3.5 w-3.5" />
            Save draft
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("ACCEPT_AND_SUBMIT")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Send className="h-3.5 w-3.5" />
            Accept & submit
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${
            toast.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/90 dark:text-rose-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200"
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dual-Pane Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        {/* LEFT: PDF Canvas Viewer */}
        <div className="lg:col-span-6 h-full min-h-[500px] flex flex-col overflow-hidden">
          <PdfCanvasViewer
            filePath={job.file_path}
            totalPages={job.total_pages || 1}
            attributes={attributes}
            selectedAttributeId={selectedAttributeId}
            onSelectAttribute={setSelectedAttributeId}
            documentMarkdown={documentMarkdown}
          />
        </div>

        {/* RIGHT: Spec Editor Table */}
        <div className="lg:col-span-6 h-full min-h-[500px] flex flex-col overflow-hidden">
          <SpecEditorTable
            attributes={attributes}
            modifiedAttributes={modifiedAttributes}
            auditReasons={auditReasons}
            selectedAttributeId={selectedAttributeId}
            onSelectAttribute={setSelectedAttributeId}
            onHoverAttribute={setSelectedAttributeId}
            onUpdateAttribute={handleUpdateAttribute}
          />
        </div>
      </div>
    </div>
  );
}
