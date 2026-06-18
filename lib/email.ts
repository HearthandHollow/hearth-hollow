import { Resend } from "resend";
import { createActionToken } from "@/lib/auth";

const resend = new Resend(process.env.RESEND_API_KEY);

// Verified domain: thehearthhollow.com
// Using support@ so replies go to a monitored inbox
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || "support@thehearthhollow.com";

export async function sendConfirmationEmail(
  customerEmail: string,
  customerName: string,
  projectId: string
) {
  try {
    const result = await resend.emails.send({
      from: SENDER_EMAIL, // Your verified domain email
      to: customerEmail,
      reply_to: "quotes@thehearthhollow.com",
      subject: "We Received Your Quote Request",
      html: `
        <h2>Thanks, ${customerName}!</h2>
        <p>We've received your project request and will review the photos and details shortly.</p>
        <p><strong>Reference Number:</strong> ${projectId}</p>
        <p>We typically provide estimates within 24-48 hours.</p>
        <p>Best regards,<br/>The Hearth & Hollow Team</p>
      `,
      text: `Thanks, ${customerName}!\n\nWe've received your project request and will review the photos and details shortly.\n\nReference Number: ${projectId}\n\nWe typically provide estimates within 24-48 hours.\n\nBest regards,\nThe Hearth & Hollow Team`,
    });

    return result;
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    throw error;
  }
}

export async function sendEstimateEmail(
  customerEmail: string,
  customerName: string,
  projectId: string,
  estimateDetails: string,
  pdfUrl?: string,
  includeActions: boolean = true
) {
  try {
    // Prefer the public custom domain so links in emails point at the real site,
    // falling back to the Vercel deployment URL, then localhost for dev.
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3001');

    const approveToken = createActionToken(`${projectId}:approve`);
    const denyToken = createActionToken(`${projectId}:deny`);

    const approveButton = includeActions ? `
      <a href="${baseUrl}/api/quotes/${projectId}/approve?token=${approveToken}"
         style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 12px; display: inline-block; font-weight: bold;">
        ✓ Approve Quote
      </a>
    ` : '';

    const denyButton = includeActions ? `
      <a href="${baseUrl}/api/quotes/${projectId}/deny?token=${denyToken}"
         style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        ✗ Decline Quote
      </a>
    ` : '';

    const actionSection = includeActions ? `
      <div style="margin: 30px 0; padding: 20px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="margin-top: 0;"><strong>Please review the estimate and let us know if you'd like to proceed:</strong></p>
        <div style="margin: 20px 0;">
          ${approveButton}
          ${denyButton}
        </div>
        <p style="margin-bottom: 0; font-size: 12px; color: #666;">
          Or reply to this email with any questions or modifications you'd like!
        </p>
      </div>
    ` : `
      <p>Please reply to this email to discuss next steps or ask any questions!</p>
    `;

    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: customerEmail,
      reply_to: "quotes@thehearthhollow.com",
      subject: `Your Project Estimate - Reference #${projectId}`,
      html: `
        <h2>Your Project Estimate</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for choosing The Hearth & Hollow! Here's your project estimate:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          ${estimateDetails}
        </div>
        ${actionSection}
        <p>Best regards,<br/>The Hearth & Hollow Team</p>
      `,
      text: `Your Project Estimate\n\nHi ${customerName},\n\nThank you for choosing The Hearth & Hollow! Here's your project estimate:\n\n${estimateDetails}\n\nPlease reply to this email to discuss next steps or ask any questions!\n\nBest regards,\nThe Hearth & Hollow Team`,
    });

    return result;
  } catch (error) {
    console.error("Failed to send estimate email:", error);
    throw error;
  }
}

export async function sendCustomEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
) {
  try {
    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      reply_to: "quotes@thehearthhollow.com",
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML if no text provided
    });

    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendInvoiceEmail(
  customerEmail: string,
  customerName: string,
  projectId: string,
  invoiceNumber: string,
  totalAmount: number,
  pdfBuffer: Buffer
) {
  try {
    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: customerEmail,
      reply_to: "quotes@thehearthhollow.com",
      subject: `Your Invoice #${invoiceNumber} - The Hearth & Hollow`,
      html: `
        <h2>Your Invoice</h2>
        <p>Hi ${customerName},</p>
        <p>Please find attached your invoice for your project (Reference #${projectId}).</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Invoice #:</strong> ${invoiceNumber}</p>
          <p style="margin: 8px 0 0;"><strong>Total Due:</strong> $${totalAmount.toLocaleString()}</p>
        </div>
        <p>Please reply to this email with any questions about your invoice.</p>
        <p>Best regards,<br/>The Hearth & Hollow Team</p>
      `,
      text: `Your Invoice\n\nHi ${customerName},\n\nPlease find attached your invoice for your project (Reference #${projectId}).\n\nInvoice #: ${invoiceNumber}\nTotal Due: $${totalAmount.toLocaleString()}\n\nPlease reply to this email with any questions about your invoice.\n\nBest regards,\nThe Hearth & Hollow Team`,
      attachments: [
        {
          filename: `invoice-${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return result;
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    throw error;
  }
}

export async function sendBookingConfirmationEmail(
  customerEmail: string,
  customerName: string,
  dateKey: string, // "YYYY-MM-DD"
  slot: string, // "morning" | "afternoon"
  projectId: string
) {
  // Format the date for display (noon UTC avoids day-shift in US timezones).
  const d = new Date(`${dateKey}T12:00:00Z`);
  const prettyDate = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const prettySlot = slot === "afternoon" ? "Afternoon" : "Morning";

  try {
    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: customerEmail,
      reply_to: "quotes@thehearthhollow.com",
      subject: `Your appointment is booked — ${prettyDate}`,
      html: `
        <h2>You're booked, ${customerName}!</h2>
        <p>Thanks for scheduling your project with The Hearth &amp; Hollow. Here are your details:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Date:</strong> ${prettyDate}</p>
          <p style="margin: 8px 0 0;"><strong>Time:</strong> ${prettySlot}</p>
          <p style="margin: 8px 0 0;"><strong>Reference:</strong> ${projectId}</p>
        </div>
        <p>We'll confirm the exact arrival time with you closer to the date. If you need to change anything, just reply to this email.</p>
        <p>Best regards,<br/>The Hearth &amp; Hollow Team</p>
      `,
      text: `You're booked, ${customerName}!\n\nDate: ${prettyDate}\nTime: ${prettySlot}\nReference: ${projectId}\n\nWe'll confirm the exact arrival time closer to the date. Reply to this email with any changes.\n\nThe Hearth & Hollow Team`,
    });
    return result;
  } catch (error) {
    console.error("Failed to send booking confirmation email:", error);
    throw error;
  }
}
