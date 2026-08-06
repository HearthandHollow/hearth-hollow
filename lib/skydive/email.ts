import { Resend } from "resend";
import { createSkydiveToken } from "@/lib/skydive/auth";
import { getSkydiveBaseUrl } from "@/lib/skydive/site";
import { DaySummary, formatHour } from "@/lib/skydive/evaluate";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL =
  process.env.RESEND_FROM_EMAIL || "support@thehearthhollow.com";
const SENDER = `Skydive Weather <${SENDER_EMAIL}>`;

export function dashboardUrl(userId: string): string {
  return `${getSkydiveBaseUrl()}/dashboard?u=${userId}&t=${createSkydiveToken(userId)}`;
}

export function unsubscribeUrl(userId: string): string {
  return `${getSkydiveBaseUrl()}/api/skydive/unsubscribe?u=${userId}&t=${createSkydiveToken(userId)}`;
}

const RATING_STYLE: Record<string, { bg: string; label: string }> = {
  GOOD: { bg: "#16a34a", label: "GOOD TO JUMP" },
  LIMITED: { bg: "#d97706", label: "LIMITED WINDOWS" },
  NO_GO: { bg: "#dc2626", label: "NO-GO" },
};

function footer(userId: string): string {
  return `
    <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
      Forecast data from the National Weather Service. Always confirm conditions
      with your drop zone — this is a planning aid, not a jump clearance.<br/>
      <a href="${dashboardUrl(userId)}" style="color: #64748b;">Adjust your limits</a> ·
      <a href="${unsubscribeUrl(userId)}" style="color: #64748b;">Unsubscribe from daily emails</a>
    </p>`;
}

function dayCard(day: DaySummary): string {
  const style = RATING_STYLE[day.rating];
  const windows =
    day.safeHours > 0
      ? `Jumpable hours: ${day.safeHourList.map(formatHour).join(", ")}`
      : `Blockers: ${day.topReasons.join(", ") || "outside forecast"}`;
  return `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <div style="display: inline-block; background: ${style.bg}; color: white; padding: 4px 12px; border-radius: 999px; font-weight: bold; font-size: 13px;">
        ${style.label}
      </div>
      <p style="margin: 8px 0 4px; font-weight: bold;">${day.label}</p>
      <p style="margin: 0; color: #475569; font-size: 14px;">
        ${day.safeHours} of ${day.totalHours} daylight hours within your limits.<br/>${windows}
      </p>
    </div>`;
}

export async function sendSkydiveWelcomeEmail(
  userId: string,
  email: string,
  name: string | null,
  locationLabel: string | null
) {
  const link = dashboardUrl(userId);
  const where = locationLabel ? ` for ${locationLabel}` : "";
  return resend.emails.send({
    from: SENDER,
    to: email,
    subject: "You're set up — Skydive Weather",
    html: `
      <h2>Welcome${name ? `, ${name}` : ""}! 🪂</h2>
      <p>You're signed up for skydive weather monitoring${where}. We check the
      National Weather Service forecast against your personal wind, cloud,
      precipitation, and temperature limits, and email you each morning with a
      go / no-go outlook.</p>
      <div style="margin: 24px 0;">
        <a href="${link}"
           style="background-color: #0284c7; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Open Your Dashboard
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b;">This link is your personal
      sign-in — bookmark it. Use the dashboard to view the hourly forecast and
      tune your safety limits any time.</p>
      ${footer(userId)}
    `,
    text: `Welcome${name ? `, ${name}` : ""}!\n\nYou're signed up for skydive weather monitoring${where}. Open your dashboard (this link is your personal sign-in — bookmark it):\n\n${link}\n\nWe'll email you each morning with a go/no-go outlook based on your limits.`,
  });
}

export async function sendSkydiveDailyEmail(
  userId: string,
  email: string,
  name: string | null,
  locationLabel: string | null,
  days: DaySummary[] // today first
) {
  const today = days[0];
  const style = today ? RATING_STYLE[today.rating] : RATING_STYLE.NO_GO;
  const where = locationLabel || "your area";
  return resend.emails.send({
    from: SENDER,
    to: email,
    subject: today
      ? `${style.label} today in ${where} — Skydive Weather`
      : `Skydive Weather outlook for ${where}`,
    html: `
      <h2 style="margin-bottom: 4px;">Today's jump outlook${name ? `, ${name}` : ""}</h2>
      <p style="margin-top: 0; color: #475569;">${where} · your personal limits applied</p>
      ${days.slice(0, 3).map(dayCard).join("")}
      <div style="margin: 24px 0;">
        <a href="${dashboardUrl(userId)}"
           style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          See Hour-by-Hour Details
        </a>
      </div>
      ${footer(userId)}
    `,
    text: days
      .slice(0, 3)
      .map(
        (d) =>
          `${d.label}: ${RATING_STYLE[d.rating].label} — ${d.safeHours}/${d.totalHours} daylight hours within limits` +
          (d.safeHours > 0
            ? ` (${d.safeHourList.map(formatHour).join(", ")})`
            : d.topReasons.length
              ? ` (blockers: ${d.topReasons.join(", ")})`
              : "")
      )
      .join("\n")
      .concat(`\n\nDetails: ${dashboardUrl(userId)}`),
  });
}
