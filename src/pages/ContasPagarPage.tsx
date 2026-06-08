import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, Eye, Calendar as CalendarIcon, Building, CheckSquare, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Paperclip, Download } from 'lucide-react';
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
  pagarParcelaContaPagar,
  updateParcelasStatus,
  ContaPagarComParcelas,
  ContaPagarParcela
} from '@/lib/contasPagarService';
import { ContaCorrente, fetchContasCorrentes } from '@/lib/contasCorrentesService';
import { fetchEmpresas } from '@/lib/empresasService';
import { fetchFornecedores, Fornecedor, syncCompraFaturadaParcelasFromContaPagar } from '@/lib/comprasService';
import { fetchObras, fetchObrasPorEmpresa, Obra } from '@/lib/obrasService';
import { CategoriaFinanceira, fetchCategoriasFinanceiras } from '@/lib/categoriasFinanceirasService';
import { fetchFinanceiroTags, FinanceiroTag } from '@/lib/financeiroTagsService';
import {
  ContaPagarParcelaAnexo,
  deleteParcelaAnexo,
  getParcelaAnexoUrl,
  renameParcelaAnexo,
  uploadParcelaAnexo,
} from '@/lib/contasPagarAnexosService';
import ContasPagarParcelasDialog from '@/components/ContasPagarParcelasDialog';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import ObservationInfoTooltip from '@/components/compras/ObservationInfoTooltip';
import SearchableSelect, { SearchableSelectOption } from '@/components/SearchableSelect';
import { cn } from '@/lib/utils';
import { useProfileMap } from '@/hooks/useProfileMap';

const STATUS_OPTIONS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'paga', label: 'Paga' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'cancelada', label: 'Cancelada' },
] as const;

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

type DashboardFilter = {
  type: 'fornecedor' | 'categoria' | 'tag' | 'status' | 'mes';
  value: string;
  label: string;
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

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    aberta: 'Aberta',
    paga: 'Paga',
    vencida: 'Vencida',
    cancelada: 'Cancelada',
  };

  return labels[status] || status;
}

function getStatusFilterLabel(statuses: string[]) {
  if (statuses.length === 0) return 'Todos os status';
  if (statuses.length === STATUS_OPTIONS.length) return 'Todos os status';
  return statuses.map(getStatusLabel).join(', ');
}

