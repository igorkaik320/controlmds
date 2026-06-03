import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

export type AvisoFinanceiroTipo = 'parcelas_vencendo_hoje' | 'parcelas_vencidas' | 'parcelas_a_vencer';

export interface AvisoConfiguracao {
  id: string;
  nome: string;
  modulo: 'financeiro';
  tipo: AvisoFinanceiroTipo;
  dias_antecedencia: number;
  ativo: boolean;
  mostrar_link_consulta: boolean;
  mostrar_link_relatorio: boolean;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  usuarios?: string[];
}

export interface AvisoFinanceiroNotificacao {
  id: string;
  avisoId: string;
  tipo: AvisoFinanceiroTipo;
  titulo: string;
  descricao: string;
  quantidade: number;
  total: number;
  dateFrom: string;
  dateTo: string;
  statuses: string[];
  mostrarLinkConsulta: boolean;
  mostrarLinkRelatorio: boolean;
}

function isMissingAvisosTable(error: any) {
  const message = String(error?.message || '');
  return message.includes('avisos_configuracoes') || message.includes('avisos_configuracoes_usuarios');
}

export function formatAvisoTipo(tipo: AvisoFinanceiroTipo) {
  const labels: Record<AvisoFinanceiroTipo, string> = {
    parcelas_vencendo_hoje: 'Parcelas vencendo hoje',
    parcelas_vencidas: 'Parcelas vencidas',
    parcelas_a_vencer: 'Parcelas a vencer',
  };
  return labels[tipo];
}

export async function fetchAvisosConfiguracoes(): Promise<AvisoConfiguracao[]> {
  const { data, error } = await (supabase as any)
    .from('avisos_configuracoes')
    .select('*, avisos_configuracoes_usuarios(user_id)')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingAvisosTable(error)) return [];
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    usuarios: (item.avisos_configuracoes_usuarios || []).map((user: any) => user.user_id),
  }));
}

