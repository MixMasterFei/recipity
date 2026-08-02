import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client — browser only.
 *
 * Every page in this app is a client component and `/api/invent` doesn't need
 * to know who you are, so there's no SSR auth here: no `@supabase/ssr`, no
 * middleware, no cookie plumbing. If server-rendered per-user data is ever
 * wanted, that's the point to add it.
 *
 * The whole feature is optional. With no env vars configured `isAuthConfigured`
 * is false, `getSupabase` returns null, and the app behaves exactly as it did
 * before accounts existed — same pattern as the AI invent route.
 *
 * On the key being public: it is meant to be. It ships in the browser bundle by
 * design, and row-level security — not secrecy — is what stops one user reading
 * another's fridge. See supabase/migrations/.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Either key name works.
 *
 * Supabase now issues `sb_publishable_...` keys, which rotate independently of
 * the project's JWT secret and are what new projects should use. The older
 * `anon` JWT still works and is what the Vercel integration injects, so accept
 * both and prefer the modern one.
 */
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isAuthConfigured(): boolean {
  return Boolean(URL && PUBLISHABLE_KEY);
}

let client: SupabaseClient | null = null;

/** The shared client, or null when accounts aren't configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  if (typeof window === "undefined") return null;

  client ??= createClient(URL!, PUBLISHABLE_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Magic-link and OAuth both come back with credentials in the URL; let
      // the client pick them up so the callback page stays trivial.
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  return client;
}

/** Where Supabase should send people back to after Google / a magic link. */
export function authRedirectTo(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback`;
}
