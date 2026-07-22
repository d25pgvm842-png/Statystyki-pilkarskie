import assert from "node:assert/strict";
import test from "node:test";
import {
  isNavigationItemActive,
  navigationGroupsForRole,
  pageTitleForPath,
} from "./app-navigation";

test("root navigation is active only on today screen", () => {
  assert.equal(isNavigationItemActive("/", "/"), true);
  assert.equal(isNavigationItemActive("/matches", "/"), false);
});

test("nested route activates its parent navigation item", () => {
  assert.equal(isNavigationItemActive("/matches/new", "/matches"), true);
  assert.equal(isNavigationItemActive("/analysis", "/matches"), false);
});

test("simple daily workflow stays on the first level", () => {
  const groups = navigationGroupsForRole("ANALYST");
  const main = groups.find((group) => group.label === "Codzienna praca");
  assert.deepEqual(main?.items.map((item) => item.label), ["Dziś", "Mecze", "Analiza meczu", "Dziennik", "Dane"]);
  assert.equal(groups.find((group) => group.label === "Zaawansowane")?.collapsible, true);
});

test("administration group is hidden outside ADMIN role", () => {
  const analystPaths = navigationGroupsForRole("ANALYST").flatMap((group) => group.items.map((item) => item.href));
  const adminPaths = navigationGroupsForRole("ADMIN").flatMap((group) => group.items.map((item) => item.href));

  assert.equal(analystPaths.includes("/settings"), false);
  assert.equal(adminPaths.includes("/settings"), true);
});

test("topbar uses simple and precise titles", () => {
  const groups = navigationGroupsForRole("ADMIN");
  assert.equal(pageTitleForPath("/", groups), "Dziś");
  assert.equal(pageTitleForPath("/matches/new", groups), "Dodaj mecz");
  assert.equal(pageTitleForPath("/recommendations", groups), "Centrum dnia");
});
