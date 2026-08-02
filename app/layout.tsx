import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

/**
 * Sorbet uses a single variable typeface everywhere — no display/body split.
 * The `opsz` axis matches the design's Google Fonts request
 * (`opsz,wght@12..96,300..800`).
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Midnight Snack Club — cook what you have",
  description:
    "Tell the club what's in your fridge. It tells you what you can cook right now, what you're one ingredient away from, and what to use up before it turns.",
  applicationName: "Midnight Snack Club",
  appleWebApp: { capable: true, title: "Midnight Snack Club" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf5e4" },
    { media: "(prefers-color-scheme: dark)", color: "#22292f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Runs before paint so a dark-mode user never sees a cream flash. */
const THEME_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('msc.theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={bricolage.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* AuthProvider wraps the store: the store reads the session to decide
            whether to sync, so it has to be inside. */}
        <AuthProvider>
          <StoreProvider>
            <AppShell>{children}</AppShell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
