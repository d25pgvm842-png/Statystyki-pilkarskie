export const SLOW_SERVER_OPERATION_MS = 750;

export function isSlowServerOperation(
  durationMs: number,
  thresholdMs = SLOW_SERVER_OPERATION_MS,
) {
  return Number.isFinite(durationMs) && durationMs >= thresholdMs;
}

export async function measureServerOperation<T>(
  name: string,
  operation: () => Promise<T>,
  thresholdMs = SLOW_SERVER_OPERATION_MS,
): Promise<T> {
  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    const durationMs = performance.now() - startedAt;

    if (isSlowServerOperation(durationMs, thresholdMs)) {
      console.warn("slow_server_operation", {
        name,
        durationMs: Math.round(durationMs),
        thresholdMs,
      });
    }
  }
}
