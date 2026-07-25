import type { PoolConfig } from "pg";

export const DATABASE_POOL_LIMITS = {
  max: 3,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
  statementTimeoutMillis: 12_000,
  queryTimeoutMillis: 15_000,
  lockTimeoutMillis: 5_000,
  idleTransactionTimeoutMillis: 10_000,
} as const;

export function databasePoolConfig(
  connectionString: string,
): PoolConfig {
  return {
    connectionString,
    max: DATABASE_POOL_LIMITS.max,
    connectionTimeoutMillis:
      DATABASE_POOL_LIMITS.connectionTimeoutMillis,
    idleTimeoutMillis:
      DATABASE_POOL_LIMITS.idleTimeoutMillis,
    statement_timeout:
      DATABASE_POOL_LIMITS.statementTimeoutMillis,
    query_timeout:
      DATABASE_POOL_LIMITS.queryTimeoutMillis,
    lock_timeout:
      DATABASE_POOL_LIMITS.lockTimeoutMillis,
    idle_in_transaction_session_timeout:
      DATABASE_POOL_LIMITS.idleTransactionTimeoutMillis,
    keepAlive: true,
    application_name: "staty-pilkarskie",
  };
}
