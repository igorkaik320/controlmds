-- Contas a pagar
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_id ON public.contas_pagar (empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id ON public.contas_pagar (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar (status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_emissao ON public.contas_pagar (data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_conta_id ON public.contas_pagar_parcelas (conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_data_vencimento ON public.contas_pagar_parcelas (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_status ON public.contas_pagar_parcelas (status);

-- Revisões de combustível
CREATE INDEX IF NOT EXISTS idx_revisoes_combustivel_veiculo_id ON public.revisoes_combustivel (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_revisoes_combustivel_data ON public.revisoes_combustivel (data DESC);

-- Equipamentos / movimentos
CREATE INDEX IF NOT EXISTS idx_equipamentos_movimentos_equipamento_id ON public.equipamentos_movimentos (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_movimentos_data ON public.equipamentos_movimentos (data DESC);

-- user_roles e profiles — usados em cada request RLS
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);