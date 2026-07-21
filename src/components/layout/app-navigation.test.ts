import assert from "node:assert/strict";
import test from "node:test";
import {
  isNavigationItemActive,
  navigationGroupsForRole,
  pageTitleForPath,
} from "./app-navigation";

test("root navigation is active only on dashboard", () => {
  assert.equal(isNavigationItemActive("/", "/"), true);
  assert.equal(isNavigationItemActive("/matches", "/"), false);
});

test("nested route activates its parent navigation item", () => {
  assert.equal(isNavigationItemActive("/matches/new", "/matches"), true);
  assert.equal(isNavigationItemActive("/analysis", "/matches"), false);
});

test("administration group is hidden outside ADMIN role", () => {
  const analystPaths = navigationGroupsForRole("ANALYST").flatMap((group) => group.items.map((item) => item.href));
  const adminPaths = navigationGroupsForRole("ADMIN").flatMap((group) => group.items.map((item) => item.href));

  assert.equal(analystPaths.includes("/settings"), false);
  assert.equal(adminPaths.includes("/settings"), true);
});

test("topbar uses a precise title for nested screens", () => {
  const groups = navigationGroupsForRole("ADMIN");
  assert.equal(pageTitleForPath("/matches/new", groups), "Dodaj mecz");
  assert.equal(pageTitleForPath("/recommendations", groups), "Centrum dnia");
});
