export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          summary: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          expected_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          status: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          status?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payment_method: string | null
          spent_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          spent_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          spent_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_cost_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          ingredient_id: string
          new_cost_per_base_unit: number
          new_purchase_price: number
          new_purchase_quantity: number
          new_purchase_unit: string
          old_cost_per_base_unit: number | null
          old_purchase_price: number | null
          old_purchase_quantity: number | null
          old_purchase_unit: string | null
          tenant_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          ingredient_id: string
          new_cost_per_base_unit: number
          new_purchase_price: number
          new_purchase_quantity: number
          new_purchase_unit: string
          old_cost_per_base_unit?: number | null
          old_purchase_price?: number | null
          old_purchase_quantity?: number | null
          old_purchase_unit?: string | null
          tenant_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string
          new_cost_per_base_unit?: number
          new_purchase_price?: number
          new_purchase_quantity?: number
          new_purchase_unit?: string
          old_cost_per_base_unit?: number | null
          old_purchase_price?: number | null
          old_purchase_quantity?: number | null
          old_purchase_unit?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_cost_history_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_cost_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          base_unit: string
          cost_per_base_unit: number
          created_at: string
          created_by: string | null
          group_name: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["ingredient_kind"]
          name: string
          notes: string | null
          purchase_price: number
          purchase_quantity: number
          purchase_unit: string
          reorder_level: number | null
          sku: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_unit?: string
          cost_per_base_unit?: number
          created_at?: string
          created_by?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["ingredient_kind"]
          name: string
          notes?: string | null
          purchase_price: number
          purchase_quantity: number
          purchase_unit: string
          reorder_level?: number | null
          sku?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_unit?: string
          cost_per_base_unit?: number
          created_at?: string
          created_by?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["ingredient_kind"]
          name?: string
          notes?: string | null
          purchase_price?: number
          purchase_quantity?: number
          purchase_unit?: string
          reorder_level?: number | null
          sku?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_base_unit_fkey"
            columns: ["base_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "ingredients_purchase_unit_fkey"
            columns: ["purchase_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "ingredients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          tenant_id: string
          unit_cost?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "inventory_movements_ingredient_id_tenant_id_fkey"
            columns: ["ingredient_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          modules: string[] | null
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          modules?: string[] | null
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          modules?: string[] | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          is_active: boolean
          name: string
          price_delta: number
          quantity: number | null
          tenant_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          is_active?: boolean
          name: string
          price_delta?: number
          quantity?: number | null
          tenant_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          is_active?: boolean
          name?: string
          price_delta?: number
          quantity?: number | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_ingredient_id_tenant_id_fkey"
            columns: ["ingredient_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "modifiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          tenant_id: string
          unit_cost: number | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          tenant_id: string
          unit_cost?: number | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          tenant_id?: string
          unit_cost?: number | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_tenant_id_fkey"
            columns: ["order_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "order_items_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_tenant_id_fkey"
            columns: ["variant_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_tenant_id_fkey"
            columns: ["variant_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_variant_costing"
            referencedColumns: ["variant_id", "tenant_id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          cash_session_id: string | null
          created_at: string
          created_by: string | null
          discount: number
          id: string
          notes: string | null
          order_number: number
          order_type: string
          payment_method: string | null
          status: string
          subtotal: number
          tax: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          cash_session_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_number?: never
          order_type?: string
          payment_method?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cash_session_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_number?: never
          order_type?: string
          payment_method?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "orders_cash_session_id_branch_id_tenant_id_fkey"
            columns: ["cash_session_id", "branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id", "branch_id", "tenant_id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifiers: {
        Row: {
          modifier_id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          modifier_id: string
          product_id: string
          tenant_id: string
        }
        Update: {
          modifier_id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifiers_modifier_id_tenant_id_fkey"
            columns: ["modifier_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "product_modifiers_modifier_id_tenant_id_fkey"
            columns: ["modifier_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_modifier_costing"
            referencedColumns: ["modifier_id", "tenant_id"]
          },
          {
            foreignKeyName: "product_modifiers_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "product_modifiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          product_id: string
          recipe_id: string | null
          selling_price: number
          sort_order: number
          temperature: Database["public"]["Enums"]["drink_temperature"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          product_id: string
          recipe_id?: string | null
          selling_price: number
          sort_order?: number
          temperature?: Database["public"]["Enums"]["drink_temperature"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          product_id?: string
          recipe_id?: string | null
          selling_price?: number
          sort_order?: number
          temperature?: Database["public"]["Enums"]["drink_temperature"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "product_variants_recipe_id_tenant_id_fkey"
            columns: ["recipe_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_tenant_id_fkey"
            columns: ["category_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          line_total: number | null
          purchase_id: string
          quantity: number
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          line_total?: number | null
          purchase_id: string
          quantity: number
          tenant_id: string
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          line_total?: number | null
          purchase_id?: string
          quantity?: number
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_ingredient_id_tenant_id_fkey"
            columns: ["ingredient_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_tenant_id_fkey"
            columns: ["purchase_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "purchase_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          received_at: string | null
          reference_number: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          reference_number?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          reference_number?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_tenant_id_fkey"
            columns: ["supplier_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_cost_snapshots: {
        Row: {
          cost_per_portion: number
          created_at: string
          id: string
          ingredient_cost: number
          packaging_cost: number
          reason: string | null
          recipe_id: string
          tenant_id: string
          total_cost: number
          waste_cost: number
        }
        Insert: {
          cost_per_portion: number
          created_at?: string
          id?: string
          ingredient_cost: number
          packaging_cost: number
          reason?: string | null
          recipe_id: string
          tenant_id: string
          total_cost: number
          waste_cost: number
        }
        Update: {
          cost_per_portion?: number
          created_at?: string
          id?: string
          ingredient_cost?: number
          packaging_cost?: number
          reason?: string | null
          recipe_id?: string
          tenant_id?: string
          total_cost?: number
          waste_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_cost_snapshots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_cost_snapshots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_variant_costing"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_cost_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          is_optional: boolean
          line_cost: number
          notes: string | null
          quantity: number
          recipe_id: string
          sort_order: number
          sub_recipe_id: string | null
          tenant_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          is_optional?: boolean
          line_cost?: number
          notes?: string | null
          quantity: number
          recipe_id: string
          sort_order?: number
          sub_recipe_id?: string | null
          tenant_id: string
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          is_optional?: boolean
          line_cost?: number
          notes?: string | null
          quantity?: number
          recipe_id?: string
          sort_order?: number
          sub_recipe_id?: string | null
          tenant_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_tenant_id_fkey"
            columns: ["ingredient_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_tenant_id_fkey"
            columns: ["recipe_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "recipe_items_sub_recipe_id_tenant_id_fkey"
            columns: ["sub_recipe_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "recipe_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      recipes: {
        Row: {
          cost_per_portion: number
          cost_per_unit: number
          cost_updated_at: string | null
          created_at: string
          created_by: string | null
          id: string
          ingredient_cost: number
          instructions: string | null
          is_active: boolean
          kind: Database["public"]["Enums"]["recipe_kind"]
          name: string
          optional_cost: number
          packaging_cost: number
          tenant_id: string
          total_cost: number
          updated_at: string
          waste_cost: number
          waste_percent: number
          yield_quantity: number
          yield_unit: string
        }
        Insert: {
          cost_per_portion?: number
          cost_per_unit?: number
          cost_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_cost?: number
          instructions?: string | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["recipe_kind"]
          name: string
          optional_cost?: number
          packaging_cost?: number
          tenant_id: string
          total_cost?: number
          updated_at?: string
          waste_cost?: number
          waste_percent?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Update: {
          cost_per_portion?: number
          cost_per_unit?: number
          cost_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_cost?: number
          instructions?: string | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["recipe_kind"]
          name?: string
          optional_cost?: number
          packaging_cost?: number
          tenant_id?: string
          total_cost?: number
          updated_at?: string
          waste_cost?: number
          waste_percent?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_yield_unit_fkey"
            columns: ["yield_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      subscription_history: {
        Row: {
          created_at: string
          created_by: string | null
          event: string
          from_status: Database["public"]["Enums"]["subscription_status"] | null
          id: string
          note: string | null
          plan_id: string | null
          subscription_id: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["subscription_status"] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          note?: string | null
          plan_id?: string | null
          subscription_id?: string | null
          tenant_id: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event?: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          note?: string | null
          plan_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_branches: number | null
          max_users: number | null
          name_ar: string
          price_monthly_egp: number
          sort_order: number
          trial_days: number
        }
        Insert: {
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_users?: number | null
          name_ar: string
          price_monthly_egp?: number
          sort_order?: number
          trial_days?: number
        }
        Update: {
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_users?: number | null
          name_ar?: string
          price_monthly_egp?: number
          sort_order?: number
          trial_days?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          is_demo: boolean
          locale: string
          name: string
          phone: string | null
          prices_include_vat: boolean
          status: Database["public"]["Enums"]["tenant_status"]
          target_food_cost_percent: number
          timezone: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          is_demo?: boolean
          locale?: string
          name: string
          phone?: string | null
          prices_include_vat?: boolean
          status?: Database["public"]["Enums"]["tenant_status"]
          target_food_cost_percent?: number
          timezone?: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          is_demo?: boolean
          locale?: string
          name?: string
          phone?: string | null
          prices_include_vat?: boolean
          status?: Database["public"]["Enums"]["tenant_status"]
          target_food_cost_percent?: number
          timezone?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      units: {
        Row: {
          code: string
          dimension: Database["public"]["Enums"]["unit_dimension"]
          factor_to_base: number
          name_ar: string
          sort_order: number
        }
        Insert: {
          code: string
          dimension: Database["public"]["Enums"]["unit_dimension"]
          factor_to_base: number
          name_ar: string
          sort_order?: number
        }
        Update: {
          code?: string
          dimension?: Database["public"]["Enums"]["unit_dimension"]
          factor_to_base?: number
          name_ar?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_ingredient_stock: {
        Row: {
          branch_id: string | null
          ingredient_id: string | null
          last_movement_at: string | null
          quantity: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_tenant_id_fkey"
            columns: ["branch_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "inventory_movements_ingredient_id_tenant_id_fkey"
            columns: ["ingredient_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_modifier_costing: {
        Row: {
          cost: number | null
          ingredient_id: string | null
          ingredient_name: string | null
          is_active: boolean | null
          modifier_id: string | null
          name: string | null
          price_delta: number | null
          quantity: number | null
          tenant_id: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_ingredient_id_tenant_id_fkey"
            columns: ["ingredient_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "modifiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      v_variant_costing: {
        Row: {
          category_id: string | null
          category_name: string | null
          cost_updated_at: string | null
          image_path: string | null
          ingredient_cost: number | null
          is_active: boolean | null
          net_price: number | null
          packaging_cost: number | null
          previous_cost_at: string | null
          previous_total_cost: number | null
          product_active: boolean | null
          product_id: string | null
          product_name: string | null
          recipe_id: string | null
          recipe_name: string | null
          selling_price: number | null
          target_food_cost_percent: number | null
          temperature: Database["public"]["Enums"]["drink_temperature"] | null
          tenant_id: string | null
          total_cost: number | null
          variant_id: string | null
          variant_name: string | null
          waste_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      base_unit_for: {
        Args: { _dim: Database["public"]["Enums"]["unit_dimension"] }
        Returns: string
      }
      can_write: {
        Args: { _module: string; _tenant: string }
        Returns: boolean
      }
      create_sale: {
        Args: {
          _branch: string
          _discount?: number
          _items: Json
          _notes?: string
          _order_type?: string
          _payment_method?: string
          _tenant: string
        }
        Returns: string
      }
      create_tenant: {
        Args: {
          _branch_name?: string
          _city?: string
          _is_demo?: boolean
          _name: string
          _phone?: string
        }
        Returns: string
      }
      dashboard_overview: {
        Args: {
          _branch?: string
          _from?: string
          _tenant: string
          _to?: string
        }
        Returns: Json
      }
      duplicate_recipe: {
        Args: { _name: string; _source: string }
        Returns: string
      }
      has_module: {
        Args: { _module: string; _tenant: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_member: { Args: { _tenant: string }; Returns: boolean }
      is_tenant_owner: { Args: { _tenant: string }; Returns: boolean }
      period_kpis: {
        Args: { _branch: string; _from: string; _tenant: string; _to: string }
        Returns: Json
      }
      recalc_recipe: {
        Args: { _reason?: string; _recipe: string }
        Returns: undefined
      }
      recalc_tenant_recipes: { Args: { _tenant: string }; Returns: number }
      recipe_consumption: {
        Args: { _portions: number; _recipe: string }
        Returns: {
          ingredient_id: string
          quantity: number
        }[]
      }
      role_default_modules: {
        Args: { _role: Database["public"]["Enums"]["tenant_role"] }
        Returns: string[]
      }
      seed_demo_data: { Args: { _tenant: string }; Returns: undefined }
      shares_tenant_with: { Args: { _other: string }; Returns: boolean }
      tenant_is_writable: { Args: { _tenant: string }; Returns: boolean }
      unit_dim: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["unit_dimension"]
      }
      void_order: {
        Args: { _order: string; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "platform_admin" | "platform_support"
      drink_temperature: "none" | "hot" | "iced"
      ingredient_kind: "raw" | "packaging"
      recipe_kind: "menu_item" | "sub_recipe"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "expired"
      tenant_role:
        | "owner"
        | "manager"
        | "cashier"
        | "barista"
        | "inventory_manager"
      tenant_status: "trial" | "active" | "suspended" | "cancelled"
      unit_dimension: "mass" | "volume" | "count"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["platform_admin", "platform_support"],
      drink_temperature: ["none", "hot", "iced"],
      ingredient_kind: ["raw", "packaging"],
      recipe_kind: ["menu_item", "sub_recipe"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "expired",
      ],
      tenant_role: [
        "owner",
        "manager",
        "cashier",
        "barista",
        "inventory_manager",
      ],
      tenant_status: ["trial", "active", "suspended", "cancelled"],
      unit_dimension: ["mass", "volume", "count"],
    },
  },
} as const
