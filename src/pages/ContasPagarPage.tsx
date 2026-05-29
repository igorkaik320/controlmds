import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Eye, Calendar as CalendarIcon, Building, CheckSquare, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import { formatCurrency, formatCurrencyInput, formatCurrencyReal, parseCurrencyInput } from '@/lib/formatters';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  fetchContasPagar, 
  marcarParcelasVencidas,
  saveContaPagar, 
  updateContaPagar, 
  deleteContaPagar,
  replaceParcelasConta,
  updateParcelasStatus,
  ContaPagarComParcelas,
  ContaPagarParcela
} from '@/lib/contasPagarService';
import { fetchEmpresas } from '@/lib/empresasService';
import { fetchFornecedores, Fornecedor, syncCompraFaturadaParcelasFromContaPagar } from '@/lib/comprasService';
import { fetchObras, fetchObrasPorEmpresa, Obra } from '@/lib/obrasService';
import { CategoriaFinanceira, fetchCategoriasFinanceiras } from '@/lib/categoriasFinanceirasService';
import ContasPagarParcelasDialog from '@/components/ContasPagarParcelasDialog';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import SearchableSelect, { SearchableSelectOption } from '@/components/SearchableSelect';
import { cn } from '@/lib/utils';

interface Empresa {
  id: string;
  nome: string;
}

type ParcelaForm = {
  id?: string;
  numero_parcela: number;
  data_vencimento: string;
  valor_parcela: string;
  status: ContaPagarParcela['status'];
  data_pagamento: string;
  observacao: string;
};

function getCategoryLevel(code?: string | null) {
  if (!code) return 0;
  return Math.max(0, code.split('.').length - 1);
}

