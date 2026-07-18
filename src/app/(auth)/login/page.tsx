import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";
import { loginAction } from "@/lib/actions/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2 text-emerald-600"><BarChart3 /><span className="font-semibold">Staty piłkarskie</span></div>
          <CardTitle>Logowanie administratora</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="grid gap-4">
            <Field label="E-mail"><Input name="email" type="email" autoComplete="email" required /></Field>
            <Field label="Hasło"><Input name="password" type="password" autoComplete="current-password" required /></Field>
            {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Nieprawidłowy e-mail lub hasło.</p> : null}
            <Button type="submit" className="w-full">Zaloguj</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
