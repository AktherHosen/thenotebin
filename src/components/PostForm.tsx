"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { savePost } from "@/app/admin/actions";
import type { Post } from "@/lib/types";

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
    <form action={savePost} className="flex flex-col gap-4">
      {post && <input type="hidden" name="id" value={post.id} />}

      <input
        name="title"
        defaultValue={post?.title}
        placeholder="Post title"
        required
        className="rounded border p-2 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-black"
      />

      <input
        name="slug"
        defaultValue={post?.slug}
        placeholder="slug (leave empty to auto-generate from title)"
        className="rounded border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />

      <textarea
        name="excerpt"
        defaultValue={post?.excerpt ?? ""}
        placeholder="Short excerpt for search results and the post list"
        rows={2}
        className="rounded border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Cover image</label>
        <input type="file" accept="image/*" onChange={onCoverChange} disabled={uploading} />
        <input type="hidden" name="cover_image" value={coverImage} />
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="Cover preview" className="max-h-40 rounded object-cover" />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={tab === "write" ? "font-bold underline" : "text-gray-500 hover:text-black"}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={tab === "preview" ? "font-bold underline" : "text-gray-500 hover:text-black"}
          >
            Preview
          </button>
          <label className="ml-auto cursor-pointer text-blue-600 hover:underline">
            {uploading ? "Uploading…" : "Insert image"}
            <input
              type="file"
              accept="image/*"
              onChange={onInlineImage}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {/* Keep the textarea mounted so its value is always submitted */}
        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={22}
          placeholder="Write in Markdown…"
          className={`w-full rounded border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black ${
            tab === "write" ? "" : "hidden"
          }`}
        />
        {tab === "preview" && (
          <article className="prose max-w-none rounded border p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium">Status</label>
          <select
            name="status"
            defaultValue={post?.status ?? "draft"}
            className="rounded border p-2"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">
            Publish date <span className="font-normal text-gray-500">(future = scheduled)</span>
          </label>
          <input
            type="datetime-local"
            name="published_at"
            defaultValue={post?.published_at?.slice(0, 16)}
            className="rounded border p-2"
          />
        </div>
        <button
          className="ml-auto rounded bg-black px-4 py-2 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          disabled={uploading}
        >
          Save
        </button>
      </div>
    </form>
  );
}
