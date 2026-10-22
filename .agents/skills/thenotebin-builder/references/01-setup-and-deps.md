# Phase 1: Setup and Dependencies

## 1. Project Initialization

Ensure files are scaffolded directly into the project root rather than creating a nested folder.

If the current directory `.` is empty (apart from `blog-platform-build-guide.md` and `.agents/`):
```bash
npx create-next-app@latest ./ --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --use-npm --yes
```

> **Warning:** If running `create-next-app` complains about existing files, scaffold into a temporary subfolder `npx create-next-app@latest temp-app ...` and copy its contents to the root, then remove `temp-app`.

## 2. Dependencies Installation

Install the required production and development dependencies:

```bash
npm install @supabase/supabase-js @supabase/ssr react-markdown remark-gfm @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D @tailwindcss/typography
```

## 3. Tailwind Configuration

Depending on the Tailwind version installed:

### Tailwind v4 (Default in Next.js 15+):
Add the typography plugin directive directly inside `app/globals.css`:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

### Tailwind v3 (If legacy tailwind.config.ts is generated):
Add to `tailwind.config.ts`:
```ts
plugins: [require("@tailwindcss/typography")],
```

## 4. Environment Variables (`.env.local`)

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Cron Secret for Vercel Cron revalidations
CRON_SECRET=replace-with-a-long-random-string

# Cloudflare R2 (Server-only credentials)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=blog-images
R2_PUBLIC_URL=https://cdn.thenotebin.com
```

Also create a `.env.example` file (with placeholders) for version control.

## 5. Verification
Run `npm run dev` and confirm http://localhost:3000 loads without compilation errors.
