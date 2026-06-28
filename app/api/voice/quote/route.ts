import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendConfirmationEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

/**
 * Voice quote intake endpoint.
 *
 * This is the phone-agent (Retell) counterpart to the website's
 * `POST /api/requests` form handler. The web form sends multipart/form-data
 * (with photo uploads) and is rate-limited by client IP. A voice agent instead
 * sends a small JSON payload from a single server IP, so this route:
 *
 *   - accepts application/json
 *   - authenticates with a shared bearer secret (RETELL_WEBHOOK_SECRET)
 *     instead of IP rate-limiting
 *   - has no file uploads (no photos on a phone call)
 *
 * It otherwise reuses the exact same data model + side effects as the web form:
 * find-or-create Customer, create ProjectRequest, send the confirmation email,
 * and raise an admin notification. Phone-sourced requests are tagged in the
 * description so they're distinguishable in the admin dashboard.
 *
 * Retell "custom function" calls POST a body shaped like:
 *   { "call": { "call_id": "...", "from_number": "...", ... },
 *     "name": "submit_quote_request",
 *     "args": { "name": "...", "email": "...", ... } }
 * so we read fields from `body.args` when present, falling back to top-level.
 */

// --- Field limits (mirror app/api/requests/route.ts) -----------------------
const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_PHONE = 40;
const MAX_SHORT = 200; // category / location / timeline
const MAX_DESCRIPTION = 5000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    // --- Auth ------------------------------------------------------------
    const secret = process.env.RETELL_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[voice/quote] RETELL_WEBHOOK_SECRET is not set");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 503 }
      );
    }

    const auth = req.headers.get("authorization") || "";
    const provided = auth.replace(/^Bearer\s+/i, "").trim();
    // Also accept an X-Webhook-Secret header for flexibility.
    const headerSecret = req.headers.get("x-webhook-secret")?.trim() || "";
    if (provided !== secret && headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Parse body ------------------------------------------------------
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid request format", details: "Expected JSON body" },
        { status: 400 }
      );
    }

    const args =
      body && typeof body.args === "object" && body.args !== null
        ? (body.args as Record<string, unknown>)
        : body;

    const call =
      body && typeof body.call === "object" && body.call !== null
        ? (body.call as Record<string, unknown>)
        : {};
    const fromNumber = str(call.from_number);

    const name = str(args.name);
    const email = str(args.email);
    // Fall back to the caller's phone number from call metadata if the agent
    // didn't explicitly capture one.
    const phone = str(args.phone) || fromNumber;
    const category = str(args.category);
    const location = str(args.location);
    const timeline = str(args.timeline);
    const description = str(args.description);

    // --- Validation (mirror the web form's rules) ------------------------
    if (!name || !email || !phone || !category || !description) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["name", "email", "phone", "category", "description"],
        },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (
      name.length > MAX_NAME ||
      phone.length > MAX_PHONE ||
      category.length > MAX_SHORT ||
      location.length > MAX_SHORT ||
      timeline.length > MAX_SHORT ||
      description.length > MAX_DESCRIPTION
    ) {
      return NextResponse.json(
        { error: "One or more fields exceed the maximum allowed length" },
        { status: 400 }
      );
    }

    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // Tag the description so phone-sourced requests are obvious in the admin
    // dashboard (the schema has no dedicated `source` column).
    const taggedDescription = `${description}\n\nSubmitted by phone via AI assistant`;

    // --- Find or create customer ----------------------------------------
    let customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, email, phone },
      });
    }

    // --- Create the project request -------------------------------------
    const projectRequest = await prisma.projectRequest.create({
      data: {
        customerId: customer.id,
        category,
        location,
        timeline,
        description: taggedDescription,
        status: "submitted",
      },
    });

    // --- Confirmation email (best-effort) -------------------------------
    try {
      await sendConfirmationEmail(email, name, projectRequest.id);
    } catch (emailError) {
      console.error("[voice/quote] confirmation email failed:", emailError);
    }

    // --- Admin notification (best-effort) -------------------------------
    await createNotification({
      type: "new_request",
      title: "New phone quote request",
      message: `${name} — ${category}`,
      url: `/admin/quotes/${projectRequest.id}`,
    });

    return NextResponse.json(
      {
        id: projectRequest.id,
        message:
          "Quote request received. A confirmation email is on its way and the team will follow up within 24 to 48 hours.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[voice/quote] Error creating request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}

// Reject other verbs explicitly so Retell config mistakes fail loudly.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
