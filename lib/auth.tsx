"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authRedirectTo, getSupabase, isAuthConfigured } from "@/lib/supabase";

/**
 * Auth state.
 *
 * When accounts aren't configured this returns a permanently signed-out shape
 * with `configured: false`, so nothing downstream needs a special case — the
 * UI just checks `configured` to decide whether to offer signing in at all.
 */

export interface AuthValue {
  /** False when no Supabase env vars are set; the feature is then invisible. */
  configured: boolean;
  /** False until the initial session lookup settles. */
  ready: boolean;
  session: Session | null;
  user: User | null;
  signInWithGoogle(): Promise<{ error: string | null }>;
  signInWithEmail(email: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}

const SIGNED_OUT: AuthValue = {
  configured: false,
  ready: true,
  session: null,
  user: null,
  signInWithGoogle: async () => ({ error: "Accounts are not configured." }),
  signInWithEmail: async () => ({ error: "Accounts are not configured." }),
  signOut: async () => {},
};

const AuthContext = createContext<AuthValue>(SIGNED_OUT);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isAuthConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;
    const client = getSupabase();
    if (!client) return;

    let cancelled = false;

    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    const client = getSupabase();
    if (!client) return { error: "Accounts are not configured." };
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectTo() },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const client = getSupabase();
    if (!client) return { error: "Accounts are not configured." };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectTo() },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () =>
      configured
        ? {
            configured: true,
            ready,
            session,
            user: session?.user ?? null,
            signInWithGoogle,
            signInWithEmail,
            signOut,
          }
        : SIGNED_OUT,
    [configured, ready, session, signInWithGoogle, signInWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

/** Best-effort display name: Google gives one, magic-link users get their email. */
export function displayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  return meta?.full_name ?? meta?.name ?? user.email ?? "cook";
}

export function initialOf(user: User | null): string {
  const name = displayName(user);
  return name.trim().charAt(0).toUpperCase() || "?";
}
