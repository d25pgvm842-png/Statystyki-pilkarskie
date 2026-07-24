import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;

export type PublicRuntimeEnvironment = Record<string, string | undefined>;

function shortCommit(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 12) : null;
}

export function createHealthPayload(
  now = new Date(),
  environment: PublicRuntimeEnvironment = process.env,
) {
  return {
    status: "ok" as const,
    application: "Staty piłkarskie",
    version: APP_VERSION,
    environment:
      environment.VERCEL_ENV?.trim()
      || environment.NODE_ENV?.trim()
      || "unknown",
    commit: shortCommit(environment.VERCEL_GIT_COMMIT_SHA),
    timestamp: now.toISOString(),
  };
}
