# CLAUDE.md — The Hearth and Hollow

Operating guide for Claude Cowork sessions working on this project. Read this first, then `session_log.md` for history and current state.

---

## What this is
A web app for **The Hearth and Hollow**, a handyman/carpentry business (`thehearthhollow.com`). Customers submit project requests with photos → AI generates a price estimate → admin reviews/edits and emails it → customer approves/declines via email → customer pays a deposit (Stripe) → customer self-schedules a date → admin manages the calendar and email threads. Customers can also submit quotes by phone via a Retell AI voice agent.

Internal package name is still `handyman-quote-generator` (v0.2.0).

## Tech stack
- **Next.js 14** (App Router), React 18, TypeScript (strict)
- **Tailwind CSS** — the public/admin pages use a **theme class system** (`bg-brand`, `bg-themeBg`, `text-themeMuted`, `border-themeBorder`, `bg-accent`, etc.) driven by `ThemeSettings`. Keep using these classes, not hardcoded colors, on customer-facing pages.
- **PostgreSQL (Neon)** via **Prisma 5**
- **AWS S3** for file storage (presigned URLs)
- **Anthropic SDK** — model `claude-haiku-4-5-20251001` (estimates, photo vision, email-thread analysis)
- **Resend** for outbound email; **Gmail API** (OAuth refresh token) for reading/replying to threads; **Google Calendar API** for booking events; native **Web Push** (VAPID via the `web-push` lib) for admin push; **Stripe** for deposit payments; **Retell** for AI phone-agent quote intake
- Hosted on **Vercel**, DNS on Vercel nameservers

## Key files
- `lib/auth.ts` — HMAC-signed admin session cookie + signed action tokens (approve/deny/schedule links): `verifySessionToken`, `createActionToken`, `verifyActionToken`.
- `lib/prisma.ts`, `lib/s3.ts` (uploads, signed URLs, `getObjectBytes`), `lib/site.ts` (`getBaseUrl`), `lib/rate-limit.ts`
- `lib/email.ts` — Resend confirmation / estimate / booking-confirmation / deposit-request emails
- `lib/gmail.ts` — Gmail REST over fetch (find thread by reference #, send reply as `support@`)
- `lib/email-analyzer.ts` — Claude analysis of an email thread → suggested quote adjustments
- `lib/claude-analyzer.ts` — estimate analysis, optional photo vision (`includePhotos`)
- `lib/availability.ts` — bookable-date logic + date helpers (noon-UTC convention)
- `lib/image.ts` — HEIC→JPEG conversion (`heic-convert`, pure JS)
- `lib/push.ts` — native Web Push sender (`sendAdminPush`) via the `web-push` lib + VAPID; sends to every row in the `PushSubscription` table and prunes 404/410. Replaced OneSignal, which stored subscriptions without the p256dh/auth encryption keys so its sends were undeliverable on every device. Subscriptions saved by `app/api/admin/push/subscribe`; client subscribes via `app/admin/hooks/usePushSubscription.ts` + `public/push-sw.js`.
- `lib/notifications.ts` — `createNotification()`: single entry point for admin notifications. Writes a `Notification` row (in-app bell feed) AND calls `sendAdminPush` (best-effort, never throws). All trigger sites should call this, not `lib/push.ts` directly.
- `prisma/schema.prisma` — models: Customer, ProjectRequest (has `scheduledDate/scheduledSlot/scheduledAt`), UploadedAsset, Estimate (has `depositAmount/depositPaid/depositStripeSessionId` for Stripe deposit tracking), EstimateHistory, Invoice, AdminUser (unused), ThemeSettings (incl. `heroImageUrl`/`craftImageUrl`/`gatheringImageUrl`/`homesteadImageUrl` homepage image fields, and `appIconUrl` -- the configurable app icon driving the PWA install icon, push-notification icon, and browser favicon), AvailabilitySettings, BlockedDate, OpenDate, Notification (type/title/message/url/viewedAt -- backs the admin bell), PushSubscription (endpoint/p256dh/auth/userAgent -- native web-push device records, table `push_subscriptions`)
- Admin UI: `app/admin/dashboard`, `app/admin/quotes/[id]` (details, photos + "Include photos", estimate editor with **Deposit** section, **Appointment** reschedule card, **Conversation** email panel, **Invoice** section), `app/admin/availability` (weekday defaults + month calendar with day-detail modal), `app/admin/theme` (colors/fonts/branding + **Homepage Images** card + **App Icon** card). `app/admin/layout.tsx` globally mounts `NotificationBell` (bell + unread badge + dropdown, polls `/api/admin/notifications` every 30s) and `PushOptIn` (push opt-in button) on every `/admin/*` page.
- Public UI: `app/page.tsx` (homepage — hero + 3 image sections, images from `ThemeSettings` via `/api/theme`), `app/request` (quote form), `app/confirmation/[id]`, `app/quote-approval/[id]` (approve/deny + deposit payment link), `app/schedule/[id]` (post-deposit date picker)
- API under `app/api/...`: `requests`, `admin/quotes/[id]/{analyze,send,estimate,status,delete,get-signed-url,emails,emails/reply,emails/analyze,schedule,invoice,invoice/pdf,invoice/send}`, `admin/availability{,/block,/open}`, `admin/theme`, `admin/notifications` (GET recent + unread count, POST mark-read by id or all), `admin/push/{subscribe,unsubscribe}`, `quotes/[id]/{approve,deny,deposit-checkout}` (deposit-checkout creates a Stripe Checkout session), `schedule/[id]/{availability,book}`, `voice/quote` (Retell phone-agent JSON intake, authenticated via `RETELL_WEBHOOK_SECRET` bearer token), `webhooks/stripe` (Stripe webhook: marks deposit paid + sends scheduling link), `site.webmanifest` (dynamic PWA manifest), `app-icon` (307 redirect to current icon URL), `theme`

## Environment variables (Vercel + local `.env.local`)
`ADMIN_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (support@), `NEXT_PUBLIC_SITE_URL` (https://thehearthhollow.com), `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET_NAME`, and Gmail/Calendar: `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` / `GMAIL_OAUTH_REFRESH_TOKEN` / `GMAIL_USER` (hunterhammond@) / `GMAIL_SEND_AS` (support@). Optional: `BOOKING_TIMEZONE` (default America/New_York), `BOOKING_CALENDAR_ID` (default primary). Push (native Web Push): `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:support@) -- set via Vercel dashboard or REST API, NOT via PowerShell-piped `vercel env add` (BOM corruption risk). Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Retell voice agent: `RETELL_WEBHOOK_SECRET`.
- **Local note:** `AWS_*` and `DATABASE_URL` are blank in `.env.local`, so `npm run dev` has no DB/S3 — **the deployed site is the real test environment.**
- `.env.local` is gitignored. Never commit or paste secrets.

