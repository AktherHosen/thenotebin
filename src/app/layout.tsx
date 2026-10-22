import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { BookOpen, Rss, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "thenotebin", template: "%s | thenotebin" },
  description: "A modern, minimalist bin of technical notes and engineering logs.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans scroll-smooth", geistSans.variable, geistMono.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col selection:bg-primary selection:text-primary-foreground">
        {/* Sticky Glassmorphism Navbar */}
        <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-bold tracking-tight text-lg group transition-colors hover:text-primary"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
                <BookOpen className="h-4 w-4" />
              </div>
              <span>thenotebin</span>
            </Link>

            <nav className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground hover:text-foreground")}
              >
                Notes
              </Link>
              <Link
                href="/feed.xml"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground hover:text-foreground gap-1.5")}
              >
                <Rss className="h-3.5 w-3.5" />
                <span>RSS</span>
              </Link>
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 ml-1")}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 py-10 sm:py-14">{children}</div>

        {/* Footer */}
        <footer className="w-full border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} thenotebin. Built with Next.js, Supabase & Tailwind.</p>
            <div className="flex items-center gap-4">
              <Link href="/feed.xml" className="hover:underline">
                RSS Feed
              </Link>
              <span>·</span>
              <Link href="/sitemap.xml" className="hover:underline">
                Sitemap
              </Link>
              <span>·</span>
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
