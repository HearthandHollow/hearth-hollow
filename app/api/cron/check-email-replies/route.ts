import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGmailConfigured, findThreadByReference } from "@/lib/gmail";
import { sendAdminPush } from "@/lib/push";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Hit by an external free scheduler (e.g. cron-job.org) every few minutes —
// NOT a Vercel Cron Job, since Hobby plan only allows daily schedules.
// Auth is a shared secret query param, since there's no logged-in admin
// session driving this request.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.nextUrl.searchParams.get("secret");
  return provided === secret;
}

// Addresses that send FROM the business itself — replies sent by these
// should never trigger a "client replied" notification.
function isOwnAddress(from: string): boolean {
  const lower = from.toLowerCase();
  return (
    lower.includes("support@thehearthhollow.com") ||
    lower.includes("quotes@thehearthhollow.com") ||
    (process.env.GMAIL_USER ? lower.includes(process.env.GMAIL_USER.toLowerCase()) : false)
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }
  if (!isGmailConfigured()) {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 503 });
  }

  // Only quotes that have an active email thread and aren't long-closed —
  // an estimate must have been sent, and the client hasn't declined.
  const candidates = await prisma.projectRequest.findMany({
    where: {
      emailSentAt: { not: null },
      clientDeniedAt: null,
    },
    include: { customer: true },
    orderBy: { emailSentAt: "desc" },
    take: 100,
  });

  let checked = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const quote of candidates) {
    checked++;
    try {
      const thread = await findThreadByReference(quote.id);
      if (!thread || thread.messages.length === 0) continue;

      const latest = thread.messages[thread.messages.length - 1];
      if (isOwnAddress(latest.from)) continue; // last message is ours, nothing new from client
      if (latest.id === quote.lastSeenInboundMessageId) continue; // already notified

      await sendAdminPush({
        title: "New reply from client",
        message: `${quote.customer.name}: ${latest.snippet || latest.subject}`,
        url: `/admin/quotes/${quote.id}`,
      });
      await createNotification({
        type: "email_reply",
        title: "New reply from client",
        message: `${quote.customer.name}: ${latest.snippet || latest.subject}`,
        url: `/admin/quotes/${quote.id}`,
      });
      notified++;

      await prisma.projectRequest.update({
        where: { id: quote.id },
        data: { lastSeenInboundMessageId: latest.id },
      });
    } catch (e: any) {
      errors.push(`${quote.id}: ${e?.message || e}`);
    }
  }

  return NextResponse.json({ checked, notified, errors });
}
