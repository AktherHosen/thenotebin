# thenotebin: Build a Full-Stack Blog Platform with Next.js, Supabase and Cloudflare R2

> **thenotebin** — A bin of useful notes.
> Website: https://thenotebin.com

A step-by-step guide to build it locally first, then deploy to Vercel.

Do the steps in order and test after each one.

**What you'll have at the end**
- Public blog: home page, post pages, SEO (meta tags, sitemap, RSS)
- Private admin dashboard: login, create/edit/delete posts, draft/publish/schedule, image upload
- Supabase for Postgres and auth, Cloudflare R2 for image storage
- Ready to deploy on Vercel

**Prerequisites**
- Node.js 20+ (`node -v`)
- Git
- A free Supabase account (https://supabase.com)
- A code editor (VS Code)

---

## Step 1: Create the Next.js project

```bash
npx create-next-app@latest thenotebin --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*"
cd thenotebin
npm install @supabase/supabase-js @supabase/ssr react-markdown remark-gfm
npm install -D @tailwindcss/typography
npm run dev
```

Open http://localhost:3000. You should see the default Next.js page.

Enable the typography plugin so rendered posts look good.

- **Tailwind v4 (default in new projects):** add this line to `app/globals.css`:
  ```css
  @plugin "@tailwindcss/typography";
  ```
- **Tailwind v3:** add `require("@tailwindcss/typography")` to `plugins` in `tailwind.config.ts`.

---

## Step 2: Create the Supabase project

1. In Supabase, click **New project**. Pick a name, a region close to you, and a strong database password (save it).
2. Wait for it to finish provisioning.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - anon / publishable key
4. Create `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=replace-with-a-long-random-string
```

Supabase has been renaming its keys (anon → publishable). Use whichever key your dashboard shows under the public/client key section. Never put the service role (secret) key in client code.

Confirm `.env.local` is in `.gitignore` (create-next-app does this by default).

---

## Step 3: Create the database tables

In Supabase open **SQL Editor → New query**, paste this, and click **Run**.

```sql
-- Posts table
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text not null default '',
  excerpt text,
  cover_image text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_published_idx on public.posts (status, published_at desc);

-- Row Level Security
alter table public.posts enable row level security;

-- Public can read only published posts whose date has arrived
create policy "Public can read published posts"
  on public.posts for select
  using (status = 'published' and published_at <= now());

-- Logged-in authors can do everything with their own posts
create policy "Authors manage own posts"
  on public.posts for all
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
```

**How scheduling works:** a post with `status = 'published'` and a future `published_at` is hidden by the policy until that time arrives. No cron needed for visibility (Step 13 handles cache refresh).

---

## Step 4: Set up Cloudflare R2 for images

Images go to a Cloudflare R2 bucket. The browser uploads directly to R2 using a short-lived presigned URL that your server creates (only after checking that you're logged in). R2 has a free tier (10 GB storage, no egress fees), though Cloudflare may ask for a payment method to enable it.

### 4a. Create the bucket
1. Log in to the Cloudflare dashboard and open **R2 Object Storage**. Enable R2 if prompted.
2. Click **Create bucket**, name it `blog-images`, and pick a location (Automatic is fine).

### 4b. Make images publicly readable
Choose one:
- **Custom domain (recommended for production):** open the bucket, go to **Settings → Custom Domains → Add**, and enter something like `cdn.thenotebin.com` (the domain must be on Cloudflare DNS). Your public base URL is `https://cdn.thenotebin.com`.
- **r2.dev URL (fine for local testing only):** under **Settings → Public Development URL**, click **Enable**. Your public base URL looks like `https://pub-xxxxxxxx.r2.dev`. It is rate-limited and not meant for production.

### 4c. Add a CORS rule (needed for browser uploads)
In the bucket go to **Settings → CORS Policy → Add** and paste:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://thenotebin.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep `https://thenotebin.com` (add `https://www.thenotebin.com` and your `*.vercel.app` URL if you test there).

### 4d. Create an API token
1. In **R2 Object Storage**, click **Manage API Tokens → Create API token**.
2. Permission: **Object Read & Write**. Scope it to the `blog-images` bucket only.
3. Create it and copy the **Access Key ID** and **Secret Access Key** (the secret is shown only once).
4. Your **Account ID** is shown on the R2 overview page.

### 4e. Add the environment variables
Append to `.env.local`:

```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=blog-images
R2_PUBLIC_URL=https://cdn.thenotebin.com
```

`R2_PUBLIC_URL` has no trailing slash. These are server-only variables (no `NEXT_PUBLIC_` prefix), so they never reach the browser.

### 4f. Install the S3 client libraries
R2 is S3-compatible, so the AWS SDK works:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 4g. Create the upload API route
This route checks you're logged in, validates the file type and size, and returns a presigned upload URL plus the final public URL.

**`app/api/upload/route.ts`**

```ts
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // Newer AWS SDK versions add checksum headers that break R2 presigned URLs
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  // The middleware matcher doesn't cover /api, so check auth here
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentType, size } = await req.json();
  const ext = ALLOWED_TYPES[contentType];

  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 400 });
  }

  const key = `uploads/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: 60 } // seconds
  );

  return NextResponse.json({
    uploadUrl,
    publicUrl: `${process.env.R2_PUBLIC_URL}/${key}`,
  });
}
```

SVG is deliberately not allowed, because SVG files can contain scripts.

> **Alternative:** if you prefer automatic resizing and format conversion, Cloudflare Images is a separate paid product with its own upload API. R2 plus optional Cloudflare image transformations on your custom domain covers most blogs and is cheaper.

---

## Step 5: Create the admin user and turn off public sign-ups

1. **Authentication → Users → Add user → Create new user**. Enter your email and a password. Tick **Auto Confirm User**.
2. **Authentication → Sign In / Providers** (or Settings): turn **off** "Allow new users to sign up" so nobody else can register.

---

## Step 6: Supabase client helpers

Create these files.

**`lib/supabase/client.ts`** (browser)

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**`lib/supabase/server.ts`** (server components, server actions, route handlers)

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
            // Called from a Server Component: safe to ignore because middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

**`lib/supabase/public.ts`** (cookie-free client for public pages, so they can be cached)

```ts
import { createClient } from "@supabase/supabase-js";

