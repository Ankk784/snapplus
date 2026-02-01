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
      guild_config: {
        Row: {
          antilink_enabled: boolean | null
          antilink_ignored_channels: string[] | null
          antilink_sanction: string | null
          antilink_type: string | null
          antiraid_enabled: boolean | null
          antiraid_max_joins: number | null
          antiraid_timeframe: number | null
          antispam_enabled: boolean | null
          antispam_max_messages: number | null
          antispam_sanction: string | null
          antispam_timeframe: number | null
          captcha_channel_id: string | null
          captcha_enabled: boolean | null
          captcha_role_id: string | null
          created_at: string
          goodbye_message: string | null
          guild_id: string
          id: string
          logs_channel_id: string | null
          public_allowed_channels: string[] | null
          public_denied_channels: string[] | null
          ticket_category_id: string | null
          ticket_support_role_id: string | null
          updated_at: string
          welcome_channel_id: string | null
          welcome_message: string | null
        }
        Insert: {
          antilink_enabled?: boolean | null
          antilink_ignored_channels?: string[] | null
          antilink_sanction?: string | null
          antilink_type?: string | null
          antiraid_enabled?: boolean | null
          antiraid_max_joins?: number | null
          antiraid_timeframe?: number | null
          antispam_enabled?: boolean | null
          antispam_max_messages?: number | null
          antispam_sanction?: string | null
          antispam_timeframe?: number | null
          captcha_channel_id?: string | null
          captcha_enabled?: boolean | null
          captcha_role_id?: string | null
          created_at?: string
          goodbye_message?: string | null
          guild_id: string
          id: string
          logs_channel_id?: string | null
          public_allowed_channels?: string[] | null
          public_denied_channels?: string[] | null
          ticket_category_id?: string | null
          ticket_support_role_id?: string | null
          updated_at?: string
          welcome_channel_id?: string | null
          welcome_message?: string | null
        }
        Update: {
          antilink_enabled?: boolean | null
          antilink_ignored_channels?: string[] | null
          antilink_sanction?: string | null
          antilink_type?: string | null
          antiraid_enabled?: boolean | null
          antiraid_max_joins?: number | null
          antiraid_timeframe?: number | null
          antispam_enabled?: boolean | null
          antispam_max_messages?: number | null
          antispam_sanction?: string | null
          antispam_timeframe?: number | null
          captcha_channel_id?: string | null
          captcha_enabled?: boolean | null
          captcha_role_id?: string | null
          created_at?: string
          goodbye_message?: string | null
          guild_id?: string
          id?: string
          logs_channel_id?: string | null
          public_allowed_channels?: string[] | null
          public_denied_channels?: string[] | null
          ticket_category_id?: string | null
          ticket_support_role_id?: string | null
          updated_at?: string
          welcome_channel_id?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      mod_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          guild_id: string
          id: string
          moderator_id: string | null
          target_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          guild_id: string
          id?: string
          moderator_id?: string | null
          target_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          guild_id?: string
          id?: string
          moderator_id?: string | null
          target_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sanctions: {
        Row: {
          active: boolean | null
          created_at: string
          duration: string | null
          expires_at: string | null
          guild_id: string
          id: string
          moderator_id: string
          reason: string | null
          type: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          duration?: string | null
          expires_at?: string | null
          guild_id: string
          id?: string
          moderator_id: string
          reason?: string | null
          type: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          duration?: string | null
          expires_at?: string | null
          guild_id?: string
          id?: string
          moderator_id?: string
          reason?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      stats_config: {
        Row: {
          id: string
          last_update: string | null
          started_at: string | null
          stats_channel_id: string | null
          stats_message_id: string | null
        }
        Insert: {
          id?: string
          last_update?: string | null
          started_at?: string | null
          stats_channel_id?: string | null
          stats_message_id?: string | null
        }
        Update: {
          id?: string
          last_update?: string | null
          started_at?: string | null
          stats_channel_id?: string | null
          stats_message_id?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          phone: string
          status: string
          username: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          phone: string
          status?: string
          username: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          phone?: string
          status?: string
          username?: string
        }
        Relationships: []
      }
      temp_roles: {
        Row: {
          created_at: string
          expires_at: string
          guild_id: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          guild_id: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          guild_id?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          channel_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          guild_id: string
          id: string
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          guild_id: string
          id?: string
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          guild_id?: string
          id?: string
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          moderator_id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          moderator_id: string
          note: string
          user_id: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          moderator_id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          id: string
          ip_hash: string | null
          user_agent: string | null
          visited_at: string | null
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          visited_at?: string | null
        }
        Update: {
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          visited_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
