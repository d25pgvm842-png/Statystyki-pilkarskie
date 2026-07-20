export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

export type LoginThrottleSnapshot = {
  failedAttempts: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export type NextLoginThrottleState = LoginThrottleSnapshot;

export function activeLoginBlockUntil(
  states: Array<{ blockedUntil: Date | null }>,
  now: Date,
) {
  const active = states
    .map((state) => state.blockedUntil)
    .filter((value): value is Date => value !== null && value.getTime() > now.getTime())
    .sort((left, right) => right.getTime() - left.getTime());

  return active[0] ?? null;
}

export function nextLoginFailureState(
  current: LoginThrottleSnapshot | null,
  now: Date,
): NextLoginThrottleState {
  if (current?.blockedUntil && current.blockedUntil.getTime() > now.getTime()) {
    return {
      failedAttempts: current.failedAttempts,
      windowStartedAt: current.windowStartedAt,
      blockedUntil: current.blockedUntil,
    };
  }

  const currentWindowIsActive = Boolean(
    current
    && now.getTime() - current.windowStartedAt.getTime() < LOGIN_WINDOW_MS,
  );
  const failedAttempts = currentWindowIsActive && current
    ? current.failedAttempts + 1
    : 1;
  const windowStartedAt = currentWindowIsActive && current
    ? current.windowStartedAt
    : now;
  const blockedUntil = failedAttempts >= LOGIN_FAILURE_LIMIT
    ? new Date(now.getTime() + LOGIN_BLOCK_MS)
    : null;

  return {
    failedAttempts,
    windowStartedAt,
    blockedUntil,
  };
}

export function loginRetryAfterSeconds(blockedUntil: Date, now = new Date()) {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
}
