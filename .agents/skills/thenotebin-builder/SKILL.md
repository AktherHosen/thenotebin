---
name: thenotebin-builder
description: >-
  Step-by-step orchestrator and runbook for building the thenotebin full-stack blog platform
  (Next.js 15+, Supabase Postgres/Auth, Cloudflare R2 storage, Tailwind CSS, Vercel deployment).
  Use this skill whenever building, scaffold testing, verifying, or maintaining the thenotebin blog platform.
---

# thenotebin: Step-by-Step Build Skill

This skill guides an AI agent through building, configuring, and verifying the **thenotebin** blog platform systematically. Follow each phase in sequential order. Do not skip verification steps.

## Architecture Overview

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 15+ (App Router, React 19) | Frontend, SSR, Server Actions, Route Handlers |
| **Styling** | Tailwind CSS v4 + `@tailwindcss/typography` | Modern responsive styling & prose formatting |
| **Database & Auth** | Supabase (PostgreSQL + Auth + RLS) | Relational data, user sessions, security policies |
| **Media Storage** | Cloudflare R2 (S3-compatible) | Fast edge image hosting via direct presigned uploads |
| **Rendering Strategy**| ISR (`revalidate = 3600`) + On-demand revalidation | High performance, static caching with instant refresh |
| **Deployment** | Vercel | Production hosting & scheduled cron trigger |

---

## Phased Build Checklist

Execute each phase and verify before proceeding:

- [ ] **Phase 1: Project Initialization & Dependencies**
  - Scaffold Next.js in workspace root (avoid nested folder issues).
  - Install dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `react-markdown`, `remark-gfm`, `@tailwindcss/typography`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
  - Configure Tailwind typography and `.env.local`.
  - Detailed Guide: [01-setup-and-deps.md](./references/01-setup-and-deps.md)

- [ ] **Phase 2: Database Schema & Storage Setup**
  - Execute PostgreSQL DDL for `public.posts` table, indexes, and RLS policies.
  - Setup Cloudflare R2 bucket, CORS policy, and API token.
  - Create presigned upload route (`app/api/upload/route.ts`).
  - Detailed Guide: [02-database-and-storage.md](./references/02-database-and-storage.md)

- [ ] **Phase 3: Supabase Clients, Middleware & Admin Dashboard**
  - Implement client helpers (`client.ts`, `server.ts`, `public.ts`, `utils.ts`, `types.ts`).
  - Implement Next.js 15 session middleware (`lib/supabase/middleware.ts` & `middleware.ts`).
  - Implement Login page & server actions (`app/login/actions.ts`, `app/login/page.tsx`).
  - Implement Admin Layout, Post listing, and CRUD actions (`app/admin/actions.ts`, `components/PostForm.tsx`, `app/admin/new/page.tsx`, `app/admin/[id]/page.tsx`).
  - Detailed Guide: [03-auth-and-admin.md](./references/03-auth-and-admin.md)

- [ ] **Phase 4: Public Blog Pages & SEO Engine**
  - Setup Root Layout with RSS link (`app/layout.tsx`).
  - Setup Home Page with published query and caching (`app/page.tsx`).
  - Setup Post Details with markdown renderer and dynamic metadata (`app/blog/[slug]/page.tsx`).
  - Setup dynamic Sitemap (`app/sitemap.ts`), Robots (`app/robots.ts`), and RSS feed (`app/feed.xml/route.ts`).
  - Detailed Guide: [04-public-and-seo.md](./references/04-public-and-seo.md)

- [ ] **Phase 5: Cron Revalidation, Vercel Deployment & Verification**
  - Implement secret-protected revalidation route (`app/api/cron/revalidate/route.ts`).
  - Create `vercel.json` cron schedule.
  - Run full test checklist (Draft isolation, Scheduled posts, Presigned uploads, SEO feeds).
  - Detailed Guide: [05-cron-and-deploy.md](./references/05-cron-and-deploy.md)

---

## Critical Rules & Pitfalls for the Agent

1. **Next.js 15 Asynchronous APIs**:
   - `cookies()` from `next/headers` must be awaited: `const cookieStore = await cookies();`.
   - Route `params` and `searchParams` in server components are Promises: `const { slug } = await params;`.
2. **Directory Structure Caution**:
   - When running `create-next-app`, initialize inside the target root directly (`./`) or move files so that `package.json` is at the workspace root, not nested inside `thenotebin/thenotebin/`.
3. **No SVG Image Uploads**:
   - SVG files can execute JavaScript; the upload handler intentionally restricts MIME types to `jpeg`, `png`, `webp`, `gif`, and `avif`.
4. **Public Client Cookie Independence**:
   - The public visitor client (`lib/supabase/public.ts`) uses standard `@supabase/supabase-js` without cookies so pages can be statically cached and revalidated by Next.js ISR.
5. **Presigned URL Checksum Compatibility**:
   - Newer `@aws-sdk/client-s3` versions automatically attach checksum headers that fail on Cloudflare R2 unless configured with `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"`.
