export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      draft_participants: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          is_host: boolean
          joined_at: string | null
          participant_name: string
          status: Database["public"]["Enums"]["participant_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          is_host?: boolean
          joined_at?: string | null
          participant_name: string
          status?: Database["public"]["Enums"]["participant_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          is_host?: boolean
          joined_at?: string | null
          participant_name?: string
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string
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
          current_turn_user_id: string | null
          id: string
          invite_code: string | null
          is_complete: boolean | null
          is_multiplayer: boolean | null
          option: string
          participants: string[]
          theme: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories: string[]
          created_at?: string | null
          current_pick_number?: number | null
          current_turn_user_id?: string | null
          id?: string
          invite_code?: string | null
          is_complete?: boolean | null
          is_multiplayer?: boolean | null
          option: string
          participants: string[]
          theme: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: string[]
          created_at?: string | null
          current_pick_number?: number | null
          current_turn_user_id?: string | null
          id?: string
          invite_code?: string | null
          is_complete?: boolean | null
          is_multiplayer?: boolean | null
          option?: string
          participants?: string[]
          theme?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_draft_participant: {
        Args: { draft_id_param: string }
        Returns: boolean
      }
      join_draft_by_invite_code: {
        Args: { invite_code_param: string; participant_name_param: string }
        Returns: string
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
