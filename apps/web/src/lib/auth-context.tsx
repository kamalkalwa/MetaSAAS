"use client";

/**
 * Auth Context Provider
 *
 * Provides authentication state to the entire app via React Context.
 * Handles:
 *   - Session management (login, logout, token refresh)
 *   - Token storage (delegated to Supabase SDK)
 *   - Auth state changes (subscription to Supabase auth events)
 *   - Dev mode fallback (when Supabase is not configured)
 *
 * Usage:
 *   Wrap your app in <AuthProvider> and use the useAuth() hook
 *   to access the current user and auth actions.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseClient, isAuthEnabled } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  /** The authenticated user, or null if not logged in */
  user: User | null;
  /** The current session (contains the JWT) */
  session: Session | null;
  /** Whether auth is still loading (initial check) */
  loading: boolean;
  /** Whether Supabase auth is configured */
  authEnabled: boolean;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  /** Sign up with email and password */
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Get the current JWT access token (for API calls) */
  getToken: () => string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authEnabled = isAuthEnabled();
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) {
      // Dev mode — no auth
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const getToken = () => {
    return session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        authEnabled,
        signIn,
        signUp,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication state and actions.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return ctx;
}
