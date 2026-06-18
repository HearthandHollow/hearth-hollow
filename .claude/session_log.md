# Session Log — The Hearth and Hollow

Running log of work across Claude Cowork sessions. Newest first. Append a dated entry at the end of each session; keep "Current state" and "Open items" up to date.

---

## Current state (as of June 2026)
Production is live and healthy on Vercel (`main` auto-deploys; only successful builds are promoted). All features below are deployed:

- **Quote intake → AI estimate → email → approve/deny** (tokenized links).
- **Photo handling:** validated uploads (type/size/count) + rate limiting; **HEIC auto-converted to JPEG** on upload; optional **photo vision** in AI estimates.
- **Email threads in admin:** Gmail-backed Conversation panel per quote — view thread, reply as `support@`, and AI-analyze the conversation for suggested quote adjustments.
- **Scheduling:** after approval the client picks a date (+ AM/PM) on `/schedule/[id]`; booking saves to the quote, emails a confirmation, and creates a Google Calendar event.
- **Availability admin (`/admin/availability`):** recurring working days (default Thu/Fri/Sat) + booking window; month calendar where any day can be opened/closed (incl. one-off opens of normally-off days) and clicked to view its jobs.
- **Admin reschedule:** Appointment card on the quote page to set/change/clear a quote's date.
- **Security hardening complete:** signed-cookie admin auth, signed action tokens, debug endpoints removed, input validation/rate limiting, strong `ADMIN_PASSWORD` + `SESSION_SECRET`.

Last commits: `c32d4ea` (admin reschedule), `b6ee4f1` (accept HEIC), `7d2c892` (HEIC auto-convert).

## Open items / future ideas
- Optional: one-time `git add --renormalize .` to clear CRLF "modified" noise in `git status`.
- Cleanup: remove unused deps (`next-auth`, `bcryptjs`); remove duplicate `AWS_ACCESS_KEY_ID` in Vercel (one flagged "Missing AWS Region").
- `uploadToS3` still returns the key even on failure (failed uploads can look successful) — consider propagating the error.
- Rate limiter is in-memory per instance; move to Vercel KV/Upstash if spam appears.
- Consider expiry on approve/deny/schedule action tokens.
- Rescheduling via admin does not update/cancel the original Google Calendar event (no event id stored) — could be added.
- Existing pre-conversion HEIC assets won't retroactively preview; only new uploads are converted.

---

## History

### June 2026 — Setup, hardening, and feature build (multi-session)
**Onboarding & context.** Connected the `hearth-hollow` repo. Captured the prior shared chat into an archive; built `PROJECT_CONTEXT_BRIEF.md`.

**Email reply fix.** Root cause: domain had no MX records, so customer replies bounced (Resend only sends). Added root MX → `smtp.google.com` and SPF in Vercel DNS; confirmed Google Workspace aliases deliver to `hunterhammond@`.

**Security audit + fixes (deployed).** Replaced forgeable static `admin_session=authenticated` cookie with HMAC-signed tokens verified on all admin routes; removed public debug endpoints (`test-env`, `test-claude`, `test-claude-call`); fixed S3 bucket env var name; added upload validation + rate limiting; quieted Prisma logs in prod; signed approve/deny tokens; `force-dynamic` on theme route; set strong `ADMIN_PASSWORD` + `SESSION_SECRET`; rotated exposed Resend key.

**Photo vision.** Added `getObjectBytes` + `includePhotos` flag so the AI estimate can analyze uploaded photos (per-analysis toggle in the quote UI).

**Email thread feature.** Chose OAuth refresh-token Gmail access (org policy blocks service-account keys). `lib/gmail.ts` (fetch-based REST), endpoints for view/reply/analyze, and the Conversation panel. Replies sent From `support@` (registered as a Gmail send-as). Reminder: re-mint the OAuth token with all three scopes if scopes change.

**Scheduling.** Added schedule fields + `AvailabilitySettings`; public `/schedule/[id]` picker; booking saves + confirmation email + calendar event (`lib/calendar.ts`, needs `calendar.events` scope on the token). Approve flow now redirects to the scheduler.

**Availability calendar.** Added `BlockedDate` (close days/weeks) then `OpenDate` (one-off opens of off-days). Month-grid UI with a day-detail modal (view jobs / open / close). Dashboard got an "Availability" link.

**Admin reschedule.** `PATCH /api/admin/quotes/[id]/schedule` + Appointment card to set/change/clear a quote's date (blocks double-booking).

**HEIC uploads.** First accepted HEIC by extension fallback (browsers send empty MIME); then added server-side HEIC→JPEG conversion via `heic-convert` (pure JS) with fallback to original.

**DB migrations done via `prisma db push`** for: scheduling fields + AvailabilitySettings; BlockedDate; OpenDate.

---

## How to log a new session (template)
```
### <date> — <short title>
- What was requested:
- What changed (files / commits):
- Migrations run (if any):
- Deployed? (commit sha / Vercel state):
- Follow-ups / notes:
```
