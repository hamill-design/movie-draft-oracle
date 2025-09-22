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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      classic_oscar_data: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          movie_title: string
          movie_year: number
          oscar_status: string
          person_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          movie_title: string
          movie_year: number
          oscar_status: string
          person_name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          movie_title?: string
          movie_year?: number
          oscar_status?: string
          person_name?: string
        }
        Relationships: []
      }
      draft_participants: {
        Row: {
          created_at: string
          draft_id: string
          guest_participant_id: string | null
          id: string
          is_host: boolean
          joined_at: string | null
          participant_name: string
          status: Database["public"]["Enums"]["participant_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draft_id: string
          guest_participant_id?: string | null
          id?: string
          is_host?: boolean
          joined_at?: string | null
          participant_name: string
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draft_id?: string
          guest_participant_id?: string | null
          id?: string
          is_host?: boolean
          joined_at?: string | null
          participant_name?: string
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_participants_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_picks: {
        Row: {
          calculated_score: number | null
          category: string
          created_at: string | null
          draft_id: string
          id: string
          imdb_rating: number | null
          metacritic_score: number | null
          movie_budget: number | null
          movie_genre: string | null
          movie_id: number
          movie_revenue: number | null
          movie_title: string
          movie_year: number | null
          oscar_status: string | null
          pick_order: number
          player_id: number
          player_name: string
          poster_path: string | null
          rt_audience_score: number | null
          rt_critics_score: number | null
          scoring_data_complete: boolean | null
        }
        Insert: {
          calculated_score?: number | null
          category: string
          created_at?: string | null
          draft_id: string
          id?: string
          imdb_rating?: number | null
          metacritic_score?: number | null
          movie_budget?: number | null
          movie_genre?: string | null
          movie_id: number
          movie_revenue?: number | null
          movie_title: string
          movie_year?: number | null
          oscar_status?: string | null
          pick_order: number
          player_id: number
          player_name: string
          poster_path?: string | null
          rt_audience_score?: number | null
          rt_critics_score?: number | null
          scoring_data_complete?: boolean | null
        }
        Update: {
          calculated_score?: number | null
          category?: string
          created_at?: string | null
          draft_id?: string
          id?: string
          imdb_rating?: number | null
          metacritic_score?: number | null
          movie_budget?: number | null
          movie_genre?: string | null
          movie_id?: number
          movie_revenue?: number | null
          movie_title?: string
          movie_year?: number | null
          oscar_status?: string | null
          pick_order?: number
          player_id?: number
          player_name?: string
          poster_path?: string | null
          rt_audience_score?: number | null
          rt_critics_score?: number | null
          scoring_data_complete?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          categories: string[]
          created_at: string | null
          current_pick_number: number | null
          current_turn_participant_id: string | null
          current_turn_user_id: string | null
          draft_order: string[] | null
          guest_session_id: string | null
          id: string
          invite_code: string | null
          is_complete: boolean | null
          is_multiplayer: boolean | null
          is_public: boolean
          option: string
          participants: string[]
          theme: string
          title: string
          turn_order: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          categories: string[]
          created_at?: string | null
          current_pick_number?: number | null
          current_turn_participant_id?: string | null
          current_turn_user_id?: string | null
          draft_order?: string[] | null
          guest_session_id?: string | null
          id?: string
          invite_code?: string | null
          is_complete?: boolean | null
          is_multiplayer?: boolean | null
          is_public?: boolean
          option: string
          participants: string[]
          theme: string
          title: string
          turn_order?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          categories?: string[]
          created_at?: string | null
          current_pick_number?: number | null
          current_turn_participant_id?: string | null
          current_turn_user_id?: string | null
          draft_order?: string[] | null
          guest_session_id?: string | null
          id?: string
          invite_code?: string | null
          is_complete?: boolean | null
          is_multiplayer?: boolean | null
          is_public?: boolean
          option?: string
          participants?: string[]
          theme?: string
          title?: string
          turn_order?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drafts_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          last_active: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_active?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_active?: string | null
        }
        Relationships: []
      }
      oscar_cache: {
        Row: {
          awards_data: string | null
          created_at: string
          id: string
          movie_title: string
          movie_year: number | null
          oscar_status: string
          tmdb_id: number
          updated_at: string
        }
        Insert: {
          awards_data?: string | null
          created_at?: string
          id?: string
          movie_title: string
          movie_year?: number | null
          oscar_status?: string
          tmdb_id: number
          updated_at?: string
        }
        Update: {
          awards_data?: string | null
          created_at?: string
          id?: string
          movie_title?: string
          movie_year?: number | null
          oscar_status?: string
          tmdb_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_new_movie_score: {
        Args: {
          p_budget: number
          p_imdb_rating: number
          p_metacritic_score: number
          p_oscar_status: string
          p_revenue: number
          p_rt_critics_score: number
        }
        Returns: number
      }
      can_access_draft: {
        Args: { p_draft_id: string; p_participant_id: string }
        Returns: boolean
      }
      cleanup_expired_guest_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_guest_multiplayer_draft: {
        Args: {
          p_categories: string[]
          p_guest_session_id: string
          p_option: string
          p_participant_name: string
          p_participants: string[]
          p_theme: string
          p_title: string
        }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_user_id: string
          draft_draft_order: string[]
          draft_guest_session_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          draft_user_id: string
          participants_data: Json
          picks_data: Json
        }[]
      }
      create_multiplayer_draft_unified: {
        Args: {
          p_categories: string[]
          p_option: string
          p_participant_id: string
          p_participant_name: string
          p_participants: string[]
          p_theme: string
          p_title: string
        }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_participant_id: string
          draft_current_turn_user_id: string
          draft_draft_order: string[]
          draft_guest_session_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          draft_user_id: string
          participants_data: Json
          picks_data: Json
        }[]
      }
      current_guest_session: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_oscar_cache_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          entries_needing_refresh: number
          nominees: number
          none_status: number
          total_entries: number
          winners: number
        }[]
      }
      is_draft_participant: {
        Args: { draft_id_param: string }
        Returns: boolean
      }
      join_draft_by_invite_code: {
        Args: { invite_code_param: string; participant_name_param: string }
        Returns: string
      }
      join_draft_by_invite_code_guest: {
        Args: {
          invite_code_param: string
          p_guest_session_id?: string
          participant_name_param: string
        }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_user_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          participant_id: string
        }[]
      }
      load_draft_unified: {
        Args: { p_draft_id: string; p_participant_id: string }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_participant_id: string
          draft_current_turn_user_id: string
          draft_draft_order: string[]
          draft_guest_session_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          draft_user_id: string
          participants_data: Json
          picks_data: Json
        }[]
      }
      load_draft_with_guest_access: {
        Args: { p_draft_id: string; p_guest_session_id?: string }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_user_id: string
          draft_draft_order: string[]
          draft_guest_session_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          draft_user_id: string
          participants_data: Json
          picks_data: Json
        }[]
      }
      make_multiplayer_pick: {
        Args: {
          p_category: string
          p_draft_id: string
          p_movie_genre: string
          p_movie_id: number
          p_movie_title: string
          p_movie_year: number
          p_poster_path?: string
        }
        Returns: {
          message: string
          new_pick_number: number
          next_turn_user_id: string
          success: boolean
        }[]
      }
      make_multiplayer_pick_unified: {
        Args: {
          p_category: string
          p_draft_id: string
          p_movie_genre: string
          p_movie_id: number
          p_movie_title: string
          p_movie_year: number
          p_participant_id: string
          p_poster_path?: string
        }
        Returns: {
          message: string
          new_pick_number: number
          next_turn_participant_id: string
          success: boolean
        }[]
      }
      migrate_guest_drafts_to_user: {
        Args: { p_guest_session_id: string }
        Returns: undefined
      }
      refresh_oscar_cache_for_questionable_entries: {
        Args: Record<PropertyKey, never>
        Returns: {
          entries_found: number
          refreshed_count: number
        }[]
      }
      set_guest_session_context: {
        Args: { session_id: string }
        Returns: undefined
      }
      start_multiplayer_draft: {
        Args: { p_draft_id: string; p_guest_session_id?: string }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_user_id: string
          draft_draft_order: string[]
          draft_guest_session_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          draft_user_id: string
        }[]
      }
      start_multiplayer_draft_unified: {
        Args: { p_draft_id: string; p_participant_id: string }
        Returns: {
          draft_categories: string[]
          draft_created_at: string
          draft_current_pick_number: number
          draft_current_turn_participant_id: string
          draft_current_turn_user_id: string
          draft_draft_order: string[]
          draft_guest_session_id: string
          draft_id: string
          draft_invite_code: string
          draft_is_complete: boolean
          draft_is_multiplayer: boolean
          draft_option: string
          draft_participants: string[]
          draft_theme: string
          draft_title: string
          draft_turn_order: Json
          draft_updated_at: string
          draft_user_id: string
        }[]
      }
    }
    Enums: {
      participant_status: "invited" | "joined" | "left"
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
    Enums: {
      participant_status: ["invited", "joined", "left"],
    },
  },
} as const
