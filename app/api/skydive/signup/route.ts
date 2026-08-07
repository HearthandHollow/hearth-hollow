import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { lookupPoint } from "@/lib/skydive/nws";
import { sendSkydiveWelcomeEmail } from "@/lib/skydive/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 100;
const MAX_LABEL = 120;

// Modest speed bump against form abuse (same pattern as the quote form).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limited = rateLimit(`skydive-signup:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const name = body.name ? String(body.name).trim().slice(0, MAX_NAME) : null;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const locationLabel = body.locationLabel
      ? String(body.locationLabel).trim().slice(0, MAX_LABEL)
      : null;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return NextResponse.json(
        { error: "Please provide a valid location." },
        { status: 400 }
      );
    }

    // Existing user: don't change their saved location/limits — just re-send
    // their magic link so the form doubles as "email me my sign-in link".
    const existing = await prisma.skydiveUser.findUnique({ where: { email } });
    if (existing) {
      await sendSkydiveWelcomeEmail(
        existing.id,
        existing.email,
        existing.name,
        existing.locationLabel
      );
      return NextResponse.json({ ok: true, existing: true });
    }

    // Map the point onto the NWS grid (also validates it's a US location).
    let point;
    try {
      point = await lookupPoint(latitude, longitude);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Couldn't find a forecast for that location." },
        { status: 400 }
      );
    }

    const user = await prisma.skydiveUser.create({
      data: {
        email,
        name,
        latitude,
        longitude,
        locationLabel: locationLabel || point.locationLabel,
        timezone: point.timezone,
        gridId: point.gridId,
        gridX: point.gridX,
        gridY: point.gridY,
      },
    });

    await sendSkydiveWelcomeEmail(user.id, user.email, user.name, user.locationLabel);

    return NextResponse.json({ ok: true, existing: false });
  } catch (error) {
    console.error("Skydive signup failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
