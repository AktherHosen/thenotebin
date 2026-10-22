# Phase 2: Database and Storage Setup

## 1. Supabase PostgreSQL Schema & RLS

Execute this SQL script in the Supabase SQL Editor:

```sql
-- 1. Create Posts table
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

-- 2. Index for published posts query performance
create index posts_published_idx on public.posts (status, published_at desc);

-- 3. Enable Row Level Security (RLS)
alter table public.posts enable row level security;

-- 4. Public access policy: only published posts whose publish date is past/now
create policy "Public can read published posts"
  on public.posts for select
  using (status = 'published' and published_at <= now());

-- 5. Authenticated author policy: authors have full CRUD on their own posts
create policy "Authors manage own posts"
  on public.posts for all
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
```

### Scheduling Architecture
A post marked `status = 'published'` with a future `published_at` is hidden from public reads by RLS until that time arrives. No background cron job is needed to change the row status.

---

## 2. Cloudflare R2 Bucket & CORS Configuration

1. **Bucket Creation**: Create bucket `blog-images`.
2. **Public Access**:
   - Custom Domain: `https://cdn.thenotebin.com` (pointed via Cloudflare DNS) OR
   - Development URL: `https://pub-xxxxxxxx.r2.dev` (local development only).
3. **CORS Policy**: In R2 Bucket Settings → CORS Policy:
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://thenotebin.com",
      "https://www.thenotebin.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
4. **API Token**: Create token with **Object Read & Write** permissions scoped specifically to `blog-images`.

---

## 3. Upload Route Handler (`app/api/upload/route.ts`)

Create `app/api/upload/route.ts` to generate presigned S3 URLs after verifying admin authentication:

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
  // Avoid AWS SDK checksum headers that break R2 presigned URLs
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
  // Middleware matcher ignores /api, so authenticate here explicitly
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
