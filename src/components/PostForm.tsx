"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { savePost } from "@/app/admin/actions";
import type { Post } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Image as ImageIcon, Eye, Edit3, X, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PostForm({ post }: { post?: Post }) {
  const [content, setContent] = useState(post?.content ?? "");
  const [coverImage, setCoverImage] = useState(post?.cover_image ?? "");
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Image upload failed");
      }

      const { publicUrl } = await res.json();
      return publicUrl as string;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setCoverImage(url);
  }

  async function onInlineImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setContent((c) => `${c}\n\n![${file.name}](${url})\n`);
    e.target.value = "";
  }

  return (
    <form action={savePost} className="space-y-6">
      {post && <input type="hidden" name="id" value={post.id} />}

      {/* Top action bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button type="submit" size="sm" disabled={uploading} className="gap-1.5">
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading…</span>
              </>
            ) : (
              <span>Save Note</span>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Editor (Left 2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Title</label>
            <Input
              name="title"
              defaultValue={post?.title}
              placeholder="e.g. Building an Event-Driven System in Node.js"
              required
              className="text-lg font-semibold tracking-tight h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Slug (Optional)</label>
            <Input
              name="slug"
              defaultValue={post?.slug}
              placeholder="auto-generated-from-title"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Excerpt</label>
            <Textarea
              name="excerpt"
              defaultValue={post?.excerpt ?? ""}
              placeholder="A brief summary for previews, search engines, and social cards..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Content Editor with Write / Preview Tabs */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                <Button
                  type="button"
                  variant={tab === "write" ? "default" : "ghost"}
                  size="xs"
                  onClick={() => setTab("write")}
                  className="gap-1 text-xs"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Write</span>
                </Button>
                <Button
                  type="button"
                  variant={tab === "preview" ? "default" : "ghost"}
                  size="xs"
                  onClick={() => setTab("preview")}
                  className="gap-1 text-xs"
                >
                  <Eye className="h-3 w-3" />
                  <span>Preview</span>
                </Button>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors">
                <Upload className="h-3 w-3" />
                <span>{uploading ? "Uploading…" : "Insert image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onInlineImage}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            {/* Always keep textarea mounted for form submit */}
            <Textarea
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              placeholder="Write your note in Markdown… support for headers, code snippets, lists, and quotes."
              className={`font-mono text-sm leading-relaxed ${tab === "write" ? "" : "hidden"}`}
            />

            {tab === "preview" && (
              <Card className="min-h-[440px] p-6">
                <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold">
                  {content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">Nothing to preview yet. Switch to Write tab.</p>
                  )}
                </article>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar Settings (Right 1 col) */}
        <div className="space-y-5">
          {/* Cover Image Upload Card */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Cover Image</label>
              {coverImage && (
                <button
                  type="button"
                  onClick={() => setCoverImage("")}
                  className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {coverImage ? (
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="Cover preview" className="h-36 w-full object-cover" />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 cursor-pointer hover:bg-muted/40 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-center text-xs">
                  <span className="font-semibold text-primary">Click to upload</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, WebP up to 5MB</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onCoverChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
            <input type="hidden" name="cover_image" value={coverImage} />
          </Card>

          {/* Publishing Settings Card */}
          <Card className="p-4 space-y-4">
            <h3 className="text-xs font-semibold text-foreground border-b pb-2">Publishing</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Status</label>
              <select
                name="status"
                defaultValue={post?.status ?? "draft"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="draft">Draft (Private)</option>
                <option value="published">Published (Live)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Publish Date
              </label>
              <Input
                type="datetime-local"
                name="published_at"
                defaultValue={post?.published_at?.slice(0, 16)}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to publish now, or pick a future date to schedule.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
