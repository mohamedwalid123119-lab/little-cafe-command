
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, activeNavItem } from "@/lib/nav";
import { MODULES } from "@/lib/permissions";
import { routeTree } from "@/routeTree.gen";

describe("App routing", () => {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
  });

  it("registers the root route as the entry redirect", () => {
    const rootRoute = router.routesById["/"];

    expect(rootRoute).toBeDefined();
    expect(rootRoute.options.beforeLoad).toBeTypeOf("function");
  });

  it("redirects the root route to /auth", () => {
    const beforeLoad = router.routesById["/"].options.beforeLoad;

    expect(beforeLoad).toBeTypeOf("function");

    let caughtError: unknown;

    try {
      beforeLoad?.({
        params: {},
        context: { queryClient: new QueryClient() },
        location: router.buildLocation({ to: "/" }),
        navigate: router.navigate,
        cause: "enter",
        abortController: new AbortController(),
        preload: false,
        matches: [],
        routeId: "/",
        search: {},
      } as never);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({
      to: "/auth",
      replace: true,
    });
  });

  it("keeps the auth page available as the main entry page", () => {
    expect(router.matchRoutes("/auth").at(-1)?.routeId).toBe("/auth");
  });

  it("has one sidebar link per existing module", () => {
    expect(NAV_ITEMS.map((i) => i.module).sort()).toEqual(
      Object.keys(MODULES).sort(),
    );
  });

  it.each(NAV_ITEMS.map((i) => [i.path, i.module]))(
    "sidebar link %s opens its own page",
    (path, module) => {
      const leaf = router.matchRoutes(path).at(-1)?.routeId;
      const expected =
        module === "dashboard"
          ? "/_authenticated/app/"
          : `/_authenticated${path}`;

      expect(leaf).toBe(expected);
    },
  );

  it("highlights the section that is open", () => {
    expect(activeNavItem("/app")?.module).toBe("dashboard");
    expect(activeNavItem("/app/")?.module).toBe("dashboard");
    expect(activeNavItem("/app/recipes")?.module).toBe("recipes");
    expect(activeNavItem("/app/pos")?.module).toBe("pos");
  });
});
