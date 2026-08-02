"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cx } from "@/components/ui/primitives";

/**
 * Navigation shell.
 *
 * Mobile gets a bottom tab bar because this app is used standing at an open
 * fridge with one hand. Desktop gets a sidebar.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Which store slice drives the count bubble, if any. */
  badge?: "pantry" | "list" | "saved";
}

const NAV: NavItem[] = [
  { href: "/", label: "Kitchen", icon: <KitchenIcon />, badge: "pantry" },
  { href: "/recipes", label: "Browse", icon: <BookIcon /> },
  { href: "/list", label: "Shopping", icon: <CartIcon />, badge: "list" },
  { href: "/saved", label: "Saved", icon: <HeartIcon />, badge: "saved" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated } = useStore();

  const counts = {
    pantry: state.pantry.length,
    list: state.shoppingList.filter((i) => !i.checked).length,
    saved: state.favorites.length,
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-4 py-6 lg:flex"
        style={{ borderColor: "var(--border)", background: "var(--bg-sunken)" }}
      >
        <Wordmark />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              count={hydrated && item.badge ? counts[item.badge] : 0}
            />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <ThemeToggle />
          <p className="px-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Everything stays in this browser. No account, no server.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur lg:hidden"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          }}
        >
          <Wordmark compact />
          <ThemeToggle compact />
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t backdrop-blur lg:hidden"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in srgb, var(--bg) 92%, transparent)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {NAV.map((item) => (
            <TabLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              count={hydrated && item.badge ? counts[item.badge] : 0}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 place-items-center rounded-xl text-base"
        style={{ background: "var(--accent-soft)" }}
        aria-hidden
      >
        🥘
      </span>
      <span className="leading-none">
        <span
          className="font-display block text-lg font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Recipity
        </span>
        {!compact && (
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            cook what you have
          </span>
        )}
      </span>
    </Link>
  );
}

function NavLink({
  item,
  active,
  count,
}: {
  item: NavItem;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: active ? "var(--bg-raised)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        boxShadow: active ? "var(--shadow-card)" : undefined,
      }}
    >
      <span style={{ color: active ? "var(--accent)" : "inherit" }}>
        {item.icon}
      </span>
      {item.label}
      {count > 0 && (
        <span
          className="ml-auto rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold tabular-nums"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function TabLink({
  item,
  active,
  count,
}: {
  item: NavItem;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium"
      style={{ color: active ? "var(--accent)" : "var(--text-faint)" }}
    >
      <span className="relative">
        {item.icon}
        {count > 0 && (
          <span
            className="absolute -right-2.5 -top-1 min-w-[1.05rem] rounded-full px-1 text-[0.6rem] font-semibold leading-4 tabular-nums"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      {item.label}
    </Link>
  );
}

function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("recipity.theme");
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
      window.localStorage.setItem("recipity.theme", next);
    } catch {
      // Storage unavailable; the toggle still works for this session.
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={cx(
        "flex items-center gap-2 rounded-xl text-sm font-medium transition-colors",
        compact ? "h-9 w-9 justify-center" : "w-full px-3 py-2.5",
      )}
      style={{ color: "var(--text-muted)" }}
    >
      <span aria-hidden>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</span>
      {!compact && (theme === "dark" ? "Light mode" : "Dark mode")}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Icons — inline so there's no icon-font or external request          */
/* ------------------------------------------------------------------ */

function iconProps() {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function KitchenIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 9h16" />
      <path d="M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M12 13v3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16" />
      <path d="M9 8h6" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2.5l2.6 12.4a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.2L21 7H5.2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M19.5 5.5a5 5 0 0 0-7.5.6 5 5 0 0 0-7.5-.6 5.2 5.2 0 0 0 0 7.3L12 20.5l7.5-7.7a5.2 5.2 0 0 0 0-7.3z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
