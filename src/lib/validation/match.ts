import { z } from "zod";

const nullableInt = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : Number(value),
  z.number().int().min(0).nullable(),
);

export const matchFormSchema = z.object({
  matchId: z.string().optional(),
  seasonId: z.string().min(1, "Wybierz sezon"),
  round: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? null : Number(value),
    z.number().int().min(1).nullable(),
  ),
  kickoffAt: z.string().min(1, "Podaj datę i godzinę").transform((value, ctx) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Nieprawidłowa data" });
      return z.NEVER;
    }
    return date;
  }),
  homeTeamId: z.string().min(1, "Wybierz gospodarza"),
  awayTeamId: z.string().min(1, "Wybierz gościa"),
  homeScore: nullableInt,
  awayScore: nullableInt,
  status: z.enum(["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"]),
  refereeId: z.preprocess((value) => value === "" ? null : value, z.string().nullable()),
  note: z.preprocess((value) => value === "" ? null : value, z.string().max(2000).nullable()),
  homeCorners: nullableInt,
  awayCorners: nullableInt,
  homeYellowCards: nullableInt,
  awayYellowCards: nullableInt,
  homeRedCards: nullableInt,
  awayRedCards: nullableInt,
  homeShotsOnTarget: nullableInt,
  awayShotsOnTarget: nullableInt,
  homeShots: nullableInt,
  awayShots: nullableInt,
  homeFouls: nullableInt,
  awayFouls: nullableInt,
  homeOffsides: nullableInt,
  awayOffsides: nullableInt,
}).superRefine((data, ctx) => {
  if (data.homeTeamId === data.awayTeamId) {
    ctx.addIssue({ code: "custom", path: ["awayTeamId"], message: "Gospodarz i gość muszą być różni" });
  }
  if (data.status === "FINISHED" && (data.homeScore === null || data.awayScore === null)) {
    ctx.addIssue({ code: "custom", path: ["homeScore"], message: "Zakończony mecz musi mieć wynik" });
  }
  if (data.homeShotsOnTarget !== null && data.homeShots !== null && data.homeShotsOnTarget > data.homeShots) {
    ctx.addIssue({ code: "custom", path: ["homeShotsOnTarget"], message: "Celne strzały nie mogą przekraczać wszystkich strzałów" });
  }
  if (data.awayShotsOnTarget !== null && data.awayShots !== null && data.awayShotsOnTarget > data.awayShots) {
    ctx.addIssue({ code: "custom", path: ["awayShotsOnTarget"], message: "Celne strzały nie mogą przekraczać wszystkich strzałów" });
  }
});

export type MatchFormData = z.infer<typeof matchFormSchema>;
