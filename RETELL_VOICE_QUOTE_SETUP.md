# Retell Phone Agent → Quote Submission Setup

Lets callers submit a quote request by phone. The Retell voice agent collects
the same fields as the website's "Request a Quote" form, then calls a secure
backend endpoint that creates an **identical** quote in your admin dashboard —
same `Customer` + `ProjectRequest` records, same confirmation email, same
notification. Phone quotes are tagged so you can tell them apart.

## How it works

```
Caller ──▶ Retell voice agent ──▶ custom function "submit_quote_request"
                                        │  (JSON + bearer secret)
                                        ▼
              POST https://thehearthhollow.com/api/voice/quote
                                        │
                                        ▼
        find/create Customer → create ProjectRequest → confirmation email
                                        │
                                        ▼
                     New quote appears in /admin/quotes
```

The endpoint already exists in your repo: `app/api/voice/quote/route.ts`.

---

## Step 1 — Set the shared secret in Vercel

The endpoint requires a bearer secret so only your Retell agent can submit.

1. Go to Vercel → **hearth-hollow** project → **Settings → Environment Variables**
2. Add a new variable (Production, Preview, Development):
   - **Key:** `RETELL_WEBHOOK_SECRET`
   - **Value:** `9235569d9208cfcc04614022eb4b8f3481081188aafa4e5c281d9cb6e0456fd5`
     *(freshly generated for you — or run `openssl rand -hex 32` for your own)*
3. Save.

> ⚠️ Per your project notes: env vars must be set in the Vercel dashboard, not
> `.env.local` (which is gitignored). Add it to `.env.local` too if you want to
> test locally.

## Step 2 — Deploy the endpoint

```bash
cd D:\Projects\hearth-hollow
git add app/api/voice/quote/route.ts RETELL_VOICE_QUOTE_SETUP.md
git commit -m "Add voice quote intake endpoint for Retell phone agent"
git push        # Vercel auto-deploys
```

Verify it's live (should return **401 Unauthorized** without the secret — that
means it's deployed and guarding correctly):

```bash
curl -i -X POST https://thehearthhollow.com/api/voice/quote \
  -H "Content-Type: application/json" -d '{}'
# → HTTP/1.1 401 Unauthorized
```

Then a full smoke test **with** the secret (this creates a real test quote):

```bash
curl -i -X POST https://thehearthhollow.com/api/voice/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 9235569d9208cfcc04614022eb4b8f3481081188aafa4e5c281d9cb6e0456fd5" \
  -d '{
    "args": {
      "name": "Test Caller",
      "email": "you@example.com",
      "phone": "+15555550123",
      "category": "Deck Repair/Building",
      "location": "Austin, TX",
      "timeline": "1-2 weeks",
      "description": "Test submission from the phone agent setup guide."
    }
  }'
# → HTTP/1.1 201 Created  { "id": "...", "message": "..." }
```

Check `/admin/quotes` — the test quote should be there, tagged "Submitted by
phone". Delete it when done.

---

## Step 3 — Create the Retell custom function (tool)

In the Retell dashboard, open (or create) your agent → **Functions / Tools** →
**Add custom function**, and paste this configuration:

- **Name:** `submit_quote_request`
- **Description:** `Submit the caller's quote request to Hearth & Hollow after all required details are collected and confirmed.`
- **URL:** `https://thehearthhollow.com/api/voice/quote`
- **Method:** `POST`
- **Headers:**
  - `Authorization: Bearer 9235569d9208cfcc04614022eb4b8f3481081188aafa4e5c281d9cb6e0456fd5`
  - `Content-Type: application/json`
- **Speak during execution:** ON → "Okay, let me get that submitted for you…"
- **Speak after execution:** ON

