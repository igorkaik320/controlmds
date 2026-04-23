import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Upload, Download, Eye, Wrench } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  fetchEquipamentos,
  saveEquipamento,
  updateEquipamento,
  deleteEquipamento,
  fetchSetores,
  fetchManutencoes,
  SITUACOES_EQUIPAMENTO,
  type Equipamento,
  type Manutencao,
  type SituacaoEquipamento,
} from '@/lib/equipamentosService';
import { fetchObras, type Obra } from '@/lib/obrasService';
import { toast } from 'sonner';
import AuditInfo from '@/components/AuditInfo';
import { useProfileMap } from '@/hooks/useProfileMap';
import * as XLSX from 'xlsx';

const emptyForm = {
  nome: '',
  marca: '',
  modelo: '',
  setor_id: '',
  n_patrimonio: '',
  n_serie: '',
  nota_fiscal: '',
  localizacao_obra_id: '',
  situacao: 'estoque' as SituacaoEquipamento,
  observacao: '',
};

const situacaoLabel = (v?: string | null) =>
  SITUACOES_EQUIPAMENTO.find((s) => s.value === v)?.label || '-';

const situacaoVariant = (v?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (v) {
    case 'estoque': return 'default';
    case 'incinerado': return 'destructive';
    case 'fazer_busca': return 'destructive';
    case 'assistencia': return 'secondary';
    case 'defeito_sede': return 'outline';
    default: return 'outline';
  }
};

