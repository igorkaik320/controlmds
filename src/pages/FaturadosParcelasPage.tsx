import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchComprasFaturadas, formatCurrencyBR } from "@/lib/comprasService";
import { fetchEmpresas, Empresa } from "@/lib/empresasService";
import { fetchObras, Obra } from "@/lib/obrasService";
import { buildInstallmentsFromItem, toIsoDateString } from "@/lib/parcelas";
import EmpresaSelect from "@/components/compras/EmpresaSelect";

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

type InstallmentView = {
  id: string;
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
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async function load() {
      setLoading(true);
      try {
        const [purchases, empresasData, obrasData] = await Promise.all([
          fetchComprasFaturadas(),
          fetchEmpresas(),
          fetchObras(),
        ]);
        setCompanies(empresasData);
        setObras(obrasData);

        const obraToEmpresa = new Map<string, string>();
        obrasData.forEach((obra) => {
          if (obra.id && obra.empresa_id) {
            obraToEmpresa.set(obra.id, obra.empresa_id);
          }
        });

        const empresaMap = new Map<string, Empresa>();
        empresasData.forEach((empresa) => {
          if (empresa.id) {
            empresaMap.set(empresa.id, empresa);
          }
        });

        const installments = purchases.flatMap((item) => {
          return buildInstallmentsFromItem(item).map((installment, index) => {
            const iso = toIsoDateString(installment.due);
            const monthKey = iso ? iso.slice(0, 7) : installment.due;
            const dayKey = iso ? iso.slice(0, 10) : installment.due;
            const monthLabel =
              iso && !Number.isNaN(new Date(`${iso}T00:00:00`).getTime())
                ? monthFormatter.format(new Date(`${iso}T00:00:00`))
                : installment.due;
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
              id: `${item.id}-${index}-${installment.due}`,
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
        <div className="grid gap-4 md:grid-cols-3">
          {months.map((month) => {
            const isSelected = month.key === selectedMonth;
            return (
              <Card
                key={month.key}
                onClick={() => setSelectedMonth(month.key)}
                className={`cursor-pointer border transition ${
                  isSelected ? "border-blue-500 bg-blue-500/10 shadow-sm" : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <CardHeader className="space-y-2">
                  <CardTitle className="text-base">{month.label}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {month.parcels} parcela{month.parcels === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatCurrencyBR(month.total)}</p>
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
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Obra / Pedido</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Total do dia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyGroups.flatMap((day) => [
                      <TableRow key={`${day.key}-header`} className="bg-muted/30">
                        <TableCell colSpan={5}>
                          <div>
                            <p className="text-sm font-semibold">{day.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {day.parcels} parcela{day.parcels === 1 ? '' : 's'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-blue-600">
                          {formatCurrencyBR(day.total)}
                        </TableCell>
                      </TableRow>,
                      ...day.items.map((installment) => (
                        <TableRow key={installment.id}>
                          <TableCell>{installment.due}</TableCell>
                          <TableCell>
                            <div className="font-medium">{installment.supplier}</div>
                            {installment.cnpj && (
                              <div className="text-[11px] text-muted-foreground">{installment.cnpj}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{installment.obra || '—'}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {installment.pedido || 'Sem pedido'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrencyBR(installment.value)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {installment.observation || '—'}
                          </TableCell>
                          <TableCell />
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
