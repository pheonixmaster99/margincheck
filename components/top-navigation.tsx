"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { signOutUser } from "@/lib/auth-service";

const BrandMark = () => (
  <svg aria-hidden="true" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="none">
    <path d="M3 14.5 7.5 10l3 3L17 6.5" stroke="currentColor" strokeWidth="2" />
    <path d="M13.5 6.5H17V10" stroke="currentColor" strokeWidth="2" />
  </svg>
);

interface TopNavigationProps {
  active?: "dashboard" | "jobs";
}

export function TopNavigation({ active = "jobs" }: TopNavigationProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const activeClass = "relative flex h-full items-center text-[13px] font-semibold text-slate-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-blue-600";
  const inactiveClass = "flex h-full items-center text-[13px] font-medium text-slate-500 transition hover:text-slate-900";
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "MC";

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutUser();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex h-[52px] items-center px-5 sm:px-10 lg:px-[52px]">
        <Link href="/" className="flex items-center gap-2 text-slate-900">
          <BrandMark />
          <span className="hidden text-[15px] font-bold tracking-[-0.02em] sm:inline">MarginCheck</span>
        </Link>
        <nav aria-label="Primary" className="ml-5 flex h-full items-center gap-5 sm:ml-14 sm:gap-7">
          <Link href="/dashboard" aria-current={active === "dashboard" ? "page" : undefined} className={active === "dashboard" ? activeClass : inactiveClass}>Dashboard</Link>
          <Link href="/dashboard#jobs" aria-current={active === "jobs" ? "page" : undefined} className={active === "jobs" ? activeClass : inactiveClass}>Jobs</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div aria-label={`Profile for ${user?.email ?? "MarginCheck user"}`} className="hidden h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-950 text-[11px] font-bold text-white ring-2 ring-white shadow-sm outline outline-1 outline-slate-200 sm:grid">{initials}</div>
          <button type="button" onClick={logout} disabled={signingOut} className="text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-60">{signingOut ? "Signing out…" : "Log out"}</button>
        </div>
      </div>
    </header>
  );
}
