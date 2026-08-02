"use client";

import Link from "next/link";
import { useState } from "react";
import { displayName, useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { syncCopy } from "@/lib/voice";
import { Main } from "@/components/shell/AppShell";
import {
  Button,
  EmptyPanel,
  Headline,
  PillLinkStyle,
} from "@/components/ui/primitives";

/**
 * Sign in / account.
 *
 * Deliberately framed as a bonus rather than a gate — the copy says so, because
 * the app works perfectly without one and nobody should feel they've hit a
 * wall. If accounts aren't configured this page says so plainly instead of
 * showing buttons that can't work.
 */
export default function AccountPage() {
  const { configured, ready, user, signInWithGoogle, signInWithEmail, signOut } =
    useAuth();
  const { state, syncStatus, lastSyncedAt } = useStore();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <Main max={760}>
        <Headline before="join the " accent="club" after="." />
        <EmptyPanel
          glyph="🔌"
          title="accounts aren't switched on."
          bodyWidth="44ch"
          action={
            <Link href="/" style={PillLinkStyle("primary")}>
              back to the kitchen →
            </Link>
          }
        >
          this build has no Supabase credentials, so there&apos;s nothing to sign
          in to. everything still works — your fridge just lives in this browser.
        </EmptyPanel>
      </Main>
    );
  }

  if (!ready) {
    return (
      <Main max={760}>
        <Headline before="join the " accent="club" after="." />
        <div
          className="msc-skeleton"
          style={{ marginTop: 28, height: 180, borderRadius: 24 }}
        />
      </Main>
    );
  }

  /* ---------------------------------------------------------------- signed in */

  if (user) {
    return (
      <Main max={760}>
        <Headline before="you're " accent="in" after="." />
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--ink-60)",
          }}
        >
          signed in as {displayName(user)}. your fridge follows you to any device
          you sign in on.
        </p>

        <div
          style={{
            marginTop: 24,
            borderRadius: 18,
            padding: 22,
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            transform: "rotate(-0.4deg)",
            boxShadow: "6px 6px 0 var(--tan-shadow)",
          }}
        >
          <Row label="signed in as" value={user.email ?? displayName(user)} />
          <Row label="sync" value={syncCopy(syncStatus, lastSyncedAt)} />
          <Row
            label="on this account"
            value={`${state.pantry.length} in the fridge · ${state.favorites.length} kept`}
          />
        </div>

        <div className="flex flex-wrap" style={{ marginTop: 20, gap: 10 }}>
          <Link href="/" style={PillLinkStyle("primary")}>
            back to the kitchen →
          </Link>
          <Button variant="outline" onClick={() => void signOut()}>
            sign out
          </Button>
        </div>

        <p
          style={{
            margin: "18px 0 0",
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.55,
            color: "var(--ink-45)",
            maxWidth: "52ch",
          }}
        >
          signing out leaves this device&apos;s fridge exactly where it is — it
          just stops syncing. nothing gets wiped.
        </p>
      </Main>
    );
  }

  /* --------------------------------------------------------------- signed out */

  const onGoogle = async () => {
    setBusy("google");
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err);
      setBusy(null);
    }
    // On success the browser leaves for Google, so there's nothing to reset.
  };

  const onEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy("email");
    setError(null);
    const { error: err } = await signInWithEmail(email.trim());
    setBusy(null);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <Main max={760}>
      <Headline before="join the " accent="club" after="." />
      <p
        style={{
          margin: "12px 0 0",
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.5,
          color: "var(--ink-60)",
          maxWidth: "48ch",
        }}
      >
        sign in and your fridge follows you — phone, laptop, whatever. entirely
        optional. the app works exactly the same without one.
      </p>

      <div
        style={{
          marginTop: 28,
          borderRadius: 24,
          padding: "32px 28px",
          border: "2px dashed var(--tan-dashed)",
        }}
      >
        {sent ? (
          <div className="text-center">
            <span style={{ fontSize: 40 }} aria-hidden>
              📬
            </span>
            <h2
              style={{
                margin: "14px 0 0",
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              check your email.
            </h2>
            <p
              style={{
                margin: "8px auto 0",
                maxWidth: "38ch",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--ink-60)",
              }}
            >
              we sent a link to <strong>{email}</strong>. click it and
              you&apos;re in — no password to invent.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              style={{
                marginTop: 16,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink-45)",
              }}
            >
              use a different email
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onGoogle}
              disabled={busy !== null}
              className="msc-press msc-hover-sky flex w-full items-center justify-center"
              style={{
                gap: 10,
                borderRadius: 999,
                padding: "13px 20px",
                fontSize: 15,
                fontWeight: 700,
                background: "var(--surface)",
                border: "2px solid var(--tan-border)",
                color: "var(--ink)",
                boxShadow: "3px 3px 0 var(--tan-shadow)",
                boxSizing: "border-box",
              }}
            >
              <GoogleMark />
              {busy === "google" ? "off to google…" : "continue with google"}
            </button>

            <div
              className="flex items-center"
              style={{ gap: 12, margin: "20px 0" }}
            >
              <span style={{ flex: 1, height: 2, background: "var(--tan-border)" }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: "var(--ink-45)",
                }}
              >
                OR
              </span>
              <span style={{ flex: 1, height: 2, background: "var(--tan-border)" }} />
            </div>

            <form onSubmit={onEmail}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email address for a sign-in link"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 999,
                  padding: "13px 22px",
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  background: "var(--surface)",
                  border: "2px solid var(--tan-border)",
                  color: "var(--ink)",
                }}
              />
              <button
                type="submit"
                disabled={busy !== null || !email.trim()}
                className="msc-press flex w-full items-center justify-center"
                style={{
                  marginTop: 10,
                  gap: 8,
                  borderRadius: 999,
                  padding: "13px 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--sky)",
                  border: "2px solid var(--sky-deep)",
                  color: "var(--ink)",
                  boxShadow: "3px 3px 0 var(--peach)",
                  boxSizing: "border-box",
                  opacity: busy !== null || !email.trim() ? 0.5 : 1,
                }}
              >
                {busy === "email" ? "sending…" : "email me a link ✉"}
              </button>
            </form>
          </>
        )}

        {error && (
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--orange)",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}
      </div>

      <p
        style={{
          margin: "18px 0 0",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.55,
          color: "var(--ink-45)",
          maxWidth: "52ch",
        }}
      >
        whatever is already in this browser comes with you — signing in merges
        it with your account rather than replacing either side.
      </p>
    </Main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between"
      style={{
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px dashed var(--tan-skeleton)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: "var(--ink-45)",
        }}
      >
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

/** Google's mark, inline — the design ships no external requests. */
function GoogleMark() {
  return (
    <svg width={17} height={17} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.3-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.7-5.2 6.6-9 12.4-9z"
      />
    </svg>
  );
}
