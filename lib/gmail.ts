/**
 * Gmail access via OAuth2 refresh token, using the Gmail REST API directly
 * over fetch (no SDK dependency). Reads the mailbox in GMAIL_USER (the real
 * inbox; the quotes@ alias delivers there) and sends replies From
 * GMAIL_SEND_AS (quotes@).
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
  body: string;
  messageId: string; // RFC822 Message-ID header, for threading replies
}

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_OAUTH_CLIENT_ID &&
    process.env.GMAIL_OAUTH_CLIENT_SECRET &&
    process.env.GMAIL_OAUTH_REFRESH_TOKEN
  );
}

function gmailUser(): string {
  return encodeURIComponent(process.env.GMAIL_USER || "me");
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth env vars are not configured");
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
    throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

async function gmailFetch(path: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function getHeader(headers: any[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");
}

function findPart(part: any, mime: string): any {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return part;
  if (part.parts) {
    for (const p of part.parts) {
      const found = findPart(p, mime);
      if (found) return found;
    }
  }
  return null;
}

function extractBody(payload: any): string {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = findPart(payload, "text/html");
  if (html?.body?.data) {
    return decodeBase64Url(html.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function toEmailMessage(m: any): EmailMessage {
  const headers = m.payload?.headers || [];
  return {
    id: m.id || "",
    threadId: m.threadId || "",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    date: getHeader(headers, "Date"),
    subject: getHeader(headers, "Subject"),
    snippet: m.snippet || "",
    body: extractBody(m.payload),
    messageId: getHeader(headers, "Message-ID"),
  };
}

/**
 * Find the email thread for a quote by searching the mailbox for its unique
 * reference id (present in the estimate subject and confirmation body).
 */
export async function findThreadByReference(
  reference: string
): Promise<{ threadId: string; messages: EmailMessage[] } | null> {
  const token = await getAccessToken();
  const user = gmailUser();

  const q = encodeURIComponent(`"${reference}"`);
  const search = await gmailFetch(
    `/users/${user}/messages?q=${q}&maxResults=10`,
    token
  );

  const firstThreadId = search.messages?.[0]?.threadId;
  if (!firstThreadId) return null;

  const thread = await gmailFetch(
    `/users/${user}/threads/${firstThreadId}?format=full`,
    token
  );

  const messages = (thread.messages || []).map(toEmailMessage);
  return { threadId: firstThreadId, messages };
}

/** Send a reply in an existing thread, From the quotes@ alias. */
export async function sendReply(opts: {
  threadId: string;
  to: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string;
}): Promise<void> {
  const token = await getAccessToken();
  const user = gmailUser();
  const from = process.env.GMAIL_SEND_AS || process.env.GMAIL_USER || "me";
  const subject = /^re:/i.test(opts.subject) ? opts.subject : `Re: ${opts.subject}`;

  const headerLines = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (opts.inReplyTo) headerLines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headerLines.push(`References: ${opts.references}`);

  const raw = `${headerLines.join("\r\n")}\r\n\r\n${opts.bodyText}`;
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmailFetch(`/users/${user}/messages/send`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded, threadId: opts.threadId }),
  });
}
