import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/lib/types";

export const revalidate = 3600; // ISR: re-check at most hourly; publishing revalidates on-demand

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
      {posts.length === 0 && (
        <p className="text-gray-500">No posts yet.</p>
      )}
      <ul className="space-y-8">
        {posts.map((post) => (
          <li key={post.id} className="group">
            <Link
              href={`/blog/${post.slug}`}
              className="text-2xl font-semibold group-hover:underline leading-snug"
            >
              {post.title}
            </Link>
            <p className="text-sm text-gray-500 mt-1">{formatDate(post.published_at)}</p>
            {post.excerpt && (
              <p className="mt-2 text-gray-700 leading-relaxed">{post.excerpt}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
