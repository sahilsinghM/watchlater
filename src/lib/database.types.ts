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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      anonymous_sessions: {
        Row: {
          first_seen_at: string
          id: string
          last_seen_at: string
          session_key: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          session_key: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          session_key?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          lesson_id: string | null
          lesson_video_id: string
          name: string | null
          reason: string | null
          session_id: string | null
          source: string
          useful: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          lesson_id?: string | null
          lesson_video_id: string
          name?: string | null
          reason?: string | null
          session_id?: string | null
          source: string
          useful: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          lesson_id?: string | null
          lesson_video_id?: string
          name?: string | null
          reason?: string | null
          session_id?: string | null
          source?: string
          useful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "feedback_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anonymous_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          lesson_video_id: string | null
          session_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          lesson_video_id?: string | null
          session_id?: string | null
          source: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          lesson_video_id?: string | null
          session_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anonymous_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          generation_metadata: Json
          id: string
          lesson_json: Json
          openai_model: string | null
          schema_version: string
          updated_at: string
          video_id: string | null
          youtube_id: string
        }
        Insert: {
          created_at?: string
          generation_metadata?: Json
          id?: string
          lesson_json: Json
          openai_model?: string | null
          schema_version?: string
          updated_at?: string
          video_id?: string | null
          youtube_id: string
        }
        Update: {
          created_at?: string
          generation_metadata?: Json
          id?: string
          lesson_json?: Json
          openai_model?: string | null
          schema_version?: string
          updated_at?: string
          video_id?: string | null
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          created_at: string
          current_step: string
          error_code: string | null
          error_detail: string | null
          id: string
          session_id: string | null
          status: string
          updated_at: string
          video_id: string | null
          youtube_id: string
        }
        Insert: {
          created_at?: string
          current_step: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          session_id?: string | null
          status: string
          updated_at?: string
          video_id?: string | null
          youtube_id: string
        }
        Update: {
          created_at?: string
          current_step?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          session_id?: string | null
          status?: string
          updated_at?: string
          video_id?: string | null
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anonymous_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          answers: Json
          completed_at: string
          id: string
          lesson_id: string | null
          lesson_video_id: string
          score: number
          session_id: string | null
          total: number
        }
        Insert: {
          answers: Json
          completed_at?: string
          id?: string
          lesson_id?: string | null
          lesson_video_id: string
          score: number
          session_id?: string | null
          total: number
        }
        Update: {
          answers?: Json
          completed_at?: string
          id?: string
          lesson_id?: string | null
          lesson_video_id?: string
          score?: number
          session_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anonymous_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      screenshots: {
        Row: {
          caption: string | null
          capture_status: string
          created_at: string
          id: string
          storage_path: string
          timestamp_seconds: number
          video_id: string
        }
        Insert: {
          caption?: string | null
          capture_status: string
          created_at?: string
          id?: string
          storage_path: string
          timestamp_seconds: number
          video_id: string
        }
        Update: {
          caption?: string | null
          capture_status?: string
          created_at?: string
          id?: string
          storage_path?: string
          timestamp_seconds?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_chunks: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          language: string | null
          source_kind: string | null
          start_seconds: number
          text: string
          video_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          source_kind?: string | null
          start_seconds: number
          text: string
          video_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          source_kind?: string | null
          start_seconds?: number
          text?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_chunks_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_interactions: {
        Row: {
          answer: string
          created_at: string
          id: string
          lesson_id: string | null
          lesson_video_id: string
          question: string
          session_id: string | null
          supported: boolean
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          lesson_video_id: string
          question: string
          session_id?: string | null
          supported: boolean
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          lesson_video_id?: string
          question?: string
          session_id?: string | null
          supported?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tutor_interactions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anonymous_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          channel: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          language: string | null
          metadata: Json
          support_status: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          youtube_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          metadata?: Json
          support_status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          youtube_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          metadata?: Json
          support_status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          youtube_id?: string
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
