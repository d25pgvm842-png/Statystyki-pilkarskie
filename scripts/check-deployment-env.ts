import { validateDeploymentEnv } from "../src/lib/env";

try {
  validateDeploymentEnv(process.env);
  console.log("Zmienne środowiskowe wdrożenia są poprawne.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Nieznany błąd konfiguracji.";
  console.error(`Błąd konfiguracji wdrożenia: ${message}`);
  process.exit(1);
}
