"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";

const roleOptions = [
  {
    id: "senior-auditor",
    label: "Senior Auditor",
    sublabel: "Review quality, evidence, and exception handling",
  },
  {
    id: "pim-admin",
    label: "PIM Admin",
    sublabel: "Route, publish, and manage schema delivery",
  },
] as const;

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<(typeof roleOptions)[number]["id"]>("senior-auditor");

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(135deg,#09090b_0%,#111827_50%,#0f172a_100%)] p-7 shadow-[0_30px_70px_rgba(0,0,0,0.45)] sm:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Enterprise access
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Secure access for catalog governance teams.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
            Sign in with your enterprise identity and route to the correct operating context for validation, schema exports, and publication oversight.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "SAML / Okta enterprise SSO",
              "Role-scoped approval workflows",
              "Mandatory audit logging",
              "Data loss protection rules",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Sign in</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Welcome back</h2>
            </div>
            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-200">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-2">
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    selectedRole === role.id
                      ? "border-emerald-500/30 bg-emerald-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                  aria-pressed={selectedRole === role.id}
                >
                  <div className="text-sm font-medium">{role.label}</div>
                  <div className="mt-1 text-[11px] leading-5 text-zinc-400">{role.sublabel}</div>
                </button>
              ))}
            </div>
          </div>

          <form className="space-y-4">
            <div>
              <label htmlFor="enterprise-id" className="mb-2 block text-sm font-medium text-zinc-200">
                Enterprise email
              </label>
              <input
                id="enterprise-id"
                type="email"
                defaultValue="auditor@unilog.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-200">
                Password
              </label>
              <input
                id="password"
                type="password"
                defaultValue="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-400">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-zinc-700 bg-zinc-950" />
                Keep me signed in
              </label>
              <button type="button" className="text-emerald-300 hover:text-emerald-200">Need help?</button>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href="/jobs"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Continue with {selectedRole === "pim-admin" ? "PIM Admin" : "Senior Auditor"}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
              >
                <Lock className="h-4 w-4" />
                SSO with Okta / SAML
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
