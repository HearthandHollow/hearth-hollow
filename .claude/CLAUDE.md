# CLAUDE.md — The Hearth and Hollow

Operating guide for Claude Cowork sessions working on this project. Read this first, then `session_log.md` for history and current state.

---

## What this is
A web app for **The Hearth and Hollow**, a handyman/carpentry business (`thehearthhollow.com`). Customers submit project requests with photos → AI generates a price estimate → admin reviews/edits and emails it → customer approves/declines via email → customer self-schedules a date → admin manages the calendar and email threads.

Internal package name is still `handyman-quote-generator` (v0.2.0).

## Tech stack
- **Next.js 14** (App Router), React 18, TypeScript (strict)
- **Tailwind CSS** — the public/admin pages use a **theme class system** (`bg-brand`, `bg-themeBg`, `text-themeMuted`, `border-themeBorder`, `bg-accent`, etc.) driven by `ThemeSettings`. Keep using these classes, not hardcoded colors, on customer-facing pages.
- **PostgreSQL (Neon)** via **Prisma 5**
- **AWS S3** for file storage (presigned URLs)
- **Anthropic SDK** — model `claude-haiku-4-5-20251001` (estimates, photo vision, email-thread analysis)
- **Resend** for outbound email; **Gmail API** (OAuth refresh token) for reading/replying to threads; **Google Calendar API** for booking events; **OneSignal** for admin web push
- Hosted on **Vercel**, DNS on Vercel nameservers

## Key files
- `lib/auth.ts` — HMAC-signed admin session cookie + signed action tokens (approve/deny/schedule links): `verifySessionToken`, `createActionToken`, `verifyActionToken`.
- `lib/prisma.ts`, `lib/s3.ts` (uploads, signed URLs, `getObjectBytes`), `lib/site.ts` (`getBaseUrl`), `lib/rate-limit.ts`
- `lib/email.ts` — Resend confirmation / estimate / booking-confirmation emails
- `lib/gmail.ts` — Gmail REST over fetch (find thread by reference #, send reply as `support@`)
- `lib/email-analyzer.ts` — Claude analysis of an email thread → suggested quote adjustments
- `lib/claude-analyzer.ts` — estimate analysis, optional photo vision (`includePhotos`)
- `lib/availability.ts` — bookable-date logic + date helpers (noon-UTC convention)
- `lib/image.ts` — HEIC→JPEG conversion (`heic-convert`, pure JS)
- `lib/push.ts` — OneSignal admin push sender (`sendAdminPush`); looks up push-capable player ids directly via the Players API rather than the dashboard Subscribed Users segment (segment lagged/mismatched in practice)
- `lib/notifications.ts` — `createNotification()`: single entry point for admin notifications. Writes a `Notification` row (in-app bell feed) AND calls `sendAdminPush` (best-effort, never throws). All trigger sites should call this, not `lib/push.ts` directly.
- `prisma/schema.prisma` — models: Customer, ProjectRequest (has `scheduledDate/scheduledSlot/scheduledAt`), UploadedAsset, Estimate, EstimateHistory, Invoice, AdminUser (unused), ThemeSettings (incl. `heroImageUrl`/`craftImageUrl`/`gatheringImageUrl`/`homesteadImageUrl` homepage image fields), AvailabilitySettings, BlockedDate, OpenDate, Notification (type/title/message/url/viewedAt -- backs the admin bell)
- Admin UI: `app/admin/dashboard`, `app/admin/quotes/[id]` (details, photos + "Include photos", estimate editor, **Appointment** reschedule card, **Conversation** email panel, **Invoice** section), `app/admin/availability` (weekday defaults + month calendar with day-detail modal), `app/admin/theme` (colors/fonts/branding + **Homepage Images** card). `app/admin/layout.tsx` globally mounts `NotificationBell` (bell + unread badge + dropdown, polls `/api/admin/notifications` every 30s) and `OneSignalInit` (push opt-in button) on every `/admin/*` page.
- Public UI: `app/page.tsx` (homepage — hero + 3 image sections, images from `ThemeSettings` via `/api/theme`), `app/request` (quote form), `app/confirmation/[id]`, `app/quote-approval/[id]`, `app/schedule/[id]` (post-approval date picker)
- API under `app/api/...`: `requests`, `admin/quotes/[id]/{analyze,send,estimate,status,delete,get-signed-url,emails,emails/reply,emails/analyze,schedule,invoice,invoice/pdf,invoice/send}`, `admin/availability{,/block,/open}`, `admin/theme`, `admin/notifications` (GET recent + unread count, POST mark-read by id or all), `quotes/[id]/{approve,deny}`, `schedule/[id]/{availability,book}`, `theme`

## Environment variables (Vercel + local `.env.local`)
`ADMIN_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (support@), `NEXT_PUBLIC_SITE_URL` (https://thehearthhollow.com), `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET_NAME`, and Gmail/Calendar: `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` / `GMAIL_OAUTH_REFRESH_TOKEN` / `GMAIL_USER` (hunterhammond@) / `GMAIL_SEND_AS` (support@). Optional: `BOOKING_TIMEZONE` (default America/New_York), `BOOKING_CALENDAR_ID` (default primary). Push: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` (no-ops quietly if unset).
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
   cd C:\Users\Hammo\hearth-hollow
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
- **Line endings:** `.gitattributes` enforces LF. A one-time `git add --renormalize .` is still outstanding (optional).
- **Assistant sandbox caveat:** the Cowork sandbox sometimes serves truncated copies of just-edited files, so in-sandbox `tsc`/`grep` can report false errors. Trust the Read tool (host) and **local `npm run build`** as ground truth.
- **`.claude/` is write-protected from the Edit/Write tools in Cowork sessions** (resolves to a "protected location"). Use `mcp__Windows-MCP__PowerShell` (`Get-Content`/`Set-Content`) to update `CLAUDE.md` or `session_log.md` instead.

## Reference docs in repo
`PROJECT_CONTEXT_BRIEF.md` (architecture + security-audit history), `PLAYBOOK.md`, `DEPLOYMENT.md`, and this `.claude/` folder.
