const API_BASE_URL = "https://v3.football.api-sports.io";
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

function errorMessages(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(errorMessages);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(errorMessages);
  }
  return [String(value)];
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

  const url = new URL(endpoint.replace(/^\//, ""), `${API_BASE_URL}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok) {
      throw new ApiFootballError(
        `API-Football zwróciło HTTP ${response.status}.`,
        response.status,
      );
    }

    if (!body) throw new ApiFootballError("API-Football zwróciło pustą odpowiedź.");
    const errors = errorMessages(body.errors);
    if (errors.length) throw new ApiFootballError(errors.join("; "));

    return (body.response ?? ([] as unknown as T));
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