## Email / domain facts
- Sending (Resend): domain verified; From `support@`, reply-to `quotes@`.
- Receiving (Google Workspace): root MX → `smtp.google.com`; aliases (`support@`, `quotes@`) deliver to the `hunterhammond@thehearthhollow.com` mailbox.
- Admin replies send as `support@` — requires `support@` to be a Gmail "Send mail as" address (it is).
- **Google OAuth refresh token must include ALL needed scopes when re-minted:** `gmail.readonly gmail.send calendar.events`. Re-minting with a subset silently breaks the others.

## Deploy workflow (IMPORTANT)
1. **Always run `npm run build` locally and confirm it's green BEFORE pushing.** (Vercel only promotes successful builds, but build first anyway.)
2. If `prisma/schema.prisma` changed, run a DB push first (Prisma reads `.env`, not `.env.local`, so feed it the URL):
   ```powershell
   cd "C:\Users\Hammo\Claude\Projects\The Hearth and Hollow\repo"
   $env:DATABASE_URL = (Select-String -Path .env.local -Pattern '^DATABASE_URL_UNPOOLED=(.+)$').Matches.Groups[1].Value.Trim('"')
   npx prisma db push
   ```
3. `git add <paths>` → `git commit -m "..."` → `git push`. Vercel auto-deploys `main`.
4. Env-var changes in Vercel require a **redeploy** to take effect.
5. New npm dependency → run `npm install` locally before building; Vercel installs automatically on deploy.

## Conventions & gotchas
- **Dates:** a calendar day is represented at **noon UTC**, keyed `YYYY-MM-DD`, to avoid timezone day-shift. Use helpers in `lib/availability.ts` / page-local `dateFromKey`.
- **Scheduling:** one job per day. Bookable = (normal working weekday OR one-off `OpenDate`) AND not `BlockedDate` AND not already booked AND within the booking window. Admin reschedule (quote page) overrides availability but still blocks double-booking.
- **Auth:** all `/api/admin/*` routes verify the signed cookie via `verifySessionToken`. Approve/deny/schedule links use signed action tokens. Admin GET routes that read cookies set `export const dynamic = 'force-dynamic'` to silence build-time prerender noise.
- **HEIC:** uploads accepted by extension fallback and auto-converted to JPEG server-side (fallback to original on failure). Browsers can't render raw HEIC and Claude vision only takes JPG/PNG/GIF/WebP — conversion fixes both.
- **VAPID env vars:** set via the Vercel dashboard or REST API. Do NOT use PowerShell-piped `vercel env add` — it prepends a UTF-8 BOM (U+FEFF) that breaks `atob()` on the client. If push subscriptions fail with "characters outside Latin1 range", the env vars are corrupted.
- **Line endings:** `.gitattributes` enforces LF. A one-time `git add --renormalize .` is still outstanding (optional).
- **Assistant sandbox caveat:** the Cowork sandbox sometimes serves truncated copies of just-edited files, so in-sandbox `tsc`/`grep` can report false errors. Trust the Read tool (host) and **local `npm run build`** as ground truth.
- **`.claude/` is write-protected from the Edit/Write tools in Cowork sessions** (resolves to a "protected location"). Use `mcp__Windows-MCP__PowerShell` with `[System.IO.File]::ReadAllText` / `WriteAllText` (UTF8 encoding) to update `CLAUDE.md` or `session_log.md`. Do NOT use `Get-Content`/`Set-Content` without explicit encoding — it corrupts unicode characters (→, —, etc.).
- **Repo path:** `C:\Users\Hammo\Claude\Projects\The Hearth and Hollow\repo` (not `C:\Users\Hammo\hearth-hollow`, which is the old path from earlier sessions and no longer exists).

## Reference docs in repo
`PROJECT_CONTEXT_BRIEF.md` (architecture + security-audit history), `PLAYBOOK.md`, `DEPLOYMENT.md`, `RETELL_VOICE_QUOTE_SETUP.md`, and this `.claude/` folder.