# WhatsApp Comms Hub — setup, go-live and operations

One WhatsApp Business number for every Hearth & Hollow project. Built 2026-10-21 by Brain
(branch `whatsapp-comms-hub`). Display name: **The Hearth and Hollow**. App: *Hearth & Hollow Comms*
(App ID 1158478813355283) in The Hearth & Hollow LLC portfolio.

## How it works
- **Inbound:** Meta → `POST /api/whatsapp/webhook` (HMAC `X-Hub-Signature-256` checked on the raw body
  with the app secret) → `wa_contacts` / `wa_conversations` / `wa_messages`. Duplicate deliveries are
  ignored by `wamid`. Events for any other phone number id (e.g. Meta's test number) are ignored once
  `WHATSAPP_PHONE_NUMBER_ID` is set.
- **Project routing** (rule-based, no AI): deep-link prefixes `RT:` `HH:` `FARM:` `FAB:` `CS:` tag the
  conversation; an untagged first message gets ONE interactive menu; the choice tags it and gets a
  short acknowledgement. Hunter can re-tag in the inbox.
- **Inbox:** `/admin/messages` (admin login). Filter by project/untagged, open/closed. Free-form replies
  only inside the 24h customer-service window; outside it, pick an APPROVED template. Opening a thread
  marks it read (blue ticks). Media is copied to private S3 (`whatsapp/<conversation>/<message>.<ext>`)
  and streamed to the admin only.
- **Alerts:** email to `WHATSAPP_ALERT_EMAIL` (default hunterhammond@thehearthhollow.com) via Resend,
  at most one per thread per `WHATSAPP_ALERT_QUIET_MIN` (15) minutes while it stays unread.
  `WHATSAPP_ALERT_PUSH=true` also adds the admin bell + web push (off — Hunter: "email for now").
- **Opt-in/out:** messaging us first = opted in. STOP/UNSUBSCRIBE → opted out + confirmation; only
  START re-opts. Nobody can message an opted-out number (inbox and send API both refuse).
- **Internal send API:** `POST /api/comms/whatsapp/send`, `Authorization: Bearer <project token>`:
  ```json
  { "to": "+15551234567", "template_name": "rt_your_match_is_up", "language": "en_US",
    "variables": ["Sam", "Alex", "3"], "opt_in": { "source": "rackertracker_signup" } }
  ```
  Templates only (free-form is inbox-only). A token is scoped to one project. `opt_in` = the caller
  attests the person ticked a WhatsApp opt-in box; without it, the number must already be opted in.
  Responses: 200 `{ok, message_id}`, 401 bad token, 403 wrong project, 409 not opted in / opted out,
  502 Meta rejected (logged with Meta's error on the message row).

## Deep links
`https://wa.me/<number>?text=RT%3A%20` (RackerTracker) · `HH%3A%20` (handyman) · `FARM%3A%20` ·
`FAB%3A%20` · `CS%3A%20`. Plain `https://wa.me/<number>` gets the menu.

## Environment variables (live site = forge `/opt/stacks/hearthhollow/.env.app`; never commit values)
| Name | What |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System-user permanent token |
| `WHATSAPP_APP_SECRET` | App secret (webhook signature) |
| `WHATSAPP_VERIFY_TOKEN` | Any random string; also typed into Meta's webhook settings |
| `WHATSAPP_PHONE_NUMBER_ID` | From Graph (see below) |
| `WHATSAPP_WABA_ID` | From Graph (templates list) |
| `WHATSAPP_2FA_PIN` | 6-digit two-step PIN, used once for `/register` (not read by the app) |
| `COMMS_API_TOKENS` | `RACKERTRACKER:<32+ random chars>,HANDYMAN:<...>` |
| `WHATSAPP_ALERT_EMAIL`, `WHATSAPP_ALERT_QUIET_MIN`, `WHATSAPP_ALERT_PUSH` | optional |
| `WHATSAPP_GRAPH_VERSION` (default v23.0), `WHATSAPP_GRAPH_BASE` | optional (tests point BASE at a mock) |

## Go-live checklist (only on Hunter's "go")
1. `prisma db push` on forge **before** merging (additive: 3 tables + 1 enum).
2. Put the env vars in forge `.env.app`; recreate the app container.
3. Merge to `main` → forge autodeploy (~5 min).
4. Meta App → WhatsApp → Configuration: callback `https://thehearthhollow.com/api/whatsapp/webhook`,
   verify token = `WHATSAPP_VERIFY_TOKEN`; subscribe the **messages** field.
5. Subscribe the app to the WABA: `POST /{WABA_ID}/subscribed_apps`. *(Done 2026-10-21 for the real
   WABA 1767089994564253.)*
6. Register the number once: `POST /{PHONE_NUMBER_ID}/register {"messaging_product":"whatsapp","pin":"<PIN>"}`.
   *(Done 2026-10-21 for the real number, id 1458896760631238.)*
7. ~~Test with Meta's test number first~~. Meta's test number (1405632999298261) is blocked on Meta's
   side, so the branch was tested on the real number through a temporary tunnel on 2026-10-21 (passed;
   see session_log). After go-live, send one message from a phone to confirm the deployed webhook works.
8. **Publish the Meta app** (+ Business Verification) — until published Meta only delivers TEST webhooks.
9. Submit the templates in `docs/whatsapp-templates.md` in WhatsApp Manager.

## Cost
Cloud API hosting: free. Customer-initiated (service) conversations: free. Meta charges per **template**
delivered outside the 24h window; utility templates are cents or less in the US, marketing costs more.
Expected first-year volume: a few hundred RackerTracker reminders/month at most → low single-digit
dollars per month. Messaging limit today: 250 business-initiated customers / 24h.

## Tests
`npx tsx scripts/test-whatsapp.ts` (12 unit tests). End-to-end (34 checks) was run on brain against a
throwaway Postgres + mock Graph API (`WHATSAPP_GRAPH_BASE`), see session_log 2026-10-21.
