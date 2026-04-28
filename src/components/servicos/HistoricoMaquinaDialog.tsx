import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ServicoMaquina,
  TIPO_SERVICO_LABEL,
  fetchServicosPorVeiculo,
} from '@/lib/servicosMaquinasService';
import { VeiculoMaquina } from '@/lib/combustivelService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo: VeiculoMaquina | null;
}

function formatDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function HistoricoMaquinaDialog({ open, onOpenChange, veiculo }: Props) {
  const [servicos, setServicos] = useState<ServicoMaquina[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !veiculo) return;
    setLoading(true);
    fetchServicosPorVeiculo(veiculo.id)
      .then(setServicos)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, veiculo]);

  const stats = useMemo(() => {
    if (servicos.length === 0)
      return {
        total: 0,
        ultimoHorimetro: null as number | null,
        intervaloMedio: null as number | null,
        intervaloMedioHorimetro: null as number | null,
        pecaTop: null as string | null,
      };

    const total = servicos.length;
    const ultimoHorimetro =
      servicos.find((s) => s.horimetro != null)?.horimetro ?? null;

    // intervalo médio entre serviços (em dias)
    const datasOrd = [...servicos]
      .map((s) => new Date(s.data).getTime())
      .sort((a, b) => a - b);
    let intervaloMedio: number | null = null;
    if (datasOrd.length > 1) {
      let totalDias = 0;
      for (let i = 1; i < datasOrd.length; i++) {
        totalDias += (datasOrd[i] - datasOrd[i - 1]) / (1000 * 60 * 60 * 24);
      }
      intervaloMedio = Math.round(totalDias / (datasOrd.length - 1));
    }

    // intervalo médio entre serviços (em horímetro / horas de uso)
    const horimetrosOrd = [...servicos]
      .filter((s) => s.horimetro != null)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
      .map((s) => Number(s.horimetro));
    let intervaloMedioHorimetro: number | null = null;
    if (horimetrosOrd.length > 1) {
      let totalH = 0;
      let count = 0;
      for (let i = 1; i < horimetrosOrd.length; i++) {
        const diff = horimetrosOrd[i] - horimetrosOrd[i - 1];
        if (diff >= 0) {
          totalH += diff;
          count += 1;
        }
      }
      if (count > 0) intervaloMedioHorimetro = Math.round(totalH / count);
    }

    // peça mais trocada
    const counts = new Map<string, { nome: string; n: number }>();
    for (const s of servicos) {
      for (const p of s.pecas || []) {
        const key = p.componente_id;
        const nome = p.componente?.nome || 'Sem nome';
        const cur = counts.get(key) || { nome, n: 0 };
        cur.n += 1;
        counts.set(key, cur);
      }
    }
    let pecaTop: string | null = null;
    let max = 0;
    counts.forEach((v) => {
      if (v.n > max) {
        max = v.n;
        pecaTop = `${v.nome} (${v.n}x)`;
      }
    });

    return { total, ultimoHorimetro, intervaloMedio, pecaTop };
  }, [servicos]);

  const porPeca = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; datas: string[]; trocadas: number; defeitos: number }
    >();
    for (const s of servicos) {
      for (const p of s.pecas || []) {
        const cur = map.get(p.componente_id) || {
          nome: p.componente?.nome || 'Sem nome',
          datas: [],
          trocadas: 0,
          defeitos: 0,
        };
        cur.datas.push(s.data);
        if (p.status === 'trocada') cur.trocadas += 1;
        else cur.defeitos += 1;
        map.set(p.componente_id, cur);
      }
    }

    return Array.from(map.entries())
      .map(([id, v]) => {
        const ord = [...v.datas].sort();
        let intervalo: number | null = null;
        if (ord.length > 1) {
          let total = 0;
          for (let i = 1; i < ord.length; i++) {
            total +=
              (new Date(ord[i]).getTime() - new Date(ord[i - 1]).getTime()) /
              (1000 * 60 * 60 * 24);
          }
          intervalo = Math.round(total / (ord.length - 1));
        }
        return {
          id,
          nome: v.nome,
          ocorrencias: v.datas.length,
          trocadas: v.trocadas,
          defeitos: v.defeitos,
          ultima: ord[ord.length - 1],
          intervalo,
        };
      })
      .sort((a, b) => b.ocorrencias - a.ocorrencias);
  }, [servicos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Histórico de serviços — {veiculo?.placa || ''}
            {veiculo?.modelo ? ` (${veiculo.modelo})` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total de serviços</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Último horímetro</p>
                  <p className="text-2xl font-bold">
                    {stats.ultimoHorimetro != null ? `${stats.ultimoHorimetro} h` : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Intervalo médio entre serviços
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.intervaloMedio != null ? `${stats.intervaloMedio} dias` : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Peça mais recorrente</p>
                  <p className="text-base font-semibold">{stats.pecaTop || '—'}</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Serviços (mais recente primeiro)</h3>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horímetro</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Obra</TableHead>
                      <TableHead>Peças</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum serviço registrado
                        </TableCell>
                      </TableRow>
                    )}
                    {servicos.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDate(s.data)}</TableCell>
                        <TableCell>{s.horimetro != null ? `${s.horimetro} h` : '—'}</TableCell>
                        <TableCell>{TIPO_SERVICO_LABEL[s.tipo_servico]}</TableCell>
                        <TableCell>{(s as any).obra?.nome || '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(s.pecas || []).map((p) => (
                              <Badge
                                key={p.id}
                                variant={p.status === 'defeito' ? 'destructive' : 'secondary'}
                              >
                                {p.componente?.nome || '—'}
                              </Badge>
                            ))}
                            {(s.pecas || []).length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px] whitespace-pre-wrap text-xs">
                          {s.observacao || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Análise por peça</h3>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peça</TableHead>
                      <TableHead>Ocorrências</TableHead>
                      <TableHead>Trocadas</TableHead>
                      <TableHead>Com defeito</TableHead>
                      <TableHead>Última ocorrência</TableHead>
                      <TableHead>Intervalo médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porPeca.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhuma peça registrada
                        </TableCell>
                      </TableRow>
                    )}
                    {porPeca.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell>{p.ocorrencias}</TableCell>
                        <TableCell>{p.trocadas}</TableCell>
                        <TableCell>{p.defeitos}</TableCell>
                        <TableCell>{formatDate(p.ultima)}</TableCell>
                        <TableCell>
                          {p.intervalo != null ? `${p.intervalo} dias` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
