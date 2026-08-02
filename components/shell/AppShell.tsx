"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cx } from "@/components/ui/primitives";

/**
 * Sorbet shell.
 *
 * One top header at every width — the sidebar and mobile tab bar from the
 * previous build are gone, and the design has no width media queries at all.
 * It adapts purely through `clamp()` padding and `flex-wrap`, so the nav drops
 * under the wordmark on narrow screens without a breakpoint.
 *
 * The ticker belongs to the Kitchen only.
 */

const HEADER_PAD = "26px clamp(18px, 4vw, 38px) 0";
const SHELL_MAX = 1160;

interface NavItem {
  href: string;
  label: string;
  count?: "list" | "saved";
}

const NAV: NavItem[] = [
  { href: "/", label: "kitchen" },
  { href: "/recipes", label: "browse" },
  { href: "/list", label: "list", count: "list" },
  { href: "/saved", label: "saved", count: "saved" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated } = useStore();

  const counts = {
    list: hydrated ? state.shoppingList.filter((i) => !i.checked).length : 0,
    saved: hydrated ? state.favorites.length : 0,
  };

  // A recipe page highlights "browse" rather than adding a fifth nav item.
  const activeHref = pathname.startsWith("/recipes")
    ? "/recipes"
    : pathname === "/"
      ? "/"
      : (NAV.find((n) => n.href !== "/" && pathname.startsWith(n.href))?.href ??
        "/");

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: "var(--ground)", color: "var(--ink)" }}
    >
      <header
        className="flex w-full flex-wrap items-center justify-between"
        style={{
          padding: HEADER_PAD,
          gap: 14,
          maxWidth: SHELL_MAX,
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/"
          className="inline-block"
          style={{
            transform: "rotate(-2deg)",
            background: "var(--sky)",
            color: "var(--ink)",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.02em",
            padding: "7px 13px",
            borderRadius: 8,
            boxShadow: "4px 4px 0 var(--peach)",
          }}
        >
          MIDNIGHT SNACK CLUB
        </Link>

        <nav
          className="flex items-center"
          style={{ gap: 18, fontWeight: 600, fontSize: 14 }}
        >
          {NAV.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={
                  active
                    ? {
                        color: "var(--ink)",
                        borderBottom: "2px solid var(--peach)",
                        paddingBottom: 2,
                      }
                    : { color: "var(--ink-50)" }
                }
              >
                {item.label}
                {item.count && (
                  <>
                    {" "}
                    <span style={{ color: "var(--orange)", fontWeight: 800 }}>
                      {counts[item.count]}
                    </span>
                  </>
                )}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </header>

      {children}
    </div>
  );
}

/**
 * Scrolling marquee, Kitchen only.
 *
 * The text renders twice so the `-50%` translate wraps seamlessly rather than
 * snapping back to a gap.
 */
export function Ticker({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "var(--sky)",
        padding: "8px 0",
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      <div
        className="inline-flex"
        style={{ animation: "gz-ticker 18s linear infinite" }}
      >
        {[0, 1].map((idx) => (
          <span
            key={idx}
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--ink)",
              letterSpacing: "0.05em",
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Page body wrapper. Sorbet narrows `main` on the recipe (980) and shopping
 * (760) screens while leaving the header at 1160 — deliberately, so the
 * wordmark stays put as the content column changes width.
 */
export function Main({
  children,
  max = 1160,
  paddingBottom = 48,
  paddingTop = "clamp(24px, 4vw, 44px)",
}: {
  children: React.ReactNode;
  max?: number;
  paddingBottom?: number;
  paddingTop?: string;
}) {
  return (
    <main
      className="w-full"
      style={{
        flex: 1,
        maxWidth: max,
        margin: "0 auto",
        boxSizing: "border-box",
        padding: `0 clamp(18px, 4vw, 38px) ${paddingBottom}px`,
        paddingTop,
      }}
    >
      {children}
    </main>
  );
}

/**
 * Theme switch. Not part of the Sorbet bundle — kept because this build ships
 * a dark mode, and styled to disappear into the nav rather than announce
 * itself.
 */
function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("msc.theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      );
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("msc.theme", next);
    } catch {
      // Storage unavailable; the toggle still works for this session.
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={cx("msc-press")}
      style={{ fontSize: 15, lineHeight: 1, color: "var(--ink-50)" }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
