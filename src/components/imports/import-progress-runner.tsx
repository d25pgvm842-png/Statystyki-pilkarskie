"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Upload } from "lucide-react";
import { commitCsvImportAction } from "@/lib/actions/import-actions";
import { Button } from "@/components/ui/button";

function ImportSubmitButton({
  remaining,
  actionLabel,
  autoRun,
  resume,
}: {
  remaining: number;
  actionLabel: string;
  autoRun: boolean;
  resume: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = autoRun || pending;

  return (
    <Button type="submit" disabled={busy}>
      {busy ? (
        <LoaderCircle size={16} className="mr-2 animate-spin" />
      ) : (
        <Upload size={16} className="mr-2" />
      )}
      {pending
        ? "Uruchamiam import…"
        : autoRun
          ? `Przetwarzanie partii · pozostało ${remaining}`
          : `${resume ? "Wznów import" : actionLabel} ${remaining} poprawnych`}
    </Button>
  );
}

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
  const lastSubmittedRemaining = useRef<number | null>(null);

  useEffect(() => {
    if (!autoRun || remaining <= 0 || lastSubmittedRemaining.current === remaining) return;
    lastSubmittedRemaining.current = remaining;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 250);
    return () => window.clearTimeout(timer);
  }, [autoRun, remaining]);

  return (
    <form ref={formRef} action={commitCsvImportAction}>
      <input type="hidden" name="batchId" value={batchId} />
      <ImportSubmitButton
        remaining={remaining}
        actionLabel={actionLabel}
        autoRun={autoRun}
        resume={resume}
      />
    </form>
  );
}
