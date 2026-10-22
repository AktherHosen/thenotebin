import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, FileText, Sparkles } from "lucide-react";

export const revalidate = 3600; // ISR: re-check at most hourly; publishing revalidates on-demand

export default async function HomePage() {
  const { data } = await supabasePublic
    .from("posts")
    .select("id,title,slug,excerpt,published_at,cover_image,content")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  const posts = (data ?? []) as (Post & { content?: string })[];

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6">
      {/* Hero Section */}
      <section className="mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Curated notes & essays</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
          A digital shelf for notes, ideas & code.
        </h1>
        <p className="mt-3.5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Writing on modern web architecture, engineering decisions, and personal takeaways.
        </p>
      </section>

      {/* Empty State */}
      {posts.length === 0 && (
        <Card className="border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No notes published yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Head over to the admin dashboard to write and publish your first article.
          </p>
          <div className="mt-6">
            <Link
              href="/admin/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Write a note
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      {/* Posts Grid / List */}
      <div className="grid gap-6">
        {posts.map((post) => {
          // Approx reading time calculation (avg 200 words per minute)
          const wordCount = post.content ? post.content.trim().split(/\s+/).length : 150;
          const readTime = Math.max(1, Math.ceil(wordCount / 200));

          return (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
              <Card className="overflow-hidden transition-all duration-300 hover:border-foreground/30 hover:shadow-md">
                <div className="flex flex-col sm:flex-row gap-6 p-6">
                  {post.cover_image && (
                    <div className="sm:w-60 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="h-44 sm:h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(post.published_at)}
                        </span>
                        <span>•</span>
                        <span>{readTime} min read</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
                          Note
                        </Badge>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary leading-snug">
                        {post.title}
                      </h2>

                      {post.excerpt && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {post.excerpt}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                      <span>Read article</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
