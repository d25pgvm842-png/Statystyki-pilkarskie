export function createManualOverrideWritePlan(
  matchId: string,
  userId: string,
  fields: readonly string[],
) {
  const uniqueFields = [...new Set(fields)];

  if (!uniqueFields.length) return null;

  const reason = "Ręczna edycja";

  return {
    update: {
      where: {
        matchId,
        fieldName: { in: uniqueFields },
      },
      data: {
        createdById: userId,
        reason,
      },
    },
    create: {
      data: uniqueFields.map((fieldName) => ({
        matchId,
        fieldName,
        createdById: userId,
        reason,
      })),
      skipDuplicates: true as const,
    },
  };
}
