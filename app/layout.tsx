import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "AOE4 Draft — Age of Empires IV Drafting Tool",
    template: "%s | AOE4 Draft",
  },
  description:
    "Set up civilization and map bans & picks for your Age of Empires IV tournament matches. Supports 1v1, 2v2, 3v3, and 4v4.",
  openGraph: {
    title: "AOE4 Draft",
    description:
      "Set up civilization and map bans & picks for your Age of Empires IV tournament matches.",
    type: "website",
    siteName: "AOE4 Draft",
  },
  twitter: {
    card: "summary",
    title: "AOE4 Draft",
    description:
      "Set up civilization and map bans & picks for your Age of Empires IV tournament matches.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        {/* Global background */}
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/aoe4draft.png')" }}
        />
        <div className="fixed inset-0 bg-gradient-to-b from-background/95 via-background/93 to-background" />

        <header className="relative z-20 py-4">
          <div className="flex justify-center">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="AOE4 Draft"
                width={180}
                height={60}
                className="h-12 w-auto"
              />
            </Link>
          </div>
        </header>
        <div className="relative z-10 min-h-[calc(100vh-4rem)] flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="py-6 px-4">
            <div className="max-w-4xl mx-auto border-t border-border/30 pt-6 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground/40">
                aoe4draft.win
              </p>
              <p className="text-[11px] text-muted-foreground/40">
                Built by{" "}
                <a
                  href="https://flowtide.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-muted-foreground/60 transition-colors"
                >
                  Brad Fletcher
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
