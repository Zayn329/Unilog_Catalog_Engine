"use client";

import Link from "next/link";
import { ArrowUpRight, Layers, ListTodo } from "lucide-react";
import { useState } from "react";
import { PimExportModal } from "@/components/PimExportModal";

export function Header() {
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-zinc-900 transition-opacity hover:opacity-90 dark:text-zinc-50"
            >
              <div className="rounded-lg bg-zinc-900 p-1.5 text-white dark:bg-white dark:text-zinc-900">
                <Layers className="h-4 w-4" />
              </div>
              <span>Unilog Catalog Engine</span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/review"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
              >
                <ListTodo className="h-4 w-4" />
                Review Queue
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              aria-label="Open schema export modal"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Export PIM
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Engine Online
            </span>
          </div>
        </div>
      </header>

      <PimExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </>
  );
}
