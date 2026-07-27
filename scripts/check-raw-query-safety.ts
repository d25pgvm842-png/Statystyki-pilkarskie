import fs from "node:fs";
import path from "node:path";
import {
  inspectRawQueries,
  type RawQueryInventoryItem,
  type RawQueryViolation,
} from "../src/lib/database/raw-query-safety";

const ROOTS = ["src", "scripts", "prisma"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "generated",
]);
const SKIPPED_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.d\.ts$/,
];

function shouldSkipFile(filePath: string) {
  return SKIPPED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function collectFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (
      entry.isFile()
      && EXTENSIONS.has(path.extname(entry.name))
      && !shouldSkipFile(fullPath)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function displayPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function sqlSummary(sql: string | null) {
  if (!sql) return "dynamic SQL";
  const compact = sql.replace(/\s+/g, " ").trim();
  return compact.length > 140
    ? `${compact.slice(0, 137)}...`
    : compact;
}

function reportMarkdown(inventory: RawQueryInventoryItem[]) {
  const rows = inventory
    .sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
      || left.line - right.line
    )
    .map((item) => {
      const sql = sqlSummary(item.sql)
        .replaceAll("|", "\\|")
        .replaceAll("`", "\\`");
      return `| \`${item.filePath}\` | ${item.line} | \`${item.api}\` | \`${sql}\` |`;
    });

  return [
    "# Inwentarz surowych zapytań SQL",
    "",
    "Raport generowany automatycznie przez `npm run raw-query:report`.",
    "Pliki testowe i wygenerowany Prisma Client są pomijane.",
    "",
    `Łączna liczba wywołań: **${inventory.length}**.`,
    "",
    "| Plik | Linia | API | SQL |",
    "|---|---:|---|---|",
    ...(rows.length ? rows : ["| brak | - | - | - |"]),
    "",
    "## Zasady",
    "",
    "- `$queryRawUnsafe` i `$executeRawUnsafe` są zabronione.",
    "- `pg_advisory_lock` i `pg_advisory_xact_lock` użyte przez `$queryRaw` muszą rzutować wynik do `text`.",
    "- kontrola jest częścią `npm run verify` oraz wdrożenia Vercela.",
    "",
  ].join("\n");
}

function formatViolation(violation: RawQueryViolation) {
  return [
    `${violation.filePath}:${violation.line}`,
    `[${violation.rule}]`,
    violation.message,
    violation.sql ? `SQL: ${sqlSummary(violation.sql)}` : "",
  ].filter(Boolean).join(" ");
}

const files = ROOTS.flatMap((root) =>
  collectFiles(path.join(process.cwd(), root))
);
const inventory: RawQueryInventoryItem[] = [];
const violations: RawQueryViolation[] = [];

for (const filePath of files) {
  const relativePath = displayPath(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const result = inspectRawQueries(relativePath, source);
  inventory.push(...result.inventory);
  violations.push(...result.violations);
}

console.log(
  `[raw-query] Przeskanowano ${files.length} plików. Znaleziono ${inventory.length} wywołań Raw SQL.`,
);

for (const item of inventory) {
  console.log(
    `[raw-query] ${item.filePath}:${item.line} ${item.api} — ${sqlSummary(item.sql)}`,
  );
}

const reportFlag = process.argv.indexOf("--write-report");
if (reportFlag >= 0) {
  const reportTarget = process.argv[reportFlag + 1];
  if (!reportTarget) {
    throw new Error("Brak ścieżki po --write-report.");
  }

  const absoluteTarget = path.resolve(process.cwd(), reportTarget);
  fs.mkdirSync(path.dirname(absoluteTarget), { recursive: true });
  fs.writeFileSync(absoluteTarget, reportMarkdown(inventory), "utf8");
  console.log(`[raw-query] Zapisano raport: ${displayPath(absoluteTarget)}`);
}

if (violations.length) {
  console.error(
    `[raw-query] Wykryto ${violations.length} naruszeń bezpieczeństwa:`,
  );
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`);
  }
  process.exitCode = 1;
} else {
  console.log("[raw-query] Brak naruszeń bezpieczeństwa.");
}