export async function saveAvisoConfiguracao(
  aviso: Omit<AvisoConfiguracao, 'id' | 'created_at' | 'updated_at' | 'usuarios'>,
  usuarios: string[],
  userId: string
): Promise<AvisoConfiguracao> {
  const timestamp = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('avisos_configuracoes')
    .insert({
      ...aviso,
      created_by: userId,
      updated_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select()
    .single();

  if (error) throw error;

  if (usuarios.length > 0) {
    const { error: usuariosError } = await (supabase as any)
      .from('avisos_configuracoes_usuarios')
      .insert(usuarios.map((usuarioId) => ({ aviso_id: data.id, user_id: usuarioId })));
    if (usuariosError) throw usuariosError;
  }

  await recordAuditEntry({
    entity_type: 'avisos_configuracoes',
    entity_id: data.id,
    action: 'criacao',
    new_values: { ...data, usuarios },
    user_id: userId,
  });

  return { ...data, usuarios } as AvisoConfiguracao;
}

export async function updateAvisoConfiguracao(
  id: string,
  aviso: Partial<AvisoConfiguracao>,
  usuarios: string[],
  userId: string
): Promise<AvisoConfiguracao> {
  const { data: previous } = await (supabase as any)
    .from('avisos_configuracoes')
    .select('*, avisos_configuracoes_usuarios(user_id)')
    .eq('id', id)
    .maybeSingle();

  const {
    usuarios: _usuarios,
    id: _id,
    created_at: _createdAt,
    created_by: _createdBy,
    ...safeAviso
  } = aviso as Partial<AvisoConfiguracao> & { usuarios?: string[] };

  const { data, error } = await (supabase as any)
    .from('avisos_configuracoes')
    .update({
      ...safeAviso,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const { error: deleteError } = await (supabase as any)
    .from('avisos_configuracoes_usuarios')
    .delete()
    .eq('aviso_id', id);
  if (deleteError) throw deleteError;

  if (usuarios.length > 0) {
    const { error: usuariosError } = await (supabase as any)
      .from('avisos_configuracoes_usuarios')
      .insert(usuarios.map((usuarioId) => ({ aviso_id: id, user_id: usuarioId })));
    if (usuariosError) throw usuariosError;
  }

  await recordAuditEntry({
    entity_type: 'avisos_configuracoes',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: { ...data, usuarios },
    user_id: userId,
  });

  return { ...data, usuarios } as AvisoConfiguracao;
}

export async function deleteAvisoConfiguracao(id: string, userId: string): Promise<void> {
  const { data: previous } = await (supabase as any)
    .from('avisos_configuracoes')
    .select('*, avisos_configuracoes_usuarios(user_id)')
    .eq('id', id)
    .maybeSingle();

  const { error } = await (supabase as any)
    .from('avisos_configuracoes')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'avisos_configuracoes',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function buildAvisoRange(tipo: AvisoFinanceiroTipo, diasAntecedencia: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hoje = toIsoDate(today);

  if (tipo === 'parcelas_vencidas') {
    return {
      dateFrom: '',
      dateTo: toIsoDate(addDays(today, -1)),
      statuses: ['vencida', 'aberta'],
    };
  }

  if (tipo === 'parcelas_a_vencer') {
    return {
      dateFrom: hoje,
      dateTo: toIsoDate(addDays(today, Math.max(1, diasAntecedencia))),
      statuses: ['aberta'],
    };
  }

  return {
    dateFrom: hoje,
    dateTo: hoje,
    statuses: ['aberta', 'vencida'],
  };
}

export async function fetchAvisosFinanceirosUsuario(userId: string): Promise<AvisoFinanceiroNotificacao[]> {
  const { data: configs, error: configsError } = await (supabase as any)
    .from('avisos_configuracoes')
    .select('*, avisos_configuracoes_usuarios!inner(user_id)')
    .eq('modulo', 'financeiro')
    .eq('ativo', true)
    .eq('avisos_configuracoes_usuarios.user_id', userId);

  if (configsError) {
    if (isMissingAvisosTable(configsError)) return [];
    throw configsError;
  }

  const activeConfigs = (configs || []) as AvisoConfiguracao[];
  if (activeConfigs.length === 0) return [];

  const { data: contas, error: contasError } = await (supabase as any)
    .from('contas_pagar')
    .select(`
      id,
      empresa_nome,
      fornecedor_nome,
      obra_nome,
      quantidade_parcelas,
      contas_pagar_parcelas (
        id,
        numero_parcela,
        valor_parcela,
        data_vencimento,
        status
      )
    `);

  if (contasError) throw contasError;

  return activeConfigs.reduce<AvisoFinanceiroNotificacao[]>((acc, config: any) => {
    const range = buildAvisoRange(config.tipo, Number(config.dias_antecedencia || 0));
    const parcelas = (contas || []).flatMap((conta: any) =>
      (conta.contas_pagar_parcelas || []).map((parcela: any) => ({ conta, parcela }))
    ).filter(({ parcela }: any) => {
      if (parcela.status === 'paga' || parcela.status === 'cancelada') return false;
      if (range.statuses.length > 0 && !range.statuses.includes(parcela.status)) return false;
      if (range.dateFrom && parcela.data_vencimento < range.dateFrom) return false;
      if (range.dateTo && parcela.data_vencimento > range.dateTo) return false;
      return true;
    });

    if (parcelas.length === 0) return acc;

    const total = parcelas.reduce((sum: number, item: any) => sum + Number(item.parcela.valor_parcela || 0), 0);
    const titulo = formatAvisoTipo(config.tipo);
    const descricao = `${parcelas.length} parcela${parcelas.length === 1 ? '' : 's'} | Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}`;

    acc.push({
      id: `financeiro-${config.id}-${range.dateFrom || 'inicio'}-${range.dateTo}`,
      avisoId: config.id,
      tipo: config.tipo,
      titulo,
      descricao,
      quantidade: parcelas.length,
      total,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      statuses: range.statuses,
      mostrarLinkConsulta: Boolean(config.mostrar_link_consulta),
      mostrarLinkRelatorio: Boolean(config.mostrar_link_relatorio),
    });

    return acc;
  }, []);
}