export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**`lib/utils.ts`**

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

**`lib/types.ts`**

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

## Step 7: Protect `/admin` with middleware

**`lib/supabase/middleware.ts`**

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

  // Important: getUser() validates the session with Supabase
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

**`middleware.ts`** (project root, next to `app/`)

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

> **Note:** Newer Next.js versions (16+) rename `middleware.ts` to `proxy.ts` and the exported function to `proxy`. If you see a deprecation warning, rename the file and function accordingly. The logic stays the same.

---

## Step 8: Login page

**`app/login/actions.ts`**

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

**`app/login/page.tsx`**

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
        <button className="rounded bg-black p-2 text-white">Sign in</button>
      </form>
    </main>
  );
}
```

**Test:** run `npm run dev`, visit http://localhost:3000/admin. You should be redirected to `/login`. Log in with the user from Step 5. (You'll get a 404 on `/admin` until Step 9.)

---

## Step 9: Admin dashboard (list posts)

**`app/admin/layout.tsx`**

```tsx
import Link from "next/link";
import { logout } from "@/app/login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <Link href="/admin" className="text-xl font-bold">Admin</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" target="_blank">View site</Link>
          <Link href="/admin/new" className="rounded bg-black px-3 py-1.5 text-white">New post</Link>
          <form action={logout}>
            <button className="text-gray-600 underline">Log out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
