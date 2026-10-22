import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { deletePost } from "./actions";
import type { Post } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, Trash2, Calendar, FileText, Plus, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin Dashboard | thenotebin" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as Post[];
  const now = Date.now();

  const publishedCount = posts.filter(
    (p) => p.status === "published" && (!p.published_at || new Date(p.published_at).getTime() <= now)
  ).length;
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const scheduledCount = posts.length - publishedCount - draftCount;

  return (
    <div className="space-y-6">
      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-4 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">Total Notes</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{posts.length}</p>
        </Card>
        <Card className="p-4 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">Published</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {publishedCount}
          </p>
        </Card>
        <Card className="p-4 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">Drafts / Scheduled</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {draftCount + scheduledCount}
          </p>
        </Card>
      </div>

      {/* Posts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">All Articles</h2>
          <span className="text-xs text-muted-foreground">{posts.length} entries</span>
        </div>

        {posts.length === 0 && (
          <Card className="border-dashed p-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-sm font-semibold">No notes found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first note to start sharing your thoughts.
            </p>
            <div className="mt-4">
              <Link
                href="/admin/new"
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                <Plus className="h-4 w-4" />
                <span>Create note</span>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid gap-3">
          {posts.map((post) => {
            const isScheduled =
              post.status === "published" &&
              post.published_at &&
              new Date(post.published_at).getTime() > now;

            return (
              <Card
                key={post.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:border-foreground/20 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/${post.id}`}
                      className="font-semibold text-base hover:underline truncate"
                    >
                      {post.title}
                    </Link>

                    {post.status === "draft" && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Draft
                      </Badge>
                    )}
                    {isScheduled && (
                      <Badge variant="outline" className="text-[10px] font-normal text-amber-600 border-amber-500/30">
                        Scheduled
                      </Badge>
                    )}
                    {post.status === "published" && !isScheduled && (
                      <Badge variant="default" className="text-[10px] font-normal bg-emerald-600 hover:bg-emerald-600 text-white">
                        Published
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] truncate max-w-xs">/{post.slug}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.published_at ?? post.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {post.status === "published" && !isScheduled && (
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-foreground")}
                      title="View public post"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  )}

                  <Link
                    href={`/admin/${post.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1 text-xs")}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </Link>

                  <form action={deletePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete post"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
