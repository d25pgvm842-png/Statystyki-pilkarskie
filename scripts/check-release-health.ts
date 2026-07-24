import assert from "node:assert/strict";
import packageJson from "../package.json";

type HealthPayload = {
  status: "ok" | "degraded";
  application: string;
  version: string;
  environment: string;
  commit: string | null;
  timestamp: string;
  database?: "ok" | "error";
};

function requiredValue(value: string | undefined, name: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`Brak ${name}.`);
  }

  return normalized;
}

function endpoint(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

async function readJson(url: URL) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json() as HealthPayload;

  return { response, body };
}

async function main() {
  const baseUrl = requiredValue(
    process.env.RELEASE_URL ?? process.argv[2],
    "RELEASE_URL",
  );
  const expectedCommit =
    (process.env.EXPECTED_COMMIT ?? process.argv[3])?.trim() || null;
  const expectedEnvironment =
    process.env.EXPECTED_ENVIRONMENT?.trim() || "production";

  const health = await readJson(endpoint(baseUrl, "/api/health"));

  assert.equal(health.response.status, 200, "GET /api/health nie zwrócił 200.");
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.application, "Staty piłkarskie");
  assert.equal(health.body.version, packageJson.version);
  assert.equal(health.body.environment, expectedEnvironment);
  assert.equal(
    health.response.headers.get("cache-control"),
    "no-store, max-age=0",
  );

  if (expectedCommit) {
    assert.equal(health.body.commit, expectedCommit.slice(0, 12));
  }

  const readiness = await readJson(endpoint(baseUrl, "/api/ready"));

  assert.equal(readiness.response.status, 200, "GET /api/ready nie zwrócił 200.");
  assert.equal(readiness.body.status, "ok");
  assert.equal(readiness.body.database, "ok");
  assert.equal(readiness.body.version, packageJson.version);

  const healthHead = await fetch(endpoint(baseUrl, "/api/health"), {
    method: "HEAD",
    cache: "no-store",
  });
  assert.equal(healthHead.status, 200);

  const readinessHead = await fetch(endpoint(baseUrl, "/api/ready"), {
    method: "HEAD",
    cache: "no-store",
  });
  assert.equal(readinessHead.status, 200);

  console.log(
    `Wydanie ${packageJson.version} działa poprawnie: ${health.body.commit ?? "brak SHA"}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kontrola wydania nie powiodła się: ${message}`);
  process.exit(1);
});
