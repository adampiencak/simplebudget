# Budget

A minimal personal budgeting PWA with Supabase email auth. Mobile-first, installable to home screen, syncs across devices.

## Features

- Email login (magic link — no passwords)
- Track income and expenses for any month
- Auto-log salary on a configurable pay day (default: 10th)
- Per-user data stored in Supabase Postgres with Row Level Security
- Installable as a PWA on iOS / Android / desktop

## Stack

- Next.js 15 (App Router) + React 19
- Tailwind CSS
- Supabase (Auth + Postgres)

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. In **Authentication → Providers**, make sure **Email** is enabled (it is by default). Magic links work out of the box.
4. Copy your **Project URL** and **anon key** from **Project Settings → API**.

### 2. Local development

```bash
cp .env.local.example .env.local
# paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open http://localhost:3000 → enter your email → click the link in your inbox.

### 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. In Supabase **Authentication → URL Configuration**, set:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: add `https://your-app.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback` for local dev).

That's it.

## Schema

- `public.transactions(id, user_id, kind, amount, note, date, created_at)`
- `public.settings(user_id, salary, currency, pay_day, auto_salary, last_auto_salary_ym)`

Both tables have RLS policies so each user only sees their own rows.
