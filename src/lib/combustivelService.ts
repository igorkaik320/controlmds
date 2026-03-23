import { supabase } from '@/integrations/supabase/client';
import type { Obra } from './obrasService';

// ---- Types ----
export interface VeiculoMaquina {
  id: string;
  tipo: 'veiculo' | 'maquina';
  placa: string;
  modelo: string;
  marca: string;
  categoria: string;
  categoria_id?: string | null;
  created_by: string;
  created_at: string;
}

export interface TipoCombustivel {
  id: string;
  nome: string;
  created_by: string;
  created_at: string;
}

export interface PostoCombustivel {
  id: string;
  nome: string;
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CategoriaVeiculo {
  id: string;
  nome: string;
  tipo_principal: 'posto' | 'pessoal' | 'maquinario_obra';
  categoria_pai_id: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Abastecimento {
  id: string;
  veiculo_id: string;
  obra_id?: string | null;
  posto_id?: string | null;
  nfe: string | null;
  data: string;
  combustivel_id: string;
  quantidade_litros: number;
  valor_unitario: number;
  valor_total: number;
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  veiculo?: VeiculoMaquina;
  combustivel?: TipoCombustivel;
  obra?: Obra | null;
  posto?: PostoCombustivel | null;
}

export interface RevisaoCombustivel {
  id: string;
  veiculo_id: string;
  fornecedor_id: string;
  data: string;
  valor: number;
  quilometragem_atual: number;
  quilometragem_proxima: number;
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  veiculo?: VeiculoMaquina;
  fornecedor?: {
    id: string;
    nome_fornecedor: string;
    razao_social: string | null;
    cnpj_cpf: string | null;
  };
}

// ---- Veículos / Máquinas ----
export async function fetchVeiculos(): Promise<VeiculoMaquina[]> {
  const { data, error } = await supabase
    .from('veiculos_maquinas')
    .select('*')
    .order('modelo');

  if (error) throw error;
  return data || [];
}

// ---- Postos ----
export async function fetchPostosCombustivel(): Promise<PostoCombustivel[]> {
  const { data, error } = await supabase
    .from('postos_combustivel')
    .select('*')
    .order('nome');

  if (error) throw error;
  return data || [];
}

export async function savePostoCombustivel(
  posto: {
    nome: string;
    observacao?: string | null;
    created_by: string;
  }
) {
  const { data, error } = await supabase
    .from('postos_combustivel')
    .insert(posto as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePostoCombustivel(
  id: string,
  posto: {
    nome: string;
    observacao?: string | null;
  }
) {
  const { error } = await supabase
    .from('postos_combustivel')
    .update({ ...posto, updated_at: new Date().toISOString() } as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deletePostoCombustivel(id: string) {
  const { error } = await supabase
    .from('postos_combustivel')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function saveVeiculo(v: Omit<VeiculoMaquina, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('veiculos_maquinas')
    .insert(v as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVeiculo(id: string, v: Partial<VeiculoMaquina>) {
  const { error } = await supabase
    .from('veiculos_maquinas')
    .update(v as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteVeiculo(id: string) {
  const { error } = await supabase
    .from('veiculos_maquinas')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---- Tipos de Combustível ----
export async function fetchTiposCombustivel(): Promise<TipoCombustivel[]> {
  const { data, error } = await supabase
    .from('tipos_combustivel')
    .select('*')
    .order('nome');

  if (error) throw error;
  return data || [];
}

export async function saveTipoCombustivel(nome: string, userId: string) {
  const { data, error } = await supabase
    .from('tipos_combustivel')
    .insert({ nome, created_by: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTipoCombustivel(id: string, nome: string) {
  const { error } = await supabase
    .from('tipos_combustivel')
    .update({ nome } as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTipoCombustivel(id: string) {
  const { error } = await supabase
    .from('tipos_combustivel')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---- Categorias de Veículos ----
export async function fetchCategoriasVeiculos(): Promise<CategoriaVeiculo[]> {
  const { data, error } = await supabase
    .from('categorias_veiculos')
    .select('*')
    .order('tipo_principal')
    .order('nome');

  if (error) throw error;
  return data || [];
}

export async function saveCategoriaVeiculo(
  categoria: {
    nome: string;
    tipo_principal: 'posto' | 'pessoal' | 'maquinario_obra';
    categoria_pai_id?: string | null;
    ativo?: boolean;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('categorias_veiculos')
    .insert({
      ...categoria,
      categoria_pai_id: categoria.categoria_pai_id || null,
      ativo: categoria.ativo ?? true,
      created_by: userId,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategoriaVeiculo(
  id: string,
  categoria: {
    nome: string;
    tipo_principal: 'posto' | 'pessoal' | 'maquinario_obra';
    categoria_pai_id?: string | null;
    ativo?: boolean;
  }
) {
  const { error } = await supabase
    .from('categorias_veiculos')
    .update({
      ...categoria,
      categoria_pai_id: categoria.categoria_pai_id || null,
      ativo: categoria.ativo ?? true,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCategoriaVeiculo(id: string) {
  const { error } = await supabase
    .from('categorias_veiculos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---- Abastecimentos ----
export async function fetchAbastecimentos(): Promise<Abastecimento[]> {
  const { data, error } = await supabase
    .from('abastecimentos')
    .select('*, veiculo:veiculos_maquinas(*), combustivel:tipos_combustivel(*), posto:postos_combustivel(*), obra:obras(*)')
    .order('data', { ascending: false });

  if (error) throw error;
  return (data || []) as any;
}

export async function saveAbastecimento(a: {
  veiculo_id: string;
  obra_id?: string | null;
  posto_id?: string | null;
  nfe?: string;
  data: string;
  combustivel_id: string;
  quantidade_litros: number;
  valor_unitario: number;
  valor_total: number;
  observacao?: string;
  created_by: string;
}) {
  const { data, error } = await supabase
    .from('abastecimentos')
    .insert(a as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAbastecimento(id: string, a: Partial<Abastecimento>) {
  const { error } = await supabase
    .from('abastecimentos')
    .update({ ...a, updated_at: new Date().toISOString() } as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAbastecimento(id: string) {
  const { error } = await supabase
    .from('abastecimentos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---- Revisoes ----
export async function fetchRevisoesCombustivel(): Promise<RevisaoCombustivel[]> {
  const { data, error } = await supabase
    .from('revisoes_combustivel')
    .select('*, veiculo:veiculos_maquinas(*), fornecedor:fornecedores(id, nome_fornecedor, razao_social, cnpj_cpf)')
    .order('data', { ascending: false });

  if (error) throw error;
  return (data || []) as any;
}

export async function saveRevisaoCombustivel(revisao: {
  veiculo_id: string;
  fornecedor_id: string;
  data: string;
  valor: number;
  quilometragem_atual: number;
  quilometragem_proxima: number;
  observacao?: string | null;
  created_by: string;
}) {
  const { data, error } = await supabase
    .from('revisoes_combustivel')
    .insert(revisao as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRevisaoCombustivel(id: string, revisao: Partial<RevisaoCombustivel>) {
  const { error } = await supabase
    .from('revisoes_combustivel')
    .update({ ...revisao, updated_at: new Date().toISOString() } as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRevisaoCombustivel(id: string) {
  const { error } = await supabase
    .from('revisoes_combustivel')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
