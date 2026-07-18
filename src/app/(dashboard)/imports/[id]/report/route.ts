import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildImportReportCsv } from "@/lib/imports/report";

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "import";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await context.params;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: {
      fileName: true,
      rows: {
        orderBy: { rowNumber: "asc" },
        select: {
          rowNumber: true,
          status: true,
          rawData: true,
          errors: true,
        },
      },
    },
  });

  if (!batch) notFound();

  const fileName = `${safeFileName(batch.fileName.replace(/\.csv$/i, ""))}-raport.csv`;
  return new Response(buildImportReportCsv(batch.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
