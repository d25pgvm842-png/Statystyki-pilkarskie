"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { commitCsvImportAction } from "@/lib/actions/import-actions";
import { Button } from "@/components/ui/button";

export function ImportProgressRunner({
  batchId,
  remaining,
  actionLabel,
  autoRun,
  resume,
}: {
  batchId: string;
  remaining: number;
  actionLabel: string;
  autoRun: boolean;
  resume: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!autoRun || started.current || remaining <= 0) return;
    started.current = true;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 250);
    return () => window.clearTimeout(timer);
  }, [autoRun, remaining]);

  return (
    <form ref={formRef} action={commitCsvImportAction}>
      <input type="hidden" name="batchId" value={batchId} />
      <Button type="submit" disabled={autoRun}>
        {autoRun ? (
          <LoaderCircle size={16} className="mr-2 animate-spin" />
        ) : (
          <Upload size={16} className="mr-2" />
        )}
        {autoRun
          ? `Przetwarzanie partii · pozostało ${remaining}`
          : `${resume ? "Wznów import" : actionLabel} ${remaining} poprawnych`}
      </Button>
    </form>
  );
}
