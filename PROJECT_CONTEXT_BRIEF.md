# The Hearth and Hollow — Project Context Brief

**Prepared:** June 16, 2026
**Maintained by:** Hunter Hammond (owner) + Claude (business manager / developer)
**Repo:** `C:\Users\Hammo\hearth-hollow` (GitHub `origin/main`, hosted on Vercel)
**Live domain:** https://thehearthhollow.com

---

## 1. What this is

A web app for **The Hearth and Hollow**, a handyman / carpentry business. Customers submit project requests with photos; the app stores them, uses Claude to generate a price estimate, and the admin reviews/sends estimates by email. Customers approve or decline via links in the email.

The internal package name is still `handyman-quote-generator` (v0.2.0).

### Core user flows
1. **Customer request** → `app/request` → `POST /api/requests` → creates Customer + ProjectRequest, uploads photos to S3, sends a confirmation email (Resend).
2. **Admin review** → `app/admin` (password login) → dashboard lists quotes → `POST /api/admin/quotes/[id]/analyze` runs Claude → admin edits estimate → `POST /api/admin/quotes/[id]/send` emails the estimate.
3. **Customer decision** → email buttons hit `GET /api/quotes/[id]/approve|deny?email=…` → updates status → redirects to `app/quote-approval/[id]`.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Database | PostgreSQL (Neon) via Prisma 5 |
| File storage | AWS S3 (presigned URLs) |
| AI | Anthropic SDK — `claude-haiku-4-5-20251001` for estimates |
| Email | Resend (sending), Google Workspace (receiving) |
| Auth | Custom cookie-based admin login (see findings) |
| Hosting/DNS | Vercel (nameservers `ns1/ns2.vercel-dns.com`) |

### Data model (Prisma)
`Customer` → `ProjectRequest` (1‑to‑many) → `UploadedAsset` (photos) and `Estimate` (1‑to‑1). Plus `EstimateHistory`, `AdminUser` (defined but unused — see findings), and `ThemeSettings` (admin-customizable colors/branding).

---

## 3. Email setup (current, working)

- **Sending:** Resend, fully verified. `send.thehearthhollow.com` has the Return-Path MX + SPF (Amazon SES); DKIM at `resend._domainkey`. From = `support@thehearthhollow.com`, reply-to = `quotes@thehearthhollow.com`.
- **Receiving:** Google Workspace. Root **MX → `smtp.google.com` (priority 1)** and root **SPF `v=spf1 include:_spf.google.com ~all`** were added June 16, which fixed customer replies bouncing. Aliases `quotes@`, `support@`, etc. deliver to the `hunterhammond@thehearthhollow.com` mailbox.
- **To do (optional):** enable Google DKIM in the Workspace Admin console for full auth on mail you send from the mailbox.

---

## 4. Audit findings — prioritized

### 🔴 CRITICAL

**C1. Admin authentication is trivially bypassable.**
Every admin route authorizes by checking a **static cookie value**: `admin_session === 'authenticated'` (and several routes accept *any* non-empty value). The cookie isn't a secret — anyone can set `admin_session=authenticated` in their browser/curl and gain full admin access: read all customer PII, delete quotes, send emails, mint S3 signed URLs. The login password is effectively decorative.
- Routes using `=== 'authenticated'`: `admin/quotes`, `admin/quotes/[id]`, `.../analyze`, `.../send`, `.../get-signed-url`, `assets/[id]/signed-url`.
- Routes that only check the cookie *exists* (even weaker): `bulk-actions/delete`, `bulk-actions/move`, `quotes/[id]/delete`, `.../estimate`, `.../status`, `admin/theme`.
- **Fix:** issue a signed session token at login (JWT signed with a `SESSION_SECRET`, or a random token stored in the DB) and verify it on every request via shared middleware. The schema already has an `AdminUser` model with a bcrypt `password` field that was never wired up — the intended design exists but isn't used. Recommend a Next.js `middleware.ts` that protects `/admin` and `/api/admin/*` centrally.

### 🟠 HIGH

**H1. Public debug endpoints leak info and allow cost abuse.** Remove before anything else ships:
- `GET /api/test-env` — reports which secrets are set and echoes `AWS_S3_BUCKET`/`AWS_REGION` values.
- `GET /api/test-claude` — exposes the **ANTHROPIC_API_KEY length and first 10 characters** and lists API-related env keys.
- `POST /api/test-claude-call` — lets **anyone** trigger Claude calls on your key (unbounded cost/abuse).
- **Fix:** delete all three route files.

