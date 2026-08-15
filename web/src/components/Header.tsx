import Link from "next/link";
import { Layers, ListTodo } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-50 hover:opacity-90 transition-opacity"
          >
            <div className="p-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              <Layers className="w-4 h-4" />
            </div>
            <span>Unilog Catalog Engine</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/review"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <ListTodo className="w-4 h-4" />
              Review Queue
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Engine Online
          </span>
        </div>
      </div>
    </header>
  );
}
