import assert from "node:assert/strict";
import test from "node:test";
import {
  LOGIN_BLOCK_MS,
  LOGIN_FAILURE_LIMIT,
  activeLoginBlockUntil,
  loginRetryAfterSeconds,
  nextLoginFailureState,
} from "@/lib/security/login-protection-policy";

test("piąta nieudana próba uruchamia blokadę", () => {
  const now = new Date("2026-07-20T10:00:00.000Z");
  const state = nextLoginFailureState({
    failedAttempts: LOGIN_FAILURE_LIMIT - 1,
    windowStartedAt: new Date("2026-07-20T09:55:00.000Z"),
    blockedUntil: null,
  }, now);

  assert.equal(state.failedAttempts, LOGIN_FAILURE_LIMIT);
  assert.equal(state.blockedUntil?.getTime(), now.getTime() + LOGIN_BLOCK_MS);
});

test("stare okno prób zaczyna się od nowa", () => {
  const now = new Date("2026-07-20T10:20:00.000Z");
  const state = nextLoginFailureState({
    failedAttempts: 4,
    windowStartedAt: new Date("2026-07-20T10:00:00.000Z"),
    blockedUntil: null,
  }, now);

  assert.equal(state.failedAttempts, 1);
  assert.equal(state.windowStartedAt.getTime(), now.getTime());
  assert.equal(state.blockedUntil, null);
});

test("aktywna blokada nie jest skracana ani zwiększana", () => {
  const now = new Date("2026-07-20T10:00:00.000Z");
  const blockedUntil = new Date("2026-07-20T10:10:00.000Z");
  const state = nextLoginFailureState({
    failedAttempts: 5,
    windowStartedAt: new Date("2026-07-20T09:55:00.000Z"),
    blockedUntil,
  }, now);

  assert.equal(state.failedAttempts, 5);
  assert.equal(state.blockedUntil?.getTime(), blockedUntil.getTime());
});

test("wybierana jest najdłuższa aktywna blokada", () => {
  const now = new Date("2026-07-20T10:00:00.000Z");
  const result = activeLoginBlockUntil([
    { blockedUntil: new Date("2026-07-20T09:59:00.000Z") },
    { blockedUntil: new Date("2026-07-20T10:05:00.000Z") },
    { blockedUntil: new Date("2026-07-20T10:08:00.000Z") },
  ], now);

  assert.equal(result?.toISOString(), "2026-07-20T10:08:00.000Z");
});

test("czas ponownej próby jest zaokrąglany w górę", () => {
  const now = new Date("2026-07-20T10:00:00.100Z");
  const blockedUntil = new Date("2026-07-20T10:00:01.001Z");
  assert.equal(loginRetryAfterSeconds(blockedUntil, now), 1);
});
