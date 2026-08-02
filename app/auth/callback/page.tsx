"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isAuthConfigured } from "@/lib/supabase";
import { Main } from "@/components/shell/AppShell";

/**
 * Where Google and magic links land.
 *
 * The client is configured with `detectSessionInUrl`, so in the common case it
 * has already consumed the credentials by the time this mounts and we only
 * need to confirm a session exists and move on. The explicit
 * `exchangeCodeForSession` is the PKCE fallback for when it hasn't.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthConfigured()) {
      router.replace("/");
      return;
    }

    const client = getSupabase();
    if (!client) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);

      // Supabase reports refusals (expired link, cancelled consent) on the URL.
      const denied = params.get("error_description") ?? params.get("error");
      if (denied) {
        if (!cancelled) setError(denied);
        return;
      }

      const { data } = await client.auth.getSession();
      if (!data.session) {
        const code = params.get("code");
        if (code) {
          const { error: exchangeError } =
            await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) setError(exchangeError.message);
            return;
          }
        }
      }

      if (!cancelled) {
        // replace, not push — nobody wants the callback in their back button.
        router.replace("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Main max={760}>
      <div className="text-center" style={{ paddingTop: 40 }}>
        <span style={{ fontSize: 40 }} aria-hidden>
          {error ? "🔒" : "🍳"}
        </span>
        <h1
          style={{
            margin: "14px 0 0",
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {error ? "that didn't work." : "letting you in…"}
        </h1>
        {error && (
          <>
            <p
              style={{
                margin: "8px auto 0",
                maxWidth: "40ch",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--ink-60)",
              }}
            >
              {error}
            </p>
            <button
              onClick={() => router.replace("/account")}
              style={{
                marginTop: 16,
                fontSize: 13,
                fontWeight: 700,
                color: "var(--sky-deep)",
              }}
            >
              try again →
            </button>
          </>
        )}
      </div>
    </Main>
  );
}
