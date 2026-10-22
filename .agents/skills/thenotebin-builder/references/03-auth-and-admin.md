# Phase 3: Auth, Supabase Clients & Admin Dashboard

## 1. Supabase Client Helpers & Shared Utilities

### `lib/supabase/client.ts` (Browser Client)
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `lib/supabase/server.ts` (Server Component / Action Client)
> **Notice**: Requires `await cookies()` for Next.js 15+.
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in Server Components because middleware refreshes sessions
          }
        },
      },
    }
  );
}
```

### `lib/supabase/public.ts` (Stateless Client for Cached Visitor Queries)
```ts
import { createClient } from "@supabase/supabase-js";

export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### `lib/utils.ts`
```ts
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function formatDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
```

### `lib/types.ts`
```ts
export type Post = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  status: "draft" | "published";
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};
```

---

## 2. Session Refresh & Admin Protection Middleware

### `lib/supabase/middleware.ts`
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validates current auth token with Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
```

### `middleware.ts` (Project Root)
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
```

---

## 3. Login Flow

### `app/login/actions.ts`
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });

  if (error) {
    redirect("/login?error=Invalid%20email%20or%20password");
  }

  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

### `app/login/page.tsx`
```tsx
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-bold">Admin login</h1>
      {error && <p className="mb-4 rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      <form action={login} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
        <input name="password" type="password" placeholder="Password" required className="rounded border p-2" />
        <button className="rounded bg-black p-2 text-white hover:bg-gray-800 transition">Sign in</button>
      </form>
    </main>
  );
}
```

---

## 4. Admin Dashboard & Post Management

### `app/admin/layout.tsx`
```tsx
import Link from "next/link";
import { logout } from "@/app/login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <Link href="/admin" className="text-xl font-bold">Admin</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" target="_blank" className="hover:underline">View site</Link>
          <Link href="/admin/new" className="rounded bg-black px-3 py-1.5 text-white hover:bg-gray-800 transition">New post</Link>
          <form action={logout}>
            <button className="text-gray-600 hover:text-black underline">Log out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
```

### `app/admin/page.tsx`
```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { deletePost } from "./actions";
import type { Post } from "@/lib/types";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as Post[];
  const now = Date.now();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Posts</h1>
      {posts.length === 0 && <p className="text-gray-500">No posts yet. Create your first one.</p>}
      <ul className="divide-y border-t">
        {posts.map((post) => {
          const scheduled =
            post.status === "published" && post.published_at && new Date(post.published_at).getTime() > now;
          const label = post.status === "draft" ? "Draft" : scheduled ? "Scheduled" : "Published";

          return (
            <li key={post.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/admin/${post.id}`} className="font-medium hover:underline">
                  {post.title}
                </Link>
                <p className="text-xs text-gray-500">
                  {label} · {formatDate(post.published_at ?? post.created_at)}
                </p>
              </div>
              <form action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
                <button className="text-sm text-red-600 hover:underline">Delete</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

### `app/admin/actions.ts`
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export async function savePost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const slug = slugify(String(formData.get("slug") || "") || title);
  const status = String(formData.get("status") || "draft");
  const publishedRaw = String(formData.get("published_at") || "");

  let published_at: string | null = publishedRaw ? new Date(publishedRaw).toISOString() : null;
  if (status === "published" && !published_at) published_at = new Date().toISOString();

  const payload = {
    title,
    slug,
    content: String(formData.get("content") || ""),
    excerpt: String(formData.get("excerpt") || "") || null,
    cover_image: String(formData.get("cover_image") || "") || null,
    status,
    published_at,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("posts").update(payload).eq("id", id)
    : await supabase.from("posts").insert({ ...payload, author_id: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}
```

### `components/PostForm.tsx` (Direct R2 Upload + Live Markdown Preview)
```tsx
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
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not get upload URL");
      }
      const { uploadUrl, publicUrl } = await res.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to R2 failed");

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
        className="rounded border p-2 text-xl font-semibold"
      />

      <input
        name="slug"
        defaultValue={post?.slug}
        placeholder="slug (leave empty to auto-generate from title)"
        className="rounded border p-2 text-sm"
      />

      <textarea
        name="excerpt"
        defaultValue={post?.excerpt ?? ""}
        placeholder="Short excerpt for search results and post list"
        rows={2}
        className="rounded border p-2 text-sm"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Cover image</label>
        <input type="file" accept="image/*" onChange={onCoverChange} />
        <input type="hidden" name="cover_image" value={coverImage} />
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="Cover" className="max-h-40 rounded object-cover" />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3 text-sm">
          <button type="button" onClick={() => setTab("write")} className={tab === "write" ? "font-bold underline" : ""}>
            Write
          </button>
          <button type="button" onClick={() => setTab("preview")} className={tab === "preview" ? "font-bold underline" : ""}>
            Preview
          </button>
          <label className="ml-auto cursor-pointer text-blue-600 hover:underline">
            {uploading ? "Uploading..." : "Insert image"}
            <input type="file" accept="image/*" onChange={onInlineImage} className="hidden" />
          </label>
        </div>

        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={22}
          placeholder="Write in Markdown..."
          className={`w-full rounded border p-3 font-mono text-sm ${tab === "write" ? "" : "hidden"}`}
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
          <select name="status" defaultValue={post?.status ?? "draft"} className="rounded border p-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Publish date (future = scheduled)</label>
          <input
            type="datetime-local"
            name="published_at"
            defaultValue={post?.published_at?.slice(0, 16)}
            className="rounded border p-2"
          />
        </div>
        <button className="ml-auto rounded bg-black px-4 py-2 text-white hover:bg-gray-800 transition">Save</button>
      </div>
    </form>
  );
}
```

### `app/admin/new/page.tsx`
```tsx
import PostForm from "@/components/PostForm";

export default function NewPostPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">New post</h1>
      <PostForm />
    </div>
  );
}
```

### `app/admin/[id]/page.tsx`
```tsx
import { notFound } from "next/navigation";
import PostForm from "@/components/PostForm";
import { createClient } from "@/lib/supabase/server";
import type { Post } from "@/lib/types";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("*").eq("id", id).single();

  if (!data) notFound();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Edit post</h1>
      <PostForm post={data as Post} />
    </div>
  );
}
```
