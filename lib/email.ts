import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use your verified custom domain for sending
// After verifying thehearthhollow.com in Resend dashboard, use:
// const SENDER_EMAIL = "noreply@thehearthhollow.com";
// Until then, use:
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@thehearthhollow.com";

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
  pdfUrl?: string
) {
  try {
    const result = await resend.emails.send({
      from: SENDER_EMAIL, // Your verified domain email
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
        <p>Please reply to this email to discuss next steps or ask any questions!</p>
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
