# Phase 4: Public Blog Pages and SEO Engine

## 1. Root Layout (`app/layout.tsx`)

Configures site title template, default metadata, and global RSS feed auto-discovery:

```tsx
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
          <Link href="/" className="text-xl font-bold tracking-tight">thenotebin</Link>
          <a href="/feed.xml" className="text-sm text-gray-500 hover:text-black transition">RSS</a>
        </header>
        <div className="flex-1 py-8">
          {children}
        </div>
        <footer className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-gray-500 border-t border-gray-100">
          © {new Date().getFullYear()} thenotebin
        </footer>
      </body>
    </html>
  );
}
```

---

## 2. Public Home Page (`app/page.tsx`)

Queries published posts using `supabasePublic` with hourly ISR revalidation:

```tsx
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/lib/types";

export const revalidate = 3600; // hourly revalidation; server actions revalidate immediately

export default async function HomePage() {
  const { data } = await supabasePublic
    .from("posts")
    .select("id,title,slug,excerpt,published_at,cover_image")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  const posts = (data ?? []) as Post[];

  return (
    <main className="mx-auto max-w-3xl px-4">
      {posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}
      <ul className="space-y-8">
        {posts.map((post) => (
          <li key={post.id} className="group">
            <Link href={`/blog/${post.slug}`} className="text-2xl font-semibold group-hover:underline">
              {post.title}
            </Link>
            <p className="text-sm text-gray-500 mt-1">{formatDate(post.published_at)}</p>
            {post.excerpt && <p className="mt-2 text-gray-700 leading-relaxed">{post.excerpt}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

---

## 3. Post Detail Page (`app/blog/[slug]/page.tsx`)

Renders post markdown, handles 404 for unapproved/future posts, and generates Open Graph metadata:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabasePublic } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/lib/types";

export const revalidate = 3600;

async function getPost(slug: string) {
  const { data } = await supabasePublic
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  return data as Post | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4">
      <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-500">{formatDate(post.published_at)}</p>
      {post.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover_image} alt={post.title} className="my-6 w-full rounded-lg object-cover" />
      )}
      <article className="prose prose-lg mt-6 max-w-none prose-neutral">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>
    </main>
  );
}
```

---

## 4. Search Engine Optimization (SEO) & Feeds

### `app/sitemap.ts`
```ts
import type { MetadataRoute } from "next";
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data } = await supabasePublic
    .from("posts")
    .select("slug,updated_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());

  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    ...(data ?? []).map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      lastModified: p.updated_at,
    })),
  ];
}
```

### `app/robots.ts`
```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/login"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

### `app/feed.xml/route.ts`
```ts
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 3600;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data } = await supabasePublic
    .from("posts")
    .select("title,slug,excerpt,published_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(30);

  const items = (data ?? [])
    .map(
      (p) => `<item>
  <title>${esc(p.title)}</title>
  <link>${siteUrl}/blog/${p.slug}</link>
  <guid>${siteUrl}/blog/${p.slug}</guid>
  <pubDate>${new Date(p.published_at!).toUTCString()}</pubDate>
  <description>${esc(p.excerpt ?? "")}</description>
</item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>thenotebin</title>
  <link>${siteUrl}</link>
  <description>A bin of useful notes.</description>
${items}
</channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
```
