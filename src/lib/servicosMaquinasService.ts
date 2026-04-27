import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

// ---- Types ----
export type TipoServico = 'conserto' | 'troca_pecas' | 'conserto_troca_pecas';
export type StatusPeca = 'trocada' | 'defeito';

export interface ComponenteMaquina {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface ServicoMaquinaPeca {
  id: string;
  servico_id: string;
  componente_id: string;
  status: StatusPeca;
  observacao: string | null;
  created_at: string;
  componente?: ComponenteMaquina | null;
}

export interface ServicoMaquina {
  id: string;
  veiculo_id: string;
  obra_id: string | null;
  data: string;
  horimetro: number | null;
  tipo_servico: TipoServico;
  observacao: string | null;
  observacao_pecas: string | null;
  created_by: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  veiculo?: any;
  obra?: any;
  pecas?: ServicoMaquinaPeca[];
}

export interface ServicoPecaInput {
  componente_id: string;
  status: StatusPeca;
  observacao?: string | null;
}

// ---- Componentes ----
export async function fetchComponentes(): Promise<ComponenteMaquina[]> {
  const { data, error } = await supabase
    .from('componentes_maquinas')
    .select('*')
    .order('nome');
  if (error) throw error;
  return (data || []) as any;
}

export async function saveComponente(
  comp: { nome: string; descricao?: string | null; ativo?: boolean },
  userId: string
) {
  const { data, error } = await supabase
    .from('componentes_maquinas')
    .insert({
      nome: comp.nome,
      descricao: comp.descricao ?? null,
      ativo: comp.ativo ?? true,
      created_by: userId,
    } as any)
    .select()
    .single();
  if (error) throw error;
  await recordAuditEntry({
    entity_type: 'componentes_maquinas',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });
  return data as ComponenteMaquina;
}

export async function updateComponente(
  id: string,
  comp: { nome: string; descricao?: string | null; ativo?: boolean },
  userId: string
) {
  const { data: previous } = await supabase
    .from('componentes_maquinas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('componentes_maquinas')
    .update({
      nome: comp.nome,
      descricao: comp.descricao ?? null,
      ativo: comp.ativo ?? true,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await recordAuditEntry({
    entity_type: 'componentes_maquinas',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });
  return data as ComponenteMaquina;
}

export async function deleteComponente(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('componentes_maquinas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase.from('componentes_maquinas').delete().eq('id', id);
  if (error) throw error;
  await recordAuditEntry({
    entity_type: 'componentes_maquinas',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Serviços ----
const SERVICO_SELECT =
  '*, veiculo:veiculos_maquinas(*), obra:obras(*), pecas:servicos_maquinas_pecas(*, componente:componentes_maquinas(*))';

export async function fetchServicos(): Promise<ServicoMaquina[]> {
  const { data, error } = await supabase
    .from('servicos_maquinas')
    .select(SERVICO_SELECT)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function fetchServicosPorVeiculo(veiculoId: string): Promise<ServicoMaquina[]> {
  const { data, error } = await supabase
    .from('servicos_maquinas')
    .select(SERVICO_SELECT)
    .eq('veiculo_id', veiculoId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function saveServico(
  servico: {
    veiculo_id: string;
    obra_id: string | null;
    data: string;
    horimetro: number | null;
    tipo_servico: TipoServico;
    observacao: string | null;
    observacao_pecas: string | null;
  },
  pecas: ServicoPecaInput[],
  userId: string
): Promise<ServicoMaquina> {
  const { data, error } = await supabase
    .from('servicos_maquinas')
    .insert({ ...servico, created_by: userId } as any)
    .select()
    .single();
  if (error) throw error;

  if (pecas.length > 0) {
    const rows = pecas.map((p) => ({
      servico_id: data.id,
      componente_id: p.componente_id,
      status: p.status,
      observacao: p.observacao ?? null,
    }));
    const { error: pecasError } = await supabase
      .from('servicos_maquinas_pecas')
      .insert(rows as any);
    if (pecasError) throw pecasError;
  }

  await recordAuditEntry({
    entity_type: 'servicos_maquinas',
    entity_id: data.id,
    action: 'criacao',
    new_values: { ...data, pecas },
    user_id: userId,
  });

  return data as ServicoMaquina;
}

export async function updateServico(
  id: string,
  servico: {
    veiculo_id: string;
    obra_id: string | null;
    data: string;
    horimetro: number | null;
    tipo_servico: TipoServico;
    observacao: string | null;
    observacao_pecas: string | null;
  },
  pecas: ServicoPecaInput[],
  userId: string
) {
  const { data: previous } = await supabase
    .from('servicos_maquinas')
    .select(SERVICO_SELECT)
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('servicos_maquinas')
    .update({
      ...servico,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // recriar peças
  const { error: delErr } = await supabase
    .from('servicos_maquinas_pecas')
    .delete()
    .eq('servico_id', id);
  if (delErr) throw delErr;

  if (pecas.length > 0) {
    const rows = pecas.map((p) => ({
      servico_id: id,
      componente_id: p.componente_id,
      status: p.status,
      observacao: p.observacao ?? null,
    }));
    const { error: pecasError } = await supabase
      .from('servicos_maquinas_pecas')
      .insert(rows as any);
    if (pecasError) throw pecasError;
  }

  await recordAuditEntry({
    entity_type: 'servicos_maquinas',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: { ...data, pecas },
    user_id: userId,
  });
}

export async function deleteServico(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('servicos_maquinas')
    .select(SERVICO_SELECT)
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase.from('servicos_maquinas').delete().eq('id', id);
  if (error) throw error;
  await recordAuditEntry({
    entity_type: 'servicos_maquinas',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

export const TIPO_SERVICO_LABEL: Record<TipoServico, string> = {
  conserto: 'Conserto',
  troca_pecas: 'Troca de peças',
  conserto_troca_pecas: 'Conserto + Troca de peças',
};

export const STATUS_PECA_LABEL: Record<StatusPeca, string> = {
  trocada: 'Trocada',
  defeito: 'Com defeito',
};
