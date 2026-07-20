"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  checkLoginBlock,
  clientIpFromHeaders,
  loginRetryAfterSeconds,
  normalizeLoginEmail,
  registerLoginFailure,
  registerLoginSuccess,
} from "@/lib/security/login-protection";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const DUMMY_PASSWORD_HASH = "$2b$12$MZMI7/Udlo6co2INAIFDIOVc7TNt3exERxvlYj85H5NZR0juUjraK";

function redirectLocked(blockedUntil: Date): never {
  const retry = loginRetryAfterSeconds(blockedUntil);
  redirect(`/login?error=locked&retry=${retry}`);
}

export async function loginAction(formData: FormData) {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  const rawEmail = String(formData.get("email") ?? "");
  const email = normalizeLoginEmail(rawEmail);

  const activeBlock = await checkLoginBlock({ email, ip });
  if (activeBlock) redirectLocked(activeBlock);

  const parsed = loginSchema.safeParse({
    email,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const failure = await registerLoginFailure({ email, ip });
    if (failure.blockedUntil) redirectLocked(failure.blockedUntil);
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  const passwordMatches = await compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user?.active || !passwordMatches) {
    const failure = await registerLoginFailure({
      email,
      ip,
      userId: user?.id ?? null,
    });
    if (failure.blockedUntil) redirectLocked(failure.blockedUntil);
    redirect("/login?error=invalid");
  }

  await registerLoginSuccess({ email, ip, userId: user.id });
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