export default function ContasPagarPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const location = useLocation();
  const profileMap = useProfileMap();
  const [items, setItems] = useState<ContaPagarComParcelas[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [tags, setTags] = useState<FinanceiroTag[]>([]);
  const [contasCorrentes, setContasCorrentes] = useState<ContaCorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showParcelasDialog, setShowParcelasDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingConta, setEditingConta] = useState<ContaPagarComParcelas | null>(null);
  const [contaParcelas, setContaParcelas] = useState<ContaPagarComParcelas | null>(null);
  const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [savingConta, setSavingConta] = useState(false);
  const [attachmentParcela, setAttachmentParcela] = useState<ContaPagarParcela | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<{ anexo: ContaPagarParcelaAnexo; url: string } | null>(null);
  const [renamingAnexo, setRenamingAnexo] = useState<ContaPagarParcelaAnexo | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [paymentParcelas, setPaymentParcelas] = useState<ContaPagarParcela[]>([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentContaId, setPaymentContaId] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState('contas');
  const [openReportAfterFilter, setOpenReportAfterFilter] = useState(false);
  const savingContaRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Ordenação
  type SortKey = 'numero' | 'data_emissao' | 'empresa' | 'fornecedor' | 'origem' | 'valor_total' | 'parcela' | 'vencimento' | 'status' | 'observacao';
  type ParcelasSortKey = 'vencimento' | 'empresa' | 'fornecedor' | 'origem' | 'tag' | 'parcela' | 'valor' | 'status' | 'obra';
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
  const isExternalEditing = Boolean(editingConta?.origem && editingConta.origem !== 'CP');

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
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [statusQuery, setStatusQuery] = useState('');
  const [filterDataEmissao, setFilterDataEmissao] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    empresa: '',
    obra: '',
    fornecedor: '',
    statuses: [] as string[],
    startDate: null as Date | undefined,
    endDate: null as Date | undefined,
    searchFornecedor: '',
    dateFromStr: '',
    dateToStr: '',
    dashboardFilter: null as DashboardFilter | null,
  });

  const [form, setForm] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_primeiro_vencimento: new Date().toISOString().split('T')[0],
    empresa_id: '',
    fornecedor_id: '',
    obra_id: '',
    categoria_financeira_id: '',
    tag_id: '',
    valor_total: '',
    quantidade_parcelas: '1',
    observacao: '',
  });
  const [parcelasForm, setParcelasForm] = useState<ParcelaForm[]>([]);

  const load = useCallback(async () => {
    try {
      await marcarParcelasVencidas(user?.id);
      const [contasData, empresasData, fornecedoresData, categoriasData, tagsData, contasCorrentesData] = await Promise.all([
        fetchContasPagar(),
        fetchEmpresas().catch(() => []),
        fetchFornecedores().catch(() => []),
        fetchCategoriasFinanceiras().catch(() => []),
        fetchFinanceiroTags().catch(() => []),
        fetchContasCorrentes().catch(() => []),
      ]);
      setItems(contasData);
      setEmpresas(empresasData);
      setFornecedores(fornecedoresData);
      setCategorias(categoriasData);
      setTags(tagsData);
      setContasCorrentes(contasCorrentesData);
    } catch (e: any) {
      toast.error('Erro ao carregar dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const state = location.state as {
      dashboardFilter?: DashboardFilter;
      filters?: {
        dateFrom?: string;
        dateTo?: string;
        empresa?: string;
        statuses?: string[];
      };
      openReport?: boolean;
    } | null;

    if (!state?.dashboardFilter) return;

    const appliedStatuses = state.filters?.statuses || [];
    const appliedDateFrom = state.filters?.dateFrom || '';
    const appliedDateTo = state.filters?.dateTo || '';
    const appliedEmpresa = state.filters?.empresa || '';

    setFilterEmpresa(appliedEmpresa);
    setFilterObra('');
    setFilterFornecedor('');
    setFilterStatuses(appliedStatuses);
    setSearchFornecedor('');
    setDateFromStr(appliedDateFrom);
    setDateToStr(appliedDateTo);
    setStartDate(undefined);
    setEndDate(undefined);
    setActiveTab('parcelas');
    setCurrentPage(1);
    setParcelasCurrentPage(1);
    setOpenReportAfterFilter(Boolean(state.openReport));
    setFiltrosAplicados({
      empresa: appliedEmpresa,
      obra: '',
      fornecedor: '',
      statuses: appliedStatuses,
      startDate: undefined,
      endDate: undefined,
      searchFornecedor: '',
      dateFromStr: appliedDateFrom,
      dateToStr: appliedDateTo,
      dashboardFilter: state.dashboardFilter,
    });
  }, [location.state]);

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
    if (filtrosAplicados.dashboardFilter) {
      const drill = filtrosAplicados.dashboardFilter;
      if (drill.type === 'fornecedor' && normalizeSearch(i.fornecedor_nome) !== normalizeSearch(drill.value)) return false;
      if (drill.type === 'categoria') {
        const sameCategoryId = i.categoria_financeira_id === drill.value;
        const categoryLabel = i.categoria_codigo
          ? `${i.categoria_codigo} - ${i.categoria_nome || 'Sem descrição'}`
          : i.categoria_nome || 'Sem categoria';
        const sameCategoryLabel = normalizeSearch(categoryLabel) === normalizeSearch(drill.label)
          || normalizeSearch(i.categoria_nome) === normalizeSearch(drill.value);
        if (!sameCategoryId && !sameCategoryLabel) return false;
      }
      if (drill.type === 'tag') {
        const sameTagId = i.tag_id === drill.value;
        const sameTagName = normalizeSearch(i.tag_nome) === normalizeSearch(drill.value)
          || normalizeSearch(i.tag_nome) === normalizeSearch(drill.label);
        const sameEmptyTag = !i.tag_id && !i.tag_nome && normalizeSearch(drill.value) === normalizeSearch('Sem tag');
        if (!sameTagId && !sameTagName && !sameEmptyTag) return false;
      }
    }
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
    if (filtrosAplicados.statuses.length > 0) {
      const parcelaPrincipal = getParcelaPrincipal(i);
      if (!parcelaPrincipal || !filtrosAplicados.statuses.includes(parcelaPrincipal.status)) return false;
    }
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
      statuses: filterStatuses,
      startDate: startDate,
      endDate: endDate,
      searchFornecedor,
      dateFromStr,
      dateToStr,
      dashboardFilter: null,
    });
    setCurrentPage(1);
  }

  function handleLimparFiltros() {
    setFilterEmpresa('');
    setFilterObra('');
    setFilterFornecedor('');
    setFilterStatuses([]);
    setStatusQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchFornecedor('');
    setDateFromStr('');
    setDateToStr('');
    setFiltrosAplicados({
      empresa: '',
      obra: '',
      fornecedor: '',
      statuses: [],
      startDate: undefined,
      endDate: undefined,
      searchFornecedor: '',
      dateFromStr: '',
      dateToStr: '',
      dashboardFilter: null,
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
    setEditingConta(null);
    const nextForm = {
      data_emissao: new Date().toISOString().split('T')[0],
      data_primeiro_vencimento: new Date().toISOString().split('T')[0],
      empresa_id: '',
      fornecedor_id: '',
      obra_id: '',
      categoria_financeira_id: '',
      tag_id: '',
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
    setEditingConta(item);
    setForm({
      data_emissao: item.data_emissao,
      data_primeiro_vencimento: item.data_primeiro_vencimento || item.data_emissao,
      empresa_id: item.empresa_id || '',
      fornecedor_id: item.fornecedor_id || '',
      obra_id: item.obra_id || '',
      categoria_financeira_id: item.categoria_financeira_id || '',
      tag_id: item.tag_id || '',
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
      const isEditingExternal = editingConta?.origem && editingConta.origem !== 'CP';

      if (!user || !form.valor_total || !form.empresa_id || (!isEditingExternal && !form.fornecedor_id)) {
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
      const tag = tags.find(t => t.id === form.tag_id);
      
      const obra = obras.find(o => o.id === form.obra_id);
      const totalParcelas = parcelasForm.reduce((sum, parcela) => sum + parseCurrencyInput(parcela.valor_parcela), 0);

      if (editingId && isEditingExternal) {
        const totalOriginal = Number(editingConta.valor_total || 0);
        if (Math.abs(totalParcelas - totalOriginal) > 0.01) {
          toast.error(`O total das parcelas deve continuar igual a ${formatCurrency(totalOriginal)}.`);
          return;
        }

        const parcelasAtualizadas = parcelasForm.map((parcela) => ({
          id: parcela.id,
          conta_pagar_id: editingId,
          numero_parcela: parcela.numero_parcela,
          valor_parcela: parseCurrencyInput(parcela.valor_parcela),
          data_vencimento: parcela.data_vencimento || null,
          data_pagamento: parcela.data_pagamento || null,
          valor_pago: null,
          status: parcela.status,
          observacao: parcela.observacao.trim() || null,
          created_by: user.id,
        }));

        await updateContaPagar(
          editingId,
          {
            categoria_financeira_id: categoria?.id || null,
            categoria_codigo: categoria?.codigo || null,
            categoria_nome: categoria?.nome || null,
            tag_id: tag?.id || null,
            tag_nome: tag?.nome || null,
            tag_cor: tag?.cor || null,
            data_primeiro_vencimento: parcelasForm[0]?.data_vencimento || editingConta.data_primeiro_vencimento,
            quantidade_parcelas: parcelasForm.length,
            valor_total: totalOriginal,
          },
          user.id
        );
        await replaceParcelasConta(editingId, parcelasAtualizadas, user.id);

        if (editingConta.origem === 'CF' && editingConta.origem_id) {
          await syncCompraFaturadaParcelasFromContaPagar(
            editingConta.origem_id,
            parcelasAtualizadas,
            user.id
          );
        }

        toast.success('Parcelas atualizadas');
        setShowDialog(false);
        await load();
        return;
      }

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
        tag_id: tag?.id || null,
        tag_nome: tag?.nome || null,
        tag_cor: tag?.cor || null,
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
            id: parcela.id,
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
    if (newStatus === 'paga') {
      const parcelasSelecionadas = consultaParcelas.filter((parcela) => selectedParcelas.has(parcela.id));
      if (parcelasSelecionadas.length === 0) {
        toast.error('Nenhuma parcela selecionada para baixa.');
        return;
      }
      setPaymentParcelas(parcelasSelecionadas);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentContaId(contasCorrentes.find((conta) => conta.ativa)?.id || contasCorrentes[0]?.id || '');
      setShowBulkStatus(false);
      return;
    }
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
    if (newStatus === 'paga') {
      const parcela = consultaParcelas.find((item) => item.id === parcelaId)
        || items.flatMap((conta) => conta.parcelas).find((item) => item.id === parcelaId)
        || null;

      if (!parcela) {
        toast.error('Parcela não encontrada.');
        return;
      }

      setPaymentParcelas([parcela]);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentContaId(contasCorrentes.find((conta) => conta.ativa)?.id || contasCorrentes[0]?.id || '');
      return;
    }

    try {
      await updateParcelasStatus([parcelaId], newStatus, user?.id || '');
      toast.success('Status atualizado');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleConfirmPayment() {
    if (!user || paymentParcelas.length === 0) return;
    if (!paymentDate) {
      toast.error('Informe a data de pagamento.');
      return;
    }
    if (!paymentContaId) {
      toast.error('Selecione a conta corrente.');
      return;
    }

    setSavingPayment(true);
    try {
      for (const parcela of paymentParcelas) {
        await pagarParcelaContaPagar(parcela.id, paymentDate, paymentContaId, user.id);
      }
      toast.success(`${paymentParcelas.length} parcela(s) baixada(s) como paga`);
      setPaymentParcelas([]);
      setSelectedParcelas(new Set());
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao baixar parcela.');
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleAttachmentUpload(file?: File | null) {
    if (!user || !attachmentParcela?.id || !file) return;

    setUploadingAttachment(true);
    try {
      const anexo = await uploadParcelaAnexo(attachmentParcela.id, file, user.id);
      setAttachmentParcela((prev) => prev ? { ...prev, anexos: [anexo, ...(prev.anexos || [])] } : prev);
      await load();
      toast.success('Anexo enviado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar anexo.');
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  }

  async function handleAttachmentDownload(anexo: ContaPagarParcelaAnexo) {
    try {
      const url = await getParcelaAnexoUrl(anexo);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir anexo.');
    }
  }

  async function handleAttachmentPreview(anexo: ContaPagarParcelaAnexo) {
    try {
      const url = await getParcelaAnexoUrl(anexo);
      setPreviewAnexo({ anexo, url });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao pré-visualizar anexo.');
    }
  }

  function openRenameAnexo(anexo: ContaPagarParcelaAnexo) {
    setRenamingAnexo(anexo);
    setRenameValue(anexo.nome_exibicao || anexo.nome_arquivo);
  }

  async function handleAttachmentRename() {
    if (!user || !renamingAnexo) return;
    try {
      const updated = await renameParcelaAnexo(renamingAnexo, renameValue, user.id);
      setAttachmentParcela((prev) => prev ? {
        ...prev,
        anexos: (prev.anexos || []).map((item) => item.id === updated.id ? updated : item),
      } : prev);
      setRenamingAnexo(null);
      await load();
      toast.success('Anexo renomeado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao renomear anexo.');
    }
  }

  async function handleAttachmentDelete(anexo: ContaPagarParcelaAnexo) {
    if (!user || !confirm('Excluir este anexo?')) return;
    try {
      await deleteParcelaAnexo(anexo, user.id);
      setAttachmentParcela((prev) => prev ? { ...prev, anexos: (prev.anexos || []).filter((item) => item.id !== anexo.id) } : prev);
      await load();
      toast.success('Anexo excluído');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir anexo.');
    }
  }

  function AnexoButton({ parcela, disabled = false }: { parcela?: ContaPagarParcela | null; disabled?: boolean }) {
    const count = parcela?.anexos?.length || 0;
    const canOpen = Boolean(parcela?.id) && !disabled;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', count > 0 ? 'text-primary' : 'text-muted-foreground')}
            disabled={!canOpen}
            onClick={() => parcela && setAttachmentParcela(parcela)}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canOpen
            ? count > 0 ? `${count} anexo(s)` : 'Adicionar anexo'
            : 'Salve a parcela antes de anexar arquivos'}
        </TooltipContent>
      </Tooltip>
    );
  }

  function formatFileSize(bytes?: number | null) {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  function getTagDisplay(tagId?: string | null, nome?: string | null, cor?: string | null) {
    const byId = tagId ? tags.find((tag) => tag.id === tagId) : null;
    const byName = nome
      ? tags.find((tag) => normalizeSearch(tag.nome) === normalizeSearch(nome))
      : null;
    const tag = byId || byName;

    return {
      nome: tag?.nome || nome || null,
      cor: tag?.cor || cor || '#64748b',
      ordem: tag?.ordem ?? null,
    };
  }

  function TagBadge({ tagId, nome, cor, compact = false }: { tagId?: string | null; nome?: string | null; cor?: string | null; compact?: boolean }) {
    const tag = getTagDisplay(tagId, nome, cor);
    if (!tag.nome) return <span className="text-xs text-muted-foreground">-</span>;
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md font-semibold text-white",
          compact
            ? "h-5 w-[86px] justify-center px-1.5 text-[10px]"
            : "h-6 max-w-[120px] px-2 text-[11px]"
        )}
        style={{ backgroundColor: tag.cor }}
        title={tag.nome}
      >
        <span className="truncate">{tag.nome}</span>
      </span>
    );
  }

  function hexToRgb(hex?: string | null): [number, number, number] {
    const fallback: [number, number, number] = [100, 116, 139];
    if (!hex) return fallback;

    const clean = hex.replace('#', '').trim();
    const full = clean.length === 3
      ? clean.split('').map((char) => `${char}${char}`).join('')
      : clean;

    if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;

    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }

  function getReadableTextColor([r, g, b]: [number, number, number]): [number, number, number] {
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? [15, 23, 42] : [255, 255, 255];
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

    const parcelasFiltradas = filtrosAplicados.statuses.length === 0
      ? parcelas
      : parcelas.filter((parcela) => filtrosAplicados.statuses.includes(parcela.status));

    parcelasFiltradas.sort((a, b) => {
      if (!parcelasSortKey) {
        const dataA = a.data_vencimento || '';
        const dataB = b.data_vencimento || '';
        if (dataA !== dataB) return dataA > dataB ? 1 : -1;
        return (a.conta.fornecedor_nome || '').localeCompare(b.conta.fornecedor_nome || '', 'pt-BR');
      }

      const dir = parcelasSortDir === 'asc' ? 1 : -1;
      const getVal = (item: typeof parcelasFiltradas[number]): string | number => {
        switch (parcelasSortKey) {
          case 'vencimento': return item.data_vencimento || '';
          case 'empresa': return (item.conta.empresa_nome || '').toLowerCase();
          case 'fornecedor': return (item.conta.fornecedor_nome || '').toLowerCase();
          case 'origem': return (item.conta.origem || 'CP').toLowerCase();
          case 'tag': return (item.conta.tag_nome || '').toLowerCase();
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

    return parcelasFiltradas;
  }, [items, filtrosAplicados, obras, parcelasSortKey, parcelasSortDir]);

  const reportParcelas = useMemo(() => {
    if (selectedParcelas.size === 0) return consultaParcelas;
    return consultaParcelas.filter((parcela) => selectedParcelas.has(parcela.id));
  }, [consultaParcelas, selectedParcelas]);

  // Agrupar parcelas por data para o relatório
  const reportGroups = useMemo(() => {
    const groups: Record<string, { date: string; dateLabel: string; parcels: number; total: number; items: any[] }> = {};
    
    reportParcelas.forEach(parcela => {
      const date = parcela.data_vencimento || '0000-00-00';

      if (!groups[date]) {
        const dateObj = new Date(date + 'T00:00:00');
        const dateLabel = dateObj.toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
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
    // Ordenar itens de cada dia pela ordem cadastrada nas tags.
    result.forEach(group => {
      group.items.sort((a, b) => {
        const tagA = getTagDisplay(a.conta.tag_id, a.conta.tag_nome, a.conta.tag_cor);
        const tagB = getTagDisplay(b.conta.tag_id, b.conta.tag_nome, b.conta.tag_cor);
        const ordemA = tagA.ordem ?? Number.MAX_SAFE_INTEGER;
        const ordemB = tagB.ordem ?? Number.MAX_SAFE_INTEGER;
        if (ordemA !== ordemB) return ordemA - ordemB;

        const tagNameCompare = (tagA.nome || '').localeCompare(tagB.nome || '', 'pt-BR', { sensitivity: 'base', numeric: true });
        if (tagNameCompare !== 0) return tagNameCompare;

        const fornecedorCompare = (a.conta.fornecedor_nome || '').localeCompare(b.conta.fornecedor_nome || '', 'pt-BR', { sensitivity: 'base', numeric: true });
        if (fornecedorCompare !== 0) return fornecedorCompare;

        return (a.numero_parcela || 0) - (b.numero_parcela || 0);
      });
    });
    return result.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  }, [reportParcelas, tags]);

  const reportTotal = useMemo(() => {
    return reportGroups.reduce((sum, group) => sum + group.total, 0);
  }, [reportGroups]);

  function getReportObservacao(item: any) {
    return String(item?.observacao || item?.conta?.observacao || '-').trim() || '-';
  }

  const visiveis = sortedFiltered;

  const obraOptions = useMemo<SearchableSelectOption[]>(() => {
    return obras.map((obra) => ({
      value: obra.id,
      label: obra.nome,
      description: (obra as any).empresa_nome || undefined,
      keywords: `${obra.nome} ${(obra as any).empresa_nome || ''}`,
    }));
  }, [obras]);

  const filterObraOptions = useMemo<SearchableSelectOption[]>(() => {
    return obras
      .filter((obra) => !filterEmpresa || obra.empresa_id === filterEmpresa)
      .map((obra) => ({
        value: obra.id,
        label: obra.nome,
        description: (obra as any).empresa_nome || undefined,
        keywords: `${obra.nome} ${(obra as any).empresa_nome || ''}`,
      }));
  }, [obras, filterEmpresa]);

  const filteredStatusOptions = useMemo(() => {
    const term = normalizeSearch(statusQuery);
    if (!term) return STATUS_OPTIONS;
    return STATUS_OPTIONS.filter((status) => normalizeSearch(status.label).includes(term));
  }, [statusQuery]);

  function toggleFilterStatus(status: string) {
    setFilterStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    );
  }

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

  const tagOptions = useMemo<SearchableSelectOption[]>(() => {
    return tags
      .filter((tag) => tag.ativa)
      .map((tag) => ({
        value: tag.id,
        label: tag.nome,
        keywords: `${tag.nome} ${tag.cor}`,
      }));
  }, [tags]);

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
  const reportEmpresaNome = useMemo(() => {
    if (!filtrosAplicados.empresa) return '';
    return empresas.find((empresa) => empresa.id === filtrosAplicados.empresa)?.nome || '';
  }, [empresas, filtrosAplicados.empresa]);

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

  useEffect(() => {
    if (!openReportAfterFilter) return;
    if (reportGroups.length > 0) {
      setShowReport(true);
      setOpenReportAfterFilter(false);
    }
  }, [openReportAfterFilter, reportGroups]);

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
        ["Vencimento", "Empresa", "Fornecedor", "Tag", "Observação", "Parcela", "Valor", "Status"],
        ...reportGroups.flatMap((group) =>
          group.items.map((item: any) => [
            item.data_vencimento
              ? new Date(item.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
              : "",
            cleanText(item.conta.empresa_nome),
            cleanText(item.conta.fornecedor_nome),
            cleanText(getTagDisplay(item.conta.tag_id, item.conta.tag_nome, item.conta.tag_cor).nome),
            cleanText(getReportObservacao(item)),
            `${item.numero_parcela}/${item.conta.quantidade_parcelas}`,
            Number(item.valor_parcela || 0),
            cleanText(item.status).toUpperCase(),
          ])
        ),
        ["", "", "", "", "", "TOTAL GERAL", reportTotal, ""],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 42 },
        { wch: 18 },
        { wch: 36 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
      ];

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: 6 });
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
      pdf.text("CONTAS A PAGAR", pageWidth / 2, y, { align: "center" });
      if (reportEmpresaNome) {
        y += 5;
        pdf.setFontSize(10);
        pdf.setTextColor(30, 30, 30);
        pdf.setFont("helvetica", "bold");
        pdf.text(pdf.splitTextToSize(reportEmpresaNome, usableWidth - 45), pageWidth / 2, y, { align: "center" });
      }

      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Gerado em: ${new Date().toLocaleDateString("pt-BR")}`,
        marginRight,
        y,
        { align: "right" }
      );
      y += reportEmpresaNome ? 4 : 3;

      // Linha separadora do cabeçalho
      pdf.setDrawColor(200, 200, 200);
      pdf.line(marginLeft, y, marginRight, y);
      y += 5;

      // Cabeçalho da tabela
      const cols = {
        venc:      { x: marginLeft,       w: 18 },
        empresa:   { x: marginLeft + 18,  w: 25 },
        fornec:    { x: marginLeft + 43,  w: 38 },
        obs:       { x: marginLeft + 81,  w: 32 },
        tag:       { x: marginLeft + 113, w: 19 },
        parcela:   { x: marginLeft + 132, w: 14 },
        valor:     { x: marginLeft + 146, w: 20 },
        status:    { x: marginLeft + 166, w: 16 },
      };

      const wrapPdfText = (value: unknown, width: number, maxLines: number) => {
        const text = String(value || "-").trim() || "-";
        const lines = pdf.splitTextToSize(text, width).slice(0, maxLines);

        if (lines.length === maxLines && pdf.splitTextToSize(text, width).length > maxLines) {
          const last = String(lines[lines.length - 1]);
          lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : last;
        }

        return lines.length ? lines : ["-"];
      };

      const pdfBadgeHeight = 4.2;
      const pdfBadgeRadius = 0.8;
      const drawPdfBadge = (
        text: string,
        x: number,
        width: number,
        fill: [number, number, number],
        color: [number, number, number],
        baselineY: number,
        fontSize = 6
      ) => {
        pdf.setFillColor(...fill);
        pdf.roundedRect(x, baselineY - 2.9, width, pdfBadgeHeight, pdfBadgeRadius, pdfBadgeRadius, "F");
        pdf.setTextColor(...color);
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(text, x + width / 2, baselineY - 0.7, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(50, 50, 50);
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
        pdf.text("Obs.", cols.obs.x, y);
        pdf.text("Tag", cols.tag.x + cols.tag.w / 2, y, { align: "center" });
        pdf.text("Parcela", cols.parcela.x + cols.parcela.w / 2, y, { align: "center" });
        pdf.text("Valor", cols.valor.x + cols.valor.w, y, { align: "right" });
        pdf.text("Status", cols.status.x + cols.status.w / 2, y, { align: "center" });

        pdf.setDrawColor(210, 210, 210);
        pdf.line(marginLeft, y + 2, marginRight, y + 2);
        y += 6;
      };

      drawTableHeader();

      // Grupos por data
      reportGroups.forEach((group) => {
        checkNewPage(14);

        pdf.setFillColor(248, 249, 250);
        pdf.rect(marginLeft, y - 3.5, usableWidth, 10, "F");

        const dateObj = new Date(group.date + "T00:00:00");
        const dateLabel = dateObj.toLocaleDateString("pt-BR", {
          weekday: "long",
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

        y += 10;

        // Linhas de parcela
        group.items.forEach((item: any, idx: number) => {
          pdf.setFontSize(7);
          const empresaLines = wrapPdfText(item.conta.empresa_nome || "-", cols.empresa.w - 2, 3);
          const fornecLines = wrapPdfText(item.conta.fornecedor_nome || "-", cols.fornec.w - 2, 3);
          pdf.setFontSize(6.4);
          const observacaoLines = wrapPdfText(getReportObservacao(item), cols.obs.w - 1, 4);
          const maxLines = Math.max(empresaLines.length, fornecLines.length, observacaoLines.length);
          const rowHeight = Math.max(7, maxLines * 3.2 + 3.2);
          checkNewPage(rowHeight);

          // Zebra
          if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(252, 252, 252);
          }
          pdf.rect(marginLeft, y - 3.5, usableWidth, rowHeight - 0.5, "F");

          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(50, 50, 50);

          const vencText = item.data_vencimento
            ? new Date(item.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
            : "-";

          const tagDisplay = getTagDisplay(item.conta.tag_id, item.conta.tag_nome, item.conta.tag_cor);
          pdf.setFontSize(5.2);
          const tagNome = wrapPdfText(tagDisplay.nome || "-", cols.tag.w - 2, 1)[0];
          const tagBadgeWidth = Math.min(cols.tag.w - 1, Math.max(9, pdf.getTextWidth(tagNome) + 4));
          const tagBadgeX = cols.tag.x + (cols.tag.w - tagBadgeWidth) / 2;
          pdf.setFontSize(7);
          const parcelaText = `${item.numero_parcela}/${item.conta.quantidade_parcelas}`;
          const valorText = formatCurrency(item.valor_parcela);
          const statusValue: string = item.status || "-";
          const statusText: string = statusValue.toUpperCase().substring(0, 8);

          pdf.text(vencText, cols.venc.x, y);
          pdf.text(empresaLines, cols.empresa.x, y);
          pdf.text(fornecLines, cols.fornec.x, y);

          pdf.setFontSize(6.4);
          pdf.setTextColor(80, 80, 80);
          pdf.text(observacaoLines, cols.obs.x, y);
          pdf.setFontSize(7);
          pdf.setTextColor(50, 50, 50);

          if (tagDisplay.nome) {
            const [tagR, tagG, tagB] = hexToRgb(tagDisplay.cor);
            const [textR, textG, textB] = getReadableTextColor([tagR, tagG, tagB]);
            drawPdfBadge(tagNome, tagBadgeX, tagBadgeWidth, [tagR, tagG, tagB], [textR, textG, textB], y, 5.2);
          } else {
            pdf.text("-", cols.tag.x + cols.tag.w / 2, y, { align: "center" });
          }

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
          const [br, bg, bb] = statusColors[statusValue] ?? [235, 235, 235];
          const [tr, tg, tb] = statusTextColors[statusValue] ?? [80, 80, 80];

          drawPdfBadge(statusText, cols.status.x, cols.status.w, [br, bg, bb], [tr, tg, tb], y);

          pdf.setDrawColor(240, 240, 240);
          pdf.line(marginLeft, y + rowHeight - 4.5, marginRight, y + rowHeight - 4.5);

          y += rowHeight;
        });

        checkNewPage(8);
        pdf.setFillColor(248, 249, 250);
        pdf.rect(marginLeft, y - 3.5, usableWidth, 7, "F");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text("TOTAL DO DIA", cols.fornec.x, y);
        pdf.text(formatCurrency(group.total), cols.valor.x + cols.valor.w, y, { align: "right" });
        pdf.setDrawColor(225, 225, 225);
        pdf.line(marginLeft, y + 2.5, marginRight, y + 2.5);
        y += 9;
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
            Refine a consulta por empresa, obra, fornecedor, status e período de vencimento.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_minmax(220px,1fr)_150px_170px_170px]">
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
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-start border-input bg-card px-3 text-left text-sm font-normal shadow-none"
                >
                  <span className="truncate">{getStatusFilterLabel(filterStatuses)}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                <Input
                  className="mb-2 h-8 text-sm"
                  placeholder="Digite para pesquisar"
                  value={statusQuery}
                  onChange={(event) => setStatusQuery(event.target.value)}
                />
                <div className="max-h-52 overflow-auto">
                  {filteredStatusOptions.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Nenhum status encontrado</div>
                  ) : (
                    filteredStatusOptions.map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => toggleFilterStatus(status.value)}
                      >
                        <span
                          className={cn(
                            'h-4 w-4 rounded border border-input',
                            filterStatuses.includes(status.value) && 'border-primary bg-primary'
                          )}
                        />
                        <span>{status.label}</span>
                      </button>
                    ))
                  )}
                </div>
                {filterStatuses.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 w-full"
                    onClick={() => setFilterStatuses([])}
                  >
                    Limpar status
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
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
        {filtrosAplicados.dashboardFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="font-medium text-muted-foreground">Filtro do dashboard:</span>
            <Badge variant="outline" className="rounded-md bg-card px-2 py-1 text-xs">
              {filtrosAplicados.dashboardFilter.label}
            </Badge>
          </div>
        ) : null}
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
                <TableHead className="w-32 bg-muted/50 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center">Tag</div>
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
                <TableHead className="w-[64px] bg-muted/50 text-center text-xs font-medium text-muted-foreground">Info</TableHead>
                <TableHead className="bg-muted/50 text-right text-xs font-medium text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
                    <TableCell>
                      <TagBadge tagId={conta.tag_id} nome={conta.tag_nome} cor={conta.tag_cor} />
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
                    <TableCell className="text-center">
                      <ObservationInfoTooltip
                        observation={conta.observacao || proxima?.observacao}
                        createdBy={conta.created_by}
                        createdAt={conta.created_at}
                        updatedBy={conta.updated_by}
                        updatedAt={conta.updated_at}
                        profileMap={profileMap}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {conta.origem !== 'CP' && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(conta)} title="Editar parcelas">
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
                    <TableHead onClick={() => handleParcelasSort('tag')} className="cursor-pointer select-none bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <div className="flex items-center">Tag<ParcelasSortIcon column="tag" /></div>
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
                    <TableHead className="w-[64px] bg-muted/50 text-center text-xs font-medium text-muted-foreground">Anexo</TableHead>
                    <TableHead className="w-[64px] bg-muted/50 text-center text-xs font-medium text-muted-foreground">Info</TableHead>
                    <TableHead className="bg-muted/50 text-right text-xs font-medium text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consultaParcelas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="py-8 text-center text-muted-foreground">
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
                      <TableCell>
                        <TagBadge tagId={parcela.conta.tag_id} nome={parcela.conta.tag_nome} cor={parcela.conta.tag_cor} />
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
                      <TableCell className="text-center">
                        <AnexoButton parcela={parcela} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ObservationInfoTooltip
                          observation={parcela.observacao || parcela.conta.observacao}
                          createdBy={parcela.created_by}
                          createdAt={parcela.created_at}
                          updatedBy={parcela.updated_by}
                          updatedAt={parcela.updated_at}
                          profileMap={profileMap}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {parcela.conta.origem !== 'CP' && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(parcela.conta)} title="Editar parcelas">
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
            <DialogTitle>{isExternalEditing ? 'Editar Parcelas' : editingId ? 'Editar' : 'Nova'} Conta a Pagar</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Emissão *</Label>
                <Input 
                  type="date"
                  value={form.data_emissao} 
                  onChange={(e) => setForm((p) => ({ ...p, data_emissao: e.target.value }))} 
                  disabled={isExternalEditing}
                />
              </div>
              <div>
                <Label>1º Vencimento *</Label>
                <Input 
                  type="date"
                  value={form.data_primeiro_vencimento} 
                  onChange={(e) => setForm((p) => ({ ...p, data_primeiro_vencimento: e.target.value }))} 
                  disabled={isExternalEditing}
                />
              </div>
            </div>

            <div className={cn(isExternalEditing && 'pointer-events-none opacity-70')}>
              <EmpresaSelect 
                value={form.empresa_id}
                onChange={(value) => setForm((p) => ({ ...p, empresa_id: value }))}
                label="Empresa *"
              />
            </div>

            {isExternalEditing ? (
              <div>
                <Label>Fornecedor *</Label>
                <Input value={editingConta?.fornecedor_nome || '-'} disabled />
              </div>
            ) : (
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
            )}

            <div className={cn(isExternalEditing && 'pointer-events-none opacity-70')}>
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

            <div>
              <Label>Tag</Label>
              <SearchableSelect
                value={form.tag_id}
                onChange={(value) => setForm((p) => ({ ...p, tag_id: value }))}
                options={tagOptions}
                placeholder="Digite para pesquisar a tag"
                emptyText="Nenhuma tag encontrada"
                inputClassName="h-10"
              />
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
                  disabled={isExternalEditing}
                />
              </div>
              <div>
                <Label>Quantidade de Parcelas *</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.quantidade_parcelas}
                  disabled={isExternalEditing}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, '');
                    setForm((prev) => ({ ...prev, quantidade_parcelas: value }));
                  }}
                  onBlur={() => {
                    const quantidade = Math.max(1, parseInt(form.quantidade_parcelas || '1', 10) || 1);
                    const nextForm = { ...form, quantidade_parcelas: String(quantidade) };
                    setForm(nextForm);
                    regenerateParcelas(nextForm);
                  }}
                  placeholder="Digite a quantidade"
                />
              </div>
            </div>

            <div>
              <Label>Observação</Label>
              <Input 
                value={form.observacao} 
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} 
                placeholder="Observações sobre a conta..."
                disabled={isExternalEditing}
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
                <Table className="min-w-[1040px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 bg-muted/50 text-xs font-medium text-muted-foreground">Parcela</TableHead>
                      <TableHead className="w-40 bg-muted/50 text-xs font-medium text-muted-foreground">Vencimento</TableHead>
                      <TableHead className="w-52 bg-muted/50 text-xs font-medium text-muted-foreground">Valor</TableHead>
                      <TableHead className="w-36 bg-muted/50 text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="w-40 bg-muted/50 text-xs font-medium text-muted-foreground">Pagamento</TableHead>
                      <TableHead className="min-w-44 bg-muted/50 text-xs font-medium text-muted-foreground">Obs.</TableHead>
                      <TableHead className="w-16 bg-muted/50 text-center text-xs font-medium text-muted-foreground">Anexo</TableHead>
                      <TableHead className="w-12 bg-muted/50 text-right text-xs font-medium text-muted-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasForm.map((parcela, index) => {
                      const parcelaComAnexos = editingConta?.parcelas.find((item) => item.id === parcela.id) || null;
                      return (
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
                            onValueChange={(value: ContaPagarParcela['status']) => {
                              if (value === 'paga') {
                                const parcelaExistente = editingConta?.parcelas.find((item) => item.id === parcela.id);
                                if (!parcelaExistente) {
                                  toast.error('Salve a parcela antes de baixar como paga.');
                                  return;
                                }
                                setPaymentParcelas([parcelaExistente]);
                                setPaymentDate(new Date().toISOString().split('T')[0]);
                                setPaymentContaId(contasCorrentes.find((conta) => conta.ativa)?.id || contasCorrentes[0]?.id || '');
                                return;
                              }
                              updateParcelaForm(index, { status: value });
                            }}
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
                        <TableCell className="text-center">
                          <AnexoButton parcela={parcelaComAnexos} disabled={!editingId} />
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
                      );
                    })}
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

      <Dialog open={Boolean(attachmentParcela)} onOpenChange={(open) => !open && setAttachmentParcela(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Anexos da Parcela {attachmentParcela?.numero_parcela || ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                Vencimento: {' '}
                <span className="font-medium text-foreground">
                  {attachmentParcela?.data_vencimento
                    ? new Date(`${attachmentParcela.data_vencimento}T00:00:00`).toLocaleDateString('pt-BR')
                    : '-'}
                </span>
              </p>
              <p>
                Valor: <span className="font-medium text-foreground">{formatCurrency(attachmentParcela?.valor_parcela || 0)}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={attachmentInputRef}
                type="file"
                className="max-w-sm"
                disabled={uploadingAttachment}
                onChange={(event) => handleAttachmentUpload(event.target.files?.[0])}
              />
              {uploadingAttachment && <span className="text-xs text-muted-foreground">Enviando...</span>}
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="w-28">Tamanho</TableHead>
                    <TableHead className="w-36">Data</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(attachmentParcela?.anexos || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Nenhum anexo nesta parcela
                      </TableCell>
                    </TableRow>
                  )}

                  {(attachmentParcela?.anexos || []).map((anexo) => (
                    <TableRow key={anexo.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex max-w-[320px] items-center gap-2">
                          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{anexo.nome_exibicao || anexo.nome_arquivo}</span>
                        </span>
                      </TableCell>
                      <TableCell>{formatFileSize(anexo.tamanho_bytes)}</TableCell>
                      <TableCell>{new Date(anexo.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleAttachmentPreview(anexo)} title="Pré-visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleAttachmentDownload(anexo)} title="Abrir anexo">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openRenameAnexo(anexo)} title="Renomear anexo">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleAttachmentDelete(anexo)} title="Excluir anexo">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentParcela(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renamingAnexo)} onOpenChange={(open) => !open && setRenamingAnexo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Anexo</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome do anexo</Label>
            <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingAnexo(null)}>Cancelar</Button>
            <Button onClick={handleAttachmentRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewAnexo)} onOpenChange={(open) => !open && setPreviewAnexo(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewAnexo?.anexo.nome_exibicao || previewAnexo?.anexo.nome_arquivo || 'Pré-visualização'}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] overflow-hidden rounded-md border bg-muted/20">
            {previewAnexo?.anexo.tipo_arquivo?.startsWith('image/') ? (
              <img src={previewAnexo.url} alt={previewAnexo.anexo.nome_arquivo} className="h-full w-full object-contain" />
            ) : (
              <iframe src={previewAnexo?.url} title="Pré-visualização do anexo" className="h-full w-full bg-white" />
            )}
          </div>
          <DialogFooter>
            {previewAnexo && (
              <Button variant="outline" onClick={() => handleAttachmentDownload(previewAnexo.anexo)}>
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            )}
            <Button onClick={() => setPreviewAnexo(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentParcelas.length > 0} onOpenChange={(open) => !open && setPaymentParcelas([])}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{paymentParcelas.length > 1 ? 'Baixar Parcelas' : 'Baixar Parcela'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground">Valor da baixa</p>
              <p className="text-lg font-semibold">
                {formatCurrency(paymentParcelas.reduce((sum, parcela) => sum + Number(parcela.valor_parcela || 0), 0))}
              </p>
              {paymentParcelas.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {paymentParcelas.length} parcelas selecionadas
                </p>
              )}
            </div>
            <div>
              <Label>Data de pagamento</Label>
              <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </div>
            <div>
              <Label>Conta corrente</Label>
              <Select value={paymentContaId} onValueChange={setPaymentContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contasCorrentes.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.banco} - Ag. {conta.agencia} - Conta {conta.numero_conta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentParcelas([])} disabled={savingPayment}>Cancelar</Button>
            <Button onClick={handleConfirmPayment} disabled={savingPayment || contasCorrentes.length === 0}>
              {savingPayment ? 'Baixando...' : 'Confirmar Baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="grid gap-4 text-sm md:grid-cols-5">
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
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium">{getStatusFilterLabel(filtrosAplicados.statuses)}</p>
                </div>
              </div>
            </div>

            {/* Tabela do Relatório */}
            <div ref={reportRef}>
              <div className="mb-3 rounded-md border bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Relatório</p>
                <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                  <span className="hidden sm:block" />
                  <div className="text-center">
                    <h3 className="text-base font-semibold uppercase leading-tight">Contas a Pagar</h3>
                    {reportEmpresaNome && (
                      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-foreground">
                        {reportEmpresaNome}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground sm:text-right">
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
                      <TableHead>Obs.</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportGroups.map((group) => [
                      <TableRow key={group.date}>
                        <TableCell colSpan={8} className="bg-muted/20 py-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{group.dateLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.parcels} parcela{group.parcels === 1 ? '' : 's'}
                            </p>
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
                            <TableCell className="max-w-[220px] whitespace-normal py-1 text-[11px] leading-tight text-muted-foreground">
                              {getReportObservacao(item)}
                            </TableCell>
                            <TableCell className="py-1">
                              <TagBadge tagId={item.conta.tag_id} nome={item.conta.tag_nome} cor={item.conta.tag_cor} compact />
                            </TableCell>
                            <TableCell className="text-center text-xs py-1">
                              {item.numero_parcela}/{item.conta.quantidade_parcelas}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs py-1">
                              {formatCurrency(item.valor_parcela)}
                            </TableCell>
                            <TableCell className="py-1">
                              <span className="inline-flex h-5 w-[86px] items-center justify-center rounded-md bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-700">
                                {String(item.status || '-').toUpperCase()}
                              </span>
                            </TableCell>
                          </TableRow>
                        )),
                        <TableRow key={`${group.date}-total`}>
                          <TableCell colSpan={6} className="bg-muted/30 py-2 text-right text-xs font-bold uppercase text-foreground">
                            Total do dia
                          </TableCell>
                          <TableCell className="bg-muted/30 py-2 text-right text-xs font-bold">
                            {formatCurrency(group.total)}
                          </TableCell>
                          <TableCell className="bg-muted/30 py-2" />
                        </TableRow>
                    ])}
                    
                    {/* Total Geral */}
                      <TableRow>
                        <TableCell colSpan={8} className="py-2">
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
