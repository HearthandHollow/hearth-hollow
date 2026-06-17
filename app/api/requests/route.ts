import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
import { sendConfirmationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// --- Limits / allowlists ---------------------------------------------------
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_PHONE = 40;
const MAX_SHORT = 200; // category / location / timeline
const MAX_DESCRIPTION = 5000;

// Basic, permissive email shape check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limit: max submissions per IP per window.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    // --- Rate limiting -----------------------------------------------------
    const ip = getClientIp(req);
    const limited = rateLimit(`requests:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    let formData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: "Request must be sent as multipart/form-data",
        },
        { status: 400 }
      );
    }

    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const phone = (formData.get("phone") as string | null)?.trim() ?? "";
    const category = (formData.get("category") as string | null)?.trim() ?? "";
    const location = (formData.get("location") as string | null)?.trim() ?? "";
    const timeline = (formData.get("timeline") as string | null)?.trim() ?? "";
    const description =
      (formData.get("description") as string | null)?.trim() ?? "";

    // --- Field validation --------------------------------------------------
    if (!name || !email || !phone || !category || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // --- File validation (before any DB writes) ----------------------------
    const files = (formData.getAll("files") as File[]).filter(
      (f) => f && typeof f === "object" && f.size > 0
    );

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Please upload at most ${MAX_FILES} files` },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Each file must be ${MAX_FILE_SIZE / (1024 * 1024)} MB or smaller` },
          { status: 400 }
        );
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type || "unknown"}` },
          { status: 400 }
        );
      }
    }

    // Get or create customer
    let customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, email, phone },
      });
    }

    // Create project request
    const projectRequest = await prisma.projectRequest.create({
      data: {
        customerId: customer.id,
        category,
        location,
        timeline,
        description,
        status: "submitted",
      },
    });

    // Upload validated files
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const s3Url = await uploadToS3(
          buffer,
          file.name,
          file.type,
          projectRequest.id
        );

        await prisma.uploadedAsset.create({
          data: {
            projectId: projectRequest.id,
            filename: file.name,
            s3Url,
            mimeType: file.type,
            fileSize: file.size,
          },
        });
      } catch (fileError) {
        console.error(
          `[UPLOAD-ERROR] Failed to upload file ${file.name}:`,
          fileError
        );
        // Continue even if a single file upload fails.
      }
    }

    // Send confirmation email (don't fail the request if it errors)
    try {
      await sendConfirmationEmail(email, name, projectRequest.id);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    return NextResponse.json(
      { id: projectRequest.id, message: "Request received" },
      { status: 201 }
    );
  } catch (error) {
    // Log details server-side; return a generic message to the client.
    console.error("Error creating request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
