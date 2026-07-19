const FOOTBALL_DATA_ORG_BASE_URL = "https://api.football-data.org/v4";
const REQUEST_TIMEOUT_MS = 25_000;

export class PublicDataError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PublicDataError";
  }
}

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidate = record.message ?? record.error;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

async function request(
  url: URL,
  provider: string,
  headers?: Record<string, string>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const body = await response.arrayBuffer();
    if (!response.ok) {
      const text = new TextDecoder("utf-8").decode(body);
      let detail: string | null = null;
      try {
        detail = errorMessage(JSON.parse(text));
      } catch {
        detail = text.trim().slice(0, 300) || null;
      }

      throw new PublicDataError(
        detail || `${provider} zwróciło HTTP ${response.status}.`,
        provider,
        response.status,
      );
    }

    return body;
  } catch (error) {
    if (error instanceof PublicDataError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicDataError(`Przekroczono czas oczekiwania na ${provider}.`, provider);
    }
    throw new PublicDataError(
      error instanceof Error ? error.message : `Nie udało się połączyć z ${provider}.`,
      provider,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function isFootballDataOrgConfigured() {
  return Boolean(process.env.FOOTBALL_DATA_ORG_KEY?.trim());
}

export async function footballDataOrgGet<T>(
  endpoint: string,
  params: Record<string, string | number | null | undefined>,
) {
  const token = process.env.FOOTBALL_DATA_ORG_KEY?.trim();
  if (!token) {
    throw new PublicDataError(
      "Brak FOOTBALL_DATA_ORG_KEY w zmiennych środowiskowych Vercela.",
      "football-data.org",
    );
  }

  const url = new URL(endpoint.replace(/^\//, ""), `${FOOTBALL_DATA_ORG_BASE_URL}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const body = await request(url, "football-data.org", {
    "X-Auth-Token": token,
  });

  try {
    return JSON.parse(new TextDecoder("utf-8").decode(body)) as T;
  } catch {
    throw new PublicDataError(
      "football-data.org zwróciło nieprawidłowy JSON.",
      "football-data.org",
    );
  }
}

export async function publicJsonGet<T>(urlValue: string, provider: string) {
  const body = await request(new URL(urlValue), provider);
  try {
    return JSON.parse(new TextDecoder("utf-8").decode(body)) as T;
  } catch {
    throw new PublicDataError(`${provider} zwróciło nieprawidłowy JSON.`, provider);
  }
}

export async function publicTextGet(urlValue: string, provider: string) {
  const body = await request(new URL(urlValue), provider);
  const utf8 = new TextDecoder("utf-8").decode(body);
  if (!utf8.includes("\uFFFD")) return utf8;

  try {
    return new TextDecoder("windows-1252").decode(body);
  } catch {
    return utf8;
  }
}