function normalizeSearch(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ContasPagarPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<ContaPagarComParcelas[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showParcelasDialog, setShowParcelasDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contaParcelas, setContaParcelas] = useState<ContaPagarComParcelas | null>(null);
  const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [savingConta, setSavingConta] = useState(false);
  const [activeTab, setActiveTab] = useState('contas');
  const savingContaRef = useRef(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Ordenação
  type SortKey = 'numero' | 'data_emissao' | 'empresa' | 'fornecedor' | 'origem' | 'valor_total' | 'parcela' | 'vencimento' | 'status' | 'observacao';
  type ParcelasSortKey = 'vencimento' | 'empresa' | 'fornecedor' | 'origem' | 'parcela' | 'valor' | 'status' | 'obra';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [parcelasSortKey, setParcelasSortKey] = useState<ParcelasSortKey | null>(null);
  const [parcelasSortDir, setParcelasSortDir] = useState<SortDir>('asc');
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [dateFromStr, setDateFromStr] = useState('');
  const [dateToStr, setDateToStr] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [parcelasCurrentPage, setParcelasCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  }

  function handleParcelasSort(key: ParcelasSortKey) {
    if (parcelasSortKey !== key) {
      setParcelasSortKey(key);
      setParcelasSortDir('asc');
    } else if (parcelasSortDir === 'asc') {
      setParcelasSortDir('desc');
    } else {
      setParcelasSortKey(null);
      setParcelasSortDir('asc');
    }
  }

  function ParcelasSortIcon({ column }: { column: ParcelasSortKey }) {
    if (parcelasSortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return parcelasSortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  }
  
  // Filtros
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterObra, setFilterObra] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [filterDataEmissao, setFilterDataEmissao] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    empresa: '',
    obra: '',
    fornecedor: '',
    startDate: null as Date | undefined,
    endDate: null as Date | undefined,
    searchFornecedor: '',
    dateFromStr: '',
    dateToStr: '',
  });

  const [form, setForm] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_primeiro_vencimento: new Date().toISOString().split('T')[0],
    empresa_id: '',
    fornecedor_id: '',
    obra_id: '',
    categoria_financeira_id: '',
    valor_total: '',
    quantidade_parcelas: '1',
    observacao: '',
  });
  const [parcelasForm, setParcelasForm] = useState<ParcelaForm[]>([]);

  const load = useCallback(async () => {
    try {
      await marcarParcelasVencidas(user?.id);
      const [contasData, empresasData, fornecedoresData, categoriasData] = await Promise.all([
        fetchContasPagar(),
        fetchEmpresas().catch(() => []),
        fetchFornecedores().catch(() => []),
        fetchCategoriasFinanceiras().catch(() => []),
      ]);
      setItems(contasData);
      setEmpresas(empresasData);
      setFornecedores(fornecedoresData);
      setCategorias(categoriasData);
    } catch (e: any) {
      toast.error('Erro ao carregar dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form.empresa_id) {
      fetchObrasPorEmpresa(form.empresa_id).then(setObras).catch(() => {});
    } else {
      fetchObras().then(setObras).catch(() => {});
    }
  }, [form.empresa_id]);

  const hasPeriodoAplicado = Boolean(
    filtrosAplicados.startDate ||
    filtrosAplicados.endDate ||
    filtrosAplicados.dateFromStr ||
    filtrosAplicados.dateToStr
  );

  function parcelaDentroDoPeriodo(parcela: ContaPagarParcela) {
    const venc = parcela.data_vencimento;
    if (!venc) return false;

    const vencDate = new Date(venc + 'T00:00:00');
    if (filtrosAplicados.startDate && vencDate < filtrosAplicados.startDate) return false;
    if (filtrosAplicados.endDate && vencDate > filtrosAplicados.endDate) return false;
    if (filtrosAplicados.dateFromStr && venc < filtrosAplicados.dateFromStr) return false;
    if (filtrosAplicados.dateToStr && venc > filtrosAplicados.dateToStr) return false;

    return true;
  }

  function contaPassaFiltrosBasicos(i: ContaPagarComParcelas) {
    const term = normalizeSearch(filtrosAplicados.searchFornecedor);
    if (term && !normalizeSearch(i.fornecedor_nome).includes(term)) return false;
    if (filtrosAplicados.empresa && i.empresa_id !== filtrosAplicados.empresa) return false;
    if (filtrosAplicados.obra) {
      const obraFiltro = obras.find((obra) => obra.id === filtrosAplicados.obra);
      const obraNomeFiltro = normalizeSearch(obraFiltro?.nome);
      const mesmaObraId = i.obra_id === filtrosAplicados.obra;
      const mesmaObraNome = !!obraNomeFiltro && normalizeSearch(i.obra_nome).includes(obraNomeFiltro);
      if (!mesmaObraId && !mesmaObraNome) return false;
    }
    if (filtrosAplicados.fornecedor && i.fornecedor_id !== filtrosAplicados.fornecedor) return false;
    return true;
  }

  function contaDentroDoPeriodoPrincipal(i: ContaPagarComParcelas) {
    if (!hasPeriodoAplicado) return true;

    const venc = i.parcelas
      .map((p) => p.data_vencimento)
      .filter(Boolean)
      .sort()[0];
    if (!venc) return false;

    const vencDate = new Date(venc + 'T00:00:00');
    if (filtrosAplicados.startDate && vencDate < filtrosAplicados.startDate) return false;
    if (filtrosAplicados.endDate && vencDate > filtrosAplicados.endDate) return false;
    if (filtrosAplicados.dateFromStr && venc < filtrosAplicados.dateFromStr) return false;
    if (filtrosAplicados.dateToStr && venc > filtrosAplicados.dateToStr) return false;
    return true;
  }

  function getParcelaPrincipal(conta: ContaPagarComParcelas) {
    const parcelas = [...conta.parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
    return parcelas.find((p) => p.status !== 'paga') || parcelas[0] || null;
  }

  const filtered = items.filter((i) => {
    if (!contaPassaFiltrosBasicos(i)) return false;
    return contaDentroDoPeriodoPrincipal(i);
  });

  // Aplica ordenação clicável nos headers
  const sortedFiltered = (() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

    const getVal = (c: ContaPagarComParcelas): string | number => {
      const primeira = [...c.parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela)[0];
      switch (sortKey) {
        case 'numero': return c.numero ?? 0;
        case 'data_emissao': return c.data_emissao || '';
        case 'empresa': return (c.empresa_nome || '').toLowerCase();
        case 'fornecedor': return (c.fornecedor_nome || '').toLowerCase();
        case 'origem': return (c.origem || 'CP').toLowerCase();
        case 'valor_total': return Number(c.valor_total) || 0;
        case 'parcela': return c.quantidade_parcelas || 0;
        case 'vencimento': return primeira?.data_vencimento || '';
        case 'status': return (primeira?.status || '').toLowerCase();
        case 'observacao': return ((primeira?.observacao || c.observacao) || '').toLowerCase();
        default: return '';
      }
    };

    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return collator.compare(String(va), String(vb)) * dir;
    });
    return arr;
  })();

  // Flatten all parcelas for inline display
  const allParcelas = sortedFiltered.flatMap(conta => 
    conta.parcelas.map(p => ({ ...p, conta }))
  );

  function handleConsultar() {
    setFiltrosAplicados({
      empresa: filterEmpresa,
      obra: filterObra,
      fornecedor: filterFornecedor,
      startDate: startDate,
      endDate: endDate,
      searchFornecedor,
      dateFromStr,
      dateToStr,
    });
    setCurrentPage(1);
  }

  function handleLimparFiltros() {
    setFilterEmpresa('');
    setFilterObra('');
    setFilterFornecedor('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchFornecedor('');
    setDateFromStr('');
    setDateToStr('');
    setFiltrosAplicados({
      empresa: '',
      obra: '',
      fornecedor: '',
      startDate: undefined,
      endDate: undefined,
      searchFornecedor: '',
      dateFromStr: '',
      dateToStr: '',
    });
    setCurrentPage(1);
  }

  function buildParcelasForm(valorTotalText: string, quantidadeText: string, primeiroVencimento: string) {
    const quantidade = Math.max(1, parseInt(quantidadeText || '1', 10) || 1);
    const valorTotal = parseCurrencyInput(valorTotalText || '0');
    const valorParcela = Math.round((valorTotal / quantidade) * 100) / 100;
    const valorUltima = Math.round((valorTotal - valorParcela * (quantidade - 1)) * 100) / 100;

    return Array.from({ length: quantidade }, (_, index) => {
      const data = new Date(`${primeiroVencimento || new Date().toISOString().split('T')[0]}T00:00:00`);
      data.setMonth(data.getMonth() + index);

      return {
        numero_parcela: index + 1,
        data_vencimento: data.toISOString().split('T')[0],
        valor_parcela: formatCurrencyInput(formatCurrencyReal(index === quantidade - 1 ? valorUltima : valorParcela)),
        status: 'aberta' as const,
        data_pagamento: '',
        observacao: '',
      };
    });
  }

  function regenerateParcelas(nextForm = form) {
    setParcelasForm(buildParcelasForm(
      nextForm.valor_total,
      nextForm.quantidade_parcelas,
      nextForm.data_primeiro_vencimento || nextForm.data_emissao
    ));
  }

  function updateParcelaForm(index: number, patch: Partial<ParcelaForm>) {
    setParcelasForm((prev) => prev.map((parcela, i) => (i === index ? { ...parcela, ...patch } : parcela)));
  }

  function addParcelaInline() {
    setParcelasForm((prev) => {
      const ultima = prev[prev.length - 1];
      const dataBase = ultima?.data_vencimento || form.data_primeiro_vencimento || form.data_emissao || new Date().toISOString().split('T')[0];
      const data = new Date(`${dataBase}T00:00:00`);
      data.setMonth(data.getMonth() + 1);

      return [
        ...prev,
        {
          numero_parcela: prev.length + 1,
          data_vencimento: data.toISOString().split('T')[0],
          valor_parcela: formatCurrencyInput(formatCurrencyReal(0)),
          status: 'aberta' as const,
          data_pagamento: '',
          observacao: '',
        },
      ];
    });
    setForm((prev) => ({ ...prev, quantidade_parcelas: String(parcelasForm.length + 1) }));
  }

  function removeParcelaInline(index: number) {
    setParcelasForm((prev) => prev
      .filter((_, i) => i !== index)
      .map((parcela, i) => ({ ...parcela, numero_parcela: i + 1 })));
    setForm((prev) => ({ ...prev, quantidade_parcelas: String(Math.max(1, parcelasForm.length - 1)) }));
  }

  function openNew() {
    setEditingId(null);
    const nextForm = {
      data_emissao: new Date().toISOString().split('T')[0],
      data_primeiro_vencimento: new Date().toISOString().split('T')[0],
      empresa_id: '',
      fornecedor_id: '',
      obra_id: '',
      categoria_financeira_id: '',
      valor_total: '',
      quantidade_parcelas: '1',
      observacao: '',
    };
    setForm(nextForm);
    setParcelasForm(buildParcelasForm(nextForm.valor_total, nextForm.quantidade_parcelas, nextForm.data_primeiro_vencimento));
    setShowDialog(true);
  }

  function openEdit(item: ContaPagarComParcelas) {
    const parcelasPorNumero = new Map<number, ContaPagarParcela>();

    [...item.parcelas]
      .sort((a, b) => {
        if (a.numero_parcela !== b.numero_parcela) return a.numero_parcela - b.numero_parcela;
        return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
      })
      .forEach((parcela) => {
        if (!parcelasPorNumero.has(parcela.numero_parcela)) {
          parcelasPorNumero.set(parcela.numero_parcela, parcela);
        }
      });

    const parcelasUnicas = Array.from(parcelasPorNumero.values()).sort((a, b) => a.numero_parcela - b.numero_parcela);

    setEditingId(item.id);
    setForm({
      data_emissao: item.data_emissao,
      data_primeiro_vencimento: item.data_primeiro_vencimento || item.data_emissao,
      empresa_id: item.empresa_id || '',
      fornecedor_id: item.fornecedor_id || '',
      obra_id: item.obra_id || '',
      categoria_financeira_id: item.categoria_financeira_id || '',
      valor_total: formatCurrencyInput(formatCurrencyReal(item.valor_total)),
      quantidade_parcelas: item.quantidade_parcelas.toString(),
      observacao: item.observacao || '',
    });
    setParcelasForm(
      parcelasUnicas.map((parcela) => ({
          id: parcela.id,
          numero_parcela: parcela.numero_parcela,
          data_vencimento: parcela.data_vencimento || '',
          valor_parcela: formatCurrencyInput(formatCurrencyReal(parcela.valor_parcela || 0)),
          status: parcela.status,
          data_pagamento: parcela.data_pagamento ? parcela.data_pagamento.split('T')[0] : '',
          observacao: parcela.observacao || '',
        }))
    );
    setShowDialog(true);
  }

  function openParcelas(item: ContaPagarComParcelas) {
    setContaParcelas(item);
    setShowParcelasDialog(true);
  }

  async function handleParcelasSave(parcelasAtualizadas?: ContaPagarParcela[]) {
    if (contaParcelas?.origem === 'CF' && contaParcelas.origem_id && parcelasAtualizadas?.length) {
      await syncCompraFaturadaParcelasFromContaPagar(
        contaParcelas.origem_id,
        parcelasAtualizadas,
        user?.id || ''
      );
    }
    await load();
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev) => ({ ...prev, fornecedor_id: f.id }));
  }

  async function handleSubmit() {
    if (savingContaRef.current) {
      return;
    }

    savingContaRef.current = true;
    setSavingConta(true);

    try {
      if (!user || !form.valor_total || !form.empresa_id || !form.fornecedor_id) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
      if (parcelasForm.length === 0) {
        toast.error('Gere ao menos uma parcela');
        return;
      }

      const empresa = empresas.find(e => e.id === form.empresa_id);
      const fornecedor = fornecedores.find(f => f.id === form.fornecedor_id);
      const categoria = categorias.find(c => c.id === form.categoria_financeira_id);
      
      const obra = obras.find(o => o.id === form.obra_id);
      const totalParcelas = parcelasForm.reduce((sum, parcela) => sum + parseCurrencyInput(parcela.valor_parcela), 0);
      const payload = {
        origem: 'CP' as const,
        origem_id: null,
        data_emissao: form.data_emissao,
        data_primeiro_vencimento: form.data_primeiro_vencimento || null,
        empresa_id: form.empresa_id,
        empresa_nome: empresa?.nome || '',
        fornecedor_id: form.fornecedor_id,
        fornecedor_nome: fornecedor?.nome_fornecedor || '',
        obra_id: form.obra_id || null,
        obra_nome: obra?.nome || null,
        categoria_financeira_id: categoria?.id || null,
        categoria_codigo: categoria?.codigo || null,
        categoria_nome: categoria?.nome || null,
        valor_total: totalParcelas,
        quantidade_parcelas: parcelasForm.length,
        observacao: form.observacao.trim() || null,
        status: 'aberto' as const,
        created_by: user.id,
      };

      if (editingId) {
        await updateContaPagar(editingId, payload, user.id);
        await replaceParcelasConta(
          editingId,
          parcelasForm.map((parcela) => ({
            conta_pagar_id: editingId,
            numero_parcela: parcela.numero_parcela,
            valor_parcela: parseCurrencyInput(parcela.valor_parcela),
            data_vencimento: parcela.data_vencimento || null,
            data_pagamento: parcela.data_pagamento || null,
            valor_pago: null,
            status: parcela.status,
            observacao: parcela.observacao.trim() || null,
            created_by: user.id,
          })),
          user.id
        );
        toast.success('Conta atualizada');
      } else {
        const savedConta = await saveContaPagar(payload, user.id);
        await replaceParcelasConta(
          savedConta.id,
          parcelasForm.map((parcela) => ({
            conta_pagar_id: savedConta.id,
            numero_parcela: parcela.numero_parcela,
            valor_parcela: parseCurrencyInput(parcela.valor_parcela),
            data_vencimento: parcela.data_vencimento || null,
            data_pagamento: parcela.data_pagamento || null,
            valor_pago: null,
            status: parcela.status,
            observacao: parcela.observacao.trim() || null,
            created_by: user.id,
          })),
          user.id
        );
        
        toast.success('Conta cadastrada');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      savingContaRef.current = false;
      setSavingConta(false);
    }
  }

 
  async function handleDelete(conta: ContaPagarComParcelas) {
    const isOrigemExterna = conta.origem && conta.origem !== 'CP';
    const message = isOrigemExterna
      ? 'Este lançamento veio de outro módulo. A exclusão será feita somente no financeiro/Contas a Pagar e não apagará o lançamento na origem. Deseja continuar?'
      : 'Excluir esta conta e todas as parcelas?';

    if (!confirm(message)) return;
    try {
      await deleteContaPagar(conta.id, user?.id || '');
      toast.success('Conta excluída');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Toggle parcela selection
  function toggleParcela(parcelaId: string) {
    setSelectedParcelas(prev => {
      const next = new Set(prev);
      if (next.has(parcelaId)) next.delete(parcelaId);
      else next.add(parcelaId);
      return next;
    });
  }

  // Bulk status change
  async function handleBulkStatusChange(newStatus: string) {
    if (selectedParcelas.size === 0) return;
    try {
      await updateParcelasStatus(Array.from(selectedParcelas), newStatus, user?.id || '');
      toast.success(`${selectedParcelas.size} parcela(s) atualizada(s) para "${newStatus}"`);
      setSelectedParcelas(new Set());
      setShowBulkStatus(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Inline single parcela status change
  async function handleInlineStatusChange(parcelaId: string, newStatus: string) {
    try {
      await updateParcelasStatus([parcelaId], newStatus, user?.id || '');
      toast.success('Status atualizado');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function OrigemBadge({ origem }: { origem?: string | null }) {
    const value = origem || 'CP';
    return (
      <Badge
        variant="outline"
        title={value === 'CF' ? 'Compras Faturadas' : value === 'CP' ? 'Contas a Pagar' : 'Compras à Vista'}
        className={cn(
          'h-6 min-w-9 justify-center rounded-md px-2 text-[11px] font-semibold',
          value === 'CF' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground'
        )}
      >
        {value}
      </Badge>
    );
  }

  const consultaParcelas = useMemo(() => {
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
    const parcelas = items
      .filter(contaPassaFiltrosBasicos)
      .flatMap((conta) =>
        conta.parcelas.map((parcela) => ({
          ...parcela,
          conta,
        }))
      )
      .filter((parcela) => !hasPeriodoAplicado || parcelaDentroDoPeriodo(parcela));

    parcelas.sort((a, b) => {
      if (!parcelasSortKey) {
        const dataA = a.data_vencimento || '';
        const dataB = b.data_vencimento || '';
        if (dataA !== dataB) return dataA > dataB ? -1 : 1;
        return (a.conta.fornecedor_nome || '').localeCompare(b.conta.fornecedor_nome || '', 'pt-BR');
      }

      const dir = parcelasSortDir === 'asc' ? 1 : -1;
      const getVal = (item: typeof parcelas[number]): string | number => {
        switch (parcelasSortKey) {
          case 'vencimento': return item.data_vencimento || '';
          case 'empresa': return (item.conta.empresa_nome || '').toLowerCase();
          case 'fornecedor': return (item.conta.fornecedor_nome || '').toLowerCase();
          case 'origem': return (item.conta.origem || 'CP').toLowerCase();
          case 'parcela': return item.numero_parcela || 0;
          case 'valor': return Number(item.valor_parcela) || 0;
          case 'status': return (item.status || '').toLowerCase();
          case 'obra': return (item.conta.obra_nome || '').toLowerCase();
          default: return '';
        }
      };

      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return collator.compare(String(va), String(vb)) * dir;
    });

    return parcelas;
  }, [items, filtrosAplicados, obras, parcelasSortKey, parcelasSortDir]);

  // Agrupar parcelas por data para o relatório
  const reportGroups = useMemo(() => {
    const groups: Record<string, { date: string; dateLabel: string; parcels: number; total: number; items: any[] }> = {};
    
    consultaParcelas.forEach(parcela => {
      const date = parcela.data_vencimento || '0000-00-00';

      if (!groups[date]) {
        const dateObj = new Date(date + 'T00:00:00');
        const dateLabel = dateObj.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        groups[date] = {
          date,
          dateLabel,
          parcels: 0,
          total: 0,
          items: []
        };
      }
      
      groups[date].parcels++;
      groups[date].total += parcela.valor_parcela;
      groups[date].items.push(parcela);
    });
    
    const result = Object.values(groups);
    // Ordenar itens de cada dia em ordem crescente de valor (depois de adicionar todas as parcelas)
    result.forEach(group => {
      group.items.sort((a, b) => a.valor_parcela - b.valor_parcela);
    });
    // Retornar grupos ordenados por data (mesma lógica do FaturadosParcelasPage)
    return result.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [consultaParcelas]);

  const reportTotal = useMemo(() => {
    return reportGroups.reduce((sum, group) => sum + group.total, 0);
  }, [reportGroups]);

  const visiveis = sortedFiltered;

  const obraOptions = useMemo<SearchableSelectOption[]>(() => {
    return obras.map((obra) => ({
      value: obra.id,
      label: obra.nome,
      description: obra.empresa_nome || undefined,
      keywords: `${obra.nome} ${obra.empresa_nome || ''}`,
    }));
  }, [obras]);

  const filterObraOptions = useMemo<SearchableSelectOption[]>(() => {
    return obras
      .filter((obra) => !filterEmpresa || obra.empresa_id === filterEmpresa)
      .map((obra) => ({
        value: obra.id,
        label: obra.nome,
        description: obra.empresa_nome || undefined,
        keywords: `${obra.nome} ${obra.empresa_nome || ''}`,
      }));
  }, [obras, filterEmpresa]);

  const categoriaOptions = useMemo<SearchableSelectOption[]>(() => {
    return categorias
      .filter((categoria) => categoria.ativa && categoria.tipo === 'despesa')
      .map((categoria) => ({
        value: categoria.id,
        label: `${categoria.codigo} - ${categoria.nome}`,
        description: categoria.natureza === 'totalizadora' ? 'Matriz / totalizadora' : 'Movimento',
        disabled: categoria.natureza !== 'movimento',
        level: getCategoryLevel(categoria.codigo),
        keywords: `${categoria.codigo} ${categoria.nome} ${categoria.natureza}`,
      }));
  }, [categorias]);

  const parcelasTotal = useMemo(() => {
    return parcelasForm.reduce((sum, parcela) => sum + parseCurrencyInput(parcela.valor_parcela), 0);
  }, [parcelasForm]);

  const totalPages = Math.max(1, Math.ceil(visiveis.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, visiveis.length);
  const paginatedVisiveis = visiveis.slice(pageStartIndex, pageEndIndex);
  const parcelasTotalPages = Math.max(1, Math.ceil(consultaParcelas.length / pageSize));
  const safeParcelasCurrentPage = Math.min(parcelasCurrentPage, parcelasTotalPages);
  const parcelasPageStartIndex = (safeParcelasCurrentPage - 1) * pageSize;
  const parcelasPageEndIndex = Math.min(parcelasPageStartIndex + pageSize, consultaParcelas.length);
  const paginatedConsultaParcelas = consultaParcelas.slice(parcelasPageStartIndex, parcelasPageEndIndex);

  useEffect(() => {
    setCurrentPage(1);
    setParcelasCurrentPage(1);
    setSelectedParcelas(new Set());
  }, [sortKey, sortDir, filtrosAplicados]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (parcelasCurrentPage > parcelasTotalPages) {
      setParcelasCurrentPage(parcelasTotalPages);
    }
  }, [parcelasCurrentPage, parcelasTotalPages]);

  function handleOpenReport() {
    if (reportGroups.length === 0) {
      toast.error("Nada para exportar.");
      return;
    }
    setShowReport(true);
  }

  async function handleExportExcel() {
    if (exportingExcel) return;
    if (reportGroups.length === 0) {
      toast.error("Nada para exportar.");
      return;
    }

    setExportingExcel(true);
    try {
      const XLSX = await import("xlsx");
      const cleanText = (value: unknown) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
      const rows = [
        ["Vencimento", "Empresa", "Fornecedor", "Parcela", "Valor", "Status"],
        ...reportGroups.flatMap((group) =>
          group.items.map((item: any) => [
            item.data_vencimento
              ? new Date(item.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
              : "",
            cleanText(item.conta.empresa_nome),
            cleanText(item.conta.fornecedor_nome),
            `${item.numero_parcela}/${item.conta.quantidade_parcelas}`,
            Number(item.valor_parcela || 0),
            cleanText(item.status),
          ])
        ),
        ["", "", "", "TOTAL GERAL", reportTotal, ""],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 42 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
      ];

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: 4 });
        if (ws[cellRef]) {
          ws[cellRef].t = "n";
          ws[cellRef].z = "#,##0.00";
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
      XLSX.writeFile(wb, `contas_pagar_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exportado com sucesso.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar Excel.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    if (exportingPdf) return;
    if (reportGroups.length === 0) {
      toast.error("Nada para exportar.");
      return;
    }

    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = 14;
      const marginRight = pageWidth - 14;
      const usableWidth = marginRight - marginLeft;
      let y = 14;

      const checkNewPage = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 14) {
          pdf.addPage();
          y = 14;
          return true;
        }
        return false;
      };

      // Cabeçalho
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("RELATÓRIO", marginLeft, y);
      y += 5;

      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      pdf.setFont("helvetica", "bold");
      pdf.text("Contas a Pagar", marginLeft, y);

      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Gerado em: ${new Date().toLocaleDateString("pt-BR")}`,
        marginRight,
        y,
        { align: "right" }
      );
      y += 3;

      // Linha separadora do cabeçalho
      pdf.setDrawColor(200, 200, 200);
      pdf.line(marginLeft, y, marginRight, y);
      y += 5;

      // Cabeçalho da tabela
      const cols = {
        venc:      { x: marginLeft,      w: 22 },
        empresa:   { x: marginLeft + 22, w: 28 },
        fornec:    { x: marginLeft + 50, w: 62 },
        parcela:   { x: marginLeft + 112, w: 18 },
        valor:     { x: marginLeft + 130, w: 34 },
        status:    { x: marginLeft + 166, w: 20 },
      };

      const drawTableHeader = () => {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(marginLeft, y - 4, usableWidth, 7, "F");

        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(80, 80, 80);

        pdf.text("Vencimento", cols.venc.x, y);
        pdf.text("Empresa", cols.empresa.x, y);
        pdf.text("Fornecedor", cols.fornec.x, y);
        pdf.text("Parcela", cols.parcela.x, y, { align: "center" });
        pdf.text("Valor", cols.valor.x + cols.valor.w, y, { align: "right" });
        pdf.text("Status", cols.status.x, y);

        pdf.setDrawColor(210, 210, 210);
        pdf.line(marginLeft, y + 2, marginRight, y + 2);
        y += 6;
      };

      drawTableHeader();

      // â”€â”€ Grupos de datas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      reportGroups.forEach((group) => {
        checkNewPage(14);

        // Fundo do grupo
        pdf.setFillColor(248, 249, 250);
        pdf.rect(marginLeft, y - 3.5, usableWidth, 10, "F");

        // Nome da data (sem dia da semana para economizar espaço)
        const dateObj = new Date(group.date + "T00:00:00");
        const dateLabel = dateObj.toLocaleDateString("pt-BR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text(dateLabel, marginLeft + 1, y + 2);

        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `${group.parcels} parcela${group.parcels === 1 ? "" : "s"}`,
          marginLeft + 1,
          y + 6
        );

        // Total do grupo
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text(formatCurrency(group.total), marginRight, y + 3, {
          align: "right",
        });

        y += 13;

        // Linhas de parcela
        group.items.forEach((item: any, idx: number) => {
          checkNewPage(7);

          // Zebra
          if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(252, 252, 252);
          }
          pdf.rect(marginLeft, y - 3.5, usableWidth, 6.5, "F");

          pdf.setFontSize(7.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(50, 50, 50);

          const vencText = item.data_vencimento
            ? new Date(item.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
            : "-";

          const empresaNome: string = (item.conta.empresa_nome || "-").substring(0, 14);
          const fornecNome: string = (item.conta.fornecedor_nome || "-").substring(0, 32);
          const parcelaText = `${item.numero_parcela}/${item.conta.quantidade_parcelas}`;
          const valorText = formatCurrency(item.valor_parcela);
          const statusText: string = (item.status || "-");

          pdf.text(vencText, cols.venc.x, y);
          pdf.text(empresaNome, cols.empresa.x, y);
          pdf.text(fornecNome, cols.fornec.x, y);
          pdf.text(parcelaText, cols.parcela.x + cols.parcela.w / 2, y, { align: "center" });
          pdf.text(valorText, cols.valor.x + cols.valor.w, y, { align: "right" });

          // Badge de status colorido
          const statusColors: Record<string, [number, number, number]> = {
            aberta:    [220, 237, 255],
            paga:      [220, 250, 230],
            vencida:   [255, 225, 225],
            cancelada: [235, 235, 235],
          };
          const statusTextColors: Record<string, [number, number, number]> = {
            aberta:    [30, 100, 200],
            paga:      [30, 150, 60],
            vencida:   [200, 50, 50],
            cancelada: [100, 100, 100],
          };
          const [br, bg, bb] = statusColors[statusText] ?? [235, 235, 235];
          const [tr, tg, tb] = statusTextColors[statusText] ?? [80, 80, 80];

          const statusX = cols.status.x;
          const badgeW = 18;
          const badgeH = 4.5;
          pdf.setFillColor(br, bg, bb);
          pdf.roundedRect(statusX, y - 3.2, badgeW, badgeH, 1, 1, "F");
          pdf.setTextColor(tr, tg, tb);
          pdf.setFontSize(6.5);
          pdf.text(statusText, statusX + badgeW / 2, y - 0.7, { align: "center" });

          pdf.setDrawColor(240, 240, 240);
          pdf.line(marginLeft, y + 2.5, marginRight, y + 2.5);

          y += 7;
        });

        y += 2; // espaço entre grupos
      });

      // â”€â”€ Total Geral â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      checkNewPage(12);
      y += 2;
      pdf.setDrawColor(40, 40, 40);
      pdf.setLineWidth(0.5);
      pdf.line(marginLeft, y, marginRight, y);
      y += 5;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text("TOTAL GERAL", marginLeft, y);
      pdf.text(formatCurrency(reportTotal), marginRight, y, { align: "right" });
      pdf.setLineWidth(0.2);

      const filename = `contas_pagar_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);
      toast.success("PDF exportado com sucesso.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-5 text-[13px] text-foreground">
      <Card className="glass-card rounded-lg p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
          <p className="text-xs text-muted-foreground">
            Refine a consulta por fornecedor e período de vencimento.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[260px_260px_minmax(240px,1fr)_180px_180px]">
          <EmpresaSelect
            value={filterEmpresa}
            onChange={(value) => {
              setFilterEmpresa(value);
              setFilterObra('');
            }}
            label="Empresa"
            labelClassName="font-medium text-muted-foreground"
            triggerClassName="h-9 border-input bg-card text-sm shadow-none"
            allowAll
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Obra</Label>
            <SearchableSelect
              value={filterObra}
              onChange={setFilterObra}
              options={filterObraOptions}
              placeholder="Digite para pesquisar a obra"
              emptyText="Nenhuma obra encontrada"
              inputClassName="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Pesquisar fornecedor</Label>
            <Input
              className="h-9 rounded-md border-input bg-card text-sm shadow-none placeholder:text-muted-foreground"
              placeholder="Digite para pesquisar"
              value={searchFornecedor}
              onChange={(e) => setSearchFornecedor(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Data inicial</Label>
            <Input className="h-9 rounded-md border-input bg-card text-sm shadow-none" type="date" value={dateFromStr} onChange={(e) => setDateFromStr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Data final</Label>
            <Input className="h-9 rounded-md border-input bg-card text-sm shadow-none" type="date" value={dateToStr} onChange={(e) => setDateToStr(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={handleLimparFiltros}>
            Limpar
          </Button>
          <Button size="sm" className="h-9 gap-2" onClick={handleConsultar}>
            <Search className="h-4 w-4" />
            Consultar
          </Button>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-10 rounded-lg bg-muted p-1">
          <TabsTrigger value="contas" className="h-8 rounded-md px-4 text-sm">
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="h-8 rounded-md px-4 text-sm">
            Consulta de Parcelas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-0">
      {/* Card da tabela */}
      <Card className="overflow-hidden rounded-lg border-border/50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contas a Pagar</h3>
            <p className="text-xs text-muted-foreground">
              {visiveis.length} item(ns) encontrados
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate('contas_pagar') && (
              <Button size="sm" onClick={openNew} className="h-9 gap-1">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('fornecedor')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <div className="flex items-center">Fornecedor<SortIcon column="fornecedor" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('origem')} className="w-20 cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <div className="flex items-center">Origem<SortIcon column="origem" /></div>
                </TableHead>
                <TableHead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center">Categoria</div>
                </TableHead>
                <TableHead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center">Descrição</div>
                </TableHead>
                <TableHead onClick={() => handleSort('parcela')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <div className="flex items-center">Parcelas<SortIcon column="parcela" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('valor_total')} className="cursor-pointer select-none bg-muted/50 text-right text-xs font-medium text-muted-foreground hover:bg-muted">
                  <div className="flex items-center justify-end">
                    Valor Total<SortIcon column="valor_total" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('vencimento')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <div className="flex items-center">Próximo vencimento<SortIcon column="vencimento" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('status')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <div className="flex items-center">Status<SortIcon column="status" /></div>
                </TableHead>
                <TableHead className="bg-muted/50 text-right text-xs font-medium text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              )}

              {paginatedVisiveis.map((conta) => {
                const parcelas = [...conta.parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
                const proxima = getParcelaPrincipal(conta);
                const pagas = parcelas.filter((p) => p.status === 'paga').length;
                const total = conta.quantidade_parcelas || parcelas.length;
                const descricao = conta.observacao || proxima?.observacao || conta.obra_nome || '-';

                return (
                  <TableRow key={conta.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">{conta.fornecedor_nome || '-'}</TableCell>
                    <TableCell>
                      <OrigemBadge origem={conta.origem} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {conta.categoria_codigo ? `${conta.categoria_codigo} - ${conta.categoria_nome}` : '-'}
                    </TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {descricao}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{pagas}/{total}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(conta.valor_total)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {proxima?.data_vencimento
                        ? new Date(proxima.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {proxima ? (
                        <Select
                          value={proxima.status}
                          onValueChange={(v) => handleInlineStatusChange(proxima.id, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-7 w-[104px] rounded-md border-transparent px-2.5 text-[11px] font-semibold capitalize shadow-none [&>svg]:text-current",
                              proxima.status === 'aberta' && "bg-primary/15 text-primary hover:bg-primary/20",
                              proxima.status === 'paga' && "bg-success/15 text-success hover:bg-success/20",
                              proxima.status === 'vencida' && "bg-destructive/15 text-destructive hover:bg-destructive/20",
                              proxima.status === 'cancelada' && "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            <span>
                              {proxima.status}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aberta">Aberta</SelectItem>
                            <SelectItem value="paga">Paga</SelectItem>
                            <SelectItem value="vencida">Vencida</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem parcelas</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {conta.origem !== 'CP' && (
                          <Button variant="ghost" size="icon" onClick={() => openParcelas(conta)} title="Editar parcelas">
                            <Eye className="h-4 w-4 text-foreground" />
                          </Button>
                        )}
                        {canEdit('contas_pagar') && conta.origem !== 'CF' && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(conta)} title="Editar">
                            <Pencil className="h-4 w-4 text-foreground" />
                          </Button>
                        )}
                        {canDelete('contas_pagar') && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(conta)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            {visiveis.length > 0
              ? `Mostrando ${pageStartIndex + 1}-${pageEndIndex} de ${visiveis.length}`
              : 'Nenhum item para mostrar'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span>Itens por página</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
                setParcelasCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[82px] border-input bg-card text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[74px] text-center">
                {safeCurrentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
        </TabsContent>

        <TabsContent value="parcelas" className="mt-0">
          <Card className="overflow-hidden rounded-lg border-border/50 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Consulta de Parcelas</h3>
                <p className="text-xs text-muted-foreground">
                  {consultaParcelas.length} parcela(s) encontrada(s)
                  {selectedParcelas.size > 0 ? ` • ${selectedParcelas.size} selecionada(s)` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedParcelas.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedParcelas.size} selecionada(s)
                    </span>
                    <Select onValueChange={handleBulkStatusChange}>
                      <SelectTrigger className="h-9 w-[160px] border-input bg-card text-sm shadow-none">
                        <SelectValue placeholder="Alterar status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberta">Aberta</SelectItem>
                        <SelectItem value="paga">Paga</SelectItem>
                        <SelectItem value="vencida">Vencida</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handleOpenReport} className="h-9 gap-2">
                  <FileText className="h-4 w-4" />
                  Relatório
                </Button>
              </div>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 bg-muted/50">
                      <Checkbox
                        checked={
                          paginatedConsultaParcelas.length > 0 &&
                          paginatedConsultaParcelas.every((parcela) => selectedParcelas.has(parcela.id))
                        }
                        onCheckedChange={(checked) => {
                          setSelectedParcelas((prev) => {
                            const next = new Set(prev);
                            paginatedConsultaParcelas.forEach((parcela) => {
                              if (checked) next.add(parcela.id);
                              else next.delete(parcela.id);
                            });
                            return next;
                          });
                        }}
                        aria-label="Selecionar parcelas visíveis"
                      />
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('vencimento')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Vencimento<ParcelasSortIcon column="vencimento" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('empresa')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Empresa<ParcelasSortIcon column="empresa" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('fornecedor')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Fornecedor<ParcelasSortIcon column="fornecedor" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('origem')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Origem<ParcelasSortIcon column="origem" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('parcela')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Parcela<ParcelasSortIcon column="parcela" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('valor')} className="cursor-pointer select-none bg-muted/50 text-right text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center justify-end">Valor<ParcelasSortIcon column="valor" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('status')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Status<ParcelasSortIcon column="status" /></div>
                    </TableHead>
                    <TableHead onClick={() => handleParcelasSort('obra')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Obra<ParcelasSortIcon column="obra" /></div>
                    </TableHead>
                    <TableHead className="bg-muted/50 text-right text-xs font-medium text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consultaParcelas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        Nenhuma parcela encontrada
                      </TableCell>
                    </TableRow>
                  )}

                  {paginatedConsultaParcelas.map((parcela) => (
                    <TableRow key={parcela.id} className="border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selectedParcelas.has(parcela.id)}
                          onCheckedChange={() => toggleParcela(parcela.id)}
                          aria-label={`Selecionar parcela ${parcela.numero_parcela}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {parcela.data_vencimento
                          ? new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {parcela.conta.empresa_nome || '-'}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {parcela.conta.fornecedor_nome || '-'}
                      </TableCell>
                      <TableCell>
                        <OrigemBadge origem={parcela.conta.origem} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {parcela.numero_parcela}/{parcela.conta.quantidade_parcelas || parcela.conta.parcelas.length}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(parcela.valor_parcela)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={parcela.status}
                          onValueChange={(v) => handleInlineStatusChange(parcela.id, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-7 w-[104px] rounded-md border-transparent px-2.5 text-[11px] font-semibold capitalize shadow-none [&>svg]:text-current",
                              parcela.status === 'aberta' && "bg-primary/15 text-primary hover:bg-primary/20",
                              parcela.status === 'paga' && "bg-success/15 text-success hover:bg-success/20",
                              parcela.status === 'vencida' && "bg-destructive/15 text-destructive hover:bg-destructive/20",
                              parcela.status === 'cancelada' && "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            <span>{parcela.status}</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aberta">Aberta</SelectItem>
                            <SelectItem value="paga">Paga</SelectItem>
                            <SelectItem value="vencida">Vencida</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs uppercase text-muted-foreground">
                        {parcela.conta.obra_nome || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {parcela.conta.origem !== 'CP' && (
                            <Button variant="ghost" size="icon" onClick={() => openParcelas(parcela.conta)} title="Editar parcelas">
                              <Eye className="h-4 w-4 text-foreground" />
                            </Button>
                          )}
                          {canEdit('contas_pagar') && parcela.conta.origem !== 'CF' && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(parcela.conta)} title="Editar conta">
                              <Pencil className="h-4 w-4 text-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                {consultaParcelas.length > 0
                  ? `Mostrando ${parcelasPageStartIndex + 1}-${parcelasPageEndIndex} de ${consultaParcelas.length}`
                  : 'Nenhuma parcela para mostrar'}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span>Itens por página</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1);
                    setParcelasCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[82px] border-input bg-card text-xs shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setParcelasCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeParcelasCurrentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[74px] text-center">
                    {safeParcelasCurrentPage} de {parcelasTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setParcelasCurrentPage((page) => Math.min(parcelasTotalPages, page + 1))}
                    disabled={safeParcelasCurrentPage >= parcelasTotalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de Nova/Editar Conta */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!savingConta) setShowDialog(open);
      }}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Conta a Pagar</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Emissão *</Label>
                <Input 
                  type="date"
                  value={form.data_emissao} 
                  onChange={(e) => setForm((p) => ({ ...p, data_emissao: e.target.value }))} 
                />
              </div>
              <div>
                <Label>1º Vencimento *</Label>
                <Input 
                  type="date"
                  value={form.data_primeiro_vencimento} 
                  onChange={(e) => setForm((p) => ({ ...p, data_primeiro_vencimento: e.target.value }))} 
                />
              </div>
            </div>

            <EmpresaSelect 
              value={form.empresa_id}
              onChange={(value) => setForm((p) => ({ ...p, empresa_id: value }))}
              label="Empresa *"
            />

            <div>
              <Label>Fornecedor *</Label>
              <FornecedorSelect
                value={form.fornecedor_id}
                onChange={(v) => setForm((p) => ({ ...p, fornecedor_id: v }))}
                onFornecedorSelect={handleFornecedorSelect}
                valueMode="id"
                label=""
              />
            </div>

            <div>
              <Label>Obra</Label>
              <SearchableSelect
                value={form.obra_id}
                onChange={(value) => setForm((p) => ({ ...p, obra_id: value }))}
                options={obraOptions}
                placeholder="Digite para pesquisar a obra"
                emptyText="Nenhuma obra encontrada"
                inputClassName="h-10"
              />
            </div>

            <div>
              <Label>Categoria</Label>
              <SearchableSelect
                value={form.categoria_financeira_id}
                onChange={(value) => setForm((p) => ({ ...p, categoria_financeira_id: value }))}
                options={categoriaOptions}
                placeholder="Digite código ou descrição"
                emptyText="Nenhuma categoria encontrada"
                inputClassName="h-10"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Matrizes aparecem para referência, mas somente categorias de movimento podem ser selecionadas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Total *</Label>
                <Input 
                  type="text"
                  value={form.valor_total}
                  onChange={(e) => setForm((p) => ({ ...p, valor_total: formatCurrencyInput(e.target.value) }))}
                  onBlur={() => {
                    if (!editingId) regenerateParcelas();
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <Label>Quantidade de Parcelas *</Label>
                <Select 
                  value={form.quantidade_parcelas} 
                  onValueChange={(value) => {
                    const nextForm = { ...form, quantidade_parcelas: value };
                    setForm(nextForm);
                    regenerateParcelas(nextForm);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'parcela' : 'parcelas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observação</Label>
              <Input 
                value={form.observacao} 
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} 
                placeholder="Observações sobre a conta..."
              />
            </div>

            <div className="rounded-md border border-border">
              <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Parcelas</h4>
                  <p className="text-xs text-muted-foreground">
                    Edite vencimento, valor, status e pagamento antes de salvar.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total: {formatCurrency(parcelasTotal)}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => regenerateParcelas()} disabled={savingConta}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Gerar parcelas
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addParcelaInline} disabled={savingConta}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 bg-muted/50 text-xs font-medium text-muted-foreground">Parcela</TableHead>
                      <TableHead className="w-40 bg-muted/50 text-xs font-medium text-muted-foreground">Vencimento</TableHead>
                      <TableHead className="w-52 bg-muted/50 text-xs font-medium text-muted-foreground">Valor</TableHead>
                      <TableHead className="w-36 bg-muted/50 text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="w-40 bg-muted/50 text-xs font-medium text-muted-foreground">Pagamento</TableHead>
                      <TableHead className="min-w-44 bg-muted/50 text-xs font-medium text-muted-foreground">Obs.</TableHead>
                      <TableHead className="w-12 bg-muted/50 text-right text-xs font-medium text-muted-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasForm.map((parcela, index) => (
                      <TableRow key={parcela.id || index} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{parcela.numero_parcela}</TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={parcela.data_vencimento}
                            onChange={(e) => updateParcelaForm(index, { data_vencimento: e.target.value })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="min-w-[190px]">
                          <Input
                            value={parcela.valor_parcela}
                            onChange={(e) => updateParcelaForm(index, { valor_parcela: formatCurrencyInput(e.target.value) })}
                            placeholder="R$ 0,00"
                            className="h-9 min-w-[170px] text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={parcela.status}
                            onValueChange={(value: ContaPagarParcela['status']) => updateParcelaForm(index, { status: value })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aberta">Aberta</SelectItem>
                              <SelectItem value="paga">Paga</SelectItem>
                              <SelectItem value="vencida">Vencida</SelectItem>
                              <SelectItem value="cancelada">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={parcela.data_pagamento}
                            onChange={(e) => updateParcelaForm(index, { data_pagamento: e.target.value })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={parcela.observacao}
                            onChange={(e) => updateParcelaForm(index, { observacao: e.target.value })}
                            placeholder="Observação"
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParcelaInline(index)}
                            disabled={savingConta || parcelasForm.length <= 1}
                            title="Remover parcela"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={savingConta}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={savingConta}>
              {savingConta ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edição de Parcelas */}
      <ContasPagarParcelasDialog
        open={showParcelasDialog}
        onClose={() => setShowParcelasDialog(false)}
        contaPagarId={contaParcelas?.id || ''}
        parcelas={contaParcelas?.parcelas || []}
        onSave={handleParcelasSave}
        userId={user?.id || ''}
        enforceTotal={contaParcelas?.origem === 'CF' ? Number(contaParcelas.valor_total) : undefined}
      />

      {/* Diálogo de Relatório */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Contas a Pagar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumo dos Filtros */}
            <div className="rounded-md border bg-muted/30 p-4">
              <h4 className="font-semibold mb-2">Filtros Aplicados:</h4>
              <div className="grid gap-4 text-sm md:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">
                    {filtrosAplicados.empresa 
                      ? empresas.find(e => e.id === filtrosAplicados.empresa)?.nome || 'Não encontrada'
                      : 'Todas'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Obra:</span>
                  <p className="font-medium">
                    {filtrosAplicados.obra
                      ? obras.find(o => o.id === filtrosAplicados.obra)?.nome || 'Não encontrada'
                      : 'Todas'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span>
                  <p className="font-medium">
                    {filtrosAplicados.fornecedor
                      ? fornecedores.find(f => f.id === filtrosAplicados.fornecedor)?.nome_fornecedor || 'Não encontrado'
                      : filtrosAplicados.searchFornecedor || 'Todos'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Período:</span>
                  <p className="font-medium">
                    {filtrosAplicados.dateFromStr || filtrosAplicados.dateToStr
                      ? `${filtrosAplicados.dateFromStr ? new Date(filtrosAplicados.dateFromStr + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} a ${filtrosAplicados.dateToStr ? new Date(filtrosAplicados.dateToStr + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}`
                      : filtrosAplicados.startDate || filtrosAplicados.endDate
                      ? `${filtrosAplicados.startDate ? format(filtrosAplicados.startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Início'} a ${filtrosAplicados.endDate ? format(filtrosAplicados.endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Fim'}`
                      : 'Todo o período'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela do Relatório */}
            <div ref={reportRef}>
              <div className="mb-3 rounded-md border bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Relatório</p>
                <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-base font-semibold leading-tight">Contas a Pagar</h3>
                  <p className="text-sm text-muted-foreground">
                    Gerado em: {new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {reportGroups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma parcela encontrada para os filtros selecionados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportGroups.map((group) => [
                      // Header do grupo (data e total do dia)
                      <TableRow key={group.date}>
                          <TableCell colSpan={6} className="py-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-sm">{group.dateLabel}</p>
                                <p className="text-xs text-muted-foreground">
                                  {group.parcels} parcela{group.parcels === 1 ? '' : 's'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-base">
                                  {formatCurrency(group.total)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                      </TableRow>,
                      // Parcelas do dia
                        ...group.items.map((item) => (
                          <TableRow key={`${item.conta.id}-${item.id}`}>
                            <TableCell className="py-1 text-xs">
                              {item.data_vencimento 
                                ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                                : '-'}
                            </TableCell>
                            <TableCell className="font-medium text-xs py-1">
                              {item.conta.empresa_nome || '-'}
                            </TableCell>
                            <TableCell className="text-xs py-1">
                              {item.conta.fornecedor_nome || '-'}
                            </TableCell>
                            <TableCell className="text-center text-xs py-1">
                              {item.numero_parcela}/{item.conta.quantidade_parcelas}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs py-1">
                              {formatCurrency(item.valor_parcela)}
                            </TableCell>
                            <TableCell className="py-1">
                              <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                                {item.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                    ])}
                    
                    {/* Total Geral */}
                      <TableRow>
                        <TableCell colSpan={6} className="py-2">
                          <div className="flex justify-between items-center border-t-2 border-black">
                            <p className="font-bold text-sm">TOTAL GERAL</p>
                            <p className="font-bold text-base">
                              {formatCurrency(reportTotal)}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReport(false)}>
              Fechar
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={exportingExcel || reportGroups.length === 0}
            >
              {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
            </Button>
            <Button 
              onClick={handleExportPdf}
              disabled={exportingPdf || reportGroups.length === 0}
            >
              {exportingPdf ? 'Exportando...' : 'Exportar PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
