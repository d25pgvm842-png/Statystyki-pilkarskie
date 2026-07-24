import {
  createHealthPayload,
  type PublicRuntimeEnvironment,
} from "./release-health";

export type ReadinessProbe = () => Promise<unknown>;

export async function createReadinessResult(
  probe: ReadinessProbe,
  now = new Date(),
  environment: PublicRuntimeEnvironment = process.env,
) {
  const health = createHealthPayload(now, environment);

  try {
    await probe();

    return {
      statusCode: 200 as const,
      payload: {
        ...health,
        status: "ok" as const,
        database: "ok" as const,
      },
    };
  } catch {
    return {
      statusCode: 503 as const,
      payload: {
        ...health,
        status: "degraded" as const,
        database: "error" as const,
      },
    };
  }
}
