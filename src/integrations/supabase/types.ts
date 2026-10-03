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
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          referred_user_id: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          referred_user_id: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          referred_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          commission_pct: number
          created_at: string
          display_name: string | null
          id: string
          invite_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          display_name?: string | null
          id?: string
          invite_code?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_pct?: number
          created_at?: string
          display_name?: string | null
          id?: string
          invite_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appreciation_letters: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appreciation_letters_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appreciation_letters_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          guest_id: string
          host_id: string
          house_id: string
          id: string
          message: string | null
          nights: number | null
          status: string
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string
          guest_id: string
          host_id: string
          house_id: string
          id?: string
          message?: string | null
          nights?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          guest_id?: string
          host_id?: string
          house_id?: string
          id?: string
          message?: string | null
          nights?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_locations: {
        Row: {
          created_at: string
          event_id: string
          updated_at: string
          venue_address: string | null
          video_link: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          updated_at?: string
          venue_address?: string | null
          video_link?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          updated_at?: string
          venue_address?: string | null
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_locations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: string
          format: string
          going_count: number
          host_id: string | null
          id: string
          join_slug: string
          starts_at: string
          status: string
          timezone: string | null
          title: string
          updated_at: string
          waitlist_count: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type: string
          format: string
          going_count?: number
          host_id?: string | null
          id?: string
          join_slug?: string
          starts_at: string
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
          waitlist_count?: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          format?: string
          going_count?: number
          host_id?: string | null
          id?: string
          join_slug?: string
          starts_at?: string
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
          waitlist_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          item_ref: string
          item_type: string
          snapshot: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_ref: string
          item_type: string
          snapshot?: Json | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_ref?: string
          item_type?: string
          snapshot?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      houses: {
        Row: {
          created_at: string
          description: string | null
          house_rules: string | null
          id: string
          lat: number | null
          lng: number | null
          location_text: string | null
          owner_id: string
          photos: string[]
          property_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          house_rules?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_text?: string | null
          owner_id: string
          photos?: string[]
          property_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          house_rules?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_text?: string | null
          owner_id?: string
          photos?: string[]
          property_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "houses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          purpose: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          purpose: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          purpose?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_range: string | null
          created_at: string
          display_name: string | null
          gift_excited_to_give: string | null
          gift_loved_gestures: string | null
          id: string
          intentions: string[]
          location: string | null
          membership_tier: string
          onboarded_at: string | null
          photo_url: string | null
          profession: string | null
          profile_completed: boolean
          relationship_status: string | null
          skill_tags: string[]
          stripe_customer_id: string | null
          travel_desired: string[]
          travel_frequent: string[]
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          display_name?: string | null
          gift_excited_to_give?: string | null
          gift_loved_gestures?: string | null
          id: string
          intentions?: string[]
          location?: string | null
          membership_tier?: string
          onboarded_at?: string | null
          photo_url?: string | null
          profession?: string | null
          profile_completed?: boolean
          relationship_status?: string | null
          skill_tags?: string[]
          stripe_customer_id?: string | null
          travel_desired?: string[]
          travel_frequent?: string[]
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          created_at?: string
          display_name?: string | null
          gift_excited_to_give?: string | null
          gift_loved_gestures?: string | null
          id?: string
          intentions?: string[]
          location?: string | null
          membership_tier?: string
          onboarded_at?: string | null
          photo_url?: string | null
          profession?: string | null
          profile_completed?: boolean
          relationship_status?: string | null
          skill_tags?: string[]
          stripe_customer_id?: string | null
          travel_desired?: string[]
          travel_frequent?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      reflections: {
        Row: {
          body: string
          created_at: string
          id: string
          member_id: string
          question_text: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          member_id?: string
          question_text: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          member_id?: string
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_session_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          host_id: string
          id: string
          message: string | null
          proposed_at: string
          requester_id: string
          skill_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          host_id: string
          id?: string
          message?: string | null
          proposed_at: string
          requester_id: string
          skill_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          host_id?: string
          id?: string
          message?: string | null
          proposed_at?: string
          requester_id?: string
          skill_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_session_requests_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_session_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_session_requests_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          format: string
          id: string
          owner_id: string
          photo_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          format: string
          id?: string
          owner_id: string
          photo_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          format?: string
          id?: string
          owner_id?: string
          photo_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      credit_balances: {
        Row: {
          balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_affiliate: { Args: never; Returns: string }
      affiliate_invite_info: {
        Args: { _code: string }
        Returns: {
          inviter_name: string
          inviter_photo: string
        }[]
      }
      affiliate_referral_stats: {
        Args: { _affiliate_id?: string }
        Returns: {
          display_name: string
          earned_cents: number
          joined_at: string
          membership_tier: string
          paid_cents: number
          photo_url: string
          referred_user_id: string
          test_cents: number
        }[]
      }
      cancel_rsvp: { Args: { _event_id: string }; Returns: string }
      claim_referral: { Args: { _code: string }; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      has_event_rsvp: {
        Args: { _event_id: string; _going_only: boolean }
        Returns: boolean
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      house_booked_ranges: {
        Args: { _house_id: string }
        Returns: {
          check_in: string
          check_out: string
        }[]
      }
      is_event_manager: { Args: { _event_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_letter_read: {
        Args: { _letter_id: string; _recipient_id: string }
        Returns: string
      }
      my_credit_history: {
        Args: { _before_created?: string; _before_id?: string; _limit?: number }
        Returns: {
          created_at: string
          delta: number
          description: string
          id: string
          note: string
          reason: string
        }[]
      }
      my_credit_summary: {
        Args: never
        Returns: {
          available: number
          balance: number
          reserved: number
        }[]
      }
      profile_is_complete: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: boolean
      }
      promote_waitlist: { Args: { _event_id: string }; Returns: undefined }
      request_booking: {
        Args: {
          _check_in: string
          _check_out: string
          _house_id: string
          _message: string
        }
        Returns: string
      }
      request_skill_session: {
        Args: { _message: string; _proposed_at: string; _skill_id: string }
        Returns: string
      }
      rsvp_event: { Args: { _event_id: string }; Returns: string }
      update_booking: {
        Args: { _action: string; _booking_id: string }
        Returns: string
      }
      update_skill_session: {
        Args: { _action: string; _request_id: string }
        Returns: string
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
    Enums: {},
  },
} as const
