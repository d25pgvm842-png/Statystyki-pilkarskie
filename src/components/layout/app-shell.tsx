"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  FileUp,
  FlaskConical,
  Gauge,
  HardDriveDownload,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  Radar,
  Scale,
  Search,
  Settings,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  isNavigationItemActive,
  navigationGroupsForRole,
  pageTitleForPath,
  type NavigationGroup,
} from "@/components/layout/app-navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canWrite } from "@/lib/permissions";

const SIDEBAR_STORAGE_KEY = "staty-sidebar-collapsed";
const SIDEBAR_EVENT = "staty-sidebar-change";

function subscribeSidebar(callback: () => void) {
  window.addEventListener(SIDEBAR_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

function getSidebarServerSnapshot() {
  return false;
}

const iconByName: Record<string, LucideIcon> = {
  dashboard: Gauge,
  matches: DatabaseZap,
  analysis: Activity,
  playPlan: ClipboardList,
  journal: BookOpen,
  scanner: Search,
  recommendations: Sparkles,
  backtest: FlaskConical,
  strategies: ListChecks,
  portfolio: WalletCards,
  monitoring: Radar,
  trends: TrendingUp,
  ratings: Trophy,
  teams: Users,
  referees: Scale,
  imports: FileUp,
  dataQuality: ShieldCheck,
  automation: Bot,
  dataManagement: HardDriveDownload,
  settings: Settings,
};

function NavigationContent({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavigationGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <div
            className={cn(
              "px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400",
              collapsed && "sr-only",
            )}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const Icon = iconByName[item.icon] ?? Gauge;
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-lg text-sm font-medium transition",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; role: string };
}) {
  const pathname = usePathname();
  const groups = useMemo(() => navigationGroupsForRole(user.role), [user.role]);
  const title = pageTitleForPath(pathname, groups);
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);
  const [mobileOpen, setMobileOpen] = useState(false);
  const writable = canWrite(user.role);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  return (
    <div className={cn("min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50", !writable && "viewer-read-only")}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 lg:flex dark:border-zinc-800 dark:bg-zinc-900",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800", collapsed ? "justify-center" : "gap-3")}>
          <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold">
            <BarChart3 className="shrink-0 text-emerald-600" size={23} />
            <span className={cn("truncate", collapsed && "sr-only")}>Staty piłkarskie</span>
          </Link>
        </div>

        <NavigationContent groups={groups} pathname={pathname} collapsed={collapsed} />

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-10 w-full items-center rounded-lg text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
              collapsed ? "justify-center" : "gap-3 px-3",
            )}
            aria-label={collapsed ? "Rozwiń menu" : "Zwiń menu"}
            title={collapsed ? "Rozwiń menu" : undefined}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            <span className={cn(collapsed && "sr-only")}>Zwiń menu</span>
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Zamknij menu"
          />
          <aside className="relative flex h-full w-[min(88vw,340px)] flex-col bg-white shadow-2xl dark:bg-zinc-900">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 font-semibold">
                <BarChart3 className="text-emerald-600" size={23} />
                <span>Staty piłkarskie</span>
              </Link>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu">
                <X size={19} />
              </Button>
            </div>

            <NavigationContent groups={groups} pathname={pathname} collapsed={false} onNavigate={() => setMobileOpen(false)} />

            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-3 text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-zinc-500">{user.role}</div>
              </div>
              <form action={logoutAction} data-viewer-allowed>
                <Button type="submit" variant="secondary" className="w-full">
                  <LogOut size={17} className="mr-2" />Wyloguj
                </Button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}

      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Otwórz menu"
            >
              <Menu size={20} />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold sm:text-lg">{title}</div>
            </div>
            {writable ? (
              <Link href="/matches/new" data-requires-write>
                <Button size="sm" aria-label="Dodaj mecz">
                  <PlusCircle size={16} className="sm:mr-2" />
                  <span className="hidden sm:inline">Dodaj mecz</span>
                </Button>
              </Link>
            ) : (
              <span className="hidden rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 sm:inline dark:border-zinc-700">Tylko odczyt</span>
            )}
            <ThemeToggle />
            <div className="hidden text-right text-xs xl:block">
              <div className="max-w-40 truncate font-medium">{user.name}</div>
              <div className="text-zinc-500">{user.role}</div>
            </div>
            <form action={logoutAction} className="hidden lg:block" data-viewer-allowed>
              <Button variant="ghost" size="sm" aria-label="Wyloguj"><LogOut size={17} /></Button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
