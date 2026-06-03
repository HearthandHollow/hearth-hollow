import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
import { sendConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const category = formData.get("category") as string;
    const location = formData.get("location") as string;
    const timeline = formData.get("timeline") as string;
    const description = formData.get("description") as string;

    // Validate
    if (!name || !email || !phone || !category || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // Get or create customer
    let customer = await prisma.customer.findUnique({
      where: { email },
    });

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
        location: location || "",
        timeline: timeline || "",
        description,
        status: "submitted",
      },
    });

    // Upload files
    const files = formData.getAll("files") as File[];
    if (files && files.length > 0) {
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
          console.error(`Failed to upload file ${file.name}:`, fileError);
          // Continue even if file upload fails
        }
      }
    }

    // Send confirmation email to customer
    try {
      await sendConfirmationEmail(email, name, projectRequest.id);
      console.log(`Confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      { id: projectRequest.id, message: "Request received" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating request:", error);
    return NextResponse.json(
      { error: "Failed to create request", details: String(error) },
      { status: 500 }
    );
  }
}