export default function EquipamentosPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Equipamento[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try {
      const [equipamentosData, setoresData, obrasData] = await Promise.all([
        fetchEquipamentos(),
        fetchSetores(),
        fetchObras(),
      ]);
      setItems(equipamentosData);
      setSetores(setoresData);
      setObras(obrasData);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    return (
      i.nome.toLowerCase().includes(s) ||
      i.marca?.toLowerCase().includes(s) ||
      i.modelo?.toLowerCase().includes(s) ||
      i.setor_nome?.toLowerCase().includes(s) ||
      i.n_patrimonio?.toLowerCase().includes(s) ||
      i.n_serie?.toLowerCase().includes(s)
    );
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: Equipamento) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      marca: item.marca || '',
      modelo: item.modelo || '',
      setor_id: item.setor_id || '',
      n_patrimonio: item.n_patrimonio || '',
      n_serie: item.n_serie || '',
      nota_fiscal: item.nota_fiscal || '',
      origem_obra_id: item.origem_obra_id || '',
      localizacao_obra_id: item.localizacao_obra_id || '',
      situacao: (item.situacao as SituacaoEquipamento) || 'estoque',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) {
      toast.error('Nome do equipamento é obrigatório');
      return;
    }

    try {
      const origemObra = obras.find((o) => o.id === form.origem_obra_id);
      const localObra = obras.find((o) => o.id === form.localizacao_obra_id);

      const payload: any = {
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        setor_id: form.setor_id || null,
        n_patrimonio: form.n_patrimonio.trim() || null,
        n_serie: form.n_serie.trim() || null,
        nota_fiscal: form.nota_fiscal.trim() || null,
        origem_obra_id: form.origem_obra_id || null,
        origem_obra_nome: origemObra?.nome || null,
        localizacao_obra_id: form.localizacao_obra_id || null,
        localizacao_obra_nome: localObra?.nome || null,
        situacao: form.situacao,
      };

      if (editingId) {
        await updateEquipamento(editingId, payload, user.id);
        toast.success('Equipamento atualizado');
      } else {
        await saveEquipamento(payload, user.id);
        toast.success('Equipamento cadastrado');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este equipamento?')) return;
    try {
      if (!user) throw new Error('Usuário não encontrado');
      await deleteEquipamento(id, user.id);
      load();
      toast.success('Equipamento excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function downloadModelo() {
    const headers = [
      'Nome do Equipamento',
      'Marca',
      'Modelo',
      'Setor',
      'N Patrimonio',
      'N Serie',
      'Nota Fiscal',
      'Origem (Obra)',
      'Localizacao Atual (Obra)',
      'Situacao',
    ];

    const exemplo = [
      [
        'Escavadeira CAT 320',
        'Caterpillar',
        '320D',
        setores[0]?.nome || 'Sede',
        'PAT-001',
        'SN123456',
        'NF-9999',
        obras[0]?.nome || 'Obra A',
        obras[0]?.nome || 'Obra A',
        'estoque',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplo]);
    ws['!cols'] = headers.map(() => ({ wch: 25 }));

    // Aba de instruções
    const instrucoes = [
      ['INSTRUÇÕES PARA IMPORTAÇÃO DE EQUIPAMENTOS'],
      [''],
      ['Campos obrigatórios: Nome do Equipamento'],
      [''],
      ['Situações válidas (use exatamente este texto):'],
      ...SITUACOES_EQUIPAMENTO.map((s) => [`${s.value}  →  ${s.label}`]),
      [''],
      ['Setor: digite o nome exato de um setor já cadastrado (ou deixe em branco)'],
      ['Origem / Localização: digite o nome exato de uma obra já cadastrada (ou deixe em branco)'],
      [''],
      ['Apague a linha de exemplo antes de importar.'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
    wsInstr['!cols'] = [{ wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');
    XLSX.writeFile(wb, 'modelo_equipamentos.xlsx');
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    console.group('[Importação Equipamentos]');
    console.log('Arquivo selecionado:', file?.name, 'Tamanho:', file?.size);
    console.log('Usuário:', user?.id);

    if (!file) {
      console.warn('Nenhum arquivo selecionado');
      console.groupEnd();
      return;
    }
    if (!user) {
      toast.error('Usuário não autenticado. Faça login novamente.');
      console.groupEnd();
      return;
    }

    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
      console.log(`Linhas lidas da planilha: ${rows.length}`);
      console.log('Primeira linha (exemplo):', rows[0]);
      console.log('Setores em memória:', setores.length, 'Obras:', obras.length);

      if (!rows.length) {
        toast.error('Planilha vazia ou sem linhas válidas');
        return;
      }

      const setorMap = new Map(setores.map((s) => [s.nome.toLowerCase().trim(), s]));
      const obraMap = new Map(obras.map((o) => [o.nome.toLowerCase().trim(), o]));
      const situacoesValidas = new Set(SITUACOES_EQUIPAMENTO.map((s) => s.value));

      // Mapa de equipamentos existentes indexados por número de patrimônio (normalizado)
      const patrimonioMap = new Map<string, Equipamento>(
        items
          .filter((eq) => eq.n_patrimonio && eq.n_patrimonio.trim())
          .map((eq) => [eq.n_patrimonio!.trim().toLowerCase(), eq])
      );

      let criados = 0;
      let atualizados = 0;
      const erros: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nome = String(row['Nome do Equipamento'] || row['nome'] || '').trim();
        if (!nome) {
          erros.push(`Linha ${i + 2}: nome vazio`);
          continue;
        }

        const setorNomeRaw = String(row['Setor'] || '').trim();
        const origemRaw = String(row['Origem (Obra)'] || row['Origem'] || '').trim();
        const localRaw = String(row['Localizacao Atual (Obra)'] || row['Localização Atual (Obra)'] || row['Localizacao Atual'] || '').trim();
        const situacaoRaw = String(row['Situacao'] || row['Situação'] || 'estoque').trim().toLowerCase();
        const nPatrimonio = String(row['N Patrimonio'] || row['N° Patrimônio'] || row['N Patrimônio'] || '').trim();

        const setor = setorNomeRaw ? setorMap.get(setorNomeRaw.toLowerCase()) : null;
        const origem = origemRaw ? obraMap.get(origemRaw.toLowerCase()) : null;
        const local = localRaw ? obraMap.get(localRaw.toLowerCase()) : null;

        if (setorNomeRaw && !setor) {
          erros.push(`Linha ${i + 2}: setor "${setorNomeRaw}" não encontrado`);
          continue;
        }
        if (origemRaw && !origem) {
          erros.push(`Linha ${i + 2}: obra origem "${origemRaw}" não encontrada`);
          continue;
        }
        if (localRaw && !local) {
          erros.push(`Linha ${i + 2}: obra localização "${localRaw}" não encontrada`);
          continue;
        }

        const situacao = (situacoesValidas.has(situacaoRaw as SituacaoEquipamento)
          ? situacaoRaw
          : 'estoque') as SituacaoEquipamento;

        const dados = {
          nome,
          marca: String(row['Marca'] || '').trim() || null,
          modelo: String(row['Modelo'] || '').trim() || null,
          setor_id: setor?.id || null,
          setor_nome: setor?.nome || null,
          n_patrimonio: nPatrimonio || null,
          n_serie: String(row['N Serie'] || row['N° Série'] || row['N Série'] || '').trim() || null,
          nota_fiscal: String(row['Nota Fiscal'] || '').trim() || null,
          origem_obra_id: origem?.id || null,
          origem_obra_nome: origem?.nome || null,
          localizacao_obra_id: local?.id || null,
          localizacao_obra_nome: local?.nome || null,
          situacao,
        };

        // Se tem patrimônio e já existe → atualiza apenas campos alterados
        const existente = nPatrimonio ? patrimonioMap.get(nPatrimonio.toLowerCase()) : null;

        try {
          if (existente) {
            const diff: Record<string, any> = {};
            (Object.keys(dados) as (keyof typeof dados)[]).forEach((k) => {
              const novo = dados[k];
              const antigo = (existente as any)[k];
              const novoNorm = novo === '' ? null : novo;
              const antigoNorm = antigo === '' ? null : antigo;
              if (novoNorm !== antigoNorm) diff[k] = novoNorm;
            });

            if (Object.keys(diff).length === 0) {
              console.log(`Linha ${i + 2}: patrimônio "${nPatrimonio}" já existe, sem alterações`);
              continue;
            }

            await updateEquipamento(existente.id, diff, user.id);
            atualizados++;
            console.log(`Linha ${i + 2}: patrimônio "${nPatrimonio}" atualizado`, diff);
          } else {
            await saveEquipamento({ ...dados, created_by: user.id } as any, user.id);
            criados++;
          }
        } catch (e: any) {
          erros.push(`Linha ${i + 2}: ${e.message}`);
        }
      }

      console.log(`Resultado: ${criados} criado(s), ${atualizados} atualizado(s), ${erros.length} erro(s)`);
      const partes: string[] = [];
      if (criados > 0) partes.push(`${criados} criado(s)`);
      if (atualizados > 0) partes.push(`${atualizados} atualizado(s)`);
      if (partes.length) toast.success(`Importação concluída: ${partes.join(', ')}`);

      if (erros.length) {
        console.warn('Erros de importação:', erros);
        toast.error(`${erros.length} erro(s). Veja o console (F12) para detalhes.`);
      }
      if (criados === 0 && atualizados === 0 && erros.length === 0) {
        toast.warning('Nenhum equipamento foi importado ou atualizado. Verifique a planilha.');
      }
      load();
    } catch (e: any) {
      console.error('Erro fatal na importação:', e);
      toast.error('Erro ao ler planilha: ' + (e?.message || 'desconhecido'));
    } finally {
      console.groupEnd();
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  const sectorSelectValue = form.setor_id || 'none';
  const origemSelectValue = form.origem_obra_id || 'none';
  const localSelectValue = form.localizacao_obra_id || 'none';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Equipamentos</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadModelo}>
            <Download className="h-4 w-4 mr-1" />
            Baixar Modelo
          </Button>
          {canCreate('equipamentos') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-4 w-4 mr-1" />
                {importing ? 'Importando...' : 'Importar Excel'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Equipamento
              </Button>
            </>
          )}
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome, marca, modelo, patrimônio ou série..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>N° Patrimônio</TableHead>
              <TableHead>N° Série</TableHead>
              <TableHead>Marca / Modelo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nenhum equipamento encontrado
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell>{i.n_patrimonio || '-'}</TableCell>
                <TableCell>{i.n_serie || '-'}</TableCell>
                <TableCell>{[i.marca, i.modelo].filter(Boolean).join(' / ') || '-'}</TableCell>
                <TableCell>{i.origem_obra_nome || '-'}</TableCell>
                <TableCell>{i.localizacao_obra_nome || '-'}</TableCell>
                <TableCell>
                  <Badge variant={situacaoVariant(i.situacao)}>{situacaoLabel(i.situacao)}</Badge>
                </TableCell>
                <TableCell>
                  <AuditInfo
                    createdBy={i.created_by}
                    createdAt={i.created_at}
                    updatedBy={i.updated_by}
                    updatedAt={i.updated_at}
                    profileMap={profileMap}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('equipamentos') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('equipamentos') && (
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Equipamento</DialogTitle>
            <DialogDescription>Preencha os dados do equipamento.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome do Equipamento *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Escavadeira CAT 320"
              />
            </div>

            <div>
              <Label>N° Patrimônio</Label>
              <Input
                value={form.n_patrimonio}
                onChange={(e) => setForm((p) => ({ ...p, n_patrimonio: e.target.value }))}
                placeholder="Ex: PAT-001"
              />
            </div>

            <div>
              <Label>N° Série</Label>
              <Input
                value={form.n_serie}
                onChange={(e) => setForm((p) => ({ ...p, n_serie: e.target.value }))}
                placeholder="Ex: SN123456"
              />
            </div>

            <div>
              <Label>Nota Fiscal</Label>
              <Input
                value={form.nota_fiscal}
                onChange={(e) => setForm((p) => ({ ...p, nota_fiscal: e.target.value }))}
                placeholder="Ex: NF-9999"
              />
            </div>

            <div>
              <Label>Situação</Label>
              <Select
                value={form.situacao}
                onValueChange={(v) => setForm((p) => ({ ...p, situacao: v as SituacaoEquipamento }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITUACOES_EQUIPAMENTO.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Marca</Label>
              <Input
                value={form.marca}
                onChange={(e) => setForm((p) => ({ ...p, marca: e.target.value }))}
                placeholder="Ex: Caterpillar"
              />
            </div>

            <div>
              <Label>Modelo</Label>
              <Input
                value={form.modelo}
                onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))}
                placeholder="Ex: 320D"
              />
            </div>

            <div>
              <Label>Setor</Label>
              <Select
                value={sectorSelectValue}
                onValueChange={(v) => setForm((p) => ({ ...p, setor_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.id}>{setor.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Origem (Obra)</Label>
              <Select
                value={origemSelectValue}
                onValueChange={(v) => setForm((p) => ({ ...p, origem_obra_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a obra de origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Localização Atual (Obra)</Label>
              <Select
                value={localSelectValue}
                onValueChange={(v) => setForm((p) => ({ ...p, localizacao_obra_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a localização atual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
