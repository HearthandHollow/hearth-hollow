# Skydive Weather — setup & operations

A micro-site inside this app: **skydive-weather.thehearthhollow.com**. Users
sign up with an email + US location, set personal go/no-go weather limits
(wind, gusts, cloud cover, ceiling, precip chance, temperature; thunderstorms
are always a no-go), view an hour-by-hour dashboard, and get a daily go/no-go
email via Resend.

## How it's wired

- **Data source:** the official NWS API (`api.weather.gov`) — the same
  National Weather Service forecast behind the forecast.weather.gov graphical
  MapClick pages, as JSON. A signup lat/lon is resolved once via
  `/points/{lat},{lon}` to a forecast-grid cell (cached on the user row), and
  forecasts come from the raw gridpoint endpoint (hourly layers: temperature,
  windSpeed, windGust, skyCover, probabilityOfPrecipitation, ceilingHeight,
  weather/thunder). No API key needed; we send an identifying User-Agent.
- **Routing:** `middleware.ts` rewrites requests on the
  `skydive-weather.` host onto `app/skydive/*` pages. The same pages are also
  reachable at `thehearthhollow.com/skydive` (handy for testing before DNS is
  set up). API routes live at `/api/skydive/*` on both hosts.
- **Auth:** passwordless. Signup emails a magic dashboard link
  (`/dashboard?u=<id>&t=<hmac>`) signed with the existing `SESSION_SECRET`
  action-token helper. Re-submitting the signup form with a known email
  re-sends the link.
- **DB:** one new table, `skydive_users` (model `SkydiveUser`), holding
  location + cached NWS grid + thresholds + notification prefs.
- **Email:** Resend, from the existing verified domain
  (`support@thehearthhollow.com`, sender name "Skydive Weather"): a welcome
  email and the daily outlook email, both with dashboard + unsubscribe links.

## Deploy checklist

1. **DB migration:** `npx prisma db push` against the Neon DB (the normal
   build script does this automatically since it runs `prisma db push`).
2. **Cloudflare DNS + tunnel (site is self-hosted on forge):**
   - Add a `skydive-weather` hostname in Cloudflare DNS.
   - Add a public-hostname route for `skydive-weather.thehearthhollow.com` to
     the existing Cloudflare tunnel, pointing at the same forge container/port
     that serves `thehearthhollow.com`.
   - (Vercel shadow copy: optionally add the subdomain as a Vercel domain
     too, but forge is production.)
3. **Cron:** add an **hourly** job on cron-job.org (same account as the
   email-replies poller) hitting:
   `https://thehearthhollow.com/api/cron/skydive-notify?secret=<CRON_SECRET>`
   Each run emails only users whose local clock passed their chosen send hour
   and who haven't been emailed that day, so hourly polling serves all
   timezones and all users' preferred times.
4. **Env vars:** nothing new required. Uses existing `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, `SESSION_SECRET`, `CRON_SECRET`, `DATABASE_URL`.
   Optional override: `SKYDIVE_SITE_URL` (defaults to
   `https://skydive-weather.thehearthhollow.com` in production, and to
   `http://localhost:3001/skydive` when `NEXT_PUBLIC_SITE_URL` is unset).

## Key files

- `middleware.ts` — subdomain → `/skydive/*` rewrite
- `lib/skydive/nws.ts` — NWS point lookup + gridpoint → hourly series
- `lib/skydive/evaluate.ts` — per-hour go/no-go + per-day GOOD / LIMITED /
  NO_GO summaries (daylight window 8am–7pm local; GOOD = 4+ jumpable hours)
- `lib/skydive/email.ts` — welcome + daily Resend emails, magic-link builders
- `lib/skydive/auth.ts` — magic-link token create/verify + user loader
- `app/skydive/` — landing/signup, `dashboard/`, `unsubscribed/`
- `app/api/skydive/{signup,me,settings,forecast,unsubscribe}` and
  `app/api/cron/skydive-notify`
