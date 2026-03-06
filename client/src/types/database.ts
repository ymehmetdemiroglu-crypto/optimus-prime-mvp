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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_actions: {
        Row: {
          action: string
          campaign_id: string
          created_at: string | null
          id: string
          impact: string
          status: string
        }
        Insert: {
          action: string
          campaign_id: string
          created_at?: string | null
          id?: string
          impact: string
          status?: string
        }
        Update: {
          action?: string
          campaign_id?: string
          created_at?: string | null
          id?: string
          impact?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          config: Json
          cooldown_minutes: number | null
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          last_triggered_at: string | null
          name: string
          rule_type: string
          seller_id: string
          severity: string
        }
        Insert: {
          config?: Json
          cooldown_minutes?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          last_triggered_at?: string | null
          name: string
          rule_type: string
          seller_id: string
          severity?: string
        }
        Update: {
          config?: Json
          cooldown_minutes?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          last_triggered_at?: string | null
          name?: string
          rule_type?: string
          seller_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          is_resolved: boolean | null
          keyword_id: string | null
          message: string
          metric_value: number | null
          rule_id: string | null
          seller_id: string
          severity: string
          threshold_value: number | null
          title: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          is_resolved?: boolean | null
          keyword_id?: string | null
          message: string
          metric_value?: number | null
          rule_id?: string | null
          seller_id: string
          severity: string
          threshold_value?: number | null
          title: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          is_resolved?: boolean | null
          keyword_id?: string | null
          message?: string
          metric_value?: number | null
          rule_id?: string | null
          seller_id?: string
          severity?: string
          threshold_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomous_logs: {
        Row: {
          action_type: string
          campaign_id: string | null
          created_at: string | null
          id: string
          keyword_id: string | null
          new_value: number | null
          previous_value: number | null
          reason: string | null
          seller_id: string
        }
        Insert: {
          action_type: string
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          keyword_id?: string | null
          new_value?: number | null
          previous_value?: number | null
          reason?: string | null
          seller_id: string
        }
        Update: {
          action_type?: string
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          keyword_id?: string | null
          new_value?: number | null
          previous_value?: number | null
          reason?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autonomous_logs_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autonomous_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          acos: number
          clicks: number
          created_at: string | null
          daily_budget: number
          id: string
          impressions: number
          name: string
          orders: number
          sales: number
          seller_id: string
          spend: number
          status: string
          strategy: string
          updated_at: string | null
        }
        Insert: {
          acos?: number
          clicks?: number
          created_at?: string | null
          daily_budget?: number
          id?: string
          impressions?: number
          name: string
          orders?: number
          sales?: number
          seller_id: string
          spend?: number
          status?: string
          strategy?: string
          updated_at?: string | null
        }
        Update: {
          acos?: number
          clicks?: number
          created_at?: string | null
          daily_budget?: number
          id?: string
          impressions?: number
          name?: string
          orders?: number
          sales?: number
          seller_id?: string
          spend?: number
          status?: string
          strategy?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          action_suggestion: Json | null
          content: string
          created_at: string | null
          id: string
          seller_id: string
          sender: string
        }
        Insert: {
          action_suggestion?: Json | null
          content: string
          created_at?: string | null
          id?: string
          seller_id: string
          sender?: string
        }
        Update: {
          action_suggestion?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          seller_id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_metrics: {
        Row: {
          bsr: number | null
          competitor_id: string
          created_at: string | null
          estimated_daily_sales: number | null
          estimated_price: number | null
          id: string
          rating: number | null
          recorded_at: string
          review_count: number | null
          share_of_voice_percent: number | null
        }
        Insert: {
          bsr?: number | null
          competitor_id: string
          created_at?: string | null
          estimated_daily_sales?: number | null
          estimated_price?: number | null
          id?: string
          rating?: number | null
          recorded_at?: string
          review_count?: number | null
          share_of_voice_percent?: number | null
        }
        Update: {
          bsr?: number | null
          competitor_id?: string
          created_at?: string | null
          estimated_daily_sales?: number | null
          estimated_price?: number | null
          id?: string
          rating?: number | null
          recorded_at?: string
          review_count?: number | null
          share_of_voice_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_metrics_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_metrics_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "vw_competitor_dashboard"
            referencedColumns: ["competitor_id"]
          },
        ]
      }
      competitors: {
        Row: {
          asin: string
          brand_name: string | null
          id: string
          is_active: boolean | null
          product_title: string | null
          seller_id: string
          tracked_since: string | null
        }
        Insert: {
          asin: string
          brand_name?: string | null
          id?: string
          is_active?: boolean | null
          product_title?: string | null
          seller_id: string
          tracked_since?: string | null
        }
        Update: {
          asin?: string
          brand_name?: string | null
          id?: string
          is_active?: boolean | null
          product_title?: string | null
          seller_id?: string
          tracked_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_store: {
        Row: {
          acos_14d: number | null
          acos_30d: number | null
          acos_7d: number | null
          clicks_7d: number | null
          computed_at: string | null
          cpa_14d: number | null
          cpa_30d: number | null
          cpa_7d: number | null
          cpc_14d: number | null
          cpc_30d: number | null
          cpc_7d: number | null
          ctr_14d: number | null
          ctr_30d: number | null
          ctr_7d: number | null
          ctr_trend: number | null
          cvr_14d: number | null
          cvr_30d: number | null
          cvr_7d: number | null
          cvr_trend: number | null
          day_of_week: number | null
          id: string
          impressions_7d: number | null
          is_weekend: boolean | null
          keyword_id: string
          roas_14d: number | null
          roas_30d: number | null
          roas_7d: number | null
          sales_7d: number | null
          sales_trend: number | null
          seller_id: string
          spend_7d: number | null
          spend_trend: number | null
        }
        Insert: {
          acos_14d?: number | null
          acos_30d?: number | null
          acos_7d?: number | null
          clicks_7d?: number | null
          computed_at?: string | null
          cpa_14d?: number | null
          cpa_30d?: number | null
          cpa_7d?: number | null
          cpc_14d?: number | null
          cpc_30d?: number | null
          cpc_7d?: number | null
          ctr_14d?: number | null
          ctr_30d?: number | null
          ctr_7d?: number | null
          ctr_trend?: number | null
          cvr_14d?: number | null
          cvr_30d?: number | null
          cvr_7d?: number | null
          cvr_trend?: number | null
          day_of_week?: number | null
          id?: string
          impressions_7d?: number | null
          is_weekend?: boolean | null
          keyword_id: string
          roas_14d?: number | null
          roas_30d?: number | null
          roas_7d?: number | null
          sales_7d?: number | null
          sales_trend?: number | null
          seller_id: string
          spend_7d?: number | null
          spend_trend?: number | null
        }
        Update: {
          acos_14d?: number | null
          acos_30d?: number | null
          acos_7d?: number | null
          clicks_7d?: number | null
          computed_at?: string | null
          cpa_14d?: number | null
          cpa_30d?: number | null
          cpa_7d?: number | null
          cpc_14d?: number | null
          cpc_30d?: number | null
          cpc_7d?: number | null
          ctr_14d?: number | null
          ctr_30d?: number | null
          ctr_7d?: number | null
          ctr_trend?: number | null
          cvr_14d?: number | null
          cvr_30d?: number | null
          cvr_7d?: number | null
          cvr_trend?: number | null
          day_of_week?: number | null
          id?: string
          impressions_7d?: number | null
          is_weekend?: boolean | null
          keyword_id?: string
          roas_14d?: number | null
          roas_30d?: number | null
          roas_7d?: number | null
          sales_7d?: number | null
          sales_trend?: number | null
          seller_id?: string
          spend_7d?: number | null
          spend_trend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_store_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: true
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_store_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          created_at: string | null
          id: string
          keyword_id: string
          predicted_acos: number | null
          predicted_sales: number
          predicted_spend: number
          sales_lower_bound: number | null
          sales_upper_bound: number | null
          seller_id: string
          spend_lower_bound: number | null
          spend_upper_bound: number | null
          target_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword_id: string
          predicted_acos?: number | null
          predicted_sales: number
          predicted_spend: number
          sales_lower_bound?: number | null
          sales_upper_bound?: number | null
          seller_id: string
          spend_lower_bound?: number | null
          spend_upper_bound?: number | null
          target_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword_id?: string
          predicted_acos?: number | null
          predicted_sales?: number
          predicted_spend?: number
          sales_lower_bound?: number | null
          sales_upper_bound?: number | null
          seller_id?: string
          spend_lower_bound?: number | null
          spend_upper_bound?: number | null
          target_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecasts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_metrics_daily: {
        Row: {
          acos: number | null
          campaign_id: string
          clicks: number | null
          cpc: number | null
          ctr: number | null
          cvr: number | null
          date: string
          id: string
          impressions: number | null
          keyword_id: string
          orders: number | null
          roas: number | null
          sales: number | null
          seller_id: string
          spend: number | null
        }
        Insert: {
          acos?: number | null
          campaign_id: string
          clicks?: number | null
          cpc?: number | null
          ctr?: number | null
          cvr?: number | null
          date: string
          id?: string
          impressions?: number | null
          keyword_id: string
          orders?: number | null
          roas?: number | null
          sales?: number | null
          seller_id: string
          spend?: number | null
        }
        Update: {
          acos?: number | null
          campaign_id?: string
          clicks?: number | null
          cpc?: number | null
          ctr?: number | null
          cvr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          keyword_id?: string
          orders?: number | null
          roas?: number | null
          sales?: number | null
          seller_id?: string
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_metrics_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_metrics_daily_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_metrics_daily_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          acos: number | null
          bid: number
          campaign_id: string
          clicks: number | null
          created_at: string | null
          id: string
          impressions: number | null
          keyword_text: string
          match_type: string
          orders: number | null
          sales: number | null
          seller_id: string
          spend: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          acos?: number | null
          bid?: number
          campaign_id: string
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          keyword_text: string
          match_type?: string
          orders?: number | null
          sales?: number | null
          seller_id: string
          spend?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          acos?: number | null
          bid?: number
          campaign_id?: string
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          keyword_text?: string
          match_type?: string
          orders?: number | null
          sales?: number | null
          seller_id?: string
          spend?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keywords_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keywords_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          ad_sales: number
          campaign_id: string
          id: string
          impressions: number
          organic_sales: number
          recorded_at: string
          spend: number
        }
        Insert: {
          ad_sales?: number
          campaign_id: string
          id?: string
          impressions?: number
          organic_sales?: number
          recorded_at?: string
          spend?: number
        }
        Update: {
          ad_sales?: number
          campaign_id?: string
          id?: string
          impressions?: number
          organic_sales?: number
          recorded_at?: string
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          asin: string
          created_at: string | null
          id: string
          image_url: string | null
          inventory_level: number
          price: number
          seller_id: string
          title: string
        }
        Insert: {
          asin: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          inventory_level?: number
          price: number
          seller_id: string
          title: string
        }
        Update: {
          asin?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          inventory_level?: number
          price?: number
          seller_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      q_learning_config: {
        Row: {
          created_at: string | null
          discount_factor: number
          epsilon: number
          id: string
          learning_rate: number
          multipliers: Json
          seller_id: string
        }
        Insert: {
          created_at?: string | null
          discount_factor?: number
          epsilon?: number
          id?: string
          learning_rate?: number
          multipliers?: Json
          seller_id: string
        }
        Update: {
          created_at?: string | null
          discount_factor?: number
          epsilon?: number
          id?: string
          learning_rate?: number
          multipliers?: Json
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "q_learning_config_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      q_learning_state: {
        Row: {
          action_idx: number
          id: string
          keyword_id: string
          last_updated: string | null
          q_value: number
          seller_id: string
          state_bucket: string
          visits: number
        }
        Insert: {
          action_idx: number
          id?: string
          keyword_id: string
          last_updated?: string | null
          q_value?: number
          seller_id: string
          state_bucket: string
          visits?: number
        }
        Update: {
          action_idx?: number
          id?: string
          keyword_id?: string
          last_updated?: string | null
          q_value?: number
          seller_id?: string
          state_bucket?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "q_learning_state_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "q_learning_state_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          created_at: string | null
          currency: string
          id: string
          marketplace: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          id?: string
          marketplace?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          id?: string
          marketplace?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      sp_api_credentials: {
        Row: {
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          last_synced_at: string | null
          refresh_token: string | null
          region: string
          seller_id: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_synced_at?: string | null
          refresh_token?: string | null
          region?: string
          seller_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_synced_at?: string | null
          refresh_token?: string | null
          region?: string
          seller_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_api_credentials_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          records_processed: number | null
          seller_id: string
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_processed?: number | null
          seller_id: string
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_processed?: number | null
          seller_id?: string
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      thompson_sampling_history: {
        Row: {
          created_at: string | null
          id: string
          keyword_id: string
          outcome_observed: boolean | null
          reward: number | null
          sampled_values: Json | null
          selected_multiplier: number
          seller_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword_id: string
          outcome_observed?: boolean | null
          reward?: number | null
          sampled_values?: Json | null
          selected_multiplier: number
          seller_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword_id?: string
          outcome_observed?: boolean | null
          reward?: number | null
          sampled_values?: Json | null
          selected_multiplier?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thompson_sampling_history_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thompson_sampling_history_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      thompson_sampling_state: {
        Row: {
          alpha: number
          beta: number
          bid_multiplier: number
          id: string
          keyword_id: string
          last_updated: string | null
          pulls: number | null
          seller_id: string
          total_reward: number | null
        }
        Insert: {
          alpha?: number
          beta?: number
          bid_multiplier: number
          id?: string
          keyword_id: string
          last_updated?: string | null
          pulls?: number | null
          seller_id: string
          total_reward?: number | null
        }
        Update: {
          alpha?: number
          beta?: number
          bid_multiplier?: number
          id?: string
          keyword_id?: string
          last_updated?: string | null
          pulls?: number | null
          seller_id?: string
          total_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "thompson_sampling_state_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thompson_sampling_state_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_competitor_dashboard: {
        Row: {
          asin: string | null
          brand_name: string | null
          bsr: number | null
          competitor_id: string | null
          estimated_daily_sales: number | null
          estimated_price: number | null
          is_active: boolean | null
          latest_metrics_date: string | null
          product_title: string | null
          rating: number | null
          review_count: number | null
          seller_id: string | null
          share_of_voice_percent: number | null
          tracked_since: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_alert_rules: { Args: { p_seller_id: string }; Returns: number }
      complete_sp_api_sync: {
        Args: {
          p_error?: string
          p_log_id: string
          p_records: number
          p_status: string
        }
        Returns: undefined
      }
      compute_ewma_forecast: {
        Args: { p_horizon_days?: number; p_seller_id: string }
        Returns: undefined
      }
      compute_rolling_features: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      ensemble_recommendations: {
        Args: { p_campaign_id: string }
        Returns: {
          current_bid: number
          forecast_multiplier: number
          forecast_weight: number
          keyword_id: string
          keyword_text: string
          multiplier: number
          q_learning_multiplier: number
          q_learning_weight: number
          recommended_bid: number
          thompson_multiplier: number
          thompson_weight: number
        }[]
      }
      get_campaign_forecasts: {
        Args: { p_campaign_id: string; p_horizon_days?: number }
        Returns: {
          predicted_acos: number
          predicted_sales: number
          predicted_spend: number
          sales_lower_bound: number
          sales_upper_bound: number
          spend_lower_bound: number
          spend_upper_bound: number
          target_date: string
        }[]
      }
      get_my_seller_id: { Args: never; Returns: string }
      init_q_learning_for_seller: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      init_thompson_for_seller: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      q_campaign_recommendations: {
        Args: { p_campaign_id: string }
        Returns: {
          current_bid: number
          is_explore: boolean
          keyword_id: string
          keyword_text: string
          multiplier: number
          q_value: number
          recommended_bid: number
          state_bucket: string
        }[]
      }
      q_discretize_state: {
        Args: { p_acos: number; p_ctr: number; p_cvr: number }
        Returns: string
      }
      q_select_action: {
        Args: { p_keyword_id: string }
        Returns: {
          action_idx: number
          is_explore: boolean
          multiplier: number
          q_value: number
        }[]
      }
      q_update: {
        Args: {
          p_action: number
          p_keyword_id: string
          p_next_state: string
          p_reward: number
          p_state: string
        }
        Returns: undefined
      }
      run_all_autonomous_operators: { Args: never; Returns: undefined }
      run_autonomous_operator: {
        Args: { p_seller_id: string }
        Returns: number
      }
      seed_default_alert_rules: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      seed_demo_data:
        | { Args: never; Returns: undefined }
        | { Args: { p_seller_id: string }; Returns: undefined }
      seed_demo_data_alerts: { Args: never; Returns: undefined }
      simulate_sp_api_sync: { Args: { p_sync_type: string }; Returns: string }
      thompson_beta_sample: {
        Args: { p_alpha: number; p_beta: number }
        Returns: number
      }
      thompson_campaign_recommendations: {
        Args: { p_campaign_id: string }
        Returns: {
          confidence: number
          current_bid: number
          keyword_id: string
          keyword_text: string
          multiplier: number
          recommended_bid: number
        }[]
      }
      thompson_init_keyword: {
        Args: { p_keyword_id: string; p_seller_id: string }
        Returns: undefined
      }
      thompson_select_bid: {
        Args: { p_keyword_id: string }
        Returns: {
          confidence: number
          current_bid: number
          recommended_bid: number
          samples: Json
          selected_multiplier: number
        }[]
      }
      thompson_update: {
        Args: { p_keyword_id: string; p_multiplier: number; p_reward: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
