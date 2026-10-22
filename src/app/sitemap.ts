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
    ...(data ?? []).map((p: { slug: string; updated_at: string }) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      lastModified: p.updated_at,
    })),
  ];
}
