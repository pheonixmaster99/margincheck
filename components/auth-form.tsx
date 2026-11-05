"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { signIn, signUp } from "@/lib/auth-service";
import { isFirebaseConfigured } from "@/lib/firebase";

function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "An account already exists for this email.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  return "Authentication failed. Please try again.";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";
  const requestedPath = searchParams.get("next");
  const redirectPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/dashboard";

  useEffect(() => {
    if (!loading && user) router.replace(redirectPath);
  }, [loading, redirectPath, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (isSignup && password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (isSignup) await signUp(email, password);
      else await signIn(email, password);
      router.replace(redirectPath);
    } catch (caughtError) {
      setError(authErrorMessage(caughtError));
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5 py-12 text-slate-900">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-lg font-bold">
          <span className="text-blue-600">↗</span> MarginCheck
        </Link>
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-[-0.03em]">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isSignup ? "Start tracking job profitability securely." : "Sign in to access your MarginCheck jobs."}
          </p>
          {!isFirebaseConfigured ? (
            <p role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Firebase is not configured. Add the required values to <code>.env.local</code> and restart the development server.
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-6 grid gap-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
              <input id="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" />
            </div>
            {isSignup ? (
              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" />
              </div>
            ) : null}
            {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
            <button type="submit" disabled={submitting || !isFirebaseConfigured} className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {submitting ? "Please wait…" : isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">
            {isSignup ? "Already have an account?" : "New to MarginCheck?"}{" "}
            <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-blue-600 hover:text-blue-700">
              {isSignup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
