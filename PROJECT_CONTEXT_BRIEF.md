# The Hearth and Hollow — Project Context Brief

**Updated:** June 16, 2026
**Maintained by:** Hunter Hammond (owner) + Claude (business manager / developer)
**Repo:** `C:\Users\Hammo\hearth-hollow` (GitHub `origin/main`, hosted on Vercel)
**Live domain:** https://thehearthhollow.com

---

## 1. What this is

A web app for **The Hearth and Hollow**, a handyman / carpentry business. Customers submit project requests with photos; the app generates an AI price estimate; the admin reviews/edits and emails the estimate; customers approve or decline via links in the email; and the admin can now view, reply to, and AI-analyze the email conversation per quote. Internal package name is still `handyman-quote-generator` (v0.2.0).

### Core flows
1. **Customer request** → `app/request` → `POST /api/requests` → creates Customer + ProjectRequest, validates and uploads photos to S3, sends a Resend confirmation email.
2. **Admin review** → `app/admin` (password login) → dashboard → `POST /api/admin/quotes/[id]/analyze` runs Claude (optionally with photo vision) → admin edits estimate → `POST /api/admin/quotes/[id]/send` emails it.
3. **Customer decision** → tokenized email buttons hit `GET /api/quotes/[id]/approve|deny?token=…` → updates status → redirects to `app/quote-approval/[id]`.
4. **Email conversation** (new) → on the quote page, the admin sees the Gmail thread, replies (From `support@`), and runs AI analysis that suggests quote adjustments.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Database | PostgreSQL (Neon) via Prisma 5 |
| File storage | AWS S3 (presigned URLs) |
| AI | Anthropic SDK — `claude-haiku-4-5-20251001` (estimates, photo vision, email analysis) |
| Email — outbound | Resend (verified domain; From `support@`, reply-to `quotes@`) |
| Email — inbound/threads | Gmail REST API via OAuth refresh token (reads `hunterhammond@` mailbox, sends as `support@`) |
| Auth | Signed HMAC session cookie (custom) |
| Hosting/DNS | Vercel (nameservers `ns1/ns2.vercel-dns.com`) |

### Data model (Prisma)
`Customer` → `ProjectRequest` (1‑to‑many) → `UploadedAsset` (photos) and `Estimate` (1‑to‑1). Plus `EstimateHistory`, `AdminUser` (defined, currently unused — auth uses `ADMIN_PASSWORD`), and `ThemeSettings`.

---

## 3. Email infrastructure (working)

- **Sending (Resend):** domain verified — `send.thehearthhollow.com` Return-Path MX + SPF (Amazon SES), DKIM at `resend._domainkey`. Estimates/confirmations send From `support@thehearthhollow.com`, reply-to `quotes@`.
- **Receiving (Google Workspace):** root **MX → `smtp.google.com`** and root **SPF `v=spf1 include:_spf.google.com ~all`** (added June 16). Aliases `quotes@`, `support@`, etc. deliver to the `hunterhammond@thehearthhollow.com` mailbox.
- **Admin threads (Gmail API):** OAuth refresh-token integration reads the mailbox and matches the thread to a quote by its reference number. Admin replies are sent in-thread From `support@` (registered as a Gmail "Send mail as" alias).

---

## 4. Key files (current)

- `lib/auth.ts` — signed session cookies + action tokens (approve/deny links).
- `lib/site.ts` — `getBaseUrl()` (custom domain → Vercel URL → localhost).
- `lib/rate-limit.ts` — in-memory limiter for the public form.
- `lib/s3.ts` — uploads, signed URLs, `getObjectBytes` (for vision).
- `lib/claude-analyzer.ts` — estimate analysis with optional `includePhotos` vision.
- `lib/email.ts` — Resend confirmation/estimate emails (tokenized approve/deny links).
- `lib/gmail.ts` — Gmail REST client (fetch-based; find thread, send reply).
- `lib/email-analyzer.ts` — Claude analysis of an email thread → suggested adjustments.
- `app/admin/quotes/[id]/page.tsx` — quote detail: details, photos (+ "Include photos" toggle), estimate editor, and the **Conversation** panel (thread / reply / Analyze emails).
- Admin API under `app/api/admin/quotes/[id]/…`: `analyze`, `send`, `estimate`, `status`, `delete`, `get-signed-url`, plus `emails`, `emails/reply`, `emails/analyze`.

---

## 5. Environment variables (Vercel + local `.env.local`)

`ADMIN_PASSWORD` (strong, set), `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET_NAME`, and Gmail: `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, `GMAIL_USER`, `GMAIL_SEND_AS`.

Note: `AWS_*` and `DATABASE_URL` are blank in the local `.env.local`, so full local `npm run dev` testing of S3/DB needs values; the deployed site is the reliable test environment.

---

## 6. Security status — audit items resolved

- ✅ **Admin auth bypass (was Critical):** replaced the static `admin_session=authenticated` cookie with an HMAC-signed token verified on all admin routes; timing-safe password check; `SESSION_SECRET` set.
- ✅ **Debug endpoints removed:** `test-env`, `test-claude`, `test-claude-call` deleted.
- ✅ **S3 bucket env var:** code reads `AWS_S3_BUCKET_NAME`.
- ✅ **Public upload hardening:** file type/size/count validation + rate limiting; generic error responses.
- ✅ **Prisma logging:** quiet in production.
- ✅ **Approve/deny links:** now require a signed action token (not just email).
- ✅ **Theme route:** `force-dynamic` + null guard.
- ✅ **Strong `ADMIN_PASSWORD`** set; **exposed Resend key** rotated.

---

## 7. Open / nice-to-have items

- [ ] Remove duplicate `AWS_ACCESS_KEY_ID` in Vercel (one entry flagged "Missing AWS Region").
- [ ] Remove unused deps (`next-auth`, `bcryptjs`) or adopt them.
- [ ] `uploadToS3` still returns the key on failure (failed uploads can look successful) — propagate the error.
- [ ] Rate limiter is in-memory per instance; move to Vercel KV/Upstash if spam becomes an issue.
- [ ] Consider an expiry on approve/deny and email action tokens.
- [ ] Optional: run `git add --renormalize .` as its own commit to fully apply the `.gitattributes` LF normalization.
- [ ] Prisma 5 → 7 is a major upgrade available; defer until intentionally tackled.

---

## 8. Build & deploy

- Build gate: `npm run build` must be green before pushing (the sandbox can't reliably typecheck; local build is authoritative).
- Deploy: push to `main` → Vercel auto-deploys. Vercel only promotes successful builds, so a failed build never serves traffic.
- Env-var changes in Vercel require a redeploy to take effect.
