export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Główne",
    items: [
      { href: "/", label: "Dashboard", icon: "dashboard" },
      { href: "/matches", label: "Mecze", icon: "matches" },
      { href: "/analysis", label: "Analiza", icon: "analysis" },
      { href: "/play-plan", label: "Plan gry", icon: "playPlan" },
      { href: "/journal", label: "Dziennik", icon: "journal" },
    ],
  },
  {
    label: "Decyzje i strategie",
    items: [
      { href: "/scanner", label: "Skaner", icon: "scanner" },
      { href: "/recommendations", label: "Centrum dnia", icon: "recommendations" },
      { href: "/backtest", label: "Backtest", icon: "backtest" },
      { href: "/strategies", label: "Strategie", icon: "strategies" },
      { href: "/portfolio", label: "Portfel", icon: "portfolio" },
      { href: "/monitoring", label: "Nadzór", icon: "monitoring" },
    ],
  },
  {
    label: "Analityka",
    items: [
      { href: "/trends", label: "Trendy", icon: "trends" },
      { href: "/ratings", label: "Rankingi", icon: "ratings" },
    ],
  },
  {
    label: "Dane",
    items: [
      { href: "/teams", label: "Drużyny", icon: "teams" },
      { href: "/referees", label: "Sędziowie", icon: "referees" },
      { href: "/imports", label: "Import", icon: "imports" },
      { href: "/data-quality", label: "Kontrola danych", icon: "dataQuality" },
    ],
  },
  {
    label: "Administracja",
    items: [
      { href: "/automation", label: "Automatyzacja", icon: "automation", adminOnly: true },
      { href: "/data-management", label: "Dane i kopie", icon: "dataManagement", adminOnly: true },
      { href: "/settings", label: "Konfiguracja", icon: "settings", adminOnly: true },
    ],
  },
];

const explicitPageTitles: Array<[string, string]> = [
  ["/matches/new", "Dodaj mecz"],
  ["/journal/calibration", "Kalibracja dziennika"],
  ["/automation/current-data", "Aktualne dane"],
  ["/automation/public-data", "Dane publiczne"],
  ["/automation/team-duplicates", "Duplikaty drużyn"],
];

export function navigationGroupsForRole(role: string) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || role === "ADMIN"),
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitleForPath(pathname: string, groups: NavigationGroup[]) {
  const explicit = explicitPageTitles.find(([prefix]) => isNavigationItemActive(pathname, prefix));
  if (explicit) return explicit[1];

  const item = groups
    .flatMap((group) => group.items)
    .filter((candidate) => isNavigationItemActive(pathname, candidate.href))
    .sort((left, right) => right.href.length - left.href.length)[0];

  return item?.label ?? "Staty piłkarskie";
}
