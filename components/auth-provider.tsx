"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { observeAuthState } from "@/lib/auth-service";
import { isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(
    isFirebaseConfigured ? "" : "Firebase is not configured. Add the required values to .env.local.",
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return observeAuthState(
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setError("Authentication could not be initialized. Please try again.");
        setLoading(false);
      },
    );
  }, []);

  const value = useMemo(() => ({ user, loading, error }), [error, loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
