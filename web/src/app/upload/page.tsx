"use client";

import { Upload, AlertCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Only PDF files are supported. Please select a valid PDF.";
    }
    if (file.size === 0) {
      return "The file is empty. Please select a file with content.";
    }
    if (file.size > 100 * 1024 * 1024) {
      return "File size exceeds 100 MB. Please select a smaller file.";
    }
    return null;
  };

  const handleFile = (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/jobs/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.detail ?? "Upload failed. Please try again.");
      }

      setSuccess(true);
      setJobId(data.job_id);

      setTimeout(() => {
        router.push(`/review/${data.job_id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload file");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300">
            <Upload className="h-3.5 w-3.5" />
            New extraction job
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Upload catalog document</h1>
          <p className="mt-2 text-base text-zinc-400">
            Submit a PDF for automated parsing, attribute extraction, and evidence-first validation.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          {!success ? (
            <>
              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition cursor-pointer ${
                  isDragActive
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={loading}
                />

                <div className="flex justify-center mb-3">
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                    <Upload className="h-6 w-6 text-emerald-300" />
                  </div>
                </div>

                <p className="text-lg font-semibold text-white">Drop your PDF here</p>
                <p className="mt-1 text-sm text-zinc-400">or click to browse from your device</p>
              </div>

              {/* File Info */}
              {selectedFile && (
                <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                        <Upload className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-emerald-50 truncate">{selectedFile.name}</p>
                        <p className="mt-1 text-sm text-emerald-200/70">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setError(null);
                      }}
                      className="text-emerald-200/70 hover:text-emerald-100 transition text-sm font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-200">{error}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3 flex-col sm:flex-row-reverse">
                <button
                  onClick={handleSubmit}
                  disabled={!selectedFile || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Start extraction
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                >
                  Back
                </button>
              </div>

              {/* Info */}
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  ["Supported", "PDF files up to 100 MB"],
                  ["Processing", "Automated extraction and validation"],
                  ["Result", "Immediate review workbench access"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
                    <div className="mt-1 text-sm text-zinc-300">{value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 p-3 animate-pulse">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Upload successful!</h2>
              <p className="text-zinc-400 mb-4">
                Your document has been submitted for processing. Redirecting to review workbench...
              </p>
              {jobId && (
                <div className="inline-block rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-mono text-zinc-300">
                  Job ID: {jobId}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
