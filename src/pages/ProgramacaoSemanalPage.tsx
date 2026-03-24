import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefreshFlash } from '@/hooks/useDataRefreshFlash';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet, Search, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  ProgramacaoSemanal,
  fetchProgramacaoSemanal,
  saveProgramacaoSemanal,
  updateProgramacaoSemanal,
  deleteProgramacaoSemanal,
  fetchConfigRelatorio,
  formatCurrencyBR,
  formatDateBR,
} from '@/lib/comprasService';
import { exportProgramacaoSemanalPDF, exportProgramacaoSemanalXLSX } from '@/lib/comprasExport';
import { formatCPFCNPJ, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import ResponsavelSelect from '@/components/compras/ResponsavelSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import type { Fornecedor } from '@/lib/comprasService';
import { fetchObras, Obra } from '@/lib/obrasService';
import { fetchEmpresas } from '@/lib/empresasService';
import { fetchProfiles } from '@/lib/cashRegister';
import AuditInfo from '@/components/AuditInfo';
import { useDataRefreshFlash } from '@/hooks/useDataRefreshFlash';

const emptyForm = {
  data: '',
  fornecedor: '',
  pedido: '',
  banco: '',
  agencia: '',
  conta: '',
  cnpj_cpf: '',
  valor: '',
  obra: '',
  observacao: '',
  responsavel: '',
};

export default function ProgramacaoSemanalPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<ProgramacaoSemanal[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const [draftDateFrom, setDraftDateFrom] = useFormDraft('ps-dateFrom', '');
  const [draftDateTo, setDraftDateTo] = useFormDraft('ps-dateTo', '');
  const [draftFilterForn, setDraftFilterForn] = useFormDraft('ps-filterForn', '');
  const [draftFilterObra, setDraftFilterObra] = useFormDraft('ps-filterObra', '');
  const [draftFilterResp, setDraftFilterResp] = useFormDraft('ps-filterResp', '');
  const [draftFilterEmpresa, setDraftFilterEmpresa] = useFormDraft('ps-filterEmpresa', '');
  const [observation, setObservation] = useFormDraft('ps-observation', '');

  const [dateFrom, setDateFrom] = useState(draftDateFrom);
  const [dateTo, setDateTo] = useState(draftDateTo);
  const [filterForn, setFilterForn] = useState(draftFilterForn);
  const [filterObra, setFilterObra] = useState(draftFilterObra);
  const [filterResp, setFilterResp] = useState(draftFilterResp);
  const [filterEmpresa, setFilterEmpresa] = useState(draftFilterEmpresa);

  const [form, setForm] = useState(emptyForm);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });

  const load = useCallback(async () => {
    try {
      const [programacao, obrasData, empresas, profiles] = await Promise.all([
        fetchProgramacaoSemanal(),
        fetchObras(),
        fetchEmpresas(),
        fetchProfiles(),
      ]);

      setItems(programacao);
      setObras(obrasData);
      setProfileMap(profiles);

      if (draftFilterEmpresa) {
        const empresa = empresas.find((e) => e.id === draftFilterEmpresa);
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
  }, [draftFilterEmpresa]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    if (draftDateFrom && i.data < draftDateFrom) return false;
    if (draftDateTo && i.data > draftDateTo) return false;
    if (draftFilterForn && !i.fornecedor.toLowerCase().includes(draftFilterForn.toLowerCase())) return false;
    if (draftFilterObra && !(i.obra || '').toLowerCase().includes(draftFilterObra.toLowerCase())) return false;
    if (draftFilterResp && !(i.responsavel || '').toLowerCase().includes(draftFilterResp.toLowerCase())) return false;

    if (draftFilterEmpresa) {
      const allowedObras = new Set(
        obras.filter((obra) => obra.empresa_id === draftFilterEmpresa).map((obra) => obra.nome.toLowerCase())
      );

      if (!i.obra || !allowedObras.has(i.obra.toLowerCase())) return false;
    }

    return true;
  });

  function handleConsultar() {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftFilterForn(filterForn);
    setDraftFilterObra(filterObra);
    setDraftFilterResp(filterResp);
    setDraftFilterEmpresa(filterEmpresa);
    flashAfterUpdate();
  }

  function handleLimpar() {
    setDateFrom('');
    setDateTo('');
    setFilterForn('');
    setFilterObra('');
    setFilterResp('');
    setFilterEmpresa('');

    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftFilterForn('');
    setDraftFilterObra('');
    setDraftFilterResp('');
    setDraftFilterEmpresa('');
    flashAfterUpdate();
  }

  function resetDialogDraft() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: ProgramacaoSemanal) {
    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      cnpj_cpf: item.cnpj_cpf || '',
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      obra: item.obra || '',
      observacao: item.observacao || '',
      responsavel: item.responsavel || '',
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
        banco: form.banco || null,
        agencia: form.agencia || null,
        conta: form.conta || null,
        cnpj_cpf: form.cnpj_cpf || null,
        valor: parseCurrencyInput(form.valor),
        obra: form.obra || null,
        observacao: form.observacao || null,
        responsavel: form.responsavel || null,
      };

      if (editingId) {
        await updateProgramacaoSemanal(editingId, { ...payload, updated_by: user.id });
        toast.success('Registro atualizado');
      } else {
        await saveProgramacaoSemanal({ ...payload, created_by: user.id } as any);
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
      await deleteProgramacaoSemanal(id);
      load();
      toast.success('Excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleExportPDF() {
    let config = await fetchConfigRelatorio();

    if (draftFilterEmpresa && config) {
      const empresas = await fetchEmpresas();
      const empresa = empresas.find((e) => e.id === draftFilterEmpresa);

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

    exportProgramacaoSemanalPDF(filtered, config, observation);
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      banco: f.banco || prev.banco,
      agencia: f.agencia || prev.agencia,
      conta: f.conta || prev.conta,
      cnpj_cpf: f.cnpj_cpf || prev.cnpj_cpf,
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Programação Semanal</h2>
          <p className="text-sm text-muted-foreground">
            Controle e acompanhamento da programação semanal
          </p>
        </div>

        <div className="flex gap-2">
          {canExport('programacao_semanal') && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => exportProgramacaoSemanalXLSX(filtered, observation)}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}

          {canCreate('programacao_semanal') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label className="text-xs">Fornecedor</Label>
            <Input
              value={filterForn}
              onChange={(e) => setFilterForn(e.target.value)}
              placeholder="Filtrar..."
            />
          </div>

          <div>
            <Label className="text-xs">Obra</Label>
            <Input
              value={filterObra}
              onChange={(e) => setFilterObra(e.target.value)}
              placeholder="Filtrar..."
            />
          </div>

          <div>
            <Label className="text-xs">Responsável</Label>
            <Input
              value={filterResp}
              onChange={(e) => setFilterResp(e.target.value)}
              placeholder="Filtrar..."
            />
          </div>

          <div>
            <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Empresa" allowAll />
          </div>

          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observação do relatório</Label>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
            placeholder="Observação..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={handleConsultar}>
            <Search className="mr-1 h-4 w-4" />
            Consultar
          </Button>

          <Button variant="outline" size="sm" onClick={handleLimpar}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="overflow-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Obs.</TableHead>
              <TableHead className="w-[92px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  Nenhum registro
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{formatDateBR(i.data)}</TableCell>
                <TableCell className="max-w-[240px]">
                  <div className="truncate" title={i.fornecedor}>
                    {i.fornecedor}
                  </div>
                </TableCell>
                <TableCell>{i.pedido || '—'}</TableCell>
                <TableCell>{i.banco || '—'}</TableCell>
                <TableCell>{i.agencia || '—'}</TableCell>
                <TableCell>{i.conta || '—'}</TableCell>
                <TableCell className="max-w-[160px] break-words">{i.cnpj_cpf || '—'}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrencyBR(i.valor)}</TableCell>
                <TableCell className="max-w-[200px]">
                  <div className="truncate" title={i.obra || '—'}>
                    {i.obra || '—'}
                  </div>
                </TableCell>
                <TableCell className="max-w-[140px]">
                  <div className="truncate" title={i.responsavel || '—'}>
                    {i.responsavel || '—'}
                  </div>
                </TableCell>
                <TableCell className="max-w-[190px]">
                  <div className="truncate" title={i.observacao || '—'}>
                    {i.observacao || '—'}
                  </div>
                  <div className="mt-1">
                    <AuditInfo
                      createdBy={i.created_by}
                      createdAt={i.created_at}
                      updatedBy={i.updated_by}
                      updatedAt={i.updated_at}
                      profileMap={profileMap}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canEdit('programacao_semanal') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {canDelete('programacao_semanal') && (
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
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Programação Semanal</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, data: e.target.value }))}
              />
            </div>

            <FornecedorSelect
              value={form.fornecedor}
              onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, fornecedor: v }))}
              onFornecedorSelect={handleFornecedorSelect}
            />

            <div>
              <Label>Pedido</Label>
              <Input
                value={form.pedido}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, pedido: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Banco</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, banco: e.target.value }))}
                />
              </div>

              <div>
                <Label>Agência</Label>
                <Input
                  value={form.agencia}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, agencia: e.target.value }))}
                />
              </div>

              <div>
                <Label>Conta</Label>
                <Input
                  value={form.conta}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, conta: e.target.value }))}
                />
              </div>
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
                onChange={(e) =>
                  setForm((p: typeof emptyForm) => ({ ...p, valor: formatCurrencyInput(e.target.value) }))
                }
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
              <ResponsavelSelect
                value={form.responsavel}
                onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, responsavel: v }))}
                allowAll={false}
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
