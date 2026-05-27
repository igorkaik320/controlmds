import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Eye, Calendar as CalendarIcon, Building, CheckSquare, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  saveContaPagar, 
  updateContaPagar, 
  deleteContaPagar,
  saveParcelas,
  gerarParcelas,
  updateParcelasStatus,
  ContaPagarComParcelas,
  ContaPagarParcela
} from '@/lib/contasPagarService';
import { fetchEmpresas } from '@/lib/empresasService';
import { fetchFornecedores, Fornecedor } from '@/lib/comprasService';
import { fetchObras, fetchObrasPorEmpresa, Obra } from '@/lib/obrasService';
import ContasPagarParcelasDialog from '@/components/ContasPagarParcelasDialog';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';

interface Empresa {
  id: string;
  nome: string;
}

export default function ContasPagarPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<ContaPagarComParcelas[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showParcelasDialog, setShowParcelasDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contaParcelas, setContaParcelas] = useState<ContaPagarComParcelas | null>(null);
  const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Ordenação
  type SortKey = 'numero' | 'data_emissao' | 'empresa' | 'fornecedor' | 'valor_total' | 'parcela' | 'vencimento' | 'status' | 'observacao';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
  
  // Filtros
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [filterDataEmissao, setFilterDataEmissao] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    empresa: '',
    fornecedor: '',
    startDate: null as Date | undefined,
    endDate: null as Date | undefined,
  });

  const [form, setForm] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_primeiro_vencimento: new Date().toISOString().split('T')[0],
    empresa_id: '',
    fornecedor_id: '',
    obra_id: '',
    valor_total: '',
    quantidade_parcelas: '1',
    observacao: '',
  });

  const load = useCallback(async () => {
    try {
      const [contasData, empresasData, fornecedoresData] = await Promise.all([
        fetchContasPagar(),
        fetchEmpresas().catch(() => []),
        fetchFornecedores().catch(() => []),
      ]);
      setItems(contasData);
      setEmpresas(empresasData);
      setFornecedores(fornecedoresData);
    } catch (e: any) {
      toast.error('Erro ao carregar dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form.empresa_id) {
      fetchObrasPorEmpresa(form.empresa_id).then(setObras).catch(() => {});
    } else {
      fetchObras().then(setObras).catch(() => {});
    }
  }, [form.empresa_id]);

  const filtered = items.filter((i) => {
    if (!filtrosAplicados.empresa && !filtrosAplicados.fornecedor && !filtrosAplicados.startDate && !filtrosAplicados.endDate) return true;
    if (filtrosAplicados.empresa && i.empresa_id !== filtrosAplicados.empresa) return false;
    if (filtrosAplicados.fornecedor && i.fornecedor_id !== filtrosAplicados.fornecedor) return false;
    if (filtrosAplicados.startDate || filtrosAplicados.endDate) {
      const venc = i.parcelas
        .map((p) => p.data_vencimento)
        .filter(Boolean)
        .sort()[0];
      if (!venc) return false;
      const vencDate = new Date(venc + 'T00:00:00');
      if (filtrosAplicados.startDate && vencDate < filtrosAplicados.startDate) return false;
      if (filtrosAplicados.endDate && vencDate > filtrosAplicados.endDate) return false;
    }
    return true;
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
      fornecedor: filterFornecedor,
      startDate: startDate,
      endDate: endDate,
    });
  }

  function openNew() {
    setEditingId(null);
    setForm({
      data_emissao: new Date().toISOString().split('T')[0],
      data_primeiro_vencimento: new Date().toISOString().split('T')[0],
      empresa_id: '',
      fornecedor_id: '',
      obra_id: '',
      valor_total: '',
      quantidade_parcelas: '1',
      observacao: '',
    });
    setShowDialog(true);
  }

  function openEdit(item: ContaPagarComParcelas) {
    setEditingId(item.id);
    setForm({
      data_emissao: item.data_emissao,
      data_primeiro_vencimento: item.data_primeiro_vencimento || item.data_emissao,
      empresa_id: item.empresa_id || '',
      fornecedor_id: item.fornecedor_id || '',
      obra_id: item.obra_id || '',
      valor_total: formatCurrencyInput(formatCurrencyReal(item.valor_total)),
      quantidade_parcelas: item.quantidade_parcelas.toString(),
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  function openParcelas(item: ContaPagarComParcelas) {
    setContaParcelas(item);
    setShowParcelasDialog(true);
  }

  async function handleParcelasSave() {
    await load();
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev) => ({ ...prev, fornecedor_id: f.id }));
  }

  async function handleSubmit() {
    if (!user || !form.valor_total || !form.empresa_id || !form.fornecedor_id) {
      toast.error('Preencha todos os campos obrigatÃ³rios');
      return;
    }

    try {
      const empresa = empresas.find(e => e.id === form.empresa_id);
      const fornecedor = fornecedores.find(f => f.id === form.fornecedor_id);
      
      const obra = obras.find(o => o.id === form.obra_id);
      const payload = {
        data_emissao: form.data_emissao,
        data_primeiro_vencimento: form.data_primeiro_vencimento || null,
        empresa_id: form.empresa_id,
        empresa_nome: empresa?.nome || '',
        fornecedor_id: form.fornecedor_id,
        fornecedor_nome: fornecedor?.nome_fornecedor || '',
        obra_id: form.obra_id || null,
        obra_nome: obra?.nome || null,
        valor_total: parseCurrencyInput(form.valor_total),
        quantidade_parcelas: parseInt(form.quantidade_parcelas),
        observacao: form.observacao.trim() || null,
        status: 'aberto' as const,
        created_by: user.id,
      };

      if (editingId) {
        await updateContaPagar(editingId, payload, user.id);
        toast.success('Conta atualizada');
      } else {
        const savedConta = await saveContaPagar(payload, user.id);
        
        const parcelas = gerarParcelas(
          savedConta.id,
          payload.valor_total,
          payload.quantidade_parcelas,
          form.data_primeiro_vencimento || form.data_emissao,
          user.id
        );
        await saveParcelas(parcelas, user.id);
        
        toast.success('Conta cadastrada com parcelas geradas');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

 
  async function handleDelete(id: string) {
    if (!confirm('Excluir esta conta e todas as parcelas?')) return;
    try {
      await deleteContaPagar(id, user?.id || '');
      toast.success('Conta excluÃ­da');
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

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      aberto: { label: 'Aberto', variant: 'default' },
      pago: { label: 'Pago', variant: 'secondary' },
      cancelado: { label: 'Cancelado', variant: 'destructive' },
    };
    const config = variants[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function getParcelaStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      aberta: 'default',
      paga: 'secondary',
      vencida: 'destructive',
      cancelada: 'outline',
    };
    return map[status] || 'default';
  }

  // Agrupar parcelas por data para o relatÃ³rio
  const reportGroups = useMemo(() => {
    const groups: Record<string, { date: string; dateLabel: string; parcels: number; total: number; items: any[] }> = {};
    
    filtered.forEach(conta => {
      conta.parcelas.forEach(parcela => {
        const date = parcela.data_vencimento || '0000-00-00';

        // Respeita o filtro de vencimento também nas parcelas
        if (filtrosAplicados.startDate || filtrosAplicados.endDate) {
          if (!parcela.data_vencimento) return;
          const vencDate = new Date(parcela.data_vencimento + 'T00:00:00');
          if (filtrosAplicados.startDate && vencDate < filtrosAplicados.startDate) return;
          if (filtrosAplicados.endDate && vencDate > filtrosAplicados.endDate) return;
        }

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
        groups[date].items.push({
          ...parcela,
          conta
        });
      });
    });
    
    const result = Object.values(groups);
    // Ordenar itens de cada dia em ordem crescente de valor (depois de adicionar todas as parcelas)
    result.forEach(group => {
      group.items.sort((a, b) => a.valor_parcela - b.valor_parcela);
    });
    // Retornar grupos ordenados por data (mesma lÃ³gica do FaturadosParcelasPage)
    return result.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [filtered]);

  const reportTotal = useMemo(() => {
    return reportGroups.reduce((sum, group) => sum + group.total, 0);
  }, [reportGroups]);

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

      // â”€â”€ CabeÃ§alho â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("RELATÃ“RIO", marginLeft, y);
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

      // Linha separadora do cabeÃ§alho
      pdf.setDrawColor(200, 200, 200);
      pdf.line(marginLeft, y, marginRight, y);
      y += 5;

      // â”€â”€ CabeÃ§alho da tabela â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const cols = {
        venc:      { x: marginLeft,      w: 22 },
        empresa:   { x: marginLeft + 22, w: 28 },
        fornec:    { x: marginLeft + 50, w: 52 },
        conta:     { x: marginLeft + 102, w: 18 },
        parcela:   { x: marginLeft + 120, w: 16 },
        valor:     { x: marginLeft + 136, w: 28 },
        status:    { x: marginLeft + 164, w: 22 },
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
        pdf.text("Conta", cols.conta.x, y);
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

        // Nome da data (sem dia da semana para economizar espaÃ§o)
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
          const fornecNome: string = (item.conta.fornecedor_nome || "-").substring(0, 26);
          const contaId = `#${item.conta.id.slice(-6).toUpperCase()}`;
          const parcelaText = `${item.numero_parcela}/${item.conta.quantidade_parcelas}`;
          const valorText = formatCurrency(item.valor_parcela);
          const statusText: string = (item.status || "-");

          pdf.text(vencText, cols.venc.x, y);
          pdf.text(empresaNome, cols.empresa.x, y);
          pdf.text(fornecNome, cols.fornec.x, y);
          pdf.text(contaId, cols.conta.x, y);
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

        y += 2; // espaÃ§o entre grupos
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

  // Busca textual por fornecedor (filtro live)
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [dateFromStr, setDateFromStr] = useState('');
  const [dateToStr, setDateToStr] = useState('');

  const visiveis = useMemo(() => {
    const term = searchFornecedor.trim().toLowerCase();
    const from = dateFromStr ? new Date(dateFromStr + 'T00:00:00') : null;
    const to = dateToStr ? new Date(dateToStr + 'T23:59:59') : null;
    return sortedFiltered.filter((c) => {
      if (term && !(c.fornecedor_nome || '').toLowerCase().includes(term)) return false;
      if (from || to) {
        const parcelas = [...c.parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
        const proxima = parcelas.find((p) => p.status !== 'paga') || parcelas[0];
        if (!proxima?.data_vencimento) return false;
        const dt = new Date(proxima.data_vencimento + 'T00:00:00');
        if (from && dt < from) return false;
        if (to && dt > to) return false;
      }
      return true;
    });
  }, [sortedFiltered, searchFornecedor, dateFromStr, dateToStr]);

  return (
    <div className="space-y-4">
      {/* Filtros superiores */}
      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-[1fr,180px,180px]">
          <div>
            <Label className="text-sm">Pesquisar fornecedor</Label>
            <Input
              placeholder="Digite para pesquisar"
              value={searchFornecedor}
              onChange={(e) => setSearchFornecedor(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm">Data inicial</Label>
            <Input type="date" value={dateFromStr} onChange={(e) => setDateFromStr(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Data final</Label>
            <Input type="date" value={dateToStr} onChange={(e) => setDateToStr(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Card da tabela */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">Contas a Pagar</h2>
          <div className="flex items-center gap-2">
            {selectedParcelas.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedParcelas.size} selecionada(s)
                </span>
                <Select onValueChange={handleBulkStatusChange}>
                  <SelectTrigger className="w-[160px] h-9">
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
            <Button variant="outline" size="sm" onClick={() => setShowReport(true)} className="gap-2">
              <FileText className="h-4 w-4" />
              Relatório
            </Button>
            {canCreate('contas_pagar') && (
              <Button size="sm" onClick={openNew} className="gap-1">
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
                <TableHead onClick={() => handleSort('fornecedor')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Fornecedor<SortIcon column="fornecedor" /></div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center">Descrição</div>
                </TableHead>
                <TableHead onClick={() => handleSort('parcela')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Parcelas<SortIcon column="parcela" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('valor_total')} className="cursor-pointer select-none hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">Valor<SortIcon column="valor_total" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('vencimento')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Próximo vencimento<SortIcon column="vencimento" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('status')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Status<SortIcon column="status" /></div>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              )}

              {visiveis.map((conta) => {
                const parcelas = [...conta.parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
                const proxima = parcelas.find((p) => p.status !== 'paga') || parcelas[0];
                const pagas = parcelas.filter((p) => p.status === 'paga').length;
                const total = conta.quantidade_parcelas || parcelas.length;
                const descricao = conta.observacao || proxima?.observacao || conta.obra_nome || '-';

                return (
                  <TableRow key={conta.id}>
                    <TableCell className="font-medium">{conta.fornecedor_nome || '-'}</TableCell>
                    <TableCell className="text-muted-foreground uppercase text-sm">
                      {descricao}
                    </TableCell>
                    <TableCell>{pagas}/{total}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
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
                          <SelectTrigger className="h-8 w-[120px]">
                            <Badge variant={getParcelaStatusVariant(proxima.status)} className="capitalize text-xs">
                              {proxima.status}
                            </Badge>
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
                        <Button variant="ghost" size="icon" onClick={() => openParcelas(conta)} title="Ver parcelas">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit('contas_pagar') && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(conta)} title="Editar">
                            <Pencil className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {canDelete('contas_pagar') && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(conta.id)} title="Excluir">
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
      </div>

      {/* DiÃ¡logo de Nova/Editar Conta */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Conta a Pagar</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de EmissÃ£o *</Label>
                <Input 
                  type="date"
                  value={form.data_emissao} 
                  onChange={(e) => setForm((p) => ({ ...p, data_emissao: e.target.value }))} 
                />
              </div>
              <div>
                <Label>1Âº Vencimento *</Label>
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
              <Select value={form.obra_id} onValueChange={(v) => setForm((p) => ({ ...p, obra_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Total *</Label>
                <Input 
                  type="text"
                  value={form.valor_total}
                  onChange={(e) => setForm((p) => ({ ...p, valor_total: formatCurrencyInput(e.target.value) }))}
                  placeholder="R$ 0,00"
                  disabled={editingId && items.find(item => item.id === editingId)?.parcelas.length > 0}
                  className={editingId && items.find(item => item.id === editingId)?.parcelas.length > 0 ? "bg-muted" : ""}
                />
                {editingId && items.find(item => item.id === editingId)?.parcelas.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Para alterar o valor, use a ediÃ§Ã£o de parcelas
                  </p>
                )}
              </div>
              <div>
                <Label>Quantidade de Parcelas *</Label>
                <Select 
                  value={form.quantidade_parcelas} 
                  onValueChange={(value) => setForm((p) => ({ ...p, quantidade_parcelas: value }))}
                  disabled={editingId && items.find(item => item.id === editingId)?.parcelas.length > 0}
                >
                  <SelectTrigger className={editingId && items.find(item => item.id === editingId)?.parcelas.length > 0 ? "bg-muted" : ""}>
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
                {editingId && items.find(item => item.id === editingId)?.parcelas.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Para alterar as parcelas, use a ediÃ§Ã£o de parcelas
                  </p>
                )}
              </div>
            </div>

            {/* Preview das parcelas */}
            {!editingId && form.valor_total && parseInt(form.quantidade_parcelas) > 0 && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground">PrÃ©via das parcelas:</p>
                {Array.from({ length: parseInt(form.quantidade_parcelas) }, (_, i) => {
                  const val = parseCurrencyInput(form.valor_total) / parseInt(form.quantidade_parcelas);
                  const dt = new Date(`${form.data_primeiro_vencimento || form.data_emissao}T00:00:00`);
                  dt.setMonth(dt.getMonth() + i);
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span>Parcela {i + 1}: {dt.toLocaleDateString('pt-BR')}</span>
                      <span className="font-mono">{formatCurrency(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <Label>ObservaÃ§Ã£o</Label>
              <Input 
                value={form.observacao} 
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} 
                placeholder="ObservaÃ§Ãµes sobre a conta..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingId ? 'Atualizar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DiÃ¡logo de EdiÃ§Ã£o de Parcelas */}
      <ContasPagarParcelasDialog
        open={showParcelasDialog}
        onClose={() => setShowParcelasDialog(false)}
        contaPagarId={contaParcelas?.id || ''}
        parcelas={contaParcelas?.parcelas || []}
        onSave={handleParcelasSave}
        userId={user?.id || ''}
      />

      {/* DiÃ¡logo de RelatÃ³rio */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>RelatÃ³rio de Contas a Pagar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumo dos Filtros */}
            <div className="rounded-md border bg-muted/30 p-4">
              <h4 className="font-semibold mb-2">Filtros Aplicados:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">
                    {filtrosAplicados.empresa 
                      ? empresas.find(e => e.id === filtrosAplicados.empresa)?.nome || 'NÃ£o encontrada'
                      : 'Todas'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span>
                  <p className="font-medium">
                    {filtrosAplicados.fornecedor
                      ? fornecedores.find(f => f.id === filtrosAplicados.fornecedor)?.nome_fornecedor || 'NÃ£o encontrado'
                      : 'Todos'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">PerÃ­odo:</span>
                  <p className="font-medium">
                    {filtrosAplicados.startDate || filtrosAplicados.endDate
                      ? `${filtrosAplicados.startDate ? format(filtrosAplicados.startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'InÃ­cio'} a ${filtrosAplicados.endDate ? format(filtrosAplicados.endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Fim'}`
                      : 'Todo o perÃ­odo'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela do RelatÃ³rio */}
            <div ref={reportRef}>
              <div className="mb-3 rounded-md border bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RelatÃ³rio</p>
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
                      <TableHead>Conta</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportGroups.map((group) => [
                      // Header do grupo (data e total do dia)
                      <TableRow key={group.date}>
                          <TableCell colSpan={7} className="py-2">
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
                            <TableCell className="font-mono text-xs py-1">
                              #{item.conta.id.slice(-6).toUpperCase()}
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
                        <TableCell colSpan={7} className="py-2">
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
