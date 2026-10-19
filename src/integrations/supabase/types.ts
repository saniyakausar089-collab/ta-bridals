export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          approval_status: "pending" | "approved" | "rejected";
          created_at: string;
          display_name: string;
          email: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approval_status?: "pending" | "approved" | "rejected";
          created_at?: string;
          display_name?: string;
          email?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approval_status?: "pending" | "approved" | "rejected";
          created_at?: string;
          display_name?: string;
          email?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      shoot_assignments: {
        Row: {
          assignment_type: string;
          created_at: string;
          id: string;
          shoot_id: string;
          team_member_id: string;
        };
        Insert: {
          assignment_type?: string;
          created_at?: string;
          id?: string;
          shoot_id: string;
          team_member_id: string;
        };
        Update: {
          assignment_type?: string;
          created_at?: string;
          id?: string;
          shoot_id?: string;
          team_member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shoot_assignments_shoot_id_fkey";
            columns: ["shoot_id"];
            isOneToOne: false;
            referencedRelation: "shoots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shoot_assignments_team_member_id_fkey";
            columns: ["team_member_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      shoots: {
        Row: {
          couple_name: string;
          "shoot name"?: string | null;
          created_at: string;
          created_by: string | null;
          end_time: string | null;
          event_date: string;
          event_type: string;
          id: string;
          location: string;
          notes: string | null;
          package_amount?: number | null;
          planned_team_size: number;
          start_time: string;
          status: string;
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          couple_name?: string | null;
          "shoot name"?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_time?: string | null;
          event_date: string;
          event_type: string;
          id?: string;
          location: string;
          notes?: string | null;
          package_amount?: number | null;
          planned_team_size?: number;
          start_time: string;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          couple_name?: string | null;
          "shoot name"?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_time?: string | null;
          event_date?: string;
          event_type?: string;
          id?: string;
          location?: string;
          notes?: string | null;
          package_amount?: number | null;
          planned_team_size?: number;
          start_time?: string;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          available: boolean;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          notes: string | null;
          phone: string | null;
          role: string;
          updated_at: string;
          status?: "active" | "inactive" | "on_leave";
          additional_skills?: string[];
          admin_notes?: string | null;
          emergency_contact?: string | null;
          user_id?: string | null;
        };
        Insert: {
          available?: boolean;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          role: string;
          updated_at?: string;
          status?: "active" | "inactive" | "on_leave";
          additional_skills?: string[];
          admin_notes?: string | null;
          emergency_contact?: string | null;
          user_id?: string | null;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
          status?: "active" | "inactive" | "on_leave";
          additional_skills?: string[];
          admin_notes?: string | null;
          emergency_contact?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      availability_requests: {
        Row: {
          id: string;
          worker_id: string | null;
          user_id: string;
          worker_name: string;
          request_type: "available" | "unavailable" | "leave";
          start_date: string;
          end_date: string;
          start_time: string | null;
          end_time: string | null;
          reason: string | null;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id?: string | null;
          user_id: string;
          worker_name: string;
          request_type: "available" | "unavailable" | "leave";
          start_date: string;
          end_date: string;
          start_time?: string | null;
          end_time?: string | null;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          user_id?: string;
          worker_name?: string;
          request_type?: "available" | "unavailable" | "leave";
          start_date?: string;
          end_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_name: string;
          actor_email: string | null;
          action: string;
          record_type: string;
          record_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_name: string;
          actor_email?: string | null;
          action: string;
          record_type: string;
          record_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string;
          actor_email?: string | null;
          action?: string;
          record_type?: string;
          record_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          title: string;
          message: string;
          type: "info" | "assignment" | "approval" | "system";
          is_read: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          title: string;
          message: string;
          type?: "info" | "assignment" | "approval" | "system";
          is_read?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          title?: string;
          message?: string;
          type?: "info" | "assignment" | "approval" | "system";
          is_read?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      client_invoices: {
        Row: {
          id: string;
          invoice_number: string;
          shoot_id: string;
          client_name: string;
          client_email: string | null;
          client_phone: string | null;
          currency: string;
          agreed_price: number;
          additional_charges: number;
          discount_amount: number;
          tax_amount: number;
          total_billed: number;
          total_paid: number;
          outstanding_balance: number;
          status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
          issue_date: string;
          due_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          shoot_id: string;
          client_name: string;
          client_email?: string | null;
          client_phone?: string | null;
          currency?: string;
          agreed_price?: number;
          additional_charges?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_paid?: number;
          status?: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
          issue_date?: string;
          due_date: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          shoot_id?: string;
          client_name?: string;
          client_email?: string | null;
          client_phone?: string | null;
          currency?: string;
          agreed_price?: number;
          additional_charges?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_paid?: number;
          status?: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
          issue_date?: string;
          due_date?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_payments: {
        Row: {
          id: string;
          receipt_number: string;
          invoice_id: string;
          shoot_id: string;
          amount: number;
          currency: string;
          payment_method: string;
          transaction_reference: string | null;
          payment_date: string;
          notes: string | null;
          is_reversed: boolean;
          reversal_reason: string | null;
          reversed_at: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          receipt_number: string;
          invoice_id: string;
          shoot_id: string;
          amount: number;
          currency?: string;
          payment_method: string;
          transaction_reference?: string | null;
          payment_date?: string;
          notes?: string | null;
          is_reversed?: boolean;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          receipt_number?: string;
          invoice_id?: string;
          shoot_id?: string;
          amount?: number;
          currency?: string;
          payment_method?: string;
          transaction_reference?: string | null;
          payment_date?: string;
          notes?: string | null;
          is_reversed?: boolean;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      worker_compensation_plans: {
        Row: {
          id: string;
          worker_id: string;
          compensation_type: "monthly_salary" | "per_shoot" | "per_day" | "per_assignment";
          base_rate: number;
          currency: string;
          effective_from: string;
          bank_account_info: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          compensation_type: "monthly_salary" | "per_shoot" | "per_day" | "per_assignment";
          base_rate: number;
          currency?: string;
          effective_from?: string;
          bank_account_info?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          compensation_type?: "monthly_salary" | "per_shoot" | "per_day" | "per_assignment";
          base_rate?: number;
          currency?: string;
          effective_from?: string;
          bank_account_info?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      payroll_obligations: {
        Row: {
          id: string;
          worker_id: string;
          shoot_id: string | null;
          period_label: string;
          compensation_type:
            "monthly_salary" | "per_shoot" | "per_day" | "per_assignment" | "bonus" | "adjustment";
          base_amount: number;
          allowance_amount: number;
          deduction_amount: number;
          net_payable: number;
          amount_paid: number;
          balance_due: number;
          status:
            | "draft"
            | "submitted"
            | "approved"
            | "partially_paid"
            | "paid"
            | "disputed"
            | "cancelled";
          approved_by: string | null;
          approved_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          shoot_id?: string | null;
          period_label: string;
          compensation_type:
            "monthly_salary" | "per_shoot" | "per_day" | "per_assignment" | "bonus" | "adjustment";
          base_amount?: number;
          allowance_amount?: number;
          deduction_amount?: number;
          amount_paid?: number;
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "partially_paid"
            | "paid"
            | "disputed"
            | "cancelled";
          approved_by?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          shoot_id?: string | null;
          period_label?: string;
          compensation_type?:
            "monthly_salary" | "per_shoot" | "per_day" | "per_assignment" | "bonus" | "adjustment";
          base_amount?: number;
          allowance_amount?: number;
          deduction_amount?: number;
          amount_paid?: number;
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "partially_paid"
            | "paid"
            | "disputed"
            | "cancelled";
          approved_by?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      worker_payments: {
        Row: {
          id: string;
          payment_voucher_no: string;
          obligation_id: string;
          worker_id: string;
          amount: number;
          currency: string;
          payment_method: string;
          transaction_reference: string | null;
          disbursement_date: string;
          notes: string | null;
          is_reversed: boolean;
          reversal_reason: string | null;
          reversed_at: string | null;
          disbursed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_voucher_no: string;
          obligation_id: string;
          worker_id: string;
          amount: number;
          currency?: string;
          payment_method: string;
          transaction_reference?: string | null;
          disbursement_date?: string;
          notes?: string | null;
          is_reversed?: boolean;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          disbursed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_voucher_no?: string;
          obligation_id?: string;
          worker_id?: string;
          amount?: number;
          currency?: string;
          payment_method?: string;
          transaction_reference?: string | null;
          disbursement_date?: string;
          notes?: string | null;
          is_reversed?: boolean;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          disbursed_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      operating_expenses: {
        Row: {
          id: string;
          expense_number: string;
          category: string;
          payee_supplier: string;
          description: string;
          amount: number;
          currency: string;
          expense_date: string;
          due_date: string | null;
          is_direct_cost: boolean;
          shoot_id: string | null;
          payment_method: string;
          payment_status: "paid" | "partially_paid" | "unpaid";
          amount_paid: number;
          status: "submitted" | "approved" | "rejected" | "recorded" | "cancelled";
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_number: string;
          category: string;
          payee_supplier: string;
          description: string;
          amount: number;
          currency?: string;
          expense_date?: string;
          due_date?: string | null;
          is_direct_cost?: boolean;
          shoot_id?: string | null;
          payment_method?: string;
          payment_status?: "paid" | "partially_paid" | "unpaid";
          amount_paid?: number;
          status?: "submitted" | "approved" | "rejected" | "recorded" | "cancelled";
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_number?: string;
          category?: string;
          payee_supplier?: string;
          description?: string;
          amount?: number;
          currency?: string;
          expense_date?: string;
          due_date?: string | null;
          is_direct_cost?: boolean;
          shoot_id?: string | null;
          payment_method?: string;
          payment_status?: "paid" | "partially_paid" | "unpaid";
          amount_paid?: number;
          status?: "submitted" | "approved" | "rejected" | "recorded" | "cancelled";
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_direct_cost: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_direct_cost?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_direct_cost?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_user_registration: {
        Args: {
          p_role?: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_approved_user: {
        Args: {
          _user_id: string;
        };
        Returns: boolean;
      };
      reject_user_registration: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      replace_shoot_assignments: {
        Args: { p_assignments: Json; p_shoot_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "team_member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "team_member"],
    },
  },
} as const;
