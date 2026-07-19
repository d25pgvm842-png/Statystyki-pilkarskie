"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMatchAction, type MatchActionState } from "@/lib/actions/match-actions";
import { DELETE_MATCH_CONFIRMATION } from "@/lib/backup/delete-confirmation";

const initialState: MatchActionState = {};

export function DeleteMatchForm({ matchId }: { matchId: string }) {
  const [state, action, pending] = useActionState(deleteMatchAction, initialState);

  return (
    <form action={action} className="grid max-w-xl gap-3">
      <input type="hidden" name="matchId" value={matchId} />
      <label className="grid gap-1.5 text-sm">
        <span>
          Wpisz <strong>{DELETE_MATCH_CONFIRMATION}</strong>, aby potwierdzić nieodwracalne usunięcie.
        </span>
        <Input name="confirmation" autoComplete="off" required />
      </label>
      {state.message ? <div className="text-sm font-medium text-red-600">{state.message}</div> : null}
      <Button type="submit" variant="danger" className="w-fit" disabled={pending}>
        {pending ? "Usuwanie…" : "Usuń mecz"}
      </Button>
    </form>
  );
}
