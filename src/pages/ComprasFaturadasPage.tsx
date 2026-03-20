import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  CompraFaturada,
  fetchComprasFaturadas,
  saveCompraFaturada,
  updateCompraFaturada,
  deleteCompraFaturada,
  fetchConfigRelatorio,
  formatCurrencyBR,
  formatDateBR,
} from '@/lib/comprasService';
import { exportFaturadasPDF, exportFaturadasXLSX } from '@/lib/comprasExport';
import { formatCPFCNPJ, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import type { Fornecedor } from '@/lib/comprasService';
import { fetchObras, Obra } from '@/lib/obrasService';
import { fetchEmpresas } from '@/lib/empresasService';

const emptyForm = {
  data: '',
  fornecedor: '',
  pedido: '',
  forma_pagamento: '',
  condicao_pagamento: '',
  vencimentos: '',
  cnpj_cpf: '',
  valor: '',
  obra: '',
  observacao: '',
};

function parseConditionDays(condicao: string): number[] {
  const matches = condicao.match(/\d+/g);
  if (!matches) return [];
  return matches
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

function buildVencimentosFromCondition(data: string, condicao: string): string {
  if (!data || !condicao.trim()) return '';
  const days = parseConditionDays(condicao);
  if (days.length === 0) return '';
  return days.map((day) => addDaysToIsoDate(data, day)).join(' | ');
}

function extractFirstDueDateIso(vencimentos: string): string | null {
  const match = vencimentos.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export default function ComprasFaturadasPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<CompraFaturada[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog, clearShowDialog] = useFormDraft('fat-showDialog', false);
  const [editingId, setEditingId, clearEditingId] = useFormDraft<string | null>('fat-editingId', null);

  const [dateFrom, setDateFrom] = useFormDraft('fat-dateFrom', '');
  const [dateTo, setDateTo] = useFormDraft('fat-dateTo', '');
  const [filterForn, setFilterForn] = useFormDraft('fat-filterForn', '');
  const [filterObra, setFilterObra] = useFormDraft('fat-filterObra', '');
  const [filterEmpresa, setFilterEmpresa] = useFormDraft('fat-filterEmpresa', '');
  const [observation, setObservation] = useFormDraft('fat-observation', '');

  const [form, setForm, clearForm] = useFormDraft('fat-form', emptyForm);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });

  const load = useCallback(async () => {
    try {
      const [compras, obrasData, empresas] = await Promise.all([
        fetchComprasFaturadas(),
        fetchObras(),
        fetchEmpresas(),
      ]);

      setItems(compras);
      setObras(obrasData);

      if (filterEmpresa) {
        const empresa = empresas.find((e) => e.id === filterEmpresa);
        if (empresa) {
          setEmpresaLogos({
            logo_esquerda: empresa.logo_esquerda,
            logo_direita: empresa.logo_direita,
          });
        } else {
          setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
        }
      } else {
        setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterEmpresa]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    if (dateFrom && i.data < dateFrom) return false;
    if (dateTo && i.data > dateTo) return false;
    if (filterForn && !i.fornecedor.toLowerCase().includes(filterForn.toLowerCase())) return false;
    if (filterObra && !(i.obra || '').toLowerCase().includes(filterObra.toLowerCase())) return false;

    if (filterEmpresa) {
      const allowedObras = new Set(
        obras.filter((obra) => obra.empresa_id === filterEmpresa).map((obra) => obra.nome.toLowerCase())
      );

      if (!i.obra || !allowedObras.has(i.obra.toLowerCase())) return false;
    }

    return true;
  });

  function resetDialogDraft() {
    clearEditingId();
    clearForm();
    clearShowDialog();
  }

  function openNew() {
    clearEditingId();
    clearForm();
    setShowDialog(true);
  }

  function openEdit(item: CompraFaturada) {
    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      forma_pagamento: item.forma_pagamento || '',
      condicao_pagamento: item.condicao_pagamento || '',
      vencimentos: item.vencimentos || (item.data_liquidacao ? formatDateBR(item.data_liquidacao) : ''),
      cnpj_cpf: item.cnpj_cpf || '',
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      obra: item.obra || '',
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.data || !form.fornecedor || !form.valor) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      const payload = {
        data: form.data,
        fornecedor: form.fornecedor,
        pedido: form.pedido || null,
        forma_pagamento: form.forma_pagamento || null,
        condicao_pagamento: form.condicao_pagamento || null,
        vencimentos: form.vencimentos || null,
        data_liquidacao: extractFirstDueDateIso(form.vencimentos),
        cnpj_cpf: form.cnpj_cpf || null,
        valor: parseCurrencyInput(form.valor),
        obra: form.obra || null,
        observacao: form.observacao || null,
        created_by: user.id,
      };

      if (editingId) {
        await updateCompraFaturada(editingId, payload);
        toast.success('Registro atualizado');
      } else {
        await saveCompraFaturada(payload as any);
        toast.success('Registro cadastrado');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return;

    try {
      await deleteCompraFaturada(id);
      load();
      toast.success('Excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleExportPDF() {
    let config = await fetchConfigRelatorio();

    if (filterEmpresa && config) {
      const empresas = await fetchEmpresas();
      const empresa = empresas.find((e) => e.id === filterEmpresa);

      if (empresa) {
        config = {
          ...config,
          logo_esquerda: empresa.logo_esquerda || config.logo_esquerda || null,
          logo_direita: empresa.logo_direita || config.logo_direita || null,
          cor_cabecalho: empresa.cor_cabecalho || config.cor_cabecalho || '#6b7280',
        };
      }
    } else if (config) {
      config = {
        ...config,
        cor_cabecalho: '#6b7280',
      };
    }

    exportFaturadasPDF(filtered, config, observation);
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      cnpj_cpf: f.cnpj_cpf || prev.cnpj_cpf,
    }));
  }

  function handleConditionChange(value: string) {
    setForm((prev: typeof emptyForm) => {
      const autoVencimentos = buildVencimentosFromCondition(prev.data, value);
      return {
        ...prev,
        condicao_pagamento: value,
        vencimentos: autoVencimentos || prev.vencimentos,
      };
    });
  }

  function handleDateChange(value: string) {
    setForm((prev: typeof emptyForm) => {
      const autoVencimentos = buildVencimentosFromCondition(value, prev.condicao_pagamento);
      return {
        ...prev,
        data: value,
        vencimentos: autoVencimentos || prev.vencimentos,
      };
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Compras Faturadas</h2>
        <div className="flex gap-2">
          {canExport('compras_faturadas') && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportFaturadasXLSX(filtered, observation)}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}

          {canCreate('compras_faturadas') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Input
            value={filterForn}
            onChange={(e) => setFilterForn(e.target.value)}
            placeholder="Filtrar..."
            className="w-40"
          />
        </div>

        <div>
          <Label className="text-xs">Obra</Label>
          <Input
            value={filterObra}
            onChange={(e) => setFilterObra(e.target.value)}
            placeholder="Filtrar..."
            className="w-40"
          />
        </div>

        <div className="w-52">
          <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Empresa" allowAll />
        </div>

        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        <div className="min-w-[200px] flex-1">
          <Label className="text-xs">Observação do relatório</Label>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={1}
            placeholder="Observação..."
          />
        </div>
      </div>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Forma Pgto</TableHead>
              <TableHead>Condição</TableHead>
              <TableHead>Vencimentos</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  Nenhum registro
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{formatDateBR(i.data)}</TableCell>
                <TableCell>{i.fornecedor}</TableCell>
                <TableCell>{i.pedido}</TableCell>
                <TableCell>{i.forma_pagamento}</TableCell>
                <TableCell>{i.condicao_pagamento || ''}</TableCell>
                <TableCell className="max-w-[220px] whitespace-pre-wrap">
                  {i.vencimentos || (i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '')}
                </TableCell>
                <TableCell>{i.cnpj_cpf}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(i.valor)}</TableCell>
                <TableCell>{i.obra}</TableCell>
                <TableCell className="max-w-[120px] truncate">{i.observacao}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('compras_faturadas') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('compras_faturadas') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-right font-bold">
        Total: {formatCurrencyBR(filtered.reduce((s, i) => s + i.valor, 0))}
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetDialogDraft();
            return;
          }
          setShowDialog(true);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Compra Faturada</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => handleDateChange(e.target.value)} />
            </div>

            <FornecedorSelect
              value={form.fornecedor}
              onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, fornecedor: v }))}
              onFornecedorSelect={handleFornecedorSelect}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Pedido</Label>
                <Input
                  value={form.pedido}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, pedido: e.target.value }))}
                />
              </div>

              <div>
                <Label>Forma de Pagamento</Label>
                <Input
                  value={form.forma_pagamento}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, forma_pagamento: e.target.value }))}
                  placeholder="Ex: boleto, TED, pix, transferência"
                />
              </div>
            </div>

            <div>
              <Label>Condição de Pagamento</Label>
              <Input
                value={form.condicao_pagamento}
                onChange={(e) => handleConditionChange(e.target.value)}
                placeholder="Ex: 30/60/90, 28/35, entrada + 2x, 7/14/21"
              />
            </div>

            <div>
              <Label>Vencimentos</Label>
              <Textarea
                value={form.vencimentos}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, vencimentos: e.target.value }))}
                rows={3}
                placeholder="Ex: 19/04/2026 | 19/05/2026 | 18/06/2026"
              />
            </div>

            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={form.cnpj_cpf}
                onChange={(e) =>
                  setForm((p: typeof emptyForm) => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))
                }
                maxLength={18}
              />
            </div>

            <div>
              <Label>Valor *</Label>
              <Input
                value={form.valor}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, valor: formatCurrencyInput(e.target.value) }))}
                placeholder="R$ 0,00"
              />
            </div>

            <div>
              <Label>Obra</Label>
              <ObraSelect
                value={form.obra}
                onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, obra: v }))}
              />
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialogDraft}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
