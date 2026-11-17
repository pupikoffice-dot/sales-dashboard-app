// GENERATED from the BETA Supabase schema on 2026-11-17 (supabase generate types). Do not edit by hand.
// Regenerate after every migration: see docs/architecture/DATABASE-TYPES.md
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
      agent_devices: {
        Row: {
          agent_id: string
          android_version: string | null
          app_version: string | null
          device_fingerprint: string
          device_model: string | null
          id: string
          last_seen_at: string
          registered_at: string
          revoked: boolean
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          agent_id: string
          android_version?: string | null
          app_version?: string | null
          device_fingerprint: string
          device_model?: string | null
          id?: string
          last_seen_at?: string
          registered_at?: string
          revoked?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          agent_id?: string
          android_version?: string | null
          app_version?: string | null
          device_fingerprint?: string
          device_model?: string | null
          id?: string
          last_seen_at?: string
          registered_at?: string
          revoked?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_devices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_devices_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_bi_config: {
        Row: {
          habit_x: number
          habit_y: number
          id: boolean
          updated_at: string
        }
        Insert: {
          habit_x?: number
          habit_y?: number
          id?: boolean
          updated_at?: string
        }
        Update: {
          habit_x?: number
          habit_y?: number
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_bi_module: {
        Row: {
          active: boolean
          description: string | null
          id: string
          label: string
          needs_agent: string
          sort_order: number
          uses_habit: boolean
        }
        Insert: {
          active?: boolean
          description?: string | null
          id: string
          label: string
          needs_agent: string
          sort_order?: number
          uses_habit?: boolean
        }
        Update: {
          active?: boolean
          description?: string | null
          id?: string
          label?: string
          needs_agent?: string
          sort_order?: number
          uses_habit?: boolean
        }
        Relationships: []
      }
      app_class: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_grant: {
        Row: {
          class_id: string | null
          created_at: string
          effect: Database["public"]["Enums"]["grant_effect"]
          id: number
          key: string
          kind: Database["public"]["Enums"]["grant_kind"]
          user_id: string | null
          value: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          effect?: Database["public"]["Enums"]["grant_effect"]
          id?: number
          key: string
          kind: Database["public"]["Enums"]["grant_kind"]
          user_id?: string | null
          value?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          effect?: Database["public"]["Enums"]["grant_effect"]
          id?: number
          key?: string
          kind?: Database["public"]["Enums"]["grant_kind"]
          user_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_grant_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "app_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_grant_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_node: {
        Row: {
          active: boolean
          channel: Database["public"]["Enums"]["node_channel"]
          component: string | null
          config: Json
          id: string
          kind: Database["public"]["Enums"]["node_kind"]
          label: string
          route: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          channel?: Database["public"]["Enums"]["node_channel"]
          component?: string | null
          config?: Json
          id: string
          kind: Database["public"]["Enums"]["node_kind"]
          label: string
          route?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          channel?: Database["public"]["Enums"]["node_channel"]
          component?: string | null
          config?: Json
          id?: string
          kind?: Database["public"]["Enums"]["node_kind"]
          label?: string
          route?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      app_node_edge: {
        Row: {
          child_id: string
          config: Json
          parent_id: string
          sort_order: number
        }
        Insert: {
          child_id: string
          config?: Json
          parent_id: string
          sort_order?: number
        }
        Update: {
          child_id?: string
          config?: Json
          parent_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_node_edge_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "app_node"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_node_edge_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "app_node"
            referencedColumns: ["id"]
          },
        ]
      }
      app_restore_point: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: number
          label: string
          notes: string | null
          rpc_version: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          id?: number
          label: string
          notes?: string | null
          rpc_version: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: number
          label?: string
          notes?: string | null
          rpc_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_restore_point_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_runtime_config: {
        Row: {
          active_version: string
          id: boolean
          rpc_version: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_version?: string
          id?: boolean
          rpc_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_version?: string
          id?: boolean
          rpc_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_runtime_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_ui_module: {
        Row: {
          active: boolean
          description: string | null
          id: string
          kind: string
          label: string
          sort_order: number
          surface: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          id: string
          kind: string
          label: string
          sort_order?: number
          surface: string
        }
        Update: {
          active?: boolean
          description?: string | null
          id?: string
          kind?: string
          label?: string
          sort_order?: number
          surface?: string
        }
        Relationships: []
      }
      app_user_class: {
        Row: {
          class_id: string
          user_id: string
        }
        Insert: {
          class_id: string
          user_id: string
        }
        Update: {
          class_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_class_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "app_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_class_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_version: {
        Row: {
          channel: Database["public"]["Enums"]["node_channel"]
          config: Json
          deployment_url: string | null
          is_stable: boolean
          released_at: string
          released_by: string | null
          rpc_version: string
          summary: string
          version: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["node_channel"]
          config: Json
          deployment_url?: string | null
          is_stable?: boolean
          released_at?: string
          released_by?: string | null
          rpc_version: string
          summary: string
          version: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["node_channel"]
          config?: Json
          deployment_url?: string | null
          is_stable?: boolean
          released_at?: string
          released_by?: string | null
          rpc_version?: string
          summary?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_version_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      category_control_writers: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_control_writers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_removal_log: {
        Row: {
          chain_id: string
          chain_name: string | null
          company: string
          id: string
          removed_at: string
          removed_by: string | null
          removed_by_email: string | null
          removed_count: number
        }
        Insert: {
          chain_id: string
          chain_name?: string | null
          company: string
          id?: string
          removed_at?: string
          removed_by?: string | null
          removed_by_email?: string | null
          removed_count: number
        }
        Update: {
          chain_id?: string
          chain_name?: string | null
          company?: string
          id?: string
          removed_at?: string
          removed_by?: string | null
          removed_by_email?: string | null
          removed_count?: number
        }
        Relationships: []
      }
      chains: {
        Row: {
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_oversight_layout: {
        Row: {
          class_id: string
          layout: Json
          updated_at: string
        }
        Insert: {
          class_id: string
          layout: Json
          updated_at?: string
        }
        Update: {
          class_id?: string
          layout?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_oversight_layout_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "app_class"
            referencedColumns: ["id"]
          },
        ]
      }
      client_chains: {
        Row: {
          chain_id: string
          client_id: string
          company: string
          source: string
          updated_at: string
        }
        Insert: {
          chain_id: string
          client_id: string
          company: string
          source: string
          updated_at?: string
        }
        Update: {
          chain_id?: string
          client_id?: string
          company?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_chains_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      client_debt_lines: {
        Row: {
          agent_erp_id: string | null
          amount: number | null
          bucket_date: string | null
          client_name: string | null
          company: string
          debt_month: number | null
          erp_client_id: string
          id: number
          note: string | null
          synced_at: string
        }
        Insert: {
          agent_erp_id?: string | null
          amount?: number | null
          bucket_date?: string | null
          client_name?: string | null
          company: string
          debt_month?: number | null
          erp_client_id: string
          id?: number
          note?: string | null
          synced_at?: string
        }
        Update: {
          agent_erp_id?: string | null
          amount?: number | null
          bucket_date?: string | null
          client_name?: string | null
          company?: string
          debt_month?: number | null
          erp_client_id?: string
          id?: number
          note?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      client_payment_receipts: {
        Row: {
          agent_erp_id: string | null
          amount_paid: number | null
          city: string | null
          client_name: string | null
          company: string
          erp_client_id: string
          id: number
          payment_due_date: string | null
          receipt_issued_date: string | null
          receipt_num: string
          synced_at: string
        }
        Insert: {
          agent_erp_id?: string | null
          amount_paid?: number | null
          city?: string | null
          client_name?: string | null
          company: string
          erp_client_id: string
          id?: number
          payment_due_date?: string | null
          receipt_issued_date?: string | null
          receipt_num: string
          synced_at?: string
        }
        Update: {
          agent_erp_id?: string | null
          amount_paid?: number | null
          city?: string | null
          client_name?: string | null
          company?: string
          erp_client_id?: string
          id?: number
          payment_due_date?: string | null
          receipt_issued_date?: string | null
          receipt_num?: string
          synced_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          assigned_agent_id: string | null
          city: string | null
          company: string
          email: string | null
          erp_agent_id: string | null
          erp_client_id: string
          id: string
          name: string
          phone: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          assigned_agent_id?: string | null
          city?: string | null
          company: string
          email?: string | null
          erp_agent_id?: string | null
          erp_client_id: string
          id?: string
          name: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          assigned_agent_id?: string | null
          city?: string | null
          company?: string
          email?: string | null
          erp_agent_id?: string | null
          erp_client_id?: string
          id?: string
          name?: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_cache_keys: {
        Row: {
          created_at: string
          key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          key: string
          user_id: string
        }
        Update: {
          created_at?: string
          key?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_modules: {
        Row: {
          description: string | null
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id: string
          label: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      dashboard_user_access: {
        Row: {
          active: boolean
          agents: string[] | null
          companies: string[]
          default_module: string | null
          hidden_sidebar: string[]
          hidden_years: number[]
          locale: string
          modules: string[]
          oversite_modules: string[] | null
          show_client_profit: boolean
          show_item_cost: boolean
          this_year_only: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          agents?: string[] | null
          companies?: string[]
          default_module?: string | null
          hidden_sidebar?: string[]
          hidden_years?: number[]
          locale?: string
          modules?: string[]
          oversite_modules?: string[] | null
          show_client_profit?: boolean
          show_item_cost?: boolean
          this_year_only?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          agents?: string[] | null
          companies?: string[]
          default_module?: string | null
          hidden_sidebar?: string[]
          hidden_years?: number[]
          locale?: string
          modules?: string[]
          oversite_modules?: string[] | null
          show_client_profit?: boolean
          show_item_cost?: boolean
          this_year_only?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_access_default_module_fkey"
            columns: ["default_module"]
            isOneToOne: false
            referencedRelation: "dashboard_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_user_bi: {
        Row: {
          bi_module_id: string
          user_id: string
        }
        Insert: {
          bi_module_id: string
          user_id: string
        }
        Update: {
          bi_module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_bi_bi_module_id_fkey"
            columns: ["bi_module_id"]
            isOneToOne: false
            referencedRelation: "app_bi_module"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_user_link: {
        Row: {
          created_at: string
          linked_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          linked_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          linked_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_link_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_link_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_user_link_active: {
        Row: {
          active_as_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_as_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_as_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_link_active_active_as_user_id_fkey"
            columns: ["active_as_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_link_active_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_user_prefs: {
        Row: {
          skin: string
          updated_at: string
          user_id: string
        }
        Insert: {
          skin?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          skin?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_user_ui: {
        Row: {
          ui_module_id: string
          user_id: string
        }
        Insert: {
          ui_module_id: string
          user_id: string
        }
        Update: {
          ui_module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_ui_ui_module_id_fkey"
            columns: ["ui_module_id"]
            isOneToOne: false
            referencedRelation: "app_ui_module"
            referencedColumns: ["id"]
          },
        ]
      }
      data_health_incidents: {
        Row: {
          acknowledged_at: string | null
          check_key: string
          closed_at: string | null
          id: number
          last_notified_at: string | null
          notes: string | null
          opened_at: string
          reason: string
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          check_key: string
          closed_at?: string | null
          id?: never
          last_notified_at?: string | null
          notes?: string | null
          opened_at?: string
          reason: string
          severity?: string
        }
        Update: {
          acknowledged_at?: string | null
          check_key?: string
          closed_at?: string | null
          id?: never
          last_notified_at?: string | null
          notes?: string | null
          opened_at?: string
          reason?: string
          severity?: string
        }
        Relationships: []
      }
      data_health_settings: {
        Row: {
          enabled: boolean
          from_address: string
          id: boolean
          ignore_calendar: boolean
          last_run_at: string | null
          last_send_at: string | null
          last_send_error: string | null
          last_summary_date: string | null
          recipients: string[]
          summary_time: string
        }
        Insert: {
          enabled?: boolean
          from_address?: string
          id?: boolean
          ignore_calendar?: boolean
          last_run_at?: string | null
          last_send_at?: string | null
          last_send_error?: string | null
          last_summary_date?: string | null
          recipients?: string[]
          summary_time?: string
        }
        Update: {
          enabled?: boolean
          from_address?: string
          id?: boolean
          ignore_calendar?: boolean
          last_run_at?: string | null
          last_send_at?: string | null
          last_send_error?: string | null
          last_summary_date?: string | null
          recipients?: string[]
          summary_time?: string
        }
        Relationships: []
      }
      debt_meta: {
        Row: {
          company: string
          file_date: string | null
          synced_at: string
        }
        Insert: {
          company: string
          file_date?: string | null
          synced_at?: string
        }
        Update: {
          company?: string
          file_date?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      erp_job_results: {
        Row: {
          attempts: number
          call_index: number
          calls: number
          created_at: string
          exit_code: number | null
          export_timeout: boolean
          files_changed: string[]
          finished_at: string
          id: string
          pc: string
          snapshot_ok: boolean
          started_at: string
          stuck: boolean
          task: string
        }
        Insert: {
          attempts?: number
          call_index: number
          calls: number
          created_at?: string
          exit_code?: number | null
          export_timeout?: boolean
          files_changed?: string[]
          finished_at: string
          id: string
          pc: string
          snapshot_ok?: boolean
          started_at: string
          stuck?: boolean
          task: string
        }
        Update: {
          attempts?: number
          call_index?: number
          calls?: number
          created_at?: string
          exit_code?: number | null
          export_timeout?: boolean
          files_changed?: string[]
          finished_at?: string
          id?: string
          pc?: string
          snapshot_ok?: boolean
          started_at?: string
          stuck?: boolean
          task?: string
        }
        Relationships: []
      }
      intergroup_clients: {
        Row: {
          client_id: string
          company: string
          created_at: string
          note: string | null
        }
        Insert: {
          client_id: string
          company: string
          created_at?: string
          note?: string | null
        }
        Update: {
          client_id?: string
          company?: string
          created_at?: string
          note?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          company: string
          id: number
          name: string | null
          qty_on_hand: number
          sku: string
          supplier_prefix: string | null
          synced_at: string
        }
        Insert: {
          company: string
          id?: number
          name?: string | null
          qty_on_hand?: number
          sku: string
          supplier_prefix?: string | null
          synced_at?: string
        }
        Update: {
          company?: string
          id?: number
          name?: string | null
          qty_on_hand?: number
          sku?: string
          supplier_prefix?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      inventory_daily: {
        Row: {
          close_at: string
          close_qty: number
          company: string
          day: string
          name: string | null
          open_at: string
          open_qty: number
          sku: string
        }
        Insert: {
          close_at: string
          close_qty: number
          company: string
          day: string
          name?: string | null
          open_at: string
          open_qty: number
          sku: string
        }
        Update: {
          close_at?: string
          close_qty?: number
          company?: string
          day?: string
          name?: string | null
          open_at?: string
          open_qty?: number
          sku?: string
        }
        Relationships: []
      }
      inventory_day_runs: {
        Row: {
          company: string
          day: string
          first_at: string
          last_at: string
        }
        Insert: {
          company: string
          day: string
          first_at: string
          last_at: string
        }
        Update: {
          company?: string
          day?: string
          first_at?: string
          last_at?: string
        }
        Relationships: []
      }
      item_catalog: {
        Row: {
          company: string
          group_cat: string | null
          id: string
          sku: string
          synced_at: string
          tablet_cat: string | null
          tablet_cat_code: string | null
        }
        Insert: {
          company: string
          group_cat?: string | null
          id?: string
          sku: string
          synced_at?: string
          tablet_cat?: string | null
          tablet_cat_code?: string | null
        }
        Update: {
          company?: string
          group_cat?: string | null
          id?: string
          sku?: string
          synced_at?: string
          tablet_cat?: string | null
          tablet_cat_code?: string | null
        }
        Relationships: []
      }
      item_category_actions: {
        Row: {
          action: string
          attempts: number
          batch_id: number | null
          company: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          from_category: string | null
          id: number
          last_error: string | null
          origin: string
          reason: string | null
          sku: string
          status: string
          to_category: string
          updated_at: string
        }
        Insert: {
          action: string
          attempts?: number
          batch_id?: number | null
          company: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          from_category?: string | null
          id?: number
          last_error?: string | null
          origin?: string
          reason?: string | null
          sku: string
          status?: string
          to_category?: string
          updated_at?: string
        }
        Update: {
          action?: string
          attempts?: number
          batch_id?: number | null
          company?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          from_category?: string | null
          id?: number
          last_error?: string | null
          origin?: string
          reason?: string | null
          sku?: string
          status?: string
          to_category?: string
          updated_at?: string
        }
        Relationships: []
      }
      item_category_batches: {
        Row: {
          approve_note: string | null
          approved_at: string | null
          approved_by: string | null
          catalog_items: number
          company: string
          created_at: string
          id: number
          mailed_at: string | null
          new_flags: number
          new_restores: number
          released_at: string | null
          status: string
          threshold: number
        }
        Insert: {
          approve_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          catalog_items?: number
          company: string
          created_at?: string
          id?: number
          mailed_at?: string | null
          new_flags?: number
          new_restores?: number
          released_at?: string | null
          status?: string
          threshold?: number
        }
        Update: {
          approve_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          catalog_items?: number
          company?: string
          created_at?: string
          id?: number
          mailed_at?: string | null
          new_flags?: number
          new_restores?: number
          released_at?: string | null
          status?: string
          threshold?: number
        }
        Relationships: []
      }
      item_category_codes: {
        Row: {
          code: string
          company: string
          description: string | null
          items: number
          level: number
          updated_at: string
        }
        Insert: {
          code: string
          company: string
          description?: string | null
          items?: number
          level: number
          updated_at?: string
        }
        Update: {
          code?: string
          company?: string
          description?: string | null
          items?: number
          level?: number
          updated_at?: string
        }
        Relationships: []
      }
      item_category_flags: {
        Row: {
          batch_id: number | null
          company: string
          flagged_at: string
          id: number
          resolved_at: string | null
          resolved_by: string | null
          resolved_reason: string | null
          sku: string
        }
        Insert: {
          batch_id?: number | null
          company: string
          flagged_at?: string
          id?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_reason?: string | null
          sku: string
        }
        Update: {
          batch_id?: number | null
          company?: string
          flagged_at?: string
          id?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_reason?: string | null
          sku?: string
        }
        Relationships: []
      }
      item_category_last: {
        Row: {
          category_seen_at: string
          changed_at: string | null
          company: string
          first_seen_with_this_category: string
          last_category: string
          previous_category: string | null
          sku: string
        }
        Insert: {
          category_seen_at: string
          changed_at?: string | null
          company: string
          first_seen_with_this_category: string
          last_category: string
          previous_category?: string | null
          sku: string
        }
        Update: {
          category_seen_at?: string
          changed_at?: string | null
          company?: string
          first_seen_with_this_category?: string
          last_category?: string
          previous_category?: string | null
          sku?: string
        }
        Relationships: []
      }
      item_category_log: {
        Row: {
          at: string
          by_user: string | null
          company: string | null
          detail: Json | null
          event: string
          id: number
          sku: string | null
        }
        Insert: {
          at?: string
          by_user?: string | null
          company?: string | null
          detail?: Json | null
          event: string
          id?: number
          sku?: string | null
        }
        Update: {
          at?: string
          by_user?: string | null
          company?: string | null
          detail?: Json | null
          event?: string
          id?: number
          sku?: string | null
        }
        Relationships: []
      }
      item_category_marks: {
        Row: {
          cleared_at: string | null
          cleared_by: string | null
          cleared_reason: string | null
          company: string
          created_at: string
          created_by: string | null
          id: number
          kind: string
          note: string | null
          sku: string
        }
        Insert: {
          cleared_at?: string | null
          cleared_by?: string | null
          cleared_reason?: string | null
          company: string
          created_at?: string
          created_by?: string | null
          id?: number
          kind: string
          note?: string | null
          sku: string
        }
        Update: {
          cleared_at?: string | null
          cleared_by?: string | null
          cleared_reason?: string | null
          company?: string
          created_at?: string
          created_by?: string | null
          id?: number
          kind?: string
          note?: string | null
          sku?: string
        }
        Relationships: []
      }
      item_category_runs: {
        Row: {
          catalog_items: number | null
          company: string
          evaluated_at: string | null
          last_result: Json | null
          last_status: string | null
          stock_items: number | null
          stock_snapshot: string | null
        }
        Insert: {
          catalog_items?: number | null
          company: string
          evaluated_at?: string | null
          last_result?: Json | null
          last_status?: string | null
          stock_items?: number | null
          stock_snapshot?: string | null
        }
        Update: {
          catalog_items?: number | null
          company?: string
          evaluated_at?: string | null
          last_result?: Json | null
          last_status?: string | null
          stock_items?: number | null
          stock_snapshot?: string | null
        }
        Relationships: []
      }
      item_category_state: {
        Row: {
          checked_snapshot: string | null
          company: string
          last_stock_at: string | null
          sku: string
          zero_checks: number
        }
        Insert: {
          checked_snapshot?: string | null
          company: string
          last_stock_at?: string | null
          sku: string
          zero_checks?: number
        }
        Update: {
          checked_snapshot?: string | null
          company?: string
          last_stock_at?: string | null
          sku?: string
          zero_checks?: number
        }
        Relationships: []
      }
      item_monthly_stock_in: {
        Row: {
          amount_ils: number | null
          company: string
          id: number
          item_name: string | null
          month: number
          sku: string
          supplier_id: string
          synced_at: string
          year: number
        }
        Insert: {
          amount_ils?: number | null
          company: string
          id?: number
          item_name?: string | null
          month: number
          sku: string
          supplier_id?: string
          synced_at?: string
          year: number
        }
        Update: {
          amount_ils?: number | null
          company?: string
          id?: number
          item_name?: string | null
          month?: number
          sku?: string
          supplier_id?: string
          synced_at?: string
          year?: number
        }
        Relationships: []
      }
      item_pricing: {
        Row: {
          alt_sku: string | null
          barcode: string | null
          company: string
          id: number
          list_price: number | null
          name: string | null
          restriction_qty: number | null
          sku: string
          supplier_id: string | null
          synced_at: string | null
        }
        Insert: {
          alt_sku?: string | null
          barcode?: string | null
          company: string
          id?: number
          list_price?: number | null
          name?: string | null
          restriction_qty?: number | null
          sku: string
          supplier_id?: string | null
          synced_at?: string | null
        }
        Update: {
          alt_sku?: string | null
          barcode?: string | null
          company?: string
          id?: number
          list_price?: number | null
          name?: string | null
          restriction_qty?: number | null
          sku?: string
          supplier_id?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      item_pricing_admin: {
        Row: {
          company: string
          cost: number | null
          fob: number | null
          id: number
          sku: string
          synced_at: string | null
        }
        Insert: {
          company: string
          cost?: number | null
          fob?: number | null
          id?: number
          sku: string
          synced_at?: string | null
        }
        Update: {
          company?: string
          cost?: number | null
          fob?: number | null
          id?: number
          sku?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      ops_delivery_boxes: {
        Row: {
          company: string
          created_at: string
          entity_id: string
          id: string
          kind: string
          label: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          entity_id: string
          id?: string
          kind: string
          label?: string
          user_id?: string
        }
        Update: {
          company?: string
          created_at?: string
          entity_id?: string
          id?: string
          kind?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      ops_delivery_lines: {
        Row: {
          agent_erp_id: string | null
          agent_name: string | null
          client_id: string | null
          client_name: string | null
          company: string
          doc_num: string | null
          id: number
          item_code: string
          line_date: string
          qty: number
          synced_at: string
        }
        Insert: {
          agent_erp_id?: string | null
          agent_name?: string | null
          client_id?: string | null
          client_name?: string | null
          company: string
          doc_num?: string | null
          id?: number
          item_code: string
          line_date: string
          qty?: number
          synced_at?: string
        }
        Update: {
          agent_erp_id?: string | null
          agent_name?: string | null
          client_id?: string | null
          client_name?: string | null
          company?: string
          doc_num?: string | null
          id?: number
          item_code?: string
          line_date?: string
          qty?: number
          synced_at?: string
        }
        Relationships: []
      }
      order_item_hidden: {
        Row: {
          company: string
          hidden_at: string
          hidden_by: string | null
          sku: string
        }
        Insert: {
          company: string
          hidden_at?: string
          hidden_by?: string | null
          sku: string
        }
        Update: {
          company?: string
          hidden_at?: string
          hidden_by?: string | null
          sku?: string
        }
        Relationships: []
      }
      order_supplier_settings: {
        Row: {
          company: string
          cover_months: number
          hidden: boolean
          internal: boolean
          lead_months: number | null
          payment_days: number | null
          payment_notes: string | null
          payment_terms: string | null
          safety_months: number
          supplier_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company: string
          cover_months?: number
          hidden?: boolean
          internal?: boolean
          lead_months?: number | null
          payment_days?: number | null
          payment_notes?: string | null
          payment_terms?: string | null
          safety_months?: number
          supplier_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company?: string
          cover_months?: number
          hidden?: boolean
          internal?: boolean
          lead_months?: number | null
          payment_days?: number | null
          payment_notes?: string | null
          payment_terms?: string | null
          safety_months?: number
          supplier_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      purchase_facts: {
        Row: {
          cash_returned: number
          cash_sold: number
          client_id: string
          company: string
          docs_returned: number
          docs_sold: number
          first_date: string | null
          intergroup: boolean
          item_sku: string
          last_date: string | null
          month: number
          qty_ordered: number
          qty_returned: number
          qty_sold: number
          refreshed_at: string
          year: number
        }
        Insert: {
          cash_returned?: number
          cash_sold?: number
          client_id: string
          company: string
          docs_returned?: number
          docs_sold?: number
          first_date?: string | null
          intergroup?: boolean
          item_sku: string
          last_date?: string | null
          month: number
          qty_ordered?: number
          qty_returned?: number
          qty_sold?: number
          refreshed_at?: string
          year: number
        }
        Update: {
          cash_returned?: number
          cash_sold?: number
          client_id?: string
          company?: string
          docs_returned?: number
          docs_sold?: number
          first_date?: string | null
          intergroup?: boolean
          item_sku?: string
          last_date?: string | null
          month?: number
          qty_ordered?: number
          qty_returned?: number
          qty_sold?: number
          refreshed_at?: string
          year?: number
        }
        Relationships: []
      }
      query_logs: {
        Row: {
          agent_id: string
          client_id: string | null
          created_at: string
          id: number
          message: string | null
          model: string
          provider: Database["public"]["Enums"]["ai_provider_type"]
          rating: number | null
          reply: string | null
          tokens_in: number | null
          tokens_out: number | null
          voice_mode: boolean | null
        }
        Insert: {
          agent_id: string
          client_id?: string | null
          created_at?: string
          id?: number
          message?: string | null
          model: string
          provider: Database["public"]["Enums"]["ai_provider_type"]
          rating?: number | null
          reply?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          voice_mode?: boolean | null
        }
        Update: {
          agent_id?: string
          client_id?: string | null
          created_at?: string
          id?: number
          message?: string | null
          model?: string
          provider?: Database["public"]["Enums"]["ai_provider_type"]
          rating?: number | null
          reply?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          voice_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "query_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_lines: {
        Row: {
          agent_erp_id: string | null
          cash_gross: number
          client_name: string | null
          collected_date: string
          company: string
          due_date: string | null
          erp_client_id: string
          id: number
          synced_at: string
        }
        Insert: {
          agent_erp_id?: string | null
          cash_gross?: number
          client_name?: string | null
          collected_date: string
          company: string
          due_date?: string | null
          erp_client_id: string
          id?: never
          synced_at?: string
        }
        Update: {
          agent_erp_id?: string | null
          cash_gross?: number
          client_name?: string | null
          collected_date?: string
          company?: string
          due_date?: string | null
          erp_client_id?: string
          id?: never
          synced_at?: string
        }
        Relationships: []
      }
      return_reason_rules: {
        Row: {
          code: string
          company: string
          counts_as_return: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company: string
          counts_as_return: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company?: string
          counts_as_return?: boolean
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_agent_targets: {
        Row: {
          agent_erp_id: string
          month: number
          target_cash: number
          updated_at: string
          year: number
        }
        Insert: {
          agent_erp_id: string
          month: number
          target_cash?: number
          updated_at?: string
          year: number
        }
        Update: {
          agent_erp_id?: string
          month?: number
          target_cash?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      sales_lines: {
        Row: {
          agent_erp_id: string | null
          barcode: string | null
          brand: string | null
          cash: number | null
          client_id: string
          client_name: string | null
          company: string
          discount_cash: number | null
          discount_pct: number | null
          doc_num: string | null
          doc_type: string | null
          group_cat: string | null
          id: number
          inner_carton_qty: number | null
          item_name: string | null
          item_sku: string | null
          line_date: string
          line_source: string | null
          month: number
          qty: number | null
          return_reason: string | null
          return_reason_code: string | null
          supplier: string | null
          synced_at: string
          tablet_cat: string | null
          year: number
        }
        Insert: {
          agent_erp_id?: string | null
          barcode?: string | null
          brand?: string | null
          cash?: number | null
          client_id: string
          client_name?: string | null
          company: string
          discount_cash?: number | null
          discount_pct?: number | null
          doc_num?: string | null
          doc_type?: string | null
          group_cat?: string | null
          id?: number
          inner_carton_qty?: number | null
          item_name?: string | null
          item_sku?: string | null
          line_date: string
          line_source?: string | null
          month: number
          qty?: number | null
          return_reason?: string | null
          return_reason_code?: string | null
          supplier?: string | null
          synced_at?: string
          tablet_cat?: string | null
          year: number
        }
        Update: {
          agent_erp_id?: string | null
          barcode?: string | null
          brand?: string | null
          cash?: number | null
          client_id?: string
          client_name?: string | null
          company?: string
          discount_cash?: number | null
          discount_pct?: number | null
          doc_num?: string | null
          doc_type?: string | null
          group_cat?: string | null
          id?: number
          inner_carton_qty?: number | null
          item_name?: string | null
          item_sku?: string | null
          line_date?: string
          line_source?: string | null
          month?: number
          qty?: number | null
          return_reason?: string | null
          return_reason_code?: string | null
          supplier?: string | null
          synced_at?: string
          tablet_cat?: string | null
          year?: number
        }
        Relationships: []
      }
      sku_pricing: {
        Row: {
          company: string
          cost: number | null
          id: number
          list_price: number | null
          sku: string
          synced_at: string
        }
        Insert: {
          company: string
          cost?: number | null
          id?: number
          list_price?: number | null
          sku: string
          synced_at?: string
        }
        Update: {
          company?: string
          cost?: number | null
          id?: number
          list_price?: number | null
          sku?: string
          synced_at?: string
        }
        Relationships: []
      }
      source_file_observations: {
        Row: {
          file_name: string
          host: string | null
          id: number
          modified_at: string | null
          observed_at: string
          processed: boolean
          rows_loaded: number | null
          size_bytes: number | null
          sync_log_id: string | null
        }
        Insert: {
          file_name: string
          host?: string | null
          id?: never
          modified_at?: string | null
          observed_at?: string
          processed?: boolean
          rows_loaded?: number | null
          size_bytes?: number | null
          sync_log_id?: string | null
        }
        Update: {
          file_name?: string
          host?: string | null
          id?: never
          modified_at?: string | null
          observed_at?: string
          processed?: boolean
          rows_loaded?: number | null
          size_bytes?: number | null
          sync_log_id?: string | null
        }
        Relationships: []
      }
      source_file_status: {
        Row: {
          age_hours: number | null
          check_key: string
          company: string | null
          evaluated_at: string
          file_group: string
          file_name: string | null
          modified_at: string | null
          reason: string
          rows_loaded: number | null
          status: string
        }
        Insert: {
          age_hours?: number | null
          check_key: string
          company?: string | null
          evaluated_at?: string
          file_group: string
          file_name?: string | null
          modified_at?: string | null
          reason: string
          rows_loaded?: number | null
          status: string
        }
        Update: {
          age_hours?: number | null
          check_key?: string
          company?: string | null
          evaluated_at?: string
          file_group?: string
          file_name?: string | null
          modified_at?: string | null
          reason?: string
          rows_loaded?: number | null
          status?: string
        }
        Relationships: []
      }
      source_files: {
        Row: {
          active: boolean
          company: string | null
          eval_from: string | null
          eval_to: string | null
          file_group: string
          file_name: string
          fix_hint: string
          impact: string
          max_age_hours: number | null
          producer: string
          rows_check: boolean
          rule_kind: string
        }
        Insert: {
          active?: boolean
          company?: string | null
          eval_from?: string | null
          eval_to?: string | null
          file_group: string
          file_name: string
          fix_hint: string
          impact: string
          max_age_hours?: number | null
          producer: string
          rows_check?: boolean
          rule_kind: string
        }
        Update: {
          active?: boolean
          company?: string | null
          eval_from?: string | null
          eval_to?: string | null
          file_group?: string
          file_name?: string
          fix_hint?: string
          impact?: string
          max_age_hours?: number | null
          producer?: string
          rows_check?: boolean
          rule_kind?: string
        }
        Relationships: []
      }
      stock_daily: {
        Row: {
          clamped: boolean
          close_qty: number
          company: string
          day: string
          estimated: boolean
          sku: string
        }
        Insert: {
          clamped?: boolean
          close_qty: number
          company: string
          day: string
          estimated: boolean
          sku: string
        }
        Update: {
          clamped?: boolean
          close_qty?: number
          company?: string
          day?: string
          estimated?: boolean
          sku?: string
        }
        Relationships: []
      }
      stock_moves: {
        Row: {
          cash: number | null
          client_id: string | null
          company: string
          doc_num: string | null
          id: number
          item_sku: string
          loaded_at: string
          move_date: string
          move_kind: string
          qty: number
          return_reason: string | null
          source_file: string
        }
        Insert: {
          cash?: number | null
          client_id?: string | null
          company: string
          doc_num?: string | null
          id?: never
          item_sku: string
          loaded_at?: string
          move_date: string
          move_kind: string
          qty: number
          return_reason?: string | null
          source_file: string
        }
        Update: {
          cash?: number | null
          client_id?: string | null
          company?: string
          doc_num?: string | null
          id?: never
          item_sku?: string
          loaded_at?: string
          move_date?: string
          move_kind?: string
          qty?: number
          return_reason?: string | null
          source_file?: string
        }
        Relationships: []
      }
      supplier_pipeline: {
        Row: {
          alt_sku: string | null
          company: string
          currency: string | null
          doc_num: string | null
          due_date: string | null
          fob_price: number | null
          id: number
          item_name: string | null
          kind: string
          loaded_at: string
          qty: number
          sku: string
          source_file: string
          supplier_id: string | null
          total: number | null
        }
        Insert: {
          alt_sku?: string | null
          company: string
          currency?: string | null
          doc_num?: string | null
          due_date?: string | null
          fob_price?: number | null
          id?: never
          item_name?: string | null
          kind: string
          loaded_at?: string
          qty: number
          sku: string
          source_file: string
          supplier_id?: string | null
          total?: number | null
        }
        Update: {
          alt_sku?: string | null
          company?: string
          currency?: string | null
          doc_num?: string | null
          due_date?: string | null
          fob_price?: number | null
          id?: never
          item_name?: string | null
          kind?: string
          loaded_at?: string
          qty?: number
          sku?: string
          source_file?: string
          supplier_id?: string | null
          total?: number | null
        }
        Relationships: []
      }
      supplier_prefix: {
        Row: {
          prefix: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          prefix: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          prefix?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_file_state: {
        Row: {
          file_name: string
          loaded_at: string
          signature: string
        }
        Insert: {
          file_name: string
          loaded_at?: string
          signature: string
        }
        Update: {
          file_name?: string
          loaded_at?: string
          signature?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          rows_updated: number | null
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          triggered_by: Database["public"]["Enums"]["sync_trigger"]
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_updated?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          triggered_by?: Database["public"]["Enums"]["sync_trigger"]
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_updated?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          triggered_by?: Database["public"]["Enums"]["sync_trigger"]
        }
        Relationships: []
      }
      tsomet_store_budget: {
        Row: {
          agent_number: string
          budget_cash: number
          erp_number: string
          store_name: string
          store_number: string
          synced_at: string
        }
        Insert: {
          agent_number?: string
          budget_cash?: number
          erp_number?: string
          store_name?: string
          store_number: string
          synced_at?: string
        }
        Update: {
          agent_number?: string
          budget_cash?: number
          erp_number?: string
          store_name?: string
          store_number?: string
          synced_at?: string
        }
        Relationships: []
      }
      tsomet_store_sales: {
        Row: {
          cash: number
          qty: number
          report_date: string | null
          store_number: string
          synced_at: string
        }
        Insert: {
          cash?: number
          qty?: number
          report_date?: string | null
          store_number: string
          synced_at?: string
        }
        Update: {
          cash?: number
          qty?: number
          report_date?: string | null
          store_number?: string
          synced_at?: string
        }
        Relationships: []
      }
      uncategorized_stock_seen: {
        Row: {
          company: string
          first_seen_at: string
          sku: string
        }
        Insert: {
          company: string
          first_seen_at?: string
          sku: string
        }
        Update: {
          company?: string
          first_seen_at?: string
          sku?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active: boolean
          agent_erp_id: string | null
          allowed_companies: string[]
          created_at: string
          email: string
          id: string
          name: string
          parent_id: string | null
          password_display: string | null
          role: Database["public"]["Enums"]["user_role"]
          username: string | null
        }
        Insert: {
          active?: boolean
          agent_erp_id?: string | null
          allowed_companies?: string[]
          created_at?: string
          email: string
          id: string
          name: string
          parent_id?: string | null
          password_display?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          username?: string | null
        }
        Update: {
          active?: boolean
          agent_erp_id?: string | null
          allowed_companies?: string[]
          created_at?: string
          email?: string
          id?: string
          name?: string
          parent_id?: string | null
          password_display?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_stats: {
        Row: {
          assigned_agent_id: string | null
          company: string | null
          erp_client_id: string | null
          last_order_date: string | null
          monthly_sales: number | null
          total_debt: number | null
        }
        Insert: {
          assigned_agent_id?: string | null
          company?: string | null
          erp_client_id?: string | null
          last_order_date?: never
          monthly_sales?: never
          total_debt?: never
        }
        Update: {
          assigned_agent_id?: string | null
          company?: string | null
          erp_client_id?: string | null
          last_order_date?: never
          monthly_sales?: never
          total_debt?: never
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unmapped_supplier_prefixes: {
        Row: {
          companies: number | null
          last_seen: string | null
          prefix: string | null
          rows_seen: number | null
          sample_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _snapshot_permission_config: { Args: never; Returns: Json }
      activate_version: { Args: { p_version: string }; Returns: undefined }
      admin_add_chain_stores: {
        Args: {
          p_chain_id: string
          p_company: string
          p_ids: string[]
          p_move?: boolean
        }
        Returns: Json
      }
      admin_chain_stores: {
        Args: { p_chain_id: string; p_company: string }
        Returns: Json
      }
      admin_delete_chain: { Args: { p_id: string }; Returns: Json }
      admin_list_chains: { Args: never; Returns: Json }
      admin_remove_chain_store: {
        Args: { p_client_id: string; p_company: string }
        Returns: Json
      }
      admin_save_chain: {
        Args: { p_id: string; p_name: string }
        Returns: Json
      }
      admin_search_stores: {
        Args: { p_company: string; p_query: string }
        Returns: Json
      }
      approve_held_batch: {
        Args: { p_batch_id: number; p_note?: string }
        Returns: Json
      }
      can_see_data_health: { Args: never; Returns: boolean }
      category_control_counts: { Args: never; Returns: Json }
      category_control_decide: {
        Args: {
          p_company: string
          p_decision: string
          p_note?: string
          p_sku: string
        }
        Returns: Json
      }
      category_control_decide_bulk: {
        Args: {
          p_company: string
          p_decision: string
          p_note?: string
          p_skus: string[]
        }
        Returns: Json
      }
      category_control_eval_company: { Args: { p_co: string }; Returns: Json }
      category_control_evaluate: {
        Args: { p_company?: string; p_dry_run?: boolean }
        Returns: Json
      }
      category_control_mark_mailed: {
        Args: { p_ids: number[] }
        Returns: undefined
      }
      category_control_undo: {
        Args: {
          p_company: string
          p_ref?: number
          p_sku: string
          p_what: string
        }
        Returns: Json
      }
      cc_can_approve: { Args: never; Returns: boolean }
      cc_can_write: { Args: never; Returns: boolean }
      cc_gate: {
        Args: never
        Returns: {
          active: boolean
          agents: string[] | null
          companies: string[]
          default_module: string | null
          hidden_sidebar: string[]
          hidden_years: number[]
          locale: string
          modules: string[]
          oversite_modules: string[] | null
          show_client_profit: boolean
          show_item_cost: boolean
          this_year_only: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dashboard_user_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      client_owner_of: {
        Args: { p_client_id: string; p_company: string }
        Returns: string
      }
      client_owner_v: {
        Args: { p_company: string }
        Returns: {
          agent_id: string
          client_id: string
        }[]
      }
      data_health_ack: {
        Args: { p_incident_id: number; p_notes?: string }
        Returns: undefined
      }
      data_health_content: {
        Args: never
        Returns: {
          alert_reason: string
          alert_status: string
          check_key: string
          company: string
          file_group: string
          label: string
          newest: string
        }[]
      }
      data_health_latest: {
        Args: never
        Returns: {
          file_name: string
          first_seen: string
          history: number[]
          modified_at: string
          observed_at: string
          processed: boolean
          rows_loaded: number
        }[]
      }
      data_health_notices: { Args: never; Returns: Json }
      data_health_uncategorized: {
        Args: never
        Returns: {
          company: string
          name: string
          qty: number
          sku: string
        }[]
      }
      delete_sales_rows_batch: {
        Args: {
          p_company: string
          p_limit?: number
          p_line_source: string
          p_max_id?: number
          p_min_id?: number
          p_month?: number
          p_year?: number
        }
        Returns: number
      }
      delete_sales_scope: {
        Args: { p_company: string; p_line_source: string }
        Returns: number
      }
      delete_sales_scope_batch: {
        Args: { p_company: string; p_limit?: number; p_line_source: string }
        Returns: number
      }
      explain_access: {
        Args: {
          p_key: string
          p_kind: Database["public"]["Enums"]["grant_kind"]
          p_user_id: string
        }
        Returns: {
          effect: Database["public"]["Enums"]["grant_effect"]
          source: string
          value: string
          winning: boolean
        }[]
      }
      get_cache_key: { Args: never; Returns: string }
      get_category_control: { Args: { p_company?: string }; Returns: Json }
      get_chain_stores: {
        Args: { p_as?: string; p_chain_id: string; p_company: string }
        Returns: Json
      }
      get_client_card: {
        Args: { p_as?: string; p_client_id: string; p_company: string }
        Returns: Json
      }
      get_client_card_margin: {
        Args: { p_as?: string; p_client_id: string; p_company: string }
        Returns: Json
      }
      get_client_chain: {
        Args: { p_as?: string; p_client_id: string; p_company: string }
        Returns: Json
      }
      get_client_credit_check: {
        Args: { p_as?: string; p_client_id: string; p_company: string }
        Returns: Json
      }
      get_client_item_sales: {
        Args: {
          p_as?: string
          p_client_id: string
          p_company: string
          p_from?: string
          p_query: string
          p_to?: string
        }
        Returns: Json
      }
      get_client_vs_last_year: {
        Args: { p_as?: string; p_client_id: string; p_company: string }
        Returns: Json
      }
      get_dashboard_access: {
        Args: { p_user_id?: string }
        Returns: {
          active: boolean
          agents: string[] | null
          companies: string[]
          default_module: string | null
          hidden_sidebar: string[]
          hidden_years: number[]
          locale: string
          modules: string[]
          oversite_modules: string[] | null
          show_client_profit: boolean
          show_item_cost: boolean
          this_year_only: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dashboard_user_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_dashboard_aux: { Args: never; Returns: Json }
      get_dashboard_sales_boundaries: {
        Args: { p_page_rows?: number }
        Returns: Json
      }
      get_dashboard_sales_boundaries_y: {
        Args: { p_page_rows: number; p_years: number[] }
        Returns: Json
      }
      get_dashboard_sales_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_dashboard_sales_range: {
        Args: { p_from_id: number; p_to_id: number }
        Returns: Json
      }
      get_dashboard_sales_range_v2: {
        Args: { p_from_id: number; p_to_id: number }
        Returns: Json
      }
      get_dashboard_sales_range_y: {
        Args: { p_from_id: number; p_to_id: number; p_years: number[] }
        Returns: Json
      }
      get_dashboard_sales_years: { Args: never; Returns: Json }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      get_import_cover: {
        Args: { p_as?: string; p_company: string; p_show_hidden?: boolean }
        Returns: Json
      }
      get_intercompany_identities: {
        Args: never
        Returns: {
          agent_erp_id: string
          companies: string[]
          is_active: boolean
          is_self: boolean
          name: string
          user_id: string
          username: string
        }[]
      }
      get_item_card: {
        Args: { p_as?: string; p_company: string; p_sku: string }
        Returns: Json
      }
      get_item_card_margin: {
        Args: { p_as?: string; p_company: string; p_sku: string }
        Returns: Json
      }
      get_item_category_codes: {
        Args: { p_company?: string; p_level?: number }
        Returns: Json
      }
      get_item_category_restore: { Args: { p_company?: string }; Returns: Json }
      get_item_index: { Args: never; Returns: Json }
      get_item_vs_last_year: {
        Args: { p_as?: string; p_company: string; p_sku: string }
        Returns: Json
      }
      get_monthly_margin: {
        Args: { p_as?: string; p_company: string }
        Returns: Json
      }
      get_mtd_client_invoices: {
        Args: {
          p_agents?: string[]
          p_as?: string
          p_client_id: string
          p_company: string
        }
        Returns: Json
      }
      get_mtd_client_ledger: {
        Args: {
          p_agents?: string[]
          p_as?: string
          p_company: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: Json
      }
      get_mtd_invoice_lines: {
        Args: {
          p_agents?: string[]
          p_as?: string
          p_client_id: string
          p_company: string
          p_doc_num: string
          p_doc_type: string
        }
        Returns: Json
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_ops_deliveries_monthly: {
        Args: {
          p_agent?: string
          p_client?: string
          p_company?: string
          p_months?: number
        }
        Returns: {
          cartons: number
          company: string
          pallets: number
          ym: string
        }[]
      }
      get_ops_delivery_entities: {
        Args: never
        Returns: {
          cartons: number
          company: string
          entity_id: string
          kind: string
          name: string
          pallets: number
        }[]
      }
      get_order_recommendation: {
        Args: { p_as?: string; p_company: string; p_show_hidden?: boolean }
        Returns: Json
      }
      get_order_settings: {
        Args: { p_as?: string; p_company: string }
        Returns: Json
      }
      get_receipts_mtd_by_client: {
        Args: { p_agents?: string[]; p_company: string }
        Returns: Json
      }
      get_return_reasons: {
        Args: { p_as?: string; p_company: string }
        Returns: Json
      }
      get_returns_detail: {
        Args: {
          p_as?: string
          p_client_id?: string
          p_company: string
          p_sku?: string
        }
        Returns: Json
      }
      get_stock_by_brand: { Args: never; Returns: Json }
      get_stock_daily: {
        Args: { p_company: string; p_from: string; p_to: string }
        Returns: {
          close_qty: number
          day: string
          name: string
          open_qty: number
          sku: string
        }[]
      }
      get_stock_history: {
        Args: { p_company: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_stock_items: { Args: never; Returns: Json }
      get_subtree_agent_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_subtree_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_uncategorized_stock: { Args: never; Returns: Json }
      get_yearly_detail: {
        Args: { p_as?: string; p_company: string; p_year: number }
        Returns: Json
      }
      get_yearly_detail_margin: {
        Args: { p_as?: string; p_company: string; p_year: number }
        Returns: Json
      }
      get_yearly_margin: {
        Args: { p_as?: string; p_company: string }
        Returns: Json
      }
      get_yearly_overview: {
        Args: { p_as?: string; p_company: string }
        Returns: Json
      }
      gm_can_see_cost: {
        Args: {
          acc: Database["public"]["Tables"]["dashboard_user_access"]["Row"]
          p_as: string
        }
        Returns: boolean
      }
      gm_unit_cost: {
        Args: { p_company: string }
        Returns: {
          basis: string
          item_sku: string
          unit_cost: number
          year: number
        }[]
      }
      has_field: { Args: { p_acc: Json; p_field: string }; Returns: boolean }
      is_admin_or_above: { Args: never; Returns: boolean }
      is_manager_or_above: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      list_known_agents: { Args: never; Returns: string[] }
      mark_stable: { Args: { p_version: string }; Returns: undefined }
      mtd_ledger_gate: {
        Args: { p_as?: string; p_company: string }
        Returns: {
          active: boolean
          agents: string[] | null
          companies: string[]
          default_module: string | null
          hidden_sidebar: string[]
          hidden_years: number[]
          locale: string
          modules: string[]
          oversite_modules: string[] | null
          show_client_profit: boolean
          show_item_cost: boolean
          this_year_only: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dashboard_user_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      order_engine: {
        Args: {
          p_company: string
          p_include_hidden?: boolean
          p_today?: string
        }
        Returns: {
          alert_months: number
          b2_docs: string
          b2_due: string
          b2_qty: number
          b6_arrival: string
          b6_docs: string
          b6_qty: number
          b8_days: number
          b8_flag: boolean
          b8_rate: number
          cover_months: number
          demand_cover: number
          demand_lead: number
          first_sold: string
          forecast_rate: number
          hidden: boolean
          internal: boolean
          item_name: string
          last_import_date: string
          last_import_qty: number
          last_sold: string
          lead_months: number
          ly_ok: boolean
          months_left: number
          oos: boolean
          order_by: string
          order_qty: number
          pipeline_qty: number
          rate_prior12: number
          rate12: number
          run_out: string
          safety_months: number
          safety_qty: number
          sales_12m: number
          sales_3m: number
          sales_cur: number
          sales_last: number
          sku: string
          sold_months12: number
          sold_qty12: number
          status: string
          stock: number
          stock_at_arrival: number
          sup_hidden: boolean
          supplier: string
          trend: number
        }[]
      }
      parity_kpis: { Args: { p_today?: string }; Returns: Json }
      purchase_cards_gate: {
        Args: { p_as?: string; p_company: string; p_page?: string }
        Returns: {
          active: boolean
          agents: string[] | null
          companies: string[]
          default_module: string | null
          hidden_sidebar: string[]
          hidden_years: number[]
          locale: string
          modules: string[]
          oversite_modules: string[] | null
          show_client_profit: boolean
          show_item_cost: boolean
          this_year_only: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dashboard_user_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purchase_line_is_return: {
        Args: { p_cash: number; p_line_source: string }
        Returns: boolean
      }
      rebuild_stock_daily: {
        Args: { p_company: string; p_from?: string }
        Returns: number
      }
      refresh_purchase_facts: { Args: { p_company: string }; Returns: number }
      refresh_tsomet_client_chains: { Args: never; Returns: number }
      release_version: {
        Args: {
          p_channel?: Database["public"]["Enums"]["node_channel"]
          p_deployment_url?: string
          p_summary: string
          p_version: string
        }
        Returns: undefined
      }
      remove_chain_stores: {
        Args: { p_chain_id: string; p_company: string }
        Returns: number
      }
      resolve_access: { Args: { p_user_id?: string }; Returns: Json }
      resolve_dashboard_login: { Args: { p_login: string }; Returns: string }
      rnd_gate: {
        Args: { p_as?: string; p_company: string; p_page?: string }
        Returns: {
          active: boolean
          agents: string[] | null
          companies: string[]
          default_module: string | null
          hidden_sidebar: string[]
          hidden_years: number[]
          locale: string
          modules: string[]
          oversite_modules: string[] | null
          show_client_profit: boolean
          show_item_cost: boolean
          this_year_only: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dashboard_user_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      scope_agents: { Args: { p_acc: Json }; Returns: string[] }
      scope_companies: { Args: { p_acc: Json }; Returns: string[] }
      search_purchase_chains: {
        Args: { p_as?: string; p_company: string; p_query?: string }
        Returns: Json
      }
      search_purchase_clients: {
        Args: { p_as?: string; p_company: string; p_query?: string }
        Returns: Json
      }
      search_purchase_items: {
        Args: { p_as?: string; p_company: string; p_query?: string }
        Returns: Json
      }
      set_active_intercompany_identity: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_item_catalog_codes: {
        Args: { p_company: string; p_rows: Json }
        Returns: number
      }
      set_order_item_hidden: {
        Args: { p_company: string; p_hidden: boolean; p_sku: string }
        Returns: boolean
      }
      set_order_setting: {
        Args: {
          p_company: string
          p_cover_months: number
          p_internal: boolean
          p_lead_months: number
          p_payment_days: number
          p_payment_notes: string
          p_payment_terms: string
          p_safety_months: number
          p_supplier: string
        }
        Returns: boolean
      }
      set_order_supplier_hidden: {
        Args: { p_company: string; p_hidden: boolean; p_supplier: string }
        Returns: boolean
      }
      stock_daily_check: {
        Args: { p_company: string }
        Returns: {
          day_item_pairs: number
          exact_pairs: number
          items: number
          mean_abs_error: number
          median_abs_error: number
          within_5pct: number
        }[]
      }
      stock_net_change: {
        Args: { p_company: string; p_from: string; p_to: string }
        Returns: {
          day: string
          net: number
          sku: string
        }[]
      }
      sync_stuck_cleanup: { Args: never; Returns: number }
    }
    Enums: {
      ai_provider_type: "gemini" | "claude" | "openai"
      grant_effect: "allow" | "deny"
      grant_kind: "scope" | "field" | "node"
      node_channel: "stable" | "beta"
      node_kind: "dataset" | "widget" | "view"
      sync_status: "running" | "success" | "failed"
      sync_trigger: "cron" | "admin" | "agent"
      user_role: "super_admin" | "admin" | "cco" | "manager" | "agent"
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
      ai_provider_type: ["gemini", "claude", "openai"],
      grant_effect: ["allow", "deny"],
      grant_kind: ["scope", "field", "node"],
      node_channel: ["stable", "beta"],
      node_kind: ["dataset", "widget", "view"],
      sync_status: ["running", "success", "failed"],
      sync_trigger: ["cron", "admin", "agent"],
      user_role: ["super_admin", "admin", "cco", "manager", "agent"],
    },
  },
} as const
