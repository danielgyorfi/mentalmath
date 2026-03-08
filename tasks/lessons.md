# MentalMath — Lessons & Patterns

This file captures decisions, bugs, and patterns found during development.
Review it at the start of each session before touching the codebase.

---

## 🔄 Workflow Rules

### WORKFLOW-001 · Always provide git commands after every code change

After every code change, provide the user with the exact git commands to stage,
commit, and push the changes. Use conventional commit message prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `test:` — adding or updating tests
- `docs:` — documentation only
- `chore:` — config, deps, tooling

```bash
# Example pattern to follow
git add <specific files>
git commit -m "type: short description"
git push
```

Never use `git add .` or `git add -A` — always stage specific files to avoid
accidentally committing `.env.local`, build artifacts, or unrelated changes.

---

### DEC-006 · Jest config must be `.js`, not `.ts` — `ts-node` not required

**Context:** `jest.config.ts` caused `Error: 'ts-node' is required for the TypeScript configuration files.`

Jest parses its own config file before the TypeScript transform is set up, so a
`.ts` config requires `ts-node` as an extra dev dependency. Using `jest.config.js`
with `@type {import('jest').Config}` JSDoc gives full type hints with zero extra deps.

```js
// ✅ Use this — jest.config.js (CommonJS, no ts-node needed)
const nextJest = require('next/jest');
/** @type {import('jest').Config} */
const config = { ... };
module.exports = createJestConfig(config);
```

**Rule:** Always use `jest.config.js`, never `jest.config.ts`.

---

### DEC-007 · Supabase `security definer` functions require `set search_path = ''`

**Context:** Signup trigger `handle_new_user()` caused "Database error saving new user"

Two bugs in the original trigger:
1. `'student'` fallback in `coalesce` was an untyped text literal — needs `'student'::public.user_role`
2. Missing `set search_path = ''` — Supabase's security linter rejects `security definer` functions without an explicit search path, causing the trigger to fail at runtime on newer projects

**Rule:** All `security definer` functions must:
- Include `set search_path = ''` in the function signature
- Use fully schema-qualified names everywhere in the body (`public.tablename`, `public.typename`)
- Include an `EXCEPTION WHEN OTHERS THEN` block with a `raise log` so trigger failures never block auth

```sql
-- ✅ Correct pattern
create or replace function public.my_trigger_fn()
returns trigger language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.my_table ...
  return new;
exception when others then
  raise log 'my_trigger_fn failed: %', sqlerrm;
  return new;
end;
$$;
```

---

## 🐛 Bugs Found (document before fixing)

### BUG-001 · `generateChoices` — infinite loop risk for non-numeric answers

**File:** `src/lib/randomizer.ts` · `generateChoices()`
**Severity:** High (infinite loop in browser)
**Status:** Documented — not yet fixed

**What happens:**
```typescript
// ❌ WRONG — `const` means attempts never increments; loop guard is broken
const attempts = 0;
while (choices.size < 4 && attempts < 50) { ... }
```
The condition `attempts < 50` is always `0 < 50 = true`, so the loop only exits
when `choices.size` reaches 4. For numeric correct answers this works fine because
there are always 4 distinct distractors available.

**When it breaks:** If `correct_answer` is a non-numeric string (e.g. `"apple"`),
all distractor candidates fail the `!isNaN(parseFloat(distractor))` guard,
so `choices.size` stays at 1 and the loop runs forever, freezing the browser tab.

**Fix (one line):**
```typescript
// ✅ FIX — change const → let and add increment inside loop
let attempts = 0;
while (choices.size < 4 && attempts < 50) {
  attempts++;          // ← add this
  ...
}
```

**Test documenting this:** `src/__tests__/lib/randomizer.test.ts`
→ `describe('Known limitations')` → `generateChoices loop guard`

---

## ✅ Design Decisions

### DEC-001 · Jest config key: `setupFilesAfterEnv`, not `setupFilesAfterFramework`

**Context:** Setting up jest-dom in `jest.config.ts`
**Rule:** The correct Jest ≥v24 config key is `setupFilesAfterEnv`.
`setupTestFrameworkScriptFile` and `setupFilesAfterFramework` are wrong names that
Jest silently ignores, causing jest-dom matchers to be unavailable in tests.

```typescript
// ❌ Wrong (silently ignored)
setupFilesAfterFramework: ['<rootDir>/jest.setup.ts']

// ✅ Correct
setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
```

---

### DEC-002 · `next/jest` handles SWC transform automatically — don't duplicate it

**Context:** `jest.config.ts` initially included an explicit `transform` block
pointing to `@swc/jest`. This is unnecessary because `nextJest()` / `createJestConfig`
from `next/jest` already configures SWC transforms for `.ts`, `.tsx`, etc.
Adding a manual `transform` block overrides the built-in config and causes errors
if `@swc/jest` is not separately installed.

