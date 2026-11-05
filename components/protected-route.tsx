"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !error && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, loading, pathname, router, user]);

  if (loading) return <FullPageMessage title="Loading MarginCheck…" />;
  if (error) return <FullPageMessage title="Firebase setup required" detail={error} />;
  if (!user) return <FullPageMessage title="Redirecting to sign in…" />;
  return children;
}

function FullPageMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5 text-center text-slate-900">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="text-xl font-bold">{title}</h1>
        {detail ? <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p> : null}
      </div>
    </main>
  );
}
