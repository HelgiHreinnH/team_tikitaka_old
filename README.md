# Tiki Taka

Minimalist football team management web app for weekly attendance.

## Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (DB, auth, real-time)
- TanStack Query

## Getting Started

```sh
git clone <YOUR_GIT_URL>
cd team_tikitaka
npm i
cp .env.example .env # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Scripts

- dev: Start dev server
- build: Production build
- preview: Preview production build
- lint: Lint codebase

## Environment

Create `.env` with:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Project Goals

- Weekly invites emailed Tuesdays 10:30
- Users respond YES/NO/MAYBE via token link
- Public real-time attendance page
