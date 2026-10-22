import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabasePublic } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/lib/types";
import { ArrowLeft, Calendar, Clock, Share2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  const wordCount = post.content ? post.content.trim().split(/\s+/).length : 150;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6">
      {/* Back button */}
      <div className="mb-8">
        <Link
          href="/"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "gap-2 -ml-2 text-muted-foreground hover:text-foreground",
          })}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to notes</span>
        </Link>
      </div>

      {/* Article Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-medium text-xs">
            Article
          </Badge>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(post.published_at)}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {readTime} min read
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.2]">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            {post.excerpt}
          </p>
        )}
      </header>

      {/* Cover Image */}
      {post.cover_image && (
        <div className="my-8 overflow-hidden rounded-xl border border-border shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full max-h-[460px] object-cover"
          />
        </div>
      )}

      <Separator className="my-8" />

      {/* Markdown Article Content */}
      <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-xs prose-pre:rounded-xl prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>

      <Separator className="my-12" />

      {/* Post Footer */}
      <div className="flex items-center justify-between py-4">
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "gap-2",
          })}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All notes</span>
        </Link>
        <p className="text-xs text-muted-foreground">Published in thenotebin</p>
      </div>
    </main>
  );
}
