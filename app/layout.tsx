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
        <header className="pt-4 pb-2">
          <div className="flex justify-center">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="AOE4 Draft"
                width={180}
                height={60}
                className="h-14 w-auto"
              />
            </Link>
          </div>
        </header>
        {children}
        <footer className="py-4 text-center text-[11px] text-muted-foreground border-t border-border">
          <p>
            &copy; {new Date().getFullYear()} Built by{" "}
            <a
              href="https://flowtide.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Brad Fletcher
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