```

**`app/admin/page.tsx`**

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
      <ul className="divide-y">
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

---

## Step 10: Create / edit posts

### 10a. Server actions

**`app/admin/actions.ts`**

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

### 10b. The form component (with live preview and image upload)

**`components/PostForm.tsx`**

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
      // 1. Ask our server for a presigned R2 upload URL
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not get an upload URL");
      }
      const { uploadUrl, publicUrl } = await res.json();

      // 2. Upload the file straight from the browser to Cloudflare R2
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
        placeholder="Short excerpt for search results and the post list"
        rows={2}
        className="rounded border p-2 text-sm"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Cover image</label>
        <input type="file" accept="image/*" onChange={onCoverChange} />
        <input type="hidden" name="cover_image" value={coverImage} />
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="Cover" className="max-h-40 rounded" />
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
          <label className="ml-auto cursor-pointer text-blue-600">
            {uploading ? "Uploading..." : "Insert image"}
            <input type="file" accept="image/*" onChange={onInlineImage} className="hidden" />
          </label>
        </div>

        {/* Keep the textarea mounted so its value is always submitted */}
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
          <label className="block text-sm font-medium">Publish date (future date = scheduled)</label>
          <input
            type="datetime-local"
            name="published_at"
            defaultValue={post?.published_at?.slice(0, 16)}
            className="rounded border p-2"
          />
        </div>
        <button className="ml-auto rounded bg-black px-4 py-2 text-white">Save</button>
      </div>
    </form>
  );
}
```

> **Timezone note:** `datetime-local` has no timezone. On Vercel the server runs in UTC, so the time you enter is treated as UTC. That's fine for daily posts; just be aware of it when scheduling a specific hour.

### 10c. New and edit pages

**`app/admin/new/page.tsx`**

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

**`app/admin/[id]/page.tsx`**

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

