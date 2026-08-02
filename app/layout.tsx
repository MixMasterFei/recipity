import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Recipity — cook what you already have",
  description:
    "Tell Recipity what's in your kitchen and it finds the recipes you can make right now, the ones you're two ingredients away from, and what to use up before it goes off.",
  applicationName: "Recipity",
  appleWebApp: { capable: true, title: "Recipity" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#17110c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Applied before paint so a dark-mode user never sees a white flash.
 * Inline because it has to run before React hydrates.
 */
const THEME_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('recipity.theme');
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