**Rule:** Keep `jest.config.ts` minimal. Let `next/jest` own the transform config.

---

### DEC-003 · Supabase server client must be created fresh per request

**Context:** `src/lib/supabase/server.ts`
Next.js Server Components cannot share a single Supabase client instance across
requests because `cookies()` is request-scoped.

**Rule:** Always call `createClient()` inside the component or route handler,
never export a singleton from the server client file.

```typescript
// ❌ Wrong — singleton breaks SSR
export const supabase = createClient(); // top-level

// ✅ Correct — fresh client per request
export function createClient() { ... }
// Caller does: const supabase = createClient();
```

---

### DEC-004 · mathjs `evaluate()` for answer expressions — variable substitution order matters

**Context:** `evaluateAnswer()` in `src/lib/randomizer.ts`
Variables are substituted into the expression string with a `\bkey\b` word-boundary
regex before being passed to `mathjs.evaluate()`. This means:

- Variable names must be valid JS identifiers (letters, digits, `_`).
- Variable names that are prefixes of each other (e.g. `a` and `ab`) can collide:
  `\ba\b` will NOT match inside `ab` due to word boundaries, so this is safe.
- Avoid single-letter variable names that are also mathjs constants (`e`, `i`, `pi`).

**Rule:** Use descriptive variable names (`qty`, `price`, `num`, `den`) rather than
single letters where possible. Always run a preview in the ExerciseEditor before
publishing a template.

---

### DEC-005 · Exercise template `answer_expression` uses mathjs syntax, not JS

**Context:** Teacher-facing ExerciseEditor
**Rule:** Document clearly (and in the UI) that the expression uses **mathjs**
syntax, not raw JavaScript. Key differences:
- Powers: `a^2` not `a**2`
- Modulo: `mod(a, b)` not `a % b`
- Rounding: `round(x, 2)` for 2 decimal places

---

## 🔧 Architecture Patterns

### ARCH-001 · Client vs Server components — where auth lives

All data fetching that requires the authenticated user must happen in **Server
Components** or **API routes** (using `createClient()` from `server.ts`).
Never fetch user data in Client Components; pass it as props from the parent
Server Component.

**Why:** The server client reads cookies server-side, which is secure and avoids
extra round-trips. The browser client is only for interactive actions (sign in/out,
submitting forms, saving sessions client-side).

---

### ARCH-002 · RLS is the security layer — always test with a non-owner account

Supabase Row Level Security policies are the authoritative access control.
Every policy in `supabase/schema.sql` should be verified by:
1. Logging in as the correct role and confirming access works
2. Logging in as a different user and confirming access is denied

**Anti-pattern to avoid:** Relying on application-layer checks alone (e.g. checking
`teacher_id === user.id` in a Server Component) while forgetting that the API route
also needs the ownership check. The `.eq('teacher_id', user.id)` filter in API
routes provides a defence-in-depth layer above RLS.

---

### ARCH-003 · `generateSession` snapshots questions at session start

When a student starts playing, `generateSession(template)` creates the full set of
questions and stores them in `exercise_sessions.questions` (a JSONB column). This
means:
- The template can change mid-session without affecting the student's current game.
- Results are always reviewable (we have the exact questions that were asked).
- Server re-generation of questions is NOT needed — all logic runs client-side
  in `ExercisePlayer.tsx`.

---

## 📋 Task History

| Date       | Task                                | Status    |
|------------|-------------------------------------|-----------|
| 2026-03-08 | Initial project scaffold            | ✅ Done   |
| 2026-03-08 | Randomisation engine                | ✅ Done   |
| 2026-03-08 | Auth (login/signup/middleware)      | ✅ Done   |
| 2026-03-08 | Student dashboard + ExercisePlayer  | ✅ Done   |
| 2026-03-08 | Teacher dashboard + ExerciseEditor  | ✅ Done   |
| 2026-03-08 | API routes (exercises/sessions/classes) | ✅ Done |
| 2026-03-08 | Unit tests (Jest + randomizer suite)| ✅ Done   |
| 2026-03-08 | tasks/lessons.md learning file      | ✅ Done   |

---

## 🔮 Upcoming / Known Tech Debt

- [ ] **BUG-001** Fix `const attempts` → `let attempts` in `generateChoices`
- [ ] Add `/teacher/classes/[id]` page (student list + exercise assignment)
- [ ] Add `/student/join` page (enter class code)
- [ ] Add progress chart to teacher dashboard (per-student, per-template)
- [ ] Add email notification when a student completes an exercise
- [ ] Consider adding Playwright E2E tests for the play loop
- [ ] Evaluate caching strategy for exercise templates (React cache / unstable_cache)
