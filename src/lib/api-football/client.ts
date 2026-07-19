const DIRECT_API_BASE_URL = "https://v3.football.api-sports.io";
const RAPID_API_BASE_URL = "https://api-football-v1.p.rapidapi.com/v3";
const RAPID_API_HOST = "api-football-v1.p.rapidapi.com";
const REQUEST_TIMEOUT_MS = 25_000;

export class ApiFootballError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

type ApiEnvelope<T> = {
  errors?: unknown;
  results?: number;
  response?: T;
};

type ApiTransport = "direct" | "rapidapi";

function errorMessages(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(errorMessages);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(errorMessages);
  }
  return [String(value)];
}

function shouldTryRapidApi(error: ApiFootballError) {
  if (error.status === 401 || error.status === 403) return true;
  return /(api.?key|application key|token|authentication|unauthorized|not subscribed)/i.test(error.message);
}

function requestHeaders(transport: ApiTransport, apiKey: string): Record<string, string> {
  if (transport === "rapidapi") {
    return {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": RAPID_API_HOST,
    };
  }

  return {
    "x-apisports-key": apiKey,
  };
}

async function requestApiFootball<T>(
  transport: ApiTransport,
  apiKey: string,
  endpoint: string,
  params: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const baseUrl = transport === "rapidapi" ? RAPID_API_BASE_URL : DIRECT_API_BASE_URL;
  const url = new URL(endpoint.replace(/^\//, ""), `${baseUrl}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: requestHeaders(transport, apiKey),
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    let body: ApiEnvelope<T> | null = null;

    if (responseText) {
      try {
        body = JSON.parse(responseText) as ApiEnvelope<T>;
      } catch {
        throw new ApiFootballError(
          `API-Football zwróciło nieprawidłową odpowiedź (HTTP ${response.status}).`,
          response.status,
        );
      }
    }

    const errors = errorMessages(body?.errors);

    if (!response.ok) {
      throw new ApiFootballError(
        errors.join("; ") || `API-Football zwróciło HTTP ${response.status}.`,
        response.status,
      );
    }

    if (!body) {
      throw new ApiFootballError("API-Football zwróciło pustą odpowiedź.");
    }

    if (errors.length) {
      throw new ApiFootballError(errors.join("; "));
    }

    return body.response ?? ([] as unknown as T);
  } catch (error) {
    if (error instanceof ApiFootballError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiFootballError("Przekroczono czas oczekiwania na API-Football.");
    }
    throw new ApiFootballError(
      error instanceof Error ? error.message : "Nie udało się połączyć z API-Football.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function isApiFootballConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY?.trim());
}

export async function apiFootballGet<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    throw new ApiFootballError("Brak zmiennej API_FOOTBALL_KEY w środowisku Vercela.");
  }

  try {
    return await requestApiFootball<T>("direct", apiKey, endpoint, params);
  } catch (error) {
    if (!(error instanceof ApiFootballError) || !shouldTryRapidApi(error)) {
      throw error;
    }

    return requestApiFootball<T>("rapidapi", apiKey, endpoint, params);
  }
}