import Link from "next/link";
import { BarChart3, DatabaseZap, Gauge, Scale, ShieldCheck, Users, PlusCircle, LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/matches", label: "Mecze", icon: DatabaseZap },
  { href: "/teams", label: "Drużyny", icon: Users },
  { href: "/referees", label: "Sędziowie", icon: Scale },
  { href: "/data-quality", label: "Kontrola danych", icon: ShieldCheck },
  { href: "/settings", label: "Konfiguracja", icon: Settings },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; role: string } }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BarChart3 className="text-emerald-600" size={22} />
            <span>Staty piłkarskie</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
                <Icon size={16} />{label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/matches/new" className="hidden sm:block">
              <Button size="sm"><PlusCircle size={16} className="mr-2" />Dodaj mecz</Button>
            </Link>
            <ThemeToggle />
            <div className="hidden text-right text-xs md:block">
              <div className="font-medium">{user.name}</div>
              <div className="text-zinc-500">{user.role}</div>
            </div>
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" aria-label="Wyloguj"><LogOut size={17} /></Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-2 lg:hidden dark:border-zinc-800">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">{label}</Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</main>
    </div>
  );
}