**Test:** create a draft, then a published post, then edit and delete one. Upload a cover image and check that it appears in your R2 bucket under **Objects → uploads/**, and that the image loads from your `R2_PUBLIC_URL`.

---

## Step 11: Public blog pages

**`app/layout.tsx`** (replace the default)

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "thenotebin", template: "%s | thenotebin" },
  description: "A bin of useful notes.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
          <Link href="/" className="text-xl font-bold">thenotebin</Link>
          <a href="/feed.xml" className="text-sm text-gray-500">RSS</a>
        </header>
        {children}
        <footer className="mx-auto max-w-3xl px-4 py-10 text-sm text-gray-500">
          © {new Date().getFullYear()} thenotebin
        </footer>
      </body>
    </html>
  );
}
```

**`app/page.tsx`** (home: list of published posts)

```tsx
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/lib/types";

export const revalidate = 3600; // re-check at most hourly; publishing also revalidates on demand

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
      {posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}
      <ul className="space-y-8">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.slug}`} className="text-2xl font-semibold hover:underline">
              {post.title}
            </Link>
            <p className="text-sm text-gray-500">{formatDate(post.published_at)}</p>
            {post.excerpt && <p className="mt-2 text-gray-700">{post.excerpt}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

**`app/blog/[slug]/page.tsx`** (single post with SEO metadata)

```tsx
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

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4">
      <h1 className="text-4xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-500">{formatDate(post.published_at)}</p>
      {post.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover_image} alt={post.title} className="my-6 w-full rounded" />
      )}
      <article className="prose prose-lg mt-6 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>
    </main>
  );
}
```

**Test:** open http://localhost:3000. Published posts appear. A draft or future-dated post should not appear and its URL should 404.

---

## Step 12: SEO files (sitemap, robots, RSS)

**`app/sitemap.ts`**

```ts
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
    ...(data ?? []).map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      lastModified: p.updated_at,
    })),
  ];
}
```

**`app/robots.ts`**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/login"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

**`app/feed.xml/route.ts`**

```ts
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
      (p) => `<item>
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
```

**Test:** visit `/sitemap.xml`, `/robots.txt`, and `/feed.xml`.

---

## Step 13: Scheduled posts and daily revalidation

Visibility of scheduled posts is already handled by the database policy and the `published_at <= now` filter. Cached pages (`revalidate = 3600`) refresh at most an hour later. To make new scheduled posts appear promptly, add a daily cron on Vercel.

**`app/api/cron/revalidate/route.ts`**

```ts
import { revalidatePath } from "next/cache";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  revalidatePath("/", "layout");
  return Response.json({ ok: true, at: new Date().toISOString() });
}
```

**`vercel.json`** (project root)

```json
{
  "crons": [{ "path": "/api/cron/revalidate", "schedule": "0 6 * * *" }]
}
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set as an environment variable. Test locally with:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/revalidate
```

---

## Step 14: Put it on GitHub

```bash
git init
git add .
git commit -m "Blog platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/thenotebin.git
git push -u origin main
```

Double-check that `.env.local` is **not** in the commit.

---

## Step 15: Deploy to Vercel

1. Go to https://vercel.com, sign in with GitHub, and click **Add New → Project**.
2. Import your repo. Next.js is auto-detected.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (set to your Vercel URL or custom domain, e.g. `https://thenotebin.com`)
   - `CRON_SECRET`
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
4. Click **Deploy**.
5. In Supabase go to **Authentication → URL Configuration** and set **Site URL** to your production URL. Add `http://localhost:3000` to the redirect URLs for local dev.
6. In Cloudflare, add your production domain (and `https://your-project.vercel.app` if you test there) to the bucket's **CORS Policy** from Step 4c.
7. (Optional) **Project → Settings → Domains** to add your custom domain, then update `NEXT_PUBLIC_SITE_URL` and redeploy.

Vercel's Hobby plan is for non-commercial use. Once the blog earns money (ads, affiliates, sponsors), move to the Pro plan.

---

## Step 16: After launch

1. Add your site to **Google Search Console** and submit `/sitemap.xml`.
2. Add privacy-friendly analytics (Plausible, Umami, or Vercel Analytics).
3. Write 3 to 5 posts before announcing the blog.
4. Supabase free projects **pause after about a week of inactivity**. The daily cron touching your pages helps keep traffic flowing, but if downtime would hurt you, upgrade the plan or add a lightweight keep-alive query to the cron route.

---

## Troubleshooting

| Problem | Likely fix |
|---|---|
| Redirect loop on `/login` | Make sure `middleware.ts` is at the project root and the matcher is correct. |
| Posts don't show on the public site | Check `status = 'published'`, that `published_at` is not in the future, and that RLS policies exist. |
| "new row violates row-level security policy" | You're not logged in, or `author_id` doesn't match your user id. |
| Image upload fails with a CORS error | Add your site origin to the R2 bucket's CORS policy (Step 4c) with `PUT` allowed. |
| Upload returns 403 / SignatureDoesNotMatch | Check the R2 keys and account ID, that the token has Object Read & Write on this bucket, and that the checksum settings in `route.ts` are present. |
| Upload works but the image doesn't load | `R2_PUBLIC_URL` is wrong, or public access (custom domain or r2.dev) isn't enabled on the bucket. |
| `/api/upload` returns 401 | You're not logged in, or the session expired. Log in again at `/login`. |
| Slug already exists error | Slugs are unique; change the slug. |
| Works locally, breaks on Vercel | Check that all env vars are set in Vercel and redeploy. |
| `cookies()` should be awaited error | You're on Next.js 15+; use `await cookies()` and `await params` as shown above. |

---

## Ideas for next steps

- Categories and tags (new tables plus a join table)
- Full-text search using Postgres `tsvector`
- Syntax highlighting (`rehype-highlight` or `shiki`)
- Table of contents and reading time
- Newsletter signup (Buttondown or Resend)
- Auto-generated Open Graph images with `next/og`
- Comments (Giscus) and view counters
