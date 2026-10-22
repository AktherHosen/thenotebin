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
      (p: { title: string; slug: string; excerpt: string | null; published_at: string | null }) => `<item>
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
