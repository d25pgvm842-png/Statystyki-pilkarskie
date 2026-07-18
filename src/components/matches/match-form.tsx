"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { MatchActionState } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SeasonOption = {
  id: string;
  name: string;
  league: { name: string };
  teams: { team: { id: string; name: string } }[];
  refereeSeasons: { referee: { id: string; name: string } }[];
};

type InitialMatch = {
  id: string;
  seasonId: string;
  round: number | null;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  refereeId: string | null;
  note: string | null;
  stats: Record<string, number | null> | null;
};

type MatchAction = (state: MatchActionState, formData: FormData) => Promise<MatchActionState>;

const statGroups = [
  ["Rzuty rożne", "homeCorners", "awayCorners"],
  ["Żółte kartki", "homeYellowCards", "awayYellowCards"],
  ["Czerwone kartki", "homeRedCards", "awayRedCards"],
  ["Celne strzały", "homeShotsOnTarget", "awayShotsOnTarget"],
  ["Wszystkie strzały", "homeShots", "awayShots"],
  ["Faule", "homeFouls", "awayFouls"],
  ["Spalone", "homeOffsides", "awayOffsides"],
] as const;

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Zapisywanie..." : editing ? "Zapisz zmiany" : "Dodaj mecz"}</Button>;
}

function localDateTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function MatchForm({ seasons, action, initial }: { seasons: SeasonOption[]; action: MatchAction; initial?: InitialMatch }) {
  const [state, formAction] = useActionState(action, {});
  const [seasonId, setSeasonId] = useState(initial?.seasonId ?? seasons[0]?.id ?? "");
  const [homeTeamId, setHomeTeamId] = useState(initial?.homeTeamId ?? "");
  const [awayTeamId, setAwayTeamId] = useState(initial?.awayTeamId ?? "");
  const [refereeId, setRefereeId] = useState(initial?.refereeId ?? "");
  const selected = useMemo(() => seasons.find((season) => season.id === seasonId), [seasonId, seasons]);
  const error = (field: string) => state.errors?.[field]?.[0];

  function changeSeason(nextSeasonId: string) {
    const nextSeason = seasons.find((season) => season.id === nextSeasonId);
    setSeasonId(nextSeasonId);
    if (!nextSeason?.teams.some(({ team }) => team.id === homeTeamId)) setHomeTeamId("");
    if (!nextSeason?.teams.some(({ team }) => team.id === awayTeamId)) setAwayTeamId("");
    if (!nextSeason?.refereeSeasons.some(({ referee }) => referee.id === refereeId)) setRefereeId("");
  }

  if (!seasons.length) {
    return <Card className="p-8 text-center text-sm text-zinc-500">Najpierw dodaj aktywną ligę, sezon oraz drużyny w konfiguracji.</Card>;
  }

  return (
    <form action={formAction} className="grid gap-5">
      {initial ? <input type="hidden" name="matchId" value={initial.id} /> : null}
      {state.message ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{state.message}</div> : null}

      <Card>
        <CardHeader><CardTitle>Dane meczu</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Liga i sezon" error={error("seasonId")}>
            <Select name="seasonId" value={seasonId} onChange={(event) => changeSeason(event.target.value)} required>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}
            </Select>
          </Field>
          <Field label="Kolejka" error={error("round")}><Input name="round" type="number" min="1" defaultValue={initial?.round ?? ""} /></Field>
          <Field label="Data i godzina" error={error("kickoffAt")}><Input name="kickoffAt" type="datetime-local" defaultValue={localDateTime(initial?.kickoffAt)} required /></Field>
          <Field label="Status" error={error("status")}>
            <Select name="status" defaultValue={initial?.status ?? "SCHEDULED"}>
              <option value="SCHEDULED">Zaplanowany</option><option value="LIVE">Trwa</option><option value="FINISHED">Zakończony</option><option value="POSTPONED">Przełożony</option><option value="CANCELLED">Odwołany</option>
            </Select>
          </Field>
          <Field label="Gospodarz" error={error("homeTeamId")}>
            <Select name="homeTeamId" value={homeTeamId} onChange={(event) => setHomeTeamId(event.target.value)} required><option value="">Wybierz</option>{selected?.teams.map(({ team }) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>
          </Field>
          <Field label="Gość" error={error("awayTeamId")}>
            <Select name="awayTeamId" value={awayTeamId} onChange={(event) => setAwayTeamId(event.target.value)} required><option value="">Wybierz</option>{selected?.teams.map(({ team }) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>
          </Field>
          <Field label="Gole gospodarza" error={error("homeScore")}><Input name="homeScore" type="number" min="0" defaultValue={initial?.homeScore ?? ""} /></Field>
          <Field label="Gole gościa" error={error("awayScore")}><Input name="awayScore" type="number" min="0" defaultValue={initial?.awayScore ?? ""} /></Field>
          <Field label="Sędzia" error={error("refereeId")}>
            <Select name="refereeId" value={refereeId} onChange={(event) => setRefereeId(event.target.value)}><option value="">Brak</option>{selected?.refereeSeasons.map(({ referee }) => <option key={referee.id} value={referee.id}>{referee.name}</option>)}</Select>
          </Field>
          <div className="md:col-span-2 xl:col-span-3"><Field label="Notatka" error={error("note")}><Textarea name="note" defaultValue={initial?.note ?? ""} /></Field></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Statystyki</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-2 grid grid-cols-[minmax(130px,1fr)_110px_110px] gap-3 text-xs font-medium uppercase text-zinc-500"><span>Statystyka</span><span>Gospodarz</span><span>Gość</span></div>
          <div className="grid gap-3">
            {statGroups.map(([label, home, away]) => (
              <div key={home} className="grid grid-cols-[minmax(130px,1fr)_110px_110px] items-center gap-3">
                <span className="text-sm font-medium">{label}</span>
                <Input aria-label={`${label} gospodarza`} name={home} type="number" min="0" defaultValue={initial?.stats?.[home] ?? ""} className={error(home) ? "border-red-500" : ""} />
                <Input aria-label={`${label} gościa`} name={away} type="number" min="0" defaultValue={initial?.stats?.[away] ?? ""} className={error(away) ? "border-red-500" : ""} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2"><Link href={initial ? `/matches/${initial.id}` : "/matches"} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">Anuluj</Link><SubmitButton editing={Boolean(initial)} /></div>
    </form>
  );
}
