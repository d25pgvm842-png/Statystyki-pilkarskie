export function repairableHistoricalErrors(value: unknown) {
  if (!Array.isArray(value) || !value.length) return false;
  const messages = value.filter((item): item is string => typeof item === "string");
  if (messages.length !== value.length) return false;
  return messages.every((message) => /^Niejednoznaczne dopasowanie\b/i.test(message.trim()));
}

export function repairedHistoricalCounters(input: {
  importedRows: number; duplicateRows: number; invalidRows: number; imported: number; duplicates: number;
}) {
  const imported = Math.max(0, input.imported);
  const duplicates = Math.max(0, input.duplicates);
  return {
    importedRows: Math.max(0, input.importedRows) + imported,
    duplicateRows: Math.max(0, input.duplicateRows) + duplicates,
    invalidRows: Math.max(0, input.invalidRows - imported - duplicates),
  };
}
