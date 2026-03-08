# 🧮 MentalMath

A mental-math practice platform for kids aged 8–13. Teachers create randomised exercise templates; students practise anywhere — phone, tablet, or laptop.

## Tech stack

| Layer      | Technology               | Why                                               |
|------------|--------------------------|---------------------------------------------------|
| Framework  | Next.js 14 (App Router)  | File-based routing, server components, API routes |
| Language   | TypeScript               | Type safety across frontend + backend             |
| Styling    | Tailwind CSS             | Responsive utility-first CSS                      |
| Database   | Supabase (PostgreSQL)    | Free tier, built-in auth, Row Level Security      |
| Auth       | Supabase Auth            | Email/password, magic links, session management   |
| Hosting    | Vercel (free tier)       | Native Next.js support, global CDN, serverless    |
| Math eval  | mathjs                   | Safe expression evaluation for answer checking    |

---

## Project structure

```
src/
├── app/
│   ├── (auth)/login/          ← Login page
│   ├── (auth)/signup/         ← Signup with role selection
│   ├── auth/callback/         ← Supabase OAuth callback
│   ├── student/
│   │   ├── dashboard/         ← Student home: list exercises
│   │   └── play/[exerciseId]/ ← Exercise player (typed + MCQ)
│   ├── teacher/
│   │   ├── dashboard/         ← Teacher home: stats + classes
│   │   └── exercises/         ← Exercise template manager
│   │       └── new/           ← Create new template
│   └── api/
│       ├── exercises/         ← CRUD for templates
│       ├── sessions/          ← Save + retrieve sessions
│       └── classes/           ← Manage classes; join with code
├── components/
│   ├── ExercisePlayer.tsx     ← Core game UI (intro/play/results)
│   ├── ExerciseEditor.tsx     ← Template builder with live preview
│   └── NavBar.tsx             ← Sticky navigation
└── lib/
    ├── randomizer.ts          ← Randomisation engine (core logic)
    ├── types.ts               ← All shared TypeScript types
    └── supabase/
        ├── client.ts          ← Browser Supabase client
        └── server.ts          ← Server Supabase client (SSR)
supabase/
└── schema.sql                 ← Full database schema + RLS policies
```

---

## Exercise template format

Teachers define templates as JSON. The randomisation engine substitutes variables at runtime.

```json
{
  "title": "Times Tables",
  "question_template": "What is {a} × {b}?",
  "variables": {
    "a": { "type": "integer", "min": 2, "max": 12 },
    "b": { "type": "integer", "min": 2, "max": 12 }
  },
  "answer_expression": "a * b",
  "answer_type": "both",
  "age_groups": ["8-10"],
  "difficulty": "easy",
  "questions_count": 10
}
```

### Variable types

| Type       | Description                              | Example                                           |
|------------|------------------------------------------|---------------------------------------------------|
| `integer`  | Random whole number                      | `{ "type": "integer", "min": 2, "max": 12 }`     |
| `decimal`  | Random decimal with N places             | `{ "type": "decimal", "min": 1, "max": 10, "places": 2 }` |
| `fraction` | Displayed as `n/d`                       | `{ "type": "fraction", "numerator": {...}, "denominator": {...} }` |
| `name`     | Random first name                        | `{ "type": "name" }` or with `"pool": [...]`     |
| `subject`  | Random everyday object                   | `{ "type": "subject" }` or with `"pool": [...]`  |
| `choice`   | Pick from a fixed list                   | `{ "type": "choice", "options": ["10","20","50"] }` |

### Answer expression

Uses [mathjs](https://mathjs.org) syntax. Variables are substituted before evaluation.

```
a * b          → multiplication
a + b - c      → arithmetic
round(p / 100 * n, 2)  → percentage rounded to 2dp
```

---

## Getting started (local development)

### 1. Clone and install

```bash
git clone <your-repo>
cd mentalmath-app
npm install
```

### 2. Create a Supabase project and get your keys

**a) Create the project**
1. Go to [app.supabase.com](https://app.supabase.com) and sign in (GitHub login works)
2. Click **"New project"**, give it a name (e.g. `mentalmath`), set a database password, choose your nearest region
3. Wait ~2 minutes for provisioning

**b) Run the database schema**
1. In the left sidebar click **"SQL Editor"**
2. Click **"New query"**
3. Paste the entire contents of `supabase/schema.sql` from this repo
4. Click **"Run"** — you should see "Success. No rows returned."

**c) Find your three API keys**

In the left sidebar click **⚙️ Project Settings → API**. You'll see:

```
Project URL
  https://xxxxxxxxxxxx.supabase.co          ← NEXT_PUBLIC_SUPABASE_URL

Project API Keys
  anon  public
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…   ← NEXT_PUBLIC_SUPABASE_ANON_KEY

  service_role  secret  ⚠️ never expose publicly
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…   ← SUPABASE_SERVICE_ROLE_KEY
```

| Key | Safe to expose? | Purpose |
|-----|----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes (public) | Identifies your Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes (public) | Used in the browser; Row Level Security limits what it can do |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ No (server only) | Bypasses RLS — only used in server API routes, never in frontend code |

> The `NEXT_PUBLIC_` prefix intentionally bundles those values into the browser.
> **Never** add that prefix to `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your three keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deploying to Vercel (free tier)

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Initial commit"
gh repo create mentalmath-app --public --push
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Vercel auto-detects Next.js — no build config needed
4. Add environment variables (same as `.env.local`) under **Settings → Environment Variables**
5. Click **Deploy** ✅

### 3. Set site URL in Supabase

Go to **Supabase → Authentication → URL Configuration** and set:
- **Site URL**: `https://your-project.vercel.app`
- **Redirect URLs**: `https://your-project.vercel.app/auth/callback`

---

## How it works

### Roles

| Role    | Can do                                                              |
|---------|---------------------------------------------------------------------|
| Teacher | Create classes, create exercises, publish/unpublish, view progress  |
| Student | Join classes with a code, play assigned exercises, see own scores   |

### Class workflow

1. Teacher creates a class → gets a 6-character join code (e.g. `ABC123`)
2. Teacher assigns exercise templates to the class
3. Students sign up as **Student**, enter the join code
4. Students see all published exercises assigned to their classes

### Randomisation flow

```
ExerciseTemplate (stored in DB)
        ↓  generateSession()
GeneratedQuestion[] (randomised at session start, stored as snapshot)
        ↓  student plays
SessionAnswer[] (stored in exercise_sessions table)
        ↓  score calculated
Results shown to student + visible to teacher
```

---

## Extending the app

### Adding a new variable type

1. Add a new type to `VariableDefinition` in `src/lib/types.ts`
2. Handle it in the `resolveVariable()` function in `src/lib/randomizer.ts`
3. Update the variable reference guide in `ExerciseEditor.tsx`

### Uploading templates via JSON file

The `ExerciseEditor` accepts manual JSON input. For bulk upload, you can:
- Create a `/teacher/exercises/import` page
- Accept a `.json` file containing an array of templates
- POST each to `/api/exercises`

### Adding a class management page

Create `src/app/teacher/classes/[id]/page.tsx` with:
- Student list (fetch `class_members` joined with `profiles`)
- Exercise assignment (manage `class_exercises`)
- Per-student score breakdown

---

## Supabase free tier limits

| Resource             | Free limit         |
|----------------------|--------------------|
| Database             | 500 MB             |
| Monthly active users | 50,000             |
| Storage              | 1 GB               |
| Auth emails/month    | 100,000            |
| Bandwidth            | 5 GB               |

Vercel free tier: 100 GB bandwidth, 100 serverless function executions/day.

Both are more than enough for a school deployment.
