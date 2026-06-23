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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      actor_name_aliases: {
        Row: {
          alias_name: string
          created_at: string | null
          id: string
          primary_name: string
          tmdb_id: number
        }
        Insert: {
          alias_name: string
          created_at?: string | null
          id?: string
          primary_name: string
          tmdb_id: number
        }
        Update: {
          alias_name?: string
          created_at?: string | null
          id?: string
          primary_name?: string
          tmdb_id?: number
        }
        Relationships: []
      }
      actor_spec_categories: {
        Row: {
          actor_name: string
          actor_tmdb_id: number | null
          category_name: string
          created_at: string | null
          description: string | null
          id: string
          movie_tmdb_ids: number[]
          updated_at: string | null
        }
        Insert: {
          actor_name: string
          actor_tmdb_id?: number | null
          category_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          movie_tmdb_ids: number[]
          updated_at?: string | null
        }
        Update: {
          actor_name?: string
          actor_tmdb_id?: number | null
          category_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          movie_tmdb_ids?: number[]
          updated_at?: string | null
        }
        Relationships: []
      }
      draft_participants: {
        Row: {
          created_at: string
          draft_id: string
          guest_participant_id: string | null
          id: string
          is_ai: boolean | null
          is_host: boolean
          joined_at: string | null
          last_seen_at: string | null
          participant_name: string
          status: Database["public"]["Enums"]["participant_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draft_id: string
          guest_participant_id?: string | null
          id?: string
          is_ai?: boolean | null
          is_host?: boolean
          joined_at?: string | null
          last_seen_at?: string | null
          participant_name: string
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draft_id?: string
          guest_participant_id?: string | null
          id?: string
          is_ai?: boolean | null
          is_host?: boolean
          joined_at?: string | null
          last_seen_at?: string | null
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
          letterboxd_rating: number | null
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
          letterboxd_rating?: number | null
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
          letterboxd_rating?: number | null
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
      draft_votes: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          voted_participant_id: string | null
          voted_player_name: string | null
          voter_guest_session_id: string | null
          voter_user_id: string | null
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          voted_participant_id?: string | null
          voted_player_name?: string | null
          voter_guest_session_id?: string | null
          voter_user_id?: string | null
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          voted_participant_id?: string | null
          voted_player_name?: string | null
          voter_guest_session_id?: string | null
          voter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_votes_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_votes_voted_participant_id_fkey"
            columns: ["voted_participant_id"]
            isOneToOne: false
            referencedRelation: "draft_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_votes_voter_guest_session_id_fkey"
            columns: ["voter_guest_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          allow_public_voting: boolean
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
          voting_ends_at: string | null
        }
        Insert: {
          allow_public_voting?: boolean
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
          voting_ends_at?: string | null
        }
        Update: {
          allow_public_voting?: boolean
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
          voting_ends_at?: string | null
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
      league_drafts: {
        Row: {
          added_at: string
          categories: string[]
          draft_id: string | null
          draft_type: string | null
          id: string
          league_id: string
          notes: string | null
          scheduled_at: string | null
          season_id: string | null
          theme: string | null
        }
        Insert: {
          added_at?: string
          categories?: string[]
          draft_id?: string | null
          draft_type?: string | null
          id?: string
          league_id: string
          notes?: string | null
          scheduled_at?: string | null
          season_id?: string | null
          theme?: string | null
        }
        Update: {
          added_at?: string
          categories?: string[]
          draft_id?: string | null
          draft_type?: string | null
          id?: string
          league_id?: string
          notes?: string | null
          scheduled_at?: string | null
          season_id?: string | null
          theme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_drafts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_drafts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_drafts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string | null
          invited_user_id: string | null
          league_id: string
          status: Database["public"]["Enums"]["league_invite_status"]
          token: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          invited_email?: string | null
          invited_user_id?: string | null
          league_id: string
          status?: Database["public"]["Enums"]["league_invite_status"]
          token?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string | null
          invited_user_id?: string | null
          league_id?: string
          status?: Database["public"]["Enums"]["league_invite_status"]
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_invites_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: Database["public"]["Enums"]["league_member_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: Database["public"]["Enums"]["league_member_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: Database["public"]["Enums"]["league_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          league_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          league_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          league_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_messages_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "league_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_messages_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          league_id: string
          name: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          league_id: string
          name: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          league_id?: string
          name?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
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
      person_lifespans: {
        Row: {
          birth_date: string | null
          created_at: string
          death_date: string | null
          id: string
          name: string
          tmdb_id: number
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          death_date?: string | null
          id?: string
          name: string
          tmdb_id: number
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          death_date?: string | null
          id?: string
          name?: string
          tmdb_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          marketing_emails_opt_in: boolean
          marketing_emails_opt_in_at: string | null
          marketing_emails_opt_out_at: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          marketing_emails_opt_in?: boolean
          marketing_emails_opt_in_at?: string | null
          marketing_emails_opt_out_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          marketing_emails_opt_in?: boolean
          marketing_emails_opt_in_at?: string | null
          marketing_emails_opt_out_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spec_draft_categories: {
        Row: {
          category_name: string
          created_at: string | null
          description: string | null
          id: string
          spec_draft_id: string
          updated_at: string | null
        }
        Insert: {
          category_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          spec_draft_id: string
          updated_at?: string | null
        }
        Update: {
          category_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          spec_draft_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spec_draft_categories_spec_draft_id_fkey"
            columns: ["spec_draft_id"]
            isOneToOne: false
            referencedRelation: "spec_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      spec_draft_movie_categories: {
        Row: {
          category_name: string
          created_at: string | null
          id: string
          is_automated: boolean | null
          spec_draft_movie_id: string
        }
        Insert: {
          category_name: string
          created_at?: string | null
          id?: string
          is_automated?: boolean | null
          spec_draft_movie_id: string
        }
        Update: {
          category_name?: string
          created_at?: string | null
          id?: string
          is_automated?: boolean | null
          spec_draft_movie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spec_draft_movie_categories_spec_draft_movie_id_fkey"
            columns: ["spec_draft_movie_id"]
            isOneToOne: false
            referencedRelation: "spec_draft_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      spec_draft_movies: {
        Row: {
          created_at: string | null
          id: string
          is_sequel: boolean
          movie_genres: number[] | null
          movie_overview: string | null
          movie_poster_path: string | null
          movie_title: string
          movie_tmdb_id: number
          movie_year: number | null
          oscar_status: string | null
          revenue: number | null
          seo_blurb: string | null
          sequel_enriched_at: string | null
          spec_draft_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_sequel?: boolean
          movie_genres?: number[] | null
          movie_overview?: string | null
          movie_poster_path?: string | null
          movie_title: string
          movie_tmdb_id: number
          movie_year?: number | null
          oscar_status?: string | null
          revenue?: number | null
          seo_blurb?: string | null
          sequel_enriched_at?: string | null
          spec_draft_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_sequel?: boolean
          movie_genres?: number[] | null
          movie_overview?: string | null
          movie_poster_path?: string | null
          movie_title?: string
          movie_tmdb_id?: number
          movie_year?: number | null
          oscar_status?: string | null
          revenue?: number | null
          seo_blurb?: string | null
          sequel_enriched_at?: string | null
          spec_draft_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spec_draft_movies_spec_draft_id_fkey"
            columns: ["spec_draft_id"]
            isOneToOne: false
            referencedRelation: "spec_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      spec_drafts: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_hidden: boolean | null
          name: string
          photo_url: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_hidden?: boolean | null
          name: string
          photo_url?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_hidden?: boolean | null
          name?: string
          photo_url?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_emails: {
        Row: {
          auto_replied: boolean | null
          body_html: string | null
          body_text: string | null
          created_at: string
          forwarded_to: string | null
          from_email: string
          id: string
          processed_at: string | null
          received_at: string
          subject: string
          to_email: string[]
        }
        Insert: {
          auto_replied?: boolean | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          forwarded_to?: string | null
          from_email: string
          id?: string
          processed_at?: string | null
          received_at?: string
          subject: string
          to_email: string[]
        }
        Update: {
          auto_replied?: boolean | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          forwarded_to?: string | null
          from_email?: string
          id?: string
          processed_at?: string | null
          received_at?: string
          subject?: string
          to_email?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      league_season_standings: {
        Row: {
          display_name: string | null
          draft_count: number | null
          league_id: string | null
          photo_url: string | null
          rank: number | null
          season_id: string | null
          total_score: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_drafts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_standings: {
        Row: {
          display_name: string | null
          draft_count: number | null
          league_id: string | null
          photo_url: string | null
          rank: number | null
          total_score: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_league_invite: {
        Args: { invite_id_param: string }
        Returns: string
      }
      accept_league_invite_by_token: {
        Args: { token_param: string }
        Returns: string
      }
      calculate_new_movie_score:
        | {
            Args: {
              p_budget: number
              p_imdb_rating: number
              p_letterboxd_rating: number
              p_metacritic_score: number
              p_oscar_status: string
              p_revenue: number
              p_rt_critics_score: number
            }
            Returns: number
          }
        | {
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
      cleanup_expired_guest_sessions: { Args: never; Returns: undefined }
      clear_draft_presence: {
        Args: { p_draft_id: string; p_participant_id: string }
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
      create_multiplayer_draft_unified:
        | {
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
        | {
            Args: {
              p_ai_participant_names?: string[]
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
      current_guest_session: { Args: never; Returns: string }
      enable_draft_voting: {
        Args: {
          p_draft_id: string
          p_duration_minutes: number
          p_guest_session_id?: string
          p_public: boolean
        }
        Returns: undefined
      }
      generate_invite_code: { Args: never; Returns: string }
      generate_league_slug: { Args: { name_input: string }; Returns: string }
      heartbeat_draft_presence: {
        Args: { p_draft_id: string; p_participant_id: string }
        Returns: undefined
      }
      get_invite_code_for_draft: {
        Args: { p_draft_id: string }
        Returns: string
      }
      get_oscar_cache_stats: {
        Args: never
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
      is_league_member: { Args: { league_uuid: string }; Returns: boolean }
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
      list_profile_drafts: {
        Args: never
        Returns: {
          categories: string[]
          created_at: string
          id: string
          is_complete: boolean
          is_multiplayer: boolean
          option: string
          participant_count: number
          participants: string[]
          profile_role: string
          theme: string
          title: string
          updated_at: string
        }[]
      }
      load_draft_unified: {
        Args: { p_draft_id: string; p_participant_id: string }
        Returns: {
          draft_allow_public_voting: boolean
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
          draft_voting_ends_at: string
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
      make_multiplayer_pick_unified:
        | {
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
        | {
            Args: {
              p_caller_participant_id?: string
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
        Args: never
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
        Args: { p_draft_id: string; p_participant_id?: string }
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
      submit_draft_vote: {
        Args: {
          p_draft_id: string
          p_guest_session_id?: string
          p_voted_participant_id: string
          p_voted_player_name: string
        }
        Returns: string
      }
    }
    Enums: {
      league_invite_status: "pending" | "accepted" | "declined" | "expired"
      league_member_role: "admin" | "member"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      league_invite_status: ["pending", "accepted", "declined", "expired"],
      league_member_role: ["admin", "member"],
      participant_status: ["invited", "joined", "left"],
    },
  },
} as const
