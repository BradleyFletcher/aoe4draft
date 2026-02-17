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
  title: "AOE4 Draft",
  description: "Age of Empires IV Tournament Drafting Tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <header className="border-b border-border">
          <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/logo.png"
                alt="AOE4 Draft"
                width={32}
                height={32}
                className="shrink-0"
              />
              <span className="text-sm font-bold tracking-tight">
                AOE4 Draft
              </span>
            </Link>
          </div>
        </header>
        {children}
        <footer className="py-4 text-center text-[11px] text-muted-foreground border-t border-border">
          <p>
            &copy; {new Date().getFullYear()} Built by Brad Fletcher &middot;{" "}
            <a
              href="https://flowtide.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              flowtide.ai
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
