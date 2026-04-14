import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchComprasFaturadas, formatCurrencyBR } from "@/lib/comprasService";
import { fetchEmpresas, Empresa } from "@/lib/empresasService";
import { fetchObras, Obra } from "@/lib/obrasService";
import { buildInstallmentsFromItem, toIsoDateString } from "@/lib/parcelas";
import { fetchContasPagar, ContaPagarComParcelas } from "@/lib/contasPagarService";
import { verificarLimiteGlobal, AlertaSimples } from "@/lib/limitesSimples";
import EmpresaSelect from "@/components/compras/EmpresaSelect";
import { AlertaSimplesCard } from "@/components/limites/AlertaSimplesCard";
import { ConfigurarLimiteModal } from "@/components/limites/ConfigurarLimiteModal";
import { Settings } from "lucide-react";

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

type InstallmentView = {
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
};

type MonthSummary = {
  key: string;
  label: string;
  total: number;
  parcels: number;
};

type DayGroup = {
  key: string;
  label: string;
  total: number;
  parcels: number;
  items: InstallmentView[];
};

export default function FaturadosParcelasPage() {
  const [items, setItems] = useState<InstallmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [alertas, setAlertas] = useState<AlertaSimples[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const [comprasFaturadas, empresasData, obrasData, contasPagar] = await Promise.all([
          fetchComprasFaturadas(),
          fetchEmpresas(),
          fetchObras(),
          fetchContasPagar(),
        ]);

        setCompanies(empresasData);
        setObras(obrasData);

        // Criar mapa de empresa para obra
        const obraToEmpresa = new Map<string, string>();
        obrasData.forEach((obra) => {
          obraToEmpresa.set(obra.nome, obra.empresa_id);
        });

        // Mapear empresas para fácil acesso
        const empresaMap = new Map<string, Empresa>();
        empresasData.forEach((empresa) => {
          empresaMap.set(empresa.id, empresa);
        });

        // Processar compras faturadas (lógica existente)
        const installments = comprasFaturadas.flatMap((item) => {
          const installments = buildInstallmentsFromItem(item);
          return installments.map((installment, index) => {
            const iso = toIsoDateString(installment.due);
            const date = iso ? new Date(`${iso}T00:00:00`) : null;
            const monthKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'sem-mes';
            const monthLabel = date ? monthFormatter.format(date) : 'Sem mês';
            const dayKey = iso || installment.due;
            const dayLabel =
              iso && !Number.isNaN(new Date(`${iso}T00:00:00`).getTime())
                ? dayFormatter.format(new Date(`${iso}T00:00:00`))
                : installment.due;

            const obraId = (item as any).obra_id ?? (item as any).obraId ?? "";
            const empresaId =
              obraId && obraToEmpresa.has(obraId)
                ? obraToEmpresa.get(obraId)!
                : (item as any).empresa_id ?? (item as any).empresaId ?? "";
            const companyName =
              (empresaId && empresaMap.get(empresaId)?.nome) ||
              (item as any).empresa ||
              (item as any).empresa_nome ||
              "";

            return {
              id: `compra-${item.id}-${index}-${installment.due}`,
              tipo: 'compra_faturada' as const,
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
              obraId,
              companyId: empresaId,
              companyName: companyName || undefined,
            };
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
              installments.push({
                id: `conta-${conta.id}-${parcela.id}`,
                tipo: 'conta_pagar' as const,
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
              });
            }
          });
        });

        // Ordenar por data de vencimento
        installments.sort((a, b) => {
          const dateA = new Date(a.dueIso || a.due);
          const dateB = new Date(b.dueIso || b.due);
          return dateA.getTime() - dateB.getTime();
        });

        setItems(installments);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allowedObrasForCompany = useMemo(() => {
    if (!selectedCompany) return null;
    const names = obras
      .filter((obra) => obra.empresa_id === selectedCompany)
      .map((obra) => obra.nome.toLowerCase());
    return new Set(names);
  }, [obras, selectedCompany]);

  const visibleInstallments = useMemo(() => {
    if (!selectedCompany) return items;

    const selectedCompanyName = companies.find((c) => c.id === selectedCompany)?.nome?.toLowerCase();

    return items.filter((installment) => {
      if (installment.companyId === selectedCompany) return true;

      if (installment.obra && allowedObrasForCompany?.has(installment.obra.toLowerCase())) {
        return true;
      }

      if (selectedCompanyName && installment.companyName?.toLowerCase() === selectedCompanyName) {
        return true;
      }

      return false;
    });
  }, [allowedObrasForCompany, companies, items, selectedCompany]);

  const months = useMemo<MonthSummary[]>(() => {
    const map = new Map<string, MonthSummary>();
    for (const installment of visibleInstallments) {
      const key = installment.monthKey || "sem-mes";
      const current = map.get(key);
      if (current) {
        current.total += installment.value;
        current.parcels += 1;
      } else {
        map.set(key, {
          key,
          label: installment.monthLabel || "Sem mês",
          total: installment.value,
          parcels: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.key > b.key ? -1 : a.key < b.key ? 1 : 0));
  }, [visibleInstallments]);

  // Verificar limites simples
  useEffect(() => {
    if (!selectedMonth || months.length === 0) return;

    const selectedMonthData = months.find(m => m.key === selectedMonth);
    if (!selectedMonthData) return;

    const alerta = verificarLimiteGlobal(selectedMonth, selectedMonthData.total);
    setAlertas(alerta && alerta.tipo !== 'normal' ? [alerta] : []);
  }, [selectedMonth, months, refreshKey]);

  useEffect(() => {
    if (!selectedMonth && months.length > 0) {
      setSelectedMonth(months[0].key);
      return;
    }
    if (selectedMonth && !months.some((month) => month.key === selectedMonth)) {
      setSelectedMonth(months[0]?.key || null);
    }
  }, [months, selectedMonth]);

  const monthDetails = months.find((month) => month.key === selectedMonth);
  const selectedCompanyLabel =
    selectedCompany && companies.length > 0 ? companies.find((c) => c.id === selectedCompany)?.nome : undefined;
  const monthlyInstallments = useMemo(() => {
    if (!selectedMonth) return [];
    return visibleInstallments
      .filter((installment) => installment.monthKey === selectedMonth)
      .sort((a, b) => {
        const aKey = a.dueIso ?? a.due;
        const bKey = b.dueIso ?? b.due;
        return aKey.localeCompare(bKey);
      });
  }, [visibleInstallments, selectedMonth]);

  const dailyGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const installment of monthlyInstallments) {
      const key = installment.dayKey;
      const current = map.get(key);
      if (current) {
        current.total += installment.value;
        current.parcels += 1;
        current.items.push(installment);
      } else {
        map.set(key, {
          key,
          label: installment.dayLabel,
          total: installment.value,
          parcels: 1,
          items: [installment],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.key > b.key ? -1 : a.key < b.key ? 1 : 0));
  }, [monthlyInstallments]);

  async function handleExportPdf() {
    if (exportingPdf) return;
    if (dailyGroups.length === 0) {
      toast.error("Nada para exportar.");
      return;
    }

    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      if (!tableRef.current) throw new Error("Não foi possível preparar o PDF.");

      const root = tableRef.current;
      const rowEls = Array.from(root.querySelectorAll("tr")) as HTMLElement[];
      const rootRect = root.getBoundingClientRect();

      // Snapshot first so DOM/layout are stable for slicing.
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();

      // width-fitted: compute how many canvas pixels fit in one PDF page height
      const canvasWidthPx = canvas.width;
      const canvasHeightPx = canvas.height;
      const pageHeightPx = Math.floor((canvasWidthPx * pageHeightMm) / pageWidthMm);

      // Compute "safe cut" positions in px (row bottoms), scaled to canvas pixels.
      const scaleY = canvasHeightPx / Math.max(1, root.scrollHeight || root.clientHeight);
      const rowBottomsPx = rowEls
        .map((el) => {
          const r = el.getBoundingClientRect();
          const bottomCssPx = Math.max(0, r.bottom - rootRect.top + root.scrollTop);
          return Math.round(bottomCssPx * scaleY);
        })
        .filter((v) => v > 0 && v <= canvasHeightPx)
        .sort((a, b) => a - b);

      const sliceCanvas = document.createElement("canvas");
      const sliceCtx = sliceCanvas.getContext("2d");
      if (!sliceCtx) throw new Error("Não foi possível preparar o PDF.");

      const minSlicePx = Math.max(50, Math.floor(pageHeightPx * 0.35));
      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvasHeightPx) {
        const idealEnd = Math.min(renderedPx + pageHeightPx, canvasHeightPx);
        const cutCandidate = rowBottomsPx.filter((b) => b > renderedPx + minSlicePx && b <= idealEnd).pop();
        const endPx = cutCandidate ?? idealEnd;
        const sliceHeightPx = Math.max(1, endPx - renderedPx);

        sliceCanvas.width = canvasWidthPx;
        sliceCanvas.height = sliceHeightPx;
        sliceCtx.fillStyle = "#ffffff";
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(canvas, 0, renderedPx, canvasWidthPx, sliceHeightPx, 0, 0, canvasWidthPx, sliceHeightPx);

        const imgData = sliceCanvas.toDataURL("image/png");
        const sliceHeightMm = (sliceHeightPx * pageWidthMm) / canvasWidthPx;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, sliceHeightMm);

        renderedPx += sliceHeightPx;
        pageIndex += 1;
      }

      const companyNome = selectedCompanyLabel;
      const monthKeySafe = (selectedMonth || "sem-mes").replace(/[^\w-]/g, "");
      const companySafe = (companyNome || selectedCompany || "todas").replace(/[^\w-]/g, "");
      const filename = `parcelas_faturadas_${monthKeySafe}_${companySafe}.pdf`;

      pdf.save(filename);
      toast.success("PDF exportado com sucesso.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-center text-sm text-muted-foreground">Carregando parcelas faturadas...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Financeiro</p>
        <h1 className="text-2xl font-bold">Parcelas de Compras Faturadas</h1>
        <p className="text-sm text-muted-foreground">
          Veja quando cada parcela vence, quem é o fornecedor e qual o total previsto por mês.
        </p>
      </header>

      <section className="space-y-4">
        {/* Alertas de Limites */}
        {alertas.length > 0 && (
          <div className="space-y-3">
            {alertas.map((alerta, index) => (
              <AlertaSimplesCard key={index} alerta={alerta} />
            ))}
          </div>
        )}
        
        <div className="grid gap-4 md:grid-cols-3">
          {months.map((month) => {
            const isSelected = month.key === selectedMonth;
            const alerta = verificarLimiteGlobal(month.key, month.total);
            const hasAlerta = alerta && alerta.tipo !== 'normal';
            
            return (
              <Card
                key={month.key}
                onClick={() => setSelectedMonth(month.key)}
                className={`cursor-pointer border transition ${
                  isSelected 
                    ? "border-blue-500 bg-blue-500/10 shadow-sm" 
                    : alerta?.tipo === 'perigo'
                    ? "border-red-200 bg-red-50 hover:border-red-400"
                    : alerta?.tipo === 'alerta'
                    ? "border-yellow-200 bg-yellow-50 hover:border-yellow-400"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{month.label}</CardTitle>
                    {hasAlerta && (
                      <div className={`h-2 w-2 rounded-full ${
                        alerta.tipo === 'perigo' ? 'bg-red-500' :
                        alerta.tipo === 'alerta' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`} />
                    )}
                  </div>
                  <CardDescription className="text-sm text-muted-foreground">
                    {month.parcels} parcela{month.parcels === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatCurrencyBR(month.total)}</p>
                  {alerta && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {alerta.percentual.toFixed(1)}% do limite
                      </p>
                      <p className={`text-xs font-medium ${
                        alerta.valorDisponivel < 0 ? 'text-red-600' :
                        alerta.valorDisponivel < (alerta.valorLimite * 0.2) ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        Disponível: {formatCurrencyBR(alerta.valorDisponivel)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {monthDetails ? monthDetails.label : "Nenhum mês encontrado"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {monthDetails ? `${monthDetails.parcels} parcelas previstas` : "Registros vazios"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <EmpresaSelect
                value={selectedCompany}
                onChange={setSelectedCompany}
                label="Empresa"
                allowAll
              />
            </div>

            {monthDetails && (
              <p className="text-sm font-semibold text-blue-600 sm:order-0">{formatCurrencyBR(monthDetails.total)}</p>
            )}

            <ConfigurarLimiteModal 
              onLimiteCriado={() => setRefreshKey(prev => prev + 1)}
            >
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Limite
              </Button>
            </ConfigurarLimiteModal>

            <Button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || dailyGroups.length === 0}
              className="w-full sm:w-auto"
              variant="outline"
            >
              {exportingPdf ? "Exportando..." : "Exportar PDF"}
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Parcelas por dia</CardTitle>
            <CardDescription>
              Mostra cada vencimento e o total consolidado do dia, mantendo os cartões de totais no topo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={tableRef}>
              <div className="mb-3 rounded-md border bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Relatório</p>
                <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-base font-semibold leading-tight">Compras faturadas</h3>
                  <p className="text-sm text-muted-foreground">
                    {monthDetails?.label ? `Mês: ${monthDetails.label}` : "Mês: —"}
                    {selectedCompanyLabel ? ` • Empresa: ${selectedCompanyLabel}` : ""}
                  </p>
                </div>
              </div>
              {dailyGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Não há parcelas para o mês selecionado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Obra / Pedido</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyGroups.map((day) => [
                      <TableRow key={day.key}>
                        <TableCell colSpan={6}>
                          <div>
                            <p className="text-sm font-semibold">{day.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {day.parcels} parcela{day.parcels === 1 ? '' : 's'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...day.items.map((installment) => (
                        <TableRow key={installment.id}>
                          <TableCell>{installment.due}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              installment.tipo === 'conta_pagar' 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {installment.tipo === 'conta_pagar' ? 'Conta a Pagar' : 'Compra Faturada'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{installment.supplier}</div>
                            {installment.cnpj && (
                              <div className="text-[11px] text-muted-foreground">{installment.cnpj}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{installment.obra || '---'}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {installment.pedido || 'Sem pedido'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrencyBR(installment.value)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {installment.observation || '---'}
                          </TableCell>
                        </TableRow>
                      )),
                    ])}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
