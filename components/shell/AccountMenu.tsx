"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { displayName, initialOf, useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { syncCopy } from "@/lib/voice";

/**
 * The account affordance in the header.
 *
 * Renders nothing at all when accounts aren't configured, so an unconfigured
 * build has no dead UI — the nav looks exactly as it did before this feature
 * existed.
 */
export function AccountMenu() {
  const { configured, ready, user, signOut } = useAuth();
  const { syncStatus, lastSyncedAt } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!configured) return null;

  // Hold the space rather than flashing "sign in" at someone already signed in.
  if (!ready) {
    return (
      <span
        className="msc-skeleton inline-block"
        style={{ width: 26, height: 26, borderRadius: "50%" }}
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link href="/account" style={{ color: "var(--ink-50)" }}>
        sign in
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${displayName(user)}`}
        className="msc-press grid place-items-center"
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--sky)",
          border: "1.5px solid var(--sky-deep)",
          fontSize: 12,
          fontWeight: 800,
          color: "var(--ink)",
        }}
      >
        {initialOf(user)}
      </button>

      {open && (
        <div
          className="msc-rise absolute"
          style={{
            right: 0,
            top: "100%",
            zIndex: 40,
            marginTop: 10,
            width: 230,
            borderRadius: 16,
            padding: 14,
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            boxShadow: "6px 6px 0 var(--tan-shadow)",
          }}
          role="menu"
        >
          <p
            className="truncate"
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {user.email ?? displayName(user)}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 12,
              fontWeight: 600,
              color:
                syncStatus === "error" ? "var(--orange)" : "var(--green-text)",
            }}
          >
            {syncCopy(syncStatus, lastSyncedAt)}
          </p>

          <div
            style={{
              margin: "12px 0",
              height: 1,
              borderTop: "1px dashed var(--tan-skeleton)",
            }}
          />

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-60)" }}
            role="menuitem"
          >
            account
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="msc-hover-orange block"
            style={{
              marginTop: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-45)",
            }}
            role="menuitem"
          >
            sign out
          </button>
        </div>
      )}
    </div>
  );
}
