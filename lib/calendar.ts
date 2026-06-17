/**
 * Google Calendar event creation, reusing the same OAuth refresh token as Gmail.
 * Requires the token to include the calendar.events scope — if it doesn't (or
 * isn't configured), createBookingEvent returns { created: false } and the
 * caller continues without failing the booking.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export function isCalendarConfigured(): boolean {
  return !!(
    process.env.GMAIL_OAUTH_CLIENT_ID &&
    process.env.GMAIL_OAUTH_CLIENT_SECRET &&
    process.env.GMAIL_OAUTH_REFRESH_TOKEN
  );
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth env vars are not configured");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function createBookingEvent(opts: {
  /** Booked day at noon UTC. */
  date: Date;
  /** "morning" | "afternoon" */
  slot: string;
  summary: string;
  description: string;
  attendeeEmail?: string;
}): Promise<{ created: boolean; reason?: string }> {
  try {
    if (!isCalendarConfigured()) {
      return { created: false, reason: "Calendar not configured" };
    }
    const token = await getAccessToken();

    const tz = process.env.BOOKING_TIMEZONE || "America/New_York";
    const ymd = opts.date.toISOString().slice(0, 10);
    const window =
      opts.slot === "afternoon"
        ? { start: "13:00:00", end: "17:00:00" }
        : { start: "08:00:00", end: "12:00:00" };

    const event: any = {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: `${ymd}T${window.start}`, timeZone: tz },
      end: { dateTime: `${ymd}T${window.end}`, timeZone: tz },
    };
    if (opts.attendeeEmail) {
      event.attendees = [{ email: opts.attendeeEmail }];
    }

    const calendarId = process.env.BOOKING_CALENDAR_ID || "primary";
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[calendar] event create failed:", res.status, text);
      return { created: false, reason: `${res.status}` };
    }
    return { created: true };
  } catch (err) {
    console.error("[calendar] error:", err);
    return { created: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
