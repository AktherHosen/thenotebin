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

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    notFound();
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4">
      <h1 className="text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-500">{formatDate(post.published_at)}</p>
      {post.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_image}
          alt={post.title}
          className="my-6 w-full rounded-lg object-cover"
        />
      )}
      <article className="prose prose-lg mt-6 max-w-none prose-neutral">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>
    </main>
  );
}
