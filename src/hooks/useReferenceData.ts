import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEmpresas } from "@/lib/empresasService";
import { fetchObras } from "@/lib/obrasService";
import { fetchFornecedores, fetchResponsaveis } from "@/lib/comprasService";
import {
  fetchVeiculos,
  fetchPostosCombustivel,
  fetchTiposCombustivel,
  fetchCategoriasVeiculos,
} from "@/lib/combustivelService";
import { fetchSetores, fetchEquipamentos } from "@/lib/equipamentosService";

/**
 * Cached hooks for stable reference data.
 * staleTime: 5 minutes — data is reused instantly across pages without refetching.
 * Mutations should invalidate the matching key via useQueryClient().invalidateQueries({ queryKey: [...] }).
 */

const STABLE_OPTS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

export function useEmpresas() {
  return useQuery({ queryKey: ["empresas"], queryFn: fetchEmpresas, ...STABLE_OPTS });
}

export function useObras() {
  return useQuery({ queryKey: ["obras"], queryFn: fetchObras, ...STABLE_OPTS });
}

export function useFornecedores() {
  return useQuery({ queryKey: ["fornecedores"], queryFn: fetchFornecedores, ...STABLE_OPTS });
}

export function useResponsaveis() {
  return useQuery({ queryKey: ["responsaveis"], queryFn: fetchResponsaveis, ...STABLE_OPTS });
}

export function useVeiculos() {
  return useQuery({ queryKey: ["veiculos"], queryFn: fetchVeiculos, ...STABLE_OPTS });
}

export function usePostosCombustivel() {
  return useQuery({ queryKey: ["postos_combustivel"], queryFn: fetchPostosCombustivel, ...STABLE_OPTS });
}

export function useTiposCombustivel() {
  return useQuery({ queryKey: ["tipos_combustivel"], queryFn: fetchTiposCombustivel, ...STABLE_OPTS });
}

export function useCategoriasVeiculos() {
  return useQuery({ queryKey: ["categorias_veiculos"], queryFn: fetchCategoriasVeiculos, ...STABLE_OPTS });
}

export function useSetores() {
  return useQuery({ queryKey: ["setores"], queryFn: fetchSetores, ...STABLE_OPTS });
}

export function useEquipamentos() {
  return useQuery({ queryKey: ["equipamentos"], queryFn: fetchEquipamentos, ...STABLE_OPTS });
}

/** Helper to invalidate a cached dataset after a mutation. */
export function useInvalidateReference() {
  const qc = useQueryClient();
  return (key: string) => qc.invalidateQueries({ queryKey: [key] });
}
