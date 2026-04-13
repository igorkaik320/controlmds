import { fetchComprasFaturadas, CompraFaturada } from '@/lib/comprasService';
import { fetchContasPagar, ContaPagarComParcelas } from '@/lib/contasPagarService';

export interface ParcelaUnificada {
  id: string;
  tipo: 'compra_faturada' | 'conta_pagar';
  supplier: string;
  cnpj?: string | null;
  obra?: string | null;
  pedido?: string | null;
  observation?: string | null;
  value: number;
  due: string;
  dueIso?: string;
  monthKey: string;
  monthLabel: string;
  dayKey: string;
  dayLabel: string;
  obraId?: string;
  companyId?: string;
  companyName?: string;
  empresaNome?: string;
  fornecedorNome?: string;
  status?: string;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

export async function fetchParcelasUnificadas(): Promise<ParcelaUnificada[]> {
  try {
    // Buscar compras faturadas e contas a pagar em paralelo
    const [comprasFaturadas, contasPagar] = await Promise.all([
      fetchComprasFaturadas(),
      fetchContasPagar(),
    ]);

    const parcelas: ParcelaUnificada[] = [];

    // Processar compras faturadas (lógica existente)
    comprasFaturadas.forEach((item) => {
      // Usar a lógica existente para gerar parcelas de compras faturadas
      const installments = buildInstallmentsFromItem(item);
      
      installments.forEach((installment, index) => {
        const iso = toIsoDateString(installment.due);
        const date = iso ? new Date(`${iso}T00:00:00`) : null;
        const monthKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'sem-mes';
        const monthLabel = date ? monthFormatter.format(date) : 'Sem mês';
        const dayKey = iso || installment.due;
        const dayLabel = date ? dayFormatter.format(date) : installment.due;

        parcelas.push({
          id: `compra-${item.id}-${index}-${installment.due}`,
          tipo: 'compra_faturada',
          supplier: item.fornecedor,
          cnpj: item.cnpj_cpf,
          obra: item.obra,
          pedido: item.pedido,
          observation: item.observacao,
          value: installment.value,
          due: installment.due,
          dueIso: iso,
          monthKey,
          monthLabel,
          dayKey,
          dayLabel,
          obraId: (item as any).obra_id ?? (item as any).obraId ?? "",
          companyId: (item as any).empresa_id ?? (item as any).empresaId ?? "",
          companyName: (item as any).empresa ?? (item as any).empresa_nome ?? "",
        });
      });
    });

    // Processar contas a pagar
    contasPagar.forEach((conta) => {
      conta.parcelas.forEach((parcela) => {
        const date = new Date(`${parcela.data_vencimento}T00:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = monthFormatter.format(date);
        const dayKey = parcela.data_vencimento;
        const dayLabel = dayFormatter.format(date);

        // Só incluir parcelas que não estão pagas ou canceladas
        if (parcela.status !== 'paga' && parcela.status !== 'cancelada') {
          parcelas.push({
            id: `conta-${conta.id}-${parcela.id}`,
            tipo: 'conta_pagar',
            supplier: conta.fornecedor_nome || 'Fornecedor não informado',
            cnpj: null,
            obra: null,
            pedido: null,
            observation: conta.observacao,
            value: parcela.valor_parcela,
            due: parcela.data_vencimento,
            dueIso: parcela.data_vencimento,
            monthKey,
            monthLabel,
            dayKey,
            dayLabel,
            obraId: null,
            companyId: conta.empresa_id || null,
            companyName: conta.empresa_nome || undefined,
            empresaNome: conta.empresa_nome || undefined,
            fornecedorNome: conta.fornecedor_nome || undefined,
            status: parcela.status,
          });
        }
      });
    });

    // Ordenar por data de vencimento
    return parcelas.sort((a, b) => {
      const dateA = new Date(a.dueIso || a.due);
      const dateB = new Date(b.dueIso || b.due);
      return dateA.getTime() - dateB.getTime();
    });

  } catch (error) {
    console.error('Erro ao buscar parcelas unificadas:', error);
    throw error;
  }
}

// Funções auxiliares (copiadas de parcelas.ts para não criar dependência circular)
function buildInstallmentsFromItem(item: CompraFaturada) {
  if (!item.parcelas || item.parcelas === '1') {
    return [{ due: item.vencimentos || item.data, value: item.valor }];
  }

  const parts = item.parcelas.split('/');
  const total = parseInt(parts[0]) || 1;
  const start = parseInt(parts[1]) || 1;
  const baseDate = new Date(`${item.vencimentos || item.data}T00:00:00`);

  return Array.from({ length: total }, (_, i) => {
    const due = new Date(baseDate);
    due.setMonth(due.getMonth() + i);
    return {
      due: due.toISOString().split('T')[0],
      value: item.valor / total,
    };
  });
}

function toIsoDateString(value: string): string | null {
  if (!value) return null;

  // Se já estiver no formato YYYY-MM-DD, retorna
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Converter de DD/MM/YYYY para YYYY-MM-DD
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}
