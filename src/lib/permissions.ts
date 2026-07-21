export type AppRole = "ADMIN" | "ANALYST" | "VIEWER";
export type AppCapability = "READ" | "WRITE" | "ADMIN";

const CAPABILITIES: Record<AppRole, ReadonlySet<AppCapability>> = {
  ADMIN: new Set(["READ", "WRITE", "ADMIN"]),
  ANALYST: new Set(["READ", "WRITE"]),
  VIEWER: new Set(["READ"]),
};

export function isAppRole(value: string): value is AppRole {
  return value === "ADMIN" || value === "ANALYST" || value === "VIEWER";
}

export function hasCapability(role: string, capability: AppCapability) {
  return isAppRole(role) && CAPABILITIES[role].has(capability);
}

export function canWrite(role: string) {
  return hasCapability(role, "WRITE");
}

export function canAdminister(role: string) {
  return hasCapability(role, "ADMIN");
}
