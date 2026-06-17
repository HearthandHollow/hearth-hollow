import Anthropic from "@anthropic-ai/sdk";
import type { EmailMessage } from "@/lib/gmail";

export interface EmailAnalysis {
  summary: string;
  requestedChanges: string[];
  newDetails: string[];
  suggestedEstimate: { low: number; expected: number; high: number } | null;
  reasoning: string;
}

interface QuoteContext {
  category: string;
  description: string;
  estimate?: {
    lowEstimate: number;
    expectedEstimate: number;
    highEstimate: number;
  } | null;
}

/**
 * Read an email thread with the customer and surface what they're asking for,
 * plus a suggested estimate adjustment. Suggestions only — never auto-applied.
 */
export async function analyzeEmailThread(
  quote: QuoteContext,
  messages: EmailMessage[]
): Promise<EmailAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });

  const transcript = messages
    .map((m) => {
      const who = m.from || "Unknown";
      const when = m.date || "";
      const text = (m.body || m.snippet || "").slice(0, 4000);
      return `From: ${who}\nDate: ${when}\nSubject: ${m.subject}\n\n${text}`;
    })
    .join("\n\n----------------------------------------\n\n");

  const currentEstimate = quote.estimate
    ? `Current estimate — Low: $${quote.estimate.lowEstimate}, Expected: $${quote.estimate.expectedEstimate}, High: $${quote.estimate.highEstimate}`
    : "No estimate generated yet.";

  const prompt = `You are assisting a handyman/carpentry business owner. Review the email conversation with a customer about a project and help the owner decide whether to adjust the quote.

PROJECT CATEGORY: ${quote.category}
PROJECT DESCRIPTION: ${quote.description}
${currentEstimate}

EMAIL CONVERSATION (oldest to newest):
${transcript}

Analyze the conversation and respond with ONLY valid JSON (no markdown), in this exact shape:
{
  "summary": "1-3 sentence summary of where the conversation stands",
  "requested_changes": ["specific things the customer is asking for or changing"],
  "new_details": ["new facts about scope, materials, access, timing, or budget revealed in the emails"],
  "suggested_estimate": {"low": 0, "expected": 0, "high": 0},
  "reasoning": "brief explanation for the suggested estimate, or why no change is needed"
}
Set "suggested_estimate" to null if no change to pricing is warranted. Base any dollar changes on what the emails actually say.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1];
  }
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) jsonStr = jsonStr.substring(start, end + 1);

  const parsed = JSON.parse(jsonStr);

  const se = parsed.suggested_estimate;
  const suggestedEstimate =
    se && typeof se === "object"
      ? {
          low: Number(se.low) || 0,
          expected: Number(se.expected) || 0,
          high: Number(se.high) || 0,
        }
      : null;

  return {
    summary: parsed.summary || "",
    requestedChanges: Array.isArray(parsed.requested_changes)
      ? parsed.requested_changes
      : [],
    newDetails: Array.isArray(parsed.new_details) ? parsed.new_details : [],
    suggestedEstimate,
    reasoning: parsed.reasoning || "",
  };
}
