export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      age_categories: {
        Row: {
          age: number | null
          centre_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          age?: number | null
          centre_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          age?: number | null
          centre_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "age_categories_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string
          batch_id: string
          created_at: string
          id: string
          marked_by: string
          player_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          attendance_date: string
          batch_id: string
          created_at?: string
          id?: string
          marked_by: string
          player_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          attendance_date?: string
          batch_id?: string
          created_at?: string
          id?: string
          marked_by?: string
          player_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          age_category_id: string
          centre_id: string
          created_at: string
          end_time: string
          head_coach_id: string
          id: string
          is_active: boolean
          name: string
          player_type_id: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          age_category_id: string
          centre_id: string
          created_at?: string
          end_time: string
          head_coach_id: string
          id?: string
          is_active?: boolean
          name: string
          player_type_id?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          age_category_id?: string
          centre_id?: string
          created_at?: string
          end_time?: string
          head_coach_id?: string
          id?: string
          is_active?: boolean
          name?: string
          player_type_id?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_age_category_id_fkey"
            columns: ["age_category_id"]
            isOneToOne: false
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_head_coach_id_fkey"
            columns: ["head_coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_player_type_id_fkey"
            columns: ["player_type_id"]
            isOneToOne: false
            referencedRelation: "player_types"
            referencedColumns: ["id"]
          },
        ]
      }
      centres: {
        Row: {
          contact_number: string
          country: string
          created_at: string
          email: string
          five_s_window_end: string | null
          five_s_window_start: string | null
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          contact_number: string
          country: string
          created_at?: string
          email: string
          five_s_window_end?: string | null
          five_s_window_start?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          contact_number?: string
          country?: string
          created_at?: string
          email?: string
          five_s_window_end?: string | null
          five_s_window_start?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounced_at: string | null
          centre_id: string | null
          click_count: number
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          email_type: string
          error_message: string | null
          failed_at: string | null
          id: string
          open_count: number
          opened_at: string | null
          recipient_email: string
          recipient_profile_id: string | null
          resend_email_id: string | null
          sent_at: string
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          centre_id?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          open_count?: number
          opened_at?: string | null
          recipient_email: string
          recipient_profile_id?: string | null
          resend_email_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          centre_id?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          open_count?: number
          opened_at?: string | null
          recipient_email?: string
          recipient_profile_id?: string | null
          resend_email_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_webhook_events: {
        Row: {
          received_at: string
          webhook_event_id: string
        }
        Insert: {
          received_at?: string
          webhook_event_id: string
        }
        Update: {
          received_at?: string
          webhook_event_id?: string
        }
        Relationships: []
      }
      five_s_age_bands: {
        Row: {
          category: Database["public"]["Enums"]["five_s_category"]
          created_at: string
          display_order: number
          id: string
          label: string
          max_age: number | null
          min_age: number
        }
        Insert: {
          category: Database["public"]["Enums"]["five_s_category"]
          created_at?: string
          display_order?: number
          id?: string
          label: string
          max_age?: number | null
          min_age: number
        }
        Update: {
          category?: Database["public"]["Enums"]["five_s_category"]
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          max_age?: number | null
          min_age?: number
        }
        Relationships: []
      }
      five_s_category_notes: {
        Row: {
          category: Database["public"]["Enums"]["five_s_category"]
          centre_id: string
          id: string
          player_id: string
          recorded_at: string
          recorded_by: string
          remarks: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["five_s_category"]
          centre_id: string
          id?: string
          player_id: string
          recorded_at?: string
          recorded_by: string
          remarks: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["five_s_category"]
          centre_id?: string
          id?: string
          player_id?: string
          recorded_at?: string
          recorded_by?: string
          remarks?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_category_notes_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_category_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_category_notes_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_group_notes: {
        Row: {
          category: Database["public"]["Enums"]["five_s_category"]
          centre_id: string
          group_name: string
          id: string
          player_id: string
          recorded_at: string
          recorded_by: string
          remarks: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["five_s_category"]
          centre_id: string
          group_name: string
          id?: string
          player_id: string
          recorded_at?: string
          recorded_by: string
          remarks: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["five_s_category"]
          centre_id?: string
          group_name?: string
          id?: string
          player_id?: string
          recorded_at?: string
          recorded_by?: string
          remarks?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_group_notes_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_group_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_group_notes_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_question_responses: {
        Row: {
          answer: Database["public"]["Enums"]["five_s_answer_scale"]
          centre_id: string
          id: string
          player_id: string
          question_id: string
          recorded_at: string
          recorded_by: string
          updated_at: string
        }
        Insert: {
          answer: Database["public"]["Enums"]["five_s_answer_scale"]
          centre_id: string
          id?: string
          player_id: string
          question_id: string
          recorded_at?: string
          recorded_by: string
          updated_at?: string
        }
        Update: {
          answer?: Database["public"]["Enums"]["five_s_answer_scale"]
          centre_id?: string
          id?: string
          player_id?: string
          question_id?: string
          recorded_at?: string
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_question_responses_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_question_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_question_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "five_s_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_question_responses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_questions: {
        Row: {
          category: Database["public"]["Enums"]["five_s_category"]
          created_at: string
          display_order: number
          id: string
          question: string
          section: string
        }
        Insert: {
          category: Database["public"]["Enums"]["five_s_category"]
          created_at?: string
          display_order?: number
          id?: string
          question: string
          section: string
        }
        Update: {
          category?: Database["public"]["Enums"]["five_s_category"]
          created_at?: string
          display_order?: number
          id?: string
          question?: string
          section?: string
        }
        Relationships: []
      }
      five_s_reports: {
        Row: {
          centre_id: string
          id: string
          player_id: string
          published_at: string
          published_by: string
        }
        Insert: {
          centre_id: string
          id?: string
          player_id: string
          published_at?: string
          published_by: string
        }
        Update: {
          centre_id?: string
          id?: string
          player_id?: string
          published_at?: string
          published_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_reports_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_reports_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_results: {
        Row: {
          centre_id: string
          id: string
          level: number | null
          player_id: string
          previous_recorded_at: string | null
          previous_score: number | null
          recorded_at: string
          recorded_by: string
          remarks: string | null
          score: number | null
          shuttle: number | null
          test_id: string
          updated_at: string
          vo2_max: number | null
        }
        Insert: {
          centre_id: string
          id?: string
          level?: number | null
          player_id: string
          previous_recorded_at?: string | null
          previous_score?: number | null
          recorded_at?: string
          recorded_by: string
          remarks?: string | null
          score?: number | null
          shuttle?: number | null
          test_id: string
          updated_at?: string
          vo2_max?: number | null
        }
        Update: {
          centre_id?: string
          id?: string
          level?: number | null
          player_id?: string
          previous_recorded_at?: string | null
          previous_score?: number | null
          recorded_at?: string
          recorded_by?: string
          remarks?: string | null
          score?: number | null
          shuttle?: number | null
          test_id?: string
          updated_at?: string
          vo2_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "five_s_results_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_results_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "five_s_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_stamina_benchmarks: {
        Row: {
          age_band_id: string
          id: string
          level: number | null
          shuttle: number | null
          test_id: string
          tier: Database["public"]["Enums"]["five_s_benchmark_tier"]
          updated_at: string
          value: number | null
        }
        Insert: {
          age_band_id: string
          id?: string
          level?: number | null
          shuttle?: number | null
          test_id: string
          tier: Database["public"]["Enums"]["five_s_benchmark_tier"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          age_band_id?: string
          id?: string
          level?: number | null
          shuttle?: number | null
          test_id?: string
          tier?: Database["public"]["Enums"]["five_s_benchmark_tier"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "five_s_stamina_benchmarks_age_band_id_fkey"
            columns: ["age_band_id"]
            isOneToOne: false
            referencedRelation: "five_s_age_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_stamina_benchmarks_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "five_s_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_test_benchmarks: {
        Row: {
          age_band_id: string
          avg_value: number
          id: string
          max_value: number
          min_value: number
          test_id: string
          updated_at: string
        }
        Insert: {
          age_band_id: string
          avg_value: number
          id?: string
          max_value: number
          min_value: number
          test_id: string
          updated_at?: string
        }
        Update: {
          age_band_id?: string
          avg_value?: number
          id?: string
          max_value?: number
          min_value?: number
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_test_benchmarks_age_band_id_fkey"
            columns: ["age_band_id"]
            isOneToOne: false
            referencedRelation: "five_s_age_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_test_benchmarks_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "five_s_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_tests: {
        Row: {
          category: Database["public"]["Enums"]["five_s_category"]
          created_at: string
          display_order: number
          group_name: string | null
          id: string
          is_required: boolean
          name: string
          unit: string
        }
        Insert: {
          category: Database["public"]["Enums"]["five_s_category"]
          created_at?: string
          display_order?: number
          group_name?: string | null
          id?: string
          is_required?: boolean
          name: string
          unit: string
        }
        Update: {
          category?: Database["public"]["Enums"]["five_s_category"]
          created_at?: string
          display_order?: number
          group_name?: string | null
          id?: string
          is_required?: boolean
          name?: string
          unit?: string
        }
        Relationships: []
      }
      gate_pass_logs: {
        Row: {
          action: Database["public"]["Enums"]["gate_pass_action"]
          centre_id: string
          created_at: string
          id: string
          performed_by: string
          player_id: string
          reason: string
        }
        Insert: {
          action: Database["public"]["Enums"]["gate_pass_action"]
          centre_id: string
          created_at?: string
          id?: string
          performed_by: string
          player_id: string
          reason: string
        }
        Update: {
          action?: Database["public"]["Enums"]["gate_pass_action"]
          centre_id?: string
          created_at?: string
          id?: string
          performed_by?: string
          player_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_pass_logs_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_pass_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_pass_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          activity_type: string | null
          body_region: string | null
          cause: string | null
          centre_id: string
          created_at: string
          date_of_injury: string
          description: string | null
          id: string
          initial_treatment: string | null
          nature: string | null
          player_id: string
          report_doc_path: string | null
          reported_by: string
          treating_person: string | null
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          body_region?: string | null
          cause?: string | null
          centre_id: string
          created_at?: string
          date_of_injury: string
          description?: string | null
          id?: string
          initial_treatment?: string | null
          nature?: string | null
          player_id: string
          report_doc_path?: string | null
          reported_by: string
          treating_person?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          body_region?: string | null
          cause?: string | null
          centre_id?: string
          created_at?: string
          date_of_injury?: string
          description?: string | null
          id?: string
          initial_treatment?: string | null
          nature?: string | null
          player_id?: string
          report_doc_path?: string | null
          reported_by?: string
          treating_person?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_highlight_centres: {
        Row: {
          centre_id: string
          created_at: string
          created_by: string
          highlight_id: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          created_by: string
          highlight_id: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          created_by?: string
          highlight_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_highlight_centres_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_highlight_centres_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_highlight_centres_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "monthly_highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_highlight_dismissals: {
        Row: {
          dismissed_at: string
          monthly_highlight_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          monthly_highlight_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          monthly_highlight_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_highlight_dismissals_monthly_highlight_id_fkey"
            columns: ["monthly_highlight_id"]
            isOneToOne: false
            referencedRelation: "monthly_highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_highlight_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_highlights: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          expires_at: string
          id: string
          image_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string
          id?: string
          image_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string
          id?: string
          image_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_highlights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_event_centres: {
        Row: {
          centre_id: string
          created_at: string
          created_by: string
          news_event_id: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          created_by: string
          news_event_id: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          created_by?: string
          news_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_event_centres_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_event_centres_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_event_centres_news_event_id_fkey"
            columns: ["news_event_id"]
            isOneToOne: false
            referencedRelation: "news_events"
            referencedColumns: ["id"]
          },
        ]
      }
      news_event_dismissals: {
        Row: {
          dismissed_at: string
          news_event_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          news_event_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          news_event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_event_dismissals_news_event_id_fkey"
            columns: ["news_event_id"]
            isOneToOne: false
            referencedRelation: "news_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_event_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_date: string | null
          expires_at: string
          id: string
          title: string
          type: Database["public"]["Enums"]["news_event_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_date?: string | null
          expires_at?: string
          id?: string
          title: string
          type: Database["public"]["Enums"]["news_event_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string | null
          expires_at?: string
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["news_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "news_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_change_logs: {
        Row: {
          centre_id: string
          changed_by: string
          created_at: string
          id: string
          new_amount: number | null
          new_package_name: string | null
          old_amount: number | null
          old_package_name: string | null
          player_id: string
        }
        Insert: {
          centre_id: string
          changed_by: string
          created_at?: string
          id?: string
          new_amount?: number | null
          new_package_name?: string | null
          old_amount?: number | null
          old_package_name?: string | null
          player_id: string
        }
        Update: {
          centre_id?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_amount?: number | null
          new_package_name?: string | null
          old_amount?: number | null
          old_package_name?: string | null
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_change_logs_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_change_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_change_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          centre_id: string
          created_at: string
          custom_amount: number | null
          discount: number | null
          duration: string
          id: string
          is_active: boolean
          is_custom: boolean
          name: string
          player_type_id: string | null
          price: number
          updated_at: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          custom_amount?: number | null
          discount?: number | null
          duration: string
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name: string
          player_type_id?: string | null
          price: number
          updated_at?: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          custom_amount?: number | null
          discount?: number | null
          duration?: string
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name?: string
          player_type_id?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_player_type_id_fkey"
            columns: ["player_type_id"]
            isOneToOne: false
            referencedRelation: "player_types"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_player_links: {
        Row: {
          centre_id: string
          created_at: string
          parent_id: string
          player_id: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          parent_id: string
          player_id: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          parent_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_player_links_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_player_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_player_links_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          centre_id: string
          created_at: string
          id: string
          is_registration_payment: boolean
          notes: string | null
          package_id: string | null
          payment_date: string
          player_id: string
          recorded_by: string
        }
        Insert: {
          amount: number
          centre_id: string
          created_at?: string
          id?: string
          is_registration_payment?: boolean
          notes?: string | null
          package_id?: string | null
          payment_date: string
          player_id: string
          recorded_by: string
        }
        Update: {
          amount?: number
          centre_id?: string
          created_at?: string
          id?: string
          is_registration_payment?: boolean
          notes?: string | null
          package_id?: string | null
          payment_date?: string
          player_id?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_batches: {
        Row: {
          batch_id: string
          centre_id: string
          created_at: string
          player_id: string
        }
        Insert: {
          batch_id: string
          centre_id: string
          created_at?: string
          player_id: string
        }
        Update: {
          batch_id?: string
          centre_id?: string
          created_at?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_batches_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_batches_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_types: {
        Row: {
          centre_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_types_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          aadhaar_doc_path: string | null
          aadhaar_number_encrypted: string | null
          address_line1: string | null
          address_line2: string | null
          age_category_id: string | null
          aiff_number: string | null
          batch_id: string | null
          birth_mark: string | null
          blood_group: string | null
          centre_id: string
          city: string | null
          contact_number: string | null
          country: string | null
          created_at: string
          created_by: string
          date_of_birth: string
          email: string | null
          father_name: string | null
          food_allergy: string | null
          gender: string | null
          height_cm: number | null
          id: string
          is_active: boolean
          is_checked_in: boolean
          medical_condition: string | null
          medical_records_path: string | null
          mother_name: string | null
          name: string
          package_id: string | null
          parent_contact_number: string | null
          parent_email: string
          passport_number_encrypted: string | null
          pincode: string | null
          player_type_id: string | null
          profile_picture_path: string | null
          state: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          aadhaar_doc_path?: string | null
          aadhaar_number_encrypted?: string | null
          address_line1?: string | null
          address_line2?: string | null
          age_category_id?: string | null
          aiff_number?: string | null
          batch_id?: string | null
          birth_mark?: string | null
          blood_group?: string | null
          centre_id: string
          city?: string | null
          contact_number?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          date_of_birth: string
          email?: string | null
          father_name?: string | null
          food_allergy?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_checked_in?: boolean
          medical_condition?: string | null
          medical_records_path?: string | null
          mother_name?: string | null
          name: string
          package_id?: string | null
          parent_contact_number?: string | null
          parent_email: string
          passport_number_encrypted?: string | null
          pincode?: string | null
          player_type_id?: string | null
          profile_picture_path?: string | null
          state?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          aadhaar_doc_path?: string | null
          aadhaar_number_encrypted?: string | null
          address_line1?: string | null
          address_line2?: string | null
          age_category_id?: string | null
          aiff_number?: string | null
          batch_id?: string | null
          birth_mark?: string | null
          blood_group?: string | null
          centre_id?: string
          city?: string | null
          contact_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          date_of_birth?: string
          email?: string | null
          father_name?: string | null
          food_allergy?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_checked_in?: boolean
          medical_condition?: string | null
          medical_records_path?: string | null
          mother_name?: string | null
          name?: string
          package_id?: string | null
          parent_contact_number?: string | null
          parent_email?: string
          passport_number_encrypted?: string | null
          pincode?: string | null
          player_type_id?: string | null
          profile_picture_path?: string | null
          state?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_age_category_id_fkey"
            columns: ["age_category_id"]
            isOneToOne: false
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_player_type_id_fkey"
            columns: ["player_type_id"]
            isOneToOne: false
            referencedRelation: "player_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          centre_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          centre_id?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          centre_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          aadhaar_doc_path: string | null
          address_line1: string | null
          address_line2: string | null
          birth_certificate_path: string | null
          city: string | null
          contact_number: string | null
          country: string | null
          date_of_birth: string | null
          date_of_joining: string | null
          other_documents_path: string | null
          pincode: string | null
          profile_id: string
          profile_picture_path: string | null
          state: string | null
        }
        Insert: {
          aadhaar_doc_path?: string | null
          address_line1?: string | null
          address_line2?: string | null
          birth_certificate_path?: string | null
          city?: string | null
          contact_number?: string | null
          country?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          other_documents_path?: string | null
          pincode?: string | null
          profile_id: string
          profile_picture_path?: string | null
          state?: string | null
        }
        Update: {
          aadhaar_doc_path?: string | null
          address_line1?: string | null
          address_line2?: string | null
          birth_certificate_path?: string | null
          city?: string | null
          contact_number?: string | null
          country?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          other_documents_path?: string | null
          pincode?: string | null
          profile_id?: string
          profile_picture_path?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email_analytics_summary: {
        Args: { p_centre_id: string; p_since: string; p_until: string }
        Returns: {
          bounced_count: number
          clicked_count: number
          complained_count: number
          delivered_count: number
          failed_count: number
          opened_count: number
          sent_count: number
        }[]
      }
      payments_by_month: {
        Args: { p_centre_id: string; p_since: string }
        Returns: {
          month: string
          total: number
        }[]
      }
      record_email_event: {
        Args: {
          p_error_message?: string | null
          p_event_type: Database["public"]["Enums"]["email_status"]
          p_resend_email_id: string
          p_webhook_event_id: string
        }
        Returns: undefined
      }
      revoke_user_sessions: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      submit_skill_scores: {
        Args: { p_category_note: Json; p_group_notes: Json; p_results: Json }
        Returns: undefined
      }
      toggle_gate_pass: {
        Args: {
          p_centre_id: string
          p_performed_by: string
          p_player_id: string
          p_reason: string
        }
        Returns: {
          action: Database["public"]["Enums"]["gate_pass_action"]
          centre_id: string
          created_at: string
          id: string
          performed_by: string
          player_id: string
          reason: string
        }
        SetofOptions: {
          from: "*"
          to: "gate_pass_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      attendance_status: "present" | "absent"
      email_status:
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
        | "complained"
      five_s_answer_scale: "rarely" | "sometimes" | "frequently" | "always"
      five_s_benchmark_tier:
        | "poor_ceiling"
        | "average_low"
        | "average_high"
        | "elite_floor"
      five_s_category: "speed" | "stamina" | "strength" | "spirit" | "skill"
      gate_pass_action: "check_in" | "check_out"
      news_event_type: "upcoming_event" | "news_announcement"
      user_role:
        | "super_admin"
        | "centre_admin"
        | "coach"
        | "medical"
        | "parent"
        | "staff"
        | "finance"
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
      attendance_status: ["present", "absent"],
      email_status: [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
        "complained",
      ],
      five_s_answer_scale: ["rarely", "sometimes", "frequently", "always"],
      five_s_benchmark_tier: [
        "poor_ceiling",
        "average_low",
        "average_high",
        "elite_floor",
      ],
      five_s_category: ["speed", "stamina", "strength", "spirit", "skill"],
      gate_pass_action: ["check_in", "check_out"],
      news_event_type: ["upcoming_event", "news_announcement"],
      user_role: [
        "super_admin",
        "centre_admin",
        "coach",
        "medical",
        "parent",
        "staff",
        "finance",
      ],
    },
  },
} as const

