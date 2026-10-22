import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "thenotebin", template: "%s | thenotebin" },
  description: "A bin of useful notes.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased min-h-screen flex flex-col">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-6 border-b border-gray-100">
          <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-75 transition-opacity">
            thenotebin
          </Link>
          <a
            href="/feed.xml"
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            RSS
          </a>
        </header>
        <div className="flex-1 py-8">{children}</div>
        <footer className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-gray-500 border-t border-gray-100">
          © {new Date().getFullYear()} thenotebin
        </footer>
      </body>
    </html>
  );
}
