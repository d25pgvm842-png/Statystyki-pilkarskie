import * as ts from "typescript";

export type RawQueryInventoryItem = {
  filePath: string;
  line: number;
  api: "$queryRaw" | "$executeRaw" | "$queryRawUnsafe" | "$executeRawUnsafe";
  sql: string | null;
};

export type RawQueryViolation = RawQueryInventoryItem & {
  rule:
    | "RAW_UNSAFE_FORBIDDEN"
    | "POSTGRES_VOID_LOCK_MUST_BE_CAST";
  message: string;
};

export type RawQueryInspection = {
  inventory: RawQueryInventoryItem[];
  violations: RawQueryViolation[];
};

const unsafeApis = new Set([
  "$queryRawUnsafe",
  "$executeRawUnsafe",
] as const);

function scriptKind(filePath: string) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".cjs") || filePath.endsWith(".mjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function propertyName(expression: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  if (
    ts.isElementAccessExpression(expression)
    && expression.argumentExpression
    && ts.isStringLiteral(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }

  return null;
}

function templateSql(template: ts.TemplateLiteral): string {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return template.text;
  }

  let sql = template.head.text;
  for (const span of template.templateSpans) {
    sql += "?";
    sql += span.literal.text;
  }
  return sql;
}

function lineNumber(
  sourceFile: ts.SourceFile,
  node: ts.Node,
) {
  return sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  ).line + 1;
}

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function isRawApi(
  value: string | null,
): value is RawQueryInventoryItem["api"] {
  return value === "$queryRaw"
    || value === "$executeRaw"
    || value === "$queryRawUnsafe"
    || value === "$executeRawUnsafe";
}

export function inspectRawQueries(
  filePath: string,
  source: string,
): RawQueryInspection {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );
  const inventory: RawQueryInventoryItem[] = [];
  const violations: RawQueryViolation[] = [];

  function record(
    node: ts.Node,
    api: RawQueryInventoryItem["api"],
    sql: string | null,
  ) {
    const item: RawQueryInventoryItem = {
      filePath,
      line: lineNumber(sourceFile, node),
      api,
      sql: sql === null ? null : compactSql(sql),
    };
    inventory.push(item);

    if (unsafeApis.has(api as "$queryRawUnsafe" | "$executeRawUnsafe")) {
      violations.push({
        ...item,
        rule: "RAW_UNSAFE_FORBIDDEN",
        message: `${api} jest zabronione. Użyj parametryzowanego Raw SQL.`,
      });
    }

    if (
      api === "$queryRaw"
      && sql
      && /\bpg_advisory_(?:xact_)?lock\s*\(/i.test(sql)
      && !/::\s*text\b/i.test(sql)
    ) {
      violations.push({
        ...item,
        rule: "POSTGRES_VOID_LOCK_MUST_BE_CAST",
        message:
          "Blokująca funkcja PostgreSQL zwraca void. Rzutuj wynik do text.",
      });
    }
  }

  function visit(node: ts.Node) {
    if (ts.isTaggedTemplateExpression(node)) {
      const api = propertyName(node.tag);
      if (isRawApi(api)) {
        record(node, api, templateSql(node.template));
      }
    } else if (ts.isCallExpression(node)) {
      const api = propertyName(node.expression);
      if (isRawApi(api) && unsafeApis.has(api as "$queryRawUnsafe" | "$executeRawUnsafe")) {
        const firstArgument = node.arguments[0];
        const sql = firstArgument && ts.isStringLiteralLike(firstArgument)
          ? firstArgument.text
          : null;
        record(node, api, sql);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { inventory, violations };
}