**H2. S3 bucket env var name mismatch.** Code (`lib/s3.ts`, and `test-env`) reads `process.env.AWS_S3_BUCKET`, but Vercel only defines `AWS_S3_BUCKET_NAME`. So the configured value is never used — the code silently falls back to the hardcoded bucket `'hearth-and-hollow-quotes'`. It "works" only if that hardcoded name happens to match the real bucket.
- **Fix:** change the code to read `AWS_S3_BUCKET_NAME` (and drop the hardcoded fallback, or keep it explicit). Also reconcile the default region: `lib/s3.ts` defaults to `us-east-2` while `test-env` text says `us-east-1`.

**H3. No validation on public file uploads.** `POST /api/requests` accepts any number of files, any type, any size, and uploads them straight to S3. No rate limiting on submissions either.
- **Fix:** validate MIME type (images/PDF only), cap file size and count, and add basic rate limiting / a captcha on the public form.

### 🟡 MEDIUM

**M1. Failed S3 uploads look successful.** `uploadToS3` catches errors and still returns the key, so the DB records assets that may not exist in S3. **Fix:** propagate the error (the caller already tolerates per-file failures) so bad uploads aren't recorded.

**M2. Prisma logs every query in production** (`log: ["query"]` in `lib/prisma.ts`) — noisy and can write customer PII into Vercel logs. **Fix:** `log: ["error", "warn"]` (or query logging only in dev).

**M3. Approve/Decline links are weakly protected.** `GET /api/quotes/[id]/approve` authorizes on `id` + `email` only — both are knowable. And because it's a `GET` that mutates state, email-client link prefetching could auto-approve/deny. **Fix:** use a signed, single-use token in the link; perform the mutation on `POST` (or via a confirm click on the landing page).

**M4. Weak admin password + hardcoded fallback.** `ADMIN_PASSWORD` falls back to `'admin123'` in code; the configured value (`adminpass`) is weak. **Fix:** require a strong secret, remove the fallback, fail closed if unset.

**M5. Verify `RESEND_API_KEY` and `DATABASE_URL` in Production.** In the Vercel dashboard, `RESEND_API_KEY` doesn't appear in the current project variable list (it is present in the CLI-pulled local env), and `DATABASE_URL` appeared scoped to Preview/master. Email and DB both work today, so confirm both are set for the **Production** environment specifically.

### 🟢 LOW / cleanup

- **L1. Duplicate `AWS_ACCESS_KEY_ID`** in Vercel — two entries, one flagged "Missing AWS Region" (Development). Consolidate.
- **L2. `app/api/quotes/[id]/approve` & `deny` still build `baseUrl` from `VERCEL_URL`** — should use the new `NEXT_PUBLIC_SITE_URL` for consistency with `lib/email.ts`.
- **L3. Error responses echo internals** (e.g. `/api/requests` returns `details: String(error)`). Return generic messages to clients; log details server-side.
- **L4. Unused dependencies / models** — `next-auth` and `bcryptjs` are installed but unused; `AdminUser` model is unused. Either adopt them (recommended for C1) or remove.
- **L5. Repo hygiene** — repo has CRLF line endings causing every file to show as "modified" in git; lots of root-level `*.md` deployment notes; a `master` branch lingers alongside `main`. Consider a `.gitattributes` (`* text=auto eol=lf`) and pruning stale docs/branches.

---

## 5. Recommended fix order

1. **Delete the three `test-*` endpoints** (H1) — fastest risk reduction.
2. **Fix admin auth** (C1) — signed token + `middleware.ts`; set a strong `ADMIN_PASSWORD`/`SESSION_SECRET` (M4).
3. **Fix S3 env var name** (H2) and verify Production env vars (M5).
4. **Add upload validation + rate limiting** (H3).
5. Medium/low cleanup (M1–M3, L1–L5) as follow-ups.

None of these block the email reply fix, which is already live.

---

## 6. Security reminders

- Rotate the **Resend API key** that was exposed in plaintext in the earlier shared chat (the live `.env.local` already shows a different key, so this may be done — confirm the old one is revoked).
- `.env.local` is correctly gitignored; it contains live secrets (Anthropic key, Neon DB URL, Resend key, Vercel OIDC token) — never commit or paste it.

---

## 7. Open action items

- [ ] Push the committed `lib/email.ts` change (NEXT_PUBLIC_SITE_URL links) to deploy.
- [ ] C1: replace static-cookie admin auth with signed tokens + middleware.
- [ ] H1: delete `test-env`, `test-claude`, `test-claude-call` routes.
- [ ] H2: read `AWS_S3_BUCKET_NAME` in `lib/s3.ts`; reconcile region default.
- [ ] H3: validate/limit public uploads.
- [ ] M5: confirm `RESEND_API_KEY` + `DATABASE_URL` set for Production.
- [ ] Cleanup: M1–M3, L1–L5.
- [ ] Confirm exposed Resend key is rotated; enable Google DKIM.
