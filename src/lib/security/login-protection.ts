import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/env";
import {
  activeLoginBlockUntil,
  loginRetryAfterSeconds,
  nextLoginFailureState,
} from "@/lib/security/login-protection-policy";

const EMAIL_SCOPE = "EMAIL";
const IP_SCOPE = "IP";

function protectionHash(value: string) {
  return createHmac("sha256", getRuntimeEnv().AUTH_SECRET)
    .update(value)
    .digest("hex");
}

export function normalizeLoginEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 320);
}

export function clientIpFromHeaders(input: Pick<Headers, "get">) {
  const forwarded = input.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return forwarded
    || input.get("x-real-ip")?.trim()
    || input.get("cf-connecting-ip")?.trim()
    || "unknown";
}

function loginIdentity(email: string, ip: string) {
  const normalizedEmail = normalizeLoginEmail(email);
  const emailHash = normalizedEmail ? protectionHash(`email:${normalizedEmail}`) : null;
  const ipHash = protectionHash(`ip:${ip.trim() || "unknown"}`);
  const targets = [
    ...(emailHash ? [{ key: `email:${emailHash}`, scope: EMAIL_SCOPE }] : []),
    { key: `ip:${ipHash}`, scope: IP_SCOPE },
  ].sort((left, right) => left.key.localeCompare(right.key));

  return { emailHash, ipHash, targets };
}

export async function checkLoginBlock(input: {
  email: string;
  ip: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const identity = loginIdentity(input.email, input.ip);
  const states = await prisma.loginThrottle.findMany({
    where: { key: { in: identity.targets.map((target) => target.key) } },
    select: { blockedUntil: true },
  });

  return activeLoginBlockUntil(states, now);
}

export async function registerLoginFailure(input: {
  email: string;
  ip: string;
  userId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const identity = loginIdentity(input.email, input.ip);

  return prisma.$transaction(async (tx) => {
    for (const target of identity.targets) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${target.key}, 0))`;
    }

    const currentStates = await tx.loginThrottle.findMany({
      where: { key: { in: identity.targets.map((target) => target.key) } },
    });
    const currentByKey = new Map(currentStates.map((state) => [state.key, state]));
    let blockedUntil: Date | null = null;

    for (const target of identity.targets) {
      const current = currentByKey.get(target.key) ?? null;
      const next = nextLoginFailureState(current, now);

      await tx.loginThrottle.upsert({
        where: { key: target.key },
        create: {
          key: target.key,
          scope: target.scope,
          failedAttempts: next.failedAttempts,
          windowStartedAt: next.windowStartedAt,
          blockedUntil: next.blockedUntil,
          lastAttemptAt: now,
        },
        update: {
          failedAttempts: next.failedAttempts,
          windowStartedAt: next.windowStartedAt,
          blockedUntil: next.blockedUntil,
          lastAttemptAt: now,
        },
      });

      if (
        next.blockedUntil
        && (!blockedUntil || next.blockedUntil.getTime() > blockedUntil.getTime())
      ) {
        blockedUntil = next.blockedUntil;
      }
    }

    await tx.loginSecurityEvent.create({
      data: {
        emailHash: identity.emailHash,
        ipHash: identity.ipHash,
        userId: input.userId ?? null,
        outcome: blockedUntil ? "BLOCKED" : "FAILURE",
        reason: blockedUntil ? "FAILURE_LIMIT_REACHED" : "INVALID_CREDENTIALS",
        blockedUntil,
      },
    });

    return { blockedUntil };
  });
}

export async function registerLoginSuccess(input: {
  email: string;
  ip: string;
  userId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const identity = loginIdentity(input.email, input.ip);

  await prisma.$transaction(async (tx) => {
    for (const target of identity.targets) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${target.key}, 0))`;
    }

    await tx.loginThrottle.deleteMany({
      where: { key: { in: identity.targets.map((target) => target.key) } },
    });
    await tx.loginSecurityEvent.create({
      data: {
        emailHash: identity.emailHash,
        ipHash: identity.ipHash,
        userId: input.userId,
        outcome: "SUCCESS",
        reason: null,
        blockedUntil: null,
        createdAt: now,
      },
    });
  });
}

export { loginRetryAfterSeconds };
