import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UnitDef } from "./costing";

async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const q = {
  myMemberships: (userId: string) =>
    queryOptions({
      queryKey: ["my-memberships", userId],
      queryFn: () =>
        run(
          supabase
            .from("memberships")
            .select("id, tenant_id, role, modules, tenant:tenants(name)")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("created_at"),
        ),
    }),
  units: () =>
    queryOptions({
      queryKey: ["units"],
      staleTime: Infinity,
      queryFn: () => run(supabase.from("units").select("code, name_ar, dimension, factor_to_base").order("sort_order")) as Promise<UnitDef[]>,
    }),
  tenant: (t: string) =>
    queryOptions({
      queryKey: ["tenant", t],
      queryFn: () => run(supabase.from("tenants").select("*").eq("id", t).single()),
    }),
  ingredients: (t: string) =>
    queryOptions({
      queryKey: ["ingredients", t],
      queryFn: () => run(supabase.from("ingredients").select("*").eq("tenant_id", t).order("group_name").order("name")),
    }),
  ingredientHistory: (id: string) =>
    queryOptions({
      queryKey: ["ingredient-history", id],
      queryFn: () =>
        run(supabase.from("ingredient_cost_history").select("*").eq("ingredient_id", id).order("created_at", { ascending: false }).limit(50)),
    }),
  recipes: (t: string) =>
    queryOptions({
      queryKey: ["recipes", t],
      queryFn: () => run(supabase.from("recipes").select("*").eq("tenant_id", t).order("kind", { ascending: false }).order("name")),
    }),
  recipe: (id: string) =>
    queryOptions({
      queryKey: ["recipe", id],
      queryFn: () => run(supabase.from("recipes").select("*").eq("id", id).single()),
    }),
  recipeItems: (id: string) =>
    queryOptions({
      queryKey: ["recipe-items", id],
      queryFn: () =>
        run(
          supabase
            .from("recipe_items")
            .select("*, ingredient:ingredients(id, name, kind, base_unit, cost_per_base_unit), sub_recipe:recipes!recipe_items_sub_recipe_id_tenant_id_fkey(id, name, yield_unit, cost_per_unit)")
            .eq("recipe_id", id)
            .order("sort_order")
            .order("created_at"),
        ),
    }),
  recipeSnapshots: (id: string) =>
    queryOptions({
      queryKey: ["recipe-snapshots", id],
      queryFn: () =>
        run(supabase.from("recipe_cost_snapshots").select("*").eq("recipe_id", id).order("created_at", { ascending: false }).limit(30)),
    }),
  recipeUsage: (id: string) =>
    queryOptions({
      queryKey: ["recipe-usage", id],
      queryFn: () => run(supabase.from("v_variant_costing").select("variant_id, product_name, variant_name, temperature, selling_price, net_price, total_cost").eq("recipe_id", id)),
    }),
  categories: (t: string) =>
    queryOptions({
      queryKey: ["categories", t],
      queryFn: () => run(supabase.from("categories").select("*").eq("tenant_id", t).order("sort_order").order("name")),
    }),
  products: (t: string) =>
    queryOptions({
      queryKey: ["products", t],
      queryFn: () =>
        run(
          supabase
            .from("products")
            .select("*, product_variants(*), product_modifiers(modifier_id)")
            .eq("tenant_id", t)
            .order("sort_order")
            .order("name"),
        ),
    }),
  modifiers: (t: string) =>
    queryOptions({
      queryKey: ["modifiers", t],
      queryFn: () => run(supabase.from("v_modifier_costing").select("*").eq("tenant_id", t).order("name")),
    }),
  costing: (t: string) =>
    queryOptions({
      queryKey: ["costing", t],
      queryFn: () => run(supabase.from("v_variant_costing").select("*").eq("tenant_id", t).order("category_name").order("product_name")),
    }),
  branches: (t: string) =>
    queryOptions({
      queryKey: ["branches", t],
      queryFn: () => run(supabase.from("branches").select("*").eq("tenant_id", t).order("is_main", { ascending: false }).order("name")),
    }),
  subscription: (t: string) =>
    queryOptions({
      queryKey: ["subscription", t],
      queryFn: () =>
        run(supabase.from("subscriptions").select("*, plan:subscription_plans(*)").eq("tenant_id", t).order("created_at", { ascending: false }).limit(1).maybeSingle()),
    }),
  members: (t: string) =>
    queryOptions({
      queryKey: ["members", t],
      queryFn: async () => {
        const ms = await run(supabase.from("memberships").select("id, user_id, role, modules, is_active, created_at").eq("tenant_id", t));
        const ids = ms.map((m) => m.user_id);
        const profiles = ids.length ? await run(supabase.from("profiles").select("id, full_name, phone").in("id", ids)) : [];
        return ms.map((m) => ({ ...m, profile: profiles.find((p) => p.id === m.user_id) ?? null }));
      },
    }),
  recentPriceChanges: (t: string) =>
    queryOptions({
      queryKey: ["recent-price-changes", t],
      queryFn: () =>
        run(
          supabase
            .from("ingredient_cost_history")
            .select("*, ingredient:ingredients(name, base_unit)")
            .eq("tenant_id", t)
            .not("old_cost_per_base_unit", "is", null)
            .order("created_at", { ascending: false })
            .limit(6),
        ),
    }),
};
