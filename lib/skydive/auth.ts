import { createActionToken, verifyActionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SkydiveUser } from "@prisma/client";

/**
 * Skydive users authenticate with emailed magic links, not passwords. The
 * link carries the user id plus an HMAC action token scoped to that id, so it
 * can't be forged or reused for a different account.
 */
export function createSkydiveToken(userId: string): string {
  return createActionToken(`skydive:${userId}`);
}

export function verifySkydiveToken(
  userId: string | undefined | null,
  token: string | undefined | null
): boolean {
  if (!userId) return false;
  return verifyActionToken(`skydive:${userId}`, token);
}

/** Verify a magic-link (userId, token) pair and load the user, else null. */
export async function getAuthedSkydiveUser(
  userId: string | undefined | null,
  token: string | undefined | null
): Promise<SkydiveUser | null> {
  if (!verifySkydiveToken(userId, token)) return null;
  return prisma.skydiveUser.findUnique({ where: { id: userId! } });
}
