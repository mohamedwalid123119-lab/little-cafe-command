
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, activeNavItem } from "@/lib/nav";
import { MODULES } from "@/lib/permissions";
import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering.
describe("App routing", () => {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
  });

  it("uses the root route as a redirect to the auth page", () => {
    expect(router.matchRoutes("/").at(-1)?.routeId).toBe("/");
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
        module === "dashboard" ? "/_authenticated/app/" : `/_authenticated${path}`;

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
