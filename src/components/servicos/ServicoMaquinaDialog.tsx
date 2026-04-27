import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import VeiculoSearchSelect from '@/components/compras/VeiculoSearchSelect';
import { fetchVeiculos, VeiculoMaquina } from '@/lib/combustivelService';
import { fetchObras, Obra } from '@/lib/obrasService';
import {
  ComponenteMaquina,
  ServicoMaquina,
  ServicoPecaInput,
  StatusPeca,
  TipoServico,
  fetchComponentes,
  saveComponente,
  saveServico,
  updateServico,
} from '@/lib/servicosMaquinasService';
import { useAuth } from '@/lib/auth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ServicoMaquina | null;
  onSaved: () => void;
  defaultVeiculoId?: string;
}

interface PecaRow extends ServicoPecaInput {
  _key: string;
}

const emptyServico = {
  veiculo_id: '',
  obra_id: '' as string,
  data: new Date().toISOString().slice(0, 10),
  horimetro: '' as string,
  tipo_servico: 'conserto' as TipoServico,
  observacao: '',
  observacao_pecas: '',
};

export default function ServicoMaquinaDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  defaultVeiculoId,
}: Props) {
  const { user } = useAuth();
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [componentes, setComponentes] = useState<ComponenteMaquina[]>([]);
  const [form, setForm] = useState(emptyServico);
  const [pecas, setPecas] = useState<PecaRow[]>([]);
  const [saving, setSaving] = useState(false);

  // mini-dialog para criar componente
  const [showNovoComp, setShowNovoComp] = useState(false);
  const [novoCompNome, setNovoCompNome] = useState('');

  useEffect(() => {
    if (!open) return;
    Promise.all([fetchVeiculos(), fetchObras(), fetchComponentes()])
      .then(([v, o, c]) => {
        setVeiculos(v);
        setObras(o);
        setComponentes(c);
      })
      .catch((e) => toast.error(e.message));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        veiculo_id: editing.veiculo_id,
        obra_id: editing.obra_id || '',
        data: editing.data,
        horimetro: editing.horimetro != null ? String(editing.horimetro) : '',
        tipo_servico: editing.tipo_servico,
        observacao: editing.observacao || '',
        observacao_pecas: editing.observacao_pecas || '',
      });
      setPecas(
        (editing.pecas || []).map((p, i) => ({
          _key: `${p.id}-${i}`,
          componente_id: p.componente_id,
          status: p.status,
          observacao: p.observacao || '',
        }))
      );
    } else {
      setForm({ ...emptyServico, veiculo_id: defaultVeiculoId || '' });
      setPecas([]);
    }
  }, [editing, open, defaultVeiculoId]);

  const requerPecas = form.tipo_servico !== 'conserto';

  function addPeca() {
    setPecas((prev) => [
      ...prev,
      { _key: crypto.randomUUID(), componente_id: '', status: 'trocada', observacao: '' },
    ]);
  }

  function updatePeca(key: string, patch: Partial<PecaRow>) {
    setPecas((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));
  }

  function removePeca(key: string) {
    setPecas((prev) => prev.filter((p) => p._key !== key));
  }

  async function handleCriarComponente() {
    if (!user) return;
    if (!novoCompNome.trim()) return toast.error('Nome obrigatório');
    try {
      const created = await saveComponente({ nome: novoCompNome.trim() }, user.id);
      setComponentes((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoCompNome('');
      setShowNovoComp(false);
      toast.success('Componente cadastrado');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSubmit() {
    if (!user) return toast.error('Usuário não encontrado');
    if (!form.veiculo_id) return toast.error('Selecione a máquina');
    if (!form.data) return toast.error('Informe a data');
    if (requerPecas && pecas.length === 0)
      return toast.error('Adicione ao menos uma peça');
    if (requerPecas && pecas.some((p) => !p.componente_id))
      return toast.error('Selecione a peça em todas as linhas');

    const horimetroNum =
      form.horimetro.trim() === '' ? null : Number(form.horimetro.replace(',', '.'));
    if (horimetroNum != null && (Number.isNaN(horimetroNum) || horimetroNum < 0))
      return toast.error('Horímetro inválido');

    const payload = {
      veiculo_id: form.veiculo_id,
      obra_id: form.obra_id || null,
      data: form.data,
      horimetro: horimetroNum,
      tipo_servico: form.tipo_servico,
      observacao: form.observacao.trim() || null,
      observacao_pecas: form.observacao_pecas.trim() || null,
    };

    const pecasPayload: ServicoPecaInput[] = requerPecas
      ? pecas.map((p) => ({
          componente_id: p.componente_id,
          status: p.status,
          observacao: p.observacao || null,
        }))
      : [];

    try {
      setSaving(true);
      if (editing) {
        await updateServico(editing.id, payload, pecasPayload, user.id);
        toast.success('Serviço atualizado');
      } else {
        await saveServico(payload, pecasPayload, user.id);
        toast.success('Serviço registrado');
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar serviço' : 'Novo serviço de máquina'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <VeiculoSearchSelect
                  value={form.veiculo_id}
                  onChange={(id) => setForm((p) => ({ ...p, veiculo_id: id }))}
                  veiculos={veiculos}
                  label="Máquina *"
                  placeholder="Buscar máquina..."
                />
              </div>

              <div>
                <Label>Obra alocada</Label>
                <Select
                  value={form.obra_id || '_none'}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, obra_id: v === '_none' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                />
              </div>

              <div>
                <Label>Horímetro atual (h)</Label>
                <Input
                  inputMode="decimal"
                  value={form.horimetro}
                  onChange={(e) => setForm((p) => ({ ...p, horimetro: e.target.value }))}
                  placeholder="Ex.: 250"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Tipo de serviço *</Label>
                <Select
                  value={form.tipo_servico}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, tipo_servico: v as TipoServico }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conserto">Conserto</SelectItem>
                    <SelectItem value="troca_pecas">Troca de peças</SelectItem>
                    <SelectItem value="conserto_troca_pecas">
                      Conserto + Troca de peças
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observação do serviço</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
                placeholder="Descreva o serviço executado"
                rows={3}
              />
            </div>

            {requerPecas && (
              <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Peças trocadas / com defeito</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNovoComp(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nova peça
                    </Button>
                    <Button type="button" size="sm" onClick={addPeca}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {pecas.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma peça adicionada.
                  </p>
                )}

                {pecas.map((p) => (
                  <div
                    key={p._key}
                    className="grid grid-cols-12 gap-2 items-start border rounded-md p-2 bg-background"
                  >
                    <div className="col-span-12 md:col-span-5">
                      <Label className="text-xs">Peça</Label>
                      <Select
                        value={p.componente_id}
                        onValueChange={(v) => updatePeca(p._key, { componente_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {componentes
                            .filter((c) => c.ativo || c.id === p.componente_id)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={p.status}
                        onValueChange={(v) =>
                          updatePeca(p._key, { status: v as StatusPeca })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trocada">Trocada</SelectItem>
                          <SelectItem value="defeito">Com defeito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5 md:col-span-3">
                      <Label className="text-xs">Observação</Label>
                      <Input
                        value={p.observacao || ''}
                        onChange={(e) =>
                          updatePeca(p._key, { observacao: e.target.value })
                        }
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end h-full">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePeca(p._key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div>
                  <Label>Observação geral das peças</Label>
                  <Textarea
                    value={form.observacao_pecas}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, observacao_pecas: e.target.value }))
                    }
                    placeholder="Observação adicional sobre as peças"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNovoComp} onOpenChange={setShowNovoComp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova peça / componente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={novoCompNome}
                onChange={(e) => setNovoCompNome(e.target.value)}
                placeholder="Ex.: Bomba hidráulica"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovoComp(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarComponente}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
