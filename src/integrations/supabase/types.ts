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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      contas_pagar: {
        Row: {
          created_at: string
          created_by: string | null
          data_emissao: string
          data_primeiro_vencimento: string | null
          empresa_id: string | null
          empresa_nome: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          numero: number
          observacao: string | null
          quantidade_parcelas: number
          status: string
          updated_at: string
          updated_by: string | null
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_primeiro_vencimento?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero?: number
          observacao?: string | null
          quantidade_parcelas?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_primeiro_vencimento?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero?: number
          observacao?: string | null
          quantidade_parcelas?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_parcelas: {
        Row: {
          conta_pagar_id: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          id: string
          numero_parcela: number
          observacao: string | null
          status: string
          updated_at: string
          updated_by: string | null
          valor_pago: number | null
          valor_parcela: number
        }
        Insert: {
          conta_pagar_id: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          numero_parcela?: number
          observacao?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor_pago?: number | null
          valor_parcela?: number
        }
        Update: {
          conta_pagar_id?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          numero_parcela?: number
          observacao?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor_pago?: number | null
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_parcelas_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          cor_cabecalho: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_direita: string | null
          logo_esquerda: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          cor_cabecalho?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_direita?: string | null
          logo_esquerda?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          cor_cabecalho?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_direita?: string | null
          logo_esquerda?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipamentos_movimentos: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          equipamento_id: string
          equipamento_nome: string
          id: string
          motivo_baixa: string | null
          obra_destino_id: string | null
          obra_destino_nome: string | null
          obra_origem_id: string | null
          obra_origem_nome: string | null
          observacao: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          equipamento_id: string
          equipamento_nome: string
          id?: string
          motivo_baixa?: string | null
          obra_destino_id?: string | null
          obra_destino_nome?: string | null
          obra_origem_id?: string | null
          obra_origem_nome?: string | null
          observacao?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          equipamento_id?: string
          equipamento_nome?: string
          id?: string
          motivo_baixa?: string | null
          obra_destino_id?: string | null
          obra_destino_nome?: string | null
          obra_origem_id?: string | null
          obra_origem_nome?: string | null
          observacao?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      revisoes_combustivel: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          fornecedor_id: string
          id: string
          observacao: string | null
          quilometragem_atual: number
          quilometragem_proxima: number
          tipo_medicao: string
          updated_at: string
          valor: number
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          fornecedor_id: string
          id?: string
          observacao?: string | null
          quilometragem_atual?: number
          quilometragem_proxima?: number
          tipo_medicao?: string
          updated_at?: string
          valor?: number
          veiculo_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          fornecedor_id?: string
          id?: string
          observacao?: string | null
          quilometragem_atual?: number
          quilometragem_proxima?: number
          tipo_medicao?: string
          updated_at?: string
          valor?: number
          veiculo_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "conferente"
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
      app_role: ["admin", "operador", "conferente"],
    },
  },
} as const
