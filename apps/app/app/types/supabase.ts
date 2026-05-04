export type SupabaseDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          language: string | null
          timezone: string | null
          profile_visibility: "public" | "private" | "friends" | null
          show_online_status: boolean | null
          marketing_emails: boolean | null
          product_updates: boolean | null
          dark_mode_enabled: boolean | null
          notifications_enabled: boolean | null
          push_notifications_enabled: boolean | null
          email_notifications_enabled: boolean | null
          has_completed_onboarding: boolean | null
          onboarding_completed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          language?: string | null
          timezone?: string | null
          profile_visibility?: "public" | "private" | "friends" | null
          show_online_status?: boolean | null
          marketing_emails?: boolean | null
          product_updates?: boolean | null
          dark_mode_enabled?: boolean | null
          notifications_enabled?: boolean | null
          push_notifications_enabled?: boolean | null
          email_notifications_enabled?: boolean | null
          has_completed_onboarding?: boolean | null
          onboarding_completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          language?: string | null
          timezone?: string | null
          profile_visibility?: "public" | "private" | "friends" | null
          show_online_status?: boolean | null
          marketing_emails?: boolean | null
          product_updates?: boolean | null
          dark_mode_enabled?: boolean | null
          notifications_enabled?: boolean | null
          push_notifications_enabled?: boolean | null
          email_notifications_enabled?: boolean | null
          has_completed_onboarding?: boolean | null
          onboarding_completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          author_id: string
          title: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          author_id: string
          title: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          title?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          device_id: string | null
          device_name: string | null
          platform: "ios" | "android" | "web" | null
          is_active: boolean
          last_used_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          device_id?: string | null
          device_name?: string | null
          platform?: "ios" | "android" | "web" | null
          is_active?: boolean
          last_used_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          device_id?: string | null
          device_name?: string | null
          platform?: "ios" | "android" | "web" | null
          is_active?: boolean
          last_used_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/**
 * User preferences that sync to the `user_preferences` table.
 *
 * Previously these lived on `profiles`, but `profiles` is world-readable
 * for public discovery (display names, avatars). Private booleans like
 * "do you accept push notifications" do not belong on a public table.
 */
/**
 * Onboarding goal options the user can pick during the goal step.
 * Kept as a string union so it's easy to add more without churning callers.
 */
export type OnboardingGoal = "goalBuildApp" | "goalLearnReactNative" | "goalJustExploring"

export interface UserPreferences {
  dark_mode_enabled: boolean | null
  notifications_enabled: boolean | null
  push_notifications_enabled: boolean | null
  email_notifications_enabled: boolean | null
  goal: OnboardingGoal | null
}
