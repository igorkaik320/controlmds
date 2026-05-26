/**
 * Mapa de rotas → função de import dinâmico.
 * Permite pré-carregar (prefetch) o chunk da página antes do usuário clicar,
 * eliminando o flash de "Carregando módulo...".
 *
 * Use as MESMAS funções de import no App.tsx via `lazy(routeLoaders['/x'])`
 * para garantir que o chunk pré-carregado é o mesmo que o React.lazy usa.
 */
export const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Index"),
  "/auth": () => import("@/pages/Auth"),
  "/auditoria": () => import("@/pages/AuditLog"),
  "/usuarios": () => import("@/pages/UserManagement"),
  "/compras/avista": () => import("@/pages/ComprasAvistaPage"),
  "/compras/faturadas": () => import("@/pages/ComprasFaturadasPage"),
  "/compras/espelho": () => import("@/pages/EspelhoGeralPage"),
  "/compras/programacao-semanal": () => import("@/pages/ProgramacaoSemanalPage"),
  "/compras/espelho-semanal": () => import("@/pages/EspelhoSemanalPage"),
  "/config-relatorio": () => import("@/pages/ConfigRelatorioPage"),
  "/fornecedores": () => import("@/pages/FornecedoresPage"),
  "/obras": () => import("@/pages/ObrasPage"),
  "/responsaveis": () => import("@/pages/ResponsaveisPage"),
  "/veiculos": () => import("@/pages/VeiculosMaquinasPage"),
  "/equipamentos": () => import("@/pages/EquipamentosPage"),
  "/setores": () => import("@/pages/SetoresPage"),
  "/postos-combustivel": () => import("@/pages/PostosCombustivelPage"),
  "/tipos-combustivel": () => import("@/pages/TiposCombustivelPage"),
  "/combustivel/abastecimentos": () => import("@/pages/AbastecimentosPage"),
  "/combustivel/dashboard": () => import("@/pages/DashboardCombustivelPage"),
  "/combustivel/revisoes": () => import("@/pages/RevisoesCombustivelPage"),
  "/empresas": () => import("@/pages/EmpresasPage"),
  "/painel-executivo": () => import("@/pages/PainelExecutivoPage"),
  "/financeiro/parcelas-faturadas": () => import("@/pages/FaturadosParcelasPage"),
  "/contas-pagar": () => import("@/pages/ContasPagarPage"),
  "/servicos-maquinas": () => import("@/pages/ServicosMaquinasPage"),
  "/componentes-maquinas": () => import("@/pages/ComponentesMaquinasPage"),
};

const prefetched = new Set<string>();

/** Pré-carrega o chunk de uma rota. Idempotente. */
export function prefetchRoute(path: string) {
  if (prefetched.has(path)) return;
  const loader = routeLoaders[path];
  if (!loader) return;
  prefetched.add(path);
  // Dispara o import sem bloquear, ignorando erros (offline, etc.)
  loader().catch(() => prefetched.delete(path));
}

/** Pré-carrega todas as rotas em "idle time", em pequenas fatias para não travar a UI. */
export function prefetchAllRoutesOnIdle() {
  const paths = Object.keys(routeLoaders);
  let i = 0;

  const schedule = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number)
      | undefined;
    if (ric) ric(() => cb(), { timeout: 2000 });
    else setTimeout(cb, 300);
  };

  const tick = () => {
    if (i >= paths.length) return;
    // 2 chunks por idle tick — evita saturar a rede
    prefetchRoute(paths[i++]);
    if (i < paths.length) prefetchRoute(paths[i++]);
    schedule(tick);
  };

  schedule(tick);
}