**Parameters (JSON schema):**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The caller's full name."
    },
    "email": {
      "type": "string",
      "description": "The caller's email address, used to send the confirmation and estimate. Must be a valid email."
    },
    "phone": {
      "type": "string",
      "description": "The caller's callback phone number, including area code."
    },
    "category": {
      "type": "string",
      "description": "The type of service requested.",
      "enum": [
        "General Carpentry",
        "Furniture Building",
        "Deck Repair/Building",
        "Fence Building",
        "Wall Repair",
        "Welding",
        "Installation",
        "Other"
      ]
    },
    "location": {
      "type": "string",
      "description": "City and/or address where the work will be done."
    },
    "timeline": {
      "type": "string",
      "description": "How soon the caller wants the work done.",
      "enum": ["ASAP", "1-2 weeks", "2-4 weeks", "1-2 months", "Flexible"]
    },
    "description": {
      "type": "string",
      "description": "A detailed description of the project: what needs to be done, materials, sizes, and any preferences."
    }
  },
  "required": ["name", "email", "phone", "category", "description"]
}
```

> The `category` and `timeline` enums match your website form's dropdowns
> exactly (`app/request/page.tsx`), so phone quotes stay consistent with web ones.

---

## Step 4 — Agent prompt (LLM instructions)

Paste this into your Retell agent's **System Prompt / General Prompt** (adapt
the greeting to taste):

```
# Identity
You are the friendly phone assistant for Hearth & Hollow, a custom handyman and
carpentry business. Your job on this call is to help the caller request a quote
for a project by collecting their details and submitting the request for them.

# Style
Warm, concise, and conversational. One question at a time. Confirm spellings of
the name and email, and read the phone number back. Don't rush.

# Task — collect these details (required marked *)
1. *Full name
2. *Email address (for the confirmation and written estimate — confirm spelling)
3. *Callback phone number (read it back to confirm)
4. *Service category — one of: General Carpentry, Furniture Building,
   Deck Repair/Building, Fence Building, Wall Repair, Welding, Installation, Other.
   If unsure, ask what they need done and pick the closest; use "Other" if none fit.
5. Project location (city or address)
6. Timeline — one of: ASAP, 1-2 weeks, 2-4 weeks, 1-2 months, Flexible
7. *Project description — encourage detail: what needs doing, sizes, materials,
   and any preferences. Mention they can also add photos later via the website
   confirmation email if helpful.

# Submitting
- Once you have at least the required fields (name, email, phone, category,
  description), briefly summarize back what you've captured and ask the caller
  to confirm it's correct.
- After they confirm, call the function `submit_quote_request` with the collected
  fields.
- If the function succeeds, tell them the request is in, they'll get a
  confirmation email, and the team typically follows up within 24 to 48 hours.
- If it fails, apologize, let them know you'll have someone follow up, and offer
  to take a message or suggest the website form at thehearthhollow.com/request.

# Rules
- Never invent an email or phone number — always get them from the caller.
- Do not promise a price; estimates are sent after the team reviews the request.
- If the caller asks something off-topic, answer briefly if you can, then steer
  back to the quote.
```

---

## Step 5 — Give the agent a phone number

In Retell: **Phone Numbers** → buy a number (or import a Twilio/SIP number) →
assign it to this agent as the **inbound** agent. Place a test call, walk through
a quote, and confirm it lands in `/admin/quotes`.

Optionally forward your existing business line to the Retell number, or publish
it on the website / Google Business profile.

---

## Field reference

| Field         | Required | Notes                                              |
|---------------|----------|----------------------------------------------------|
| `name`        | ✅       | Caller's full name                                 |
| `email`       | ✅       | Validated; confirmation email is sent here         |
| `phone`       | ✅       | Falls back to caller ID if the agent omits it      |
| `category`    | ✅       | Must match the 8 website categories                |
| `description` | ✅       | Free text, up to 5000 chars                        |
| `location`    | ⬜       | City/address                                       |
| `timeline`    | ⬜       | One of the 5 website timeline options              |
| photos        | —        | Not collected by phone; caller can reply to the email |

## Security notes
- The endpoint rejects any request without the correct `RETELL_WEBHOOK_SECRET`
  (401). Keep that secret out of git.
- If the secret ever leaks, rotate it: change the Vercel env var and the Retell
  function header, then redeploy.
- Unlike the web form, this route is **not** IP rate-limited (Retell calls from
  a shared IP). The bearer secret is the gate. If you want belt-and-suspenders,
  add a per-email or per-number throttle later.

## Files changed
- `app/api/voice/quote/route.ts` — new JSON intake endpoint (added)
- `RETELL_VOICE_QUOTE_SETUP.md` — this guide (added)
