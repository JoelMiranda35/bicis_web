import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      bikes: {
        Row: {
          id: string
          title: string
          subtitle: string
          category: "ROAD" | "MTB" | "CITY_BIKE" | "E_CITY_BIKE" | "E_MTB"
          size: "XS" | "S" | "M" | "L" | "XL"
          available: boolean
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          subtitle: string
          category: "ROAD" | "MTB" | "CITY_BIKE" | "E_CITY_BIKE" | "E_MTB"
          size: "XS" | "S" | "M" | "L" | "XL"
          available?: boolean
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          subtitle?: string
          category?: "ROAD" | "MTB" | "CITY_BIKE" | "E_CITY_BIKE" | "E_MTB"
          size?: "XS" | "S" | "M" | "L" | "XL"
          available?: boolean
          image_url?: string | null
          created_at?: string
        }
      }
      accessories: {
        Row: {
          id: string
          name: string
          type: "pedal" | "helmet"
          price: number
          available: boolean
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: "pedal" | "helmet"
          price: number
          available?: boolean
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: "pedal" | "helmet"
          price?: number
          available?: boolean
          image_url?: string | null
          created_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          customer_name: string
          customer_email: string
          customer_phone: string
          customer_dni: string
          start_date: string
          end_date: string
          total_days: number
          bikes: any[]
          accessories: any[]
          insurance: boolean
          total_amount: number
          deposit_amount: number
          status: "pending" | "confirmed" | "in_process" | "completed" | "cancelled"
          stripe_payment_intent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_name: string
          customer_email: string
          customer_phone: string
          customer_dni: string
          start_date: string
          end_date: string
          total_days: number
          bikes: any[]
          accessories: any[]
          insurance?: boolean
          total_amount: number
          deposit_amount: number
          status?: "pending" | "confirmed" | "in_process" | "completed" | "cancelled"
          stripe_payment_intent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_name?: string
          customer_email?: string
          customer_phone?: string
          customer_dni?: string
          start_date?: string
          end_date?: string
          total_days?: number
          bikes?: any[]
          accessories?: any[]
          insurance?: boolean
          total_amount?: number
          deposit_amount?: number
          status?: "pending" | "confirmed" | "in_process" | "completed" | "cancelled"
          stripe_payment_intent_id?: string | null
          created_at?: string
        }
      }
    }
  }
}
