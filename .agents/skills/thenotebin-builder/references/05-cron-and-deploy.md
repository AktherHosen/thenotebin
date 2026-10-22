# Phase 5: Cron Revalidation, Deployment & Verification

## 1. Scheduled Revalidation API & Vercel Cron

### `app/api/cron/revalidate/route.ts`
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

### `vercel.json` (Project Root)
```json
{
  "crons": [
    {
      "path": "/api/cron/revalidate",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Local curl test:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/revalidate
```

---

## 2. Git & Version Control

Ensure `.env.local` is ignored in `.gitignore`:
```bash
git init
git add .
git commit -m "feat: complete thenotebin blog platform"
git branch -M main
```

---

## 3. Vercel Deployment & Production Environment

1. Import project into Vercel.
2. Set Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://thenotebin.com` or `https://thenotebin.vercel.app`)
   - `CRON_SECRET`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_URL`
3. Supabase Auth Configuration:
   - In Supabase Dashboard → Authentication → URL Configuration:
     - Set Site URL to production URL.
     - Add `http://localhost:3000` to Redirect URLs.
4. Cloudflare R2 CORS:
   - Update CORS AllowedOrigins with the production domain and Vercel preview domain.

---

## 4. End-to-End Verification Matrix

| Test Scenario | Action | Expected Result |
| :--- | :--- | :--- |
| **Admin Route Protection** | Open `/admin` while unauthenticated | 307 Redirect to `/login` |
| **Authentication** | Sign in with admin credentials | Redirect to `/admin` dashboard |
| **Post Creation (Draft)** | Create post with status `draft` | Post appears in admin dashboard with "Draft" badge; returns 404 at `/blog/[slug]` |
| **Post Creation (Published)**| Create post with status `published` | Appears immediately on `/` home and `/blog/[slug]` |
| **Scheduled Post** | Create published post with future `published_at` | Hidden from public home and returns 404 until scheduled timestamp passes |
| **R2 Image Upload** | Upload cover image or inline image in editor | Generates presigned URL, saves directly to Cloudflare R2, image renders in preview |
| **Markdown Rendering** | Input tables, code blocks, bold/italic | Renders cleanly using Tailwind Typography prose classes |
| **SEO Feeds** | Fetch `/sitemap.xml`, `/robots.txt`, `/feed.xml` | Returns valid XML / text containing published posts only |
| **Cron Revalidation** | Send GET request with `CRON_SECRET` header | Returns 200 `{ ok: true }` and revalidates cache |

---

## 5. Troubleshooting Guide

| Problem | Root Cause | Solution |
| :--- | :--- | :--- |
| **Infinite redirect on `/login`** | Middleware matcher triggers on static files or loops | Ensure `middleware.ts` is in project root and matcher is strictly `["/admin/:path*", "/login"]`. |
| **Posts missing from public site** | Post status is draft, date is in future, or RLS missing | Verify post has `status = 'published'`, `published_at <= now()`, and RLS policies are applied. |
| **"new row violates row-level security policy"** | User unauthenticated or author_id mismatch | Verify user is authenticated; ensure `author_id` is set to `user.id`. |
| **R2 Upload fails with CORS error** | Origin not in R2 CORS rules | Add `http://localhost:3000` or production domain to R2 bucket CORS settings with `PUT` method. |
| **Upload returns 403 / SignatureDoesNotMatch** | Bad R2 API token or AWS SDK checksum headers | Verify API credentials and ensure `requestChecksumCalculation: "WHEN_REQUIRED"` is configured in `S3Client`. |
| **Uploaded image does not display** | Invalid `R2_PUBLIC_URL` | Ensure custom domain or development URL is enabled on bucket and has no trailing slash. |
| **Next.js `cookies()` or `params` error** | Unawaited asynchronous Next.js 15+ APIs | Check that `await cookies()` and `const { slug } = await params` are used. |
