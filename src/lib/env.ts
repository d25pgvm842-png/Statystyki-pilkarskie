import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .min(1, "Brak DATABASE_URL.")
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL musi być adresem PostgreSQL.",
  );

const runtimeEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET musi mieć minimum 32 znaki."),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

const unsafeSecretFragments = [
  "development-secret",
  "change-before-production",
  "zmien-na-losowy",
  "zmien-mnie",
  "ci-secret",
];

export function validateRuntimeEnv(input: Record<string, string | undefined>): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}

export function validateDeploymentEnv(input: Record<string, string | undefined>): RuntimeEnv {
  const env = validateRuntimeEnv(input);
  const url = new URL(env.DATABASE_URL);
  const hostname = url.hostname.toLowerCase();
  const secret = env.AUTH_SECRET.toLowerCase();

  if (["localhost", "127.0.0.1", "postgres"].includes(hostname)) {
    throw new Error("Produkcyjny DATABASE_URL nie może wskazywać lokalnej bazy.");
  }

  if (unsafeSecretFragments.some((fragment) => secret.includes(fragment))) {
    throw new Error("AUTH_SECRET nadal zawiera wartość przykładową lub testową.");
  }

  return env;
}

let cachedEnv: RuntimeEnv | undefined;

export function getRuntimeEnv(): RuntimeEnv {
  cachedEnv ??= validateRuntimeEnv(process.env);
  return cachedEnv;
}
