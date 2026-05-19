import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { fetchComprasFaturadas, formatCurrencyBR } from "@/lib/comprasService";
import { fetchEmpresas, Empresa } from "@/lib/empresasService";
import { fetchObras, Obra } from "@/lib/obrasService";
import { buildInstallmentsFromItem, toIsoDateString } from "@/lib/parcelas";
import { fetchContasPagar, ContaPagarComParcelas } from "@/lib/contasPagarService";
import EmpresaSelect from "@/components/compras/EmpresaSelect";
import FornecedorSelect from "@/components/compras/FornecedorSelect";
import ObraSelect from "@/components/compras/ObraSelect";
import { ConfigurarLimiteModal } from "@/components/limites/ConfigurarLimiteModal";
import { Settings } from "lucide-react";

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

function formatInputDate(date: Date | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

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
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedObra, setSelectedObra] = useState("");
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Estados para filtro de período
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

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
        const installments: InstallmentView[] = comprasFaturadas.flatMap((item) => {
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
                obra: conta.obra_nome || '---',
                pedido: null,
                observation: conta.observacao,
                value: parcela.valor_parcela,
                due: parcela.data_vencimento,
                dueIso: parcela.data_vencimento,
                monthKey,
                monthLabel,
                dayKey,
                dayLabel,
                obraId: conta.obra_id,
                companyId: conta.empresa_id || undefined,
                companyName: conta.empresa_nome || undefined,
                status: parcela.status,
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
    let filteredItems = items;

    // Filtro por empresa
    if (selectedCompany) {
      const selectedCompanyName = companies.find((c) => c.id === selectedCompany)?.nome?.toLowerCase();

      filteredItems = filteredItems.filter((installment) => {
        if (installment.companyId === selectedCompany) return true;

        if (installment.obra && allowedObrasForCompany?.has(installment.obra.toLowerCase())) {
          return true;
        }

        if (selectedCompanyName && installment.companyName?.toLowerCase() === selectedCompanyName) {
          return true;
        }

        return false;
      });
    }

    // Filtro por período
    const supplierFilter = selectedSupplier.trim().toLowerCase();
    if (supplierFilter) {
      filteredItems = filteredItems.filter((installment) =>
        installment.supplier.toLowerCase().includes(supplierFilter)
      );
    }

    const obraFilter = selectedObra.trim().toLowerCase();
    if (obraFilter) {
      filteredItems = filteredItems.filter((installment) =>
        (installment.obra || "").toLowerCase().includes(obraFilter)
      );
    }

    if (startDate || endDate) {
      filteredItems = filteredItems.filter((installment) => {
        if (!installment.dueIso) return false;
        
        const installmentDate = new Date(installment.dueIso);
        
        if (startDate && installmentDate < startDate) return false;
        if (endDate && installmentDate > endDate) return false;
        
        return true;
      });
    }

    return filteredItems;
  }, [allowedObrasForCompany, companies, items, selectedCompany, selectedObra, selectedSupplier, startDate, endDate]);

  const totalFiltrado = useMemo(
    () => visibleInstallments.reduce((sum, installment) => sum + installment.value, 0),
    [visibleInstallments]
  );
  const selectedCompanyLabel =
    selectedCompany && companies.length > 0 ? companies.find((c) => c.id === selectedCompany)?.nome : undefined;
  const selectedSupplierLabel = selectedSupplier.trim();
  const selectedObraLabel = selectedObra.trim();
  const monthlyInstallments = useMemo(() => {
    return visibleInstallments
      .sort((a, b) => {
        const aKey = a.dueIso ?? a.due;
        const bKey = b.dueIso ?? b.due;
        return aKey.localeCompare(bKey);
      });
  }, [visibleInstallments]);

  const dailyGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const installment of monthlyInstallments) {
      const key = installment.dayKey;
      const current = map.get(key);
      if (current) {
        current.total += installment.value;
        current.parcels += 1;
        current.items.push(installment);
        // Ordenar itens do dia em ordem crescente de valor
        current.items.sort((a, b) => a.value - b.value);
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
      const periodSafe = `${formatInputDate(startDate) || "inicio"}_${formatInputDate(endDate) || "fim"}`.replace(/[^\w-]/g, "");
      const companySafe = (companyNome || selectedCompany || "todas").replace(/[^\w-]/g, "");
      const filename = `parcelas_faturadas_${periodSafe}_${companySafe}.pdf`;

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
        {/* Filtros */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <FornecedorSelect
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              label="Fornecedor"
              className="space-y-1.5 xl:col-span-3"
              labelClassName="text-xs"
              placeholder="Digite para buscar fornecedor..."
            />

            <div className="space-y-1.5 xl:col-span-3">
              <Label className="text-xs">Obra</Label>
              <ObraSelect
                value={selectedObra}
                onChange={setSelectedObra}
                placeholder="Digite para buscar obra..."
              />
            </div>

            <div className="xl:col-span-2">
              <EmpresaSelect
                value={selectedCompany}
                onChange={setSelectedCompany}
                label="Empresa"
                allowAll
              />
            </div>

            <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
              <Label className="text-xs">Período</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={formatInputDate(startDate)}
                  onChange={(e) => setStartDate(parseInputDate(e.target.value))}
                  aria-label="Data inicial"
                />
                <Input
                  type="date"
                  value={formatInputDate(endDate)}
                  onChange={(e) => setEndDate(parseInputDate(e.target.value))}
                  aria-label="Data final"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedSupplier("");
                setSelectedObra("");
                setSelectedCompany("");
                setStartDate(undefined);
                setEndDate(undefined);
              }}
              className="w-full md:w-auto"
            >
              <X className="mr-1 h-4 w-4" />
              Limpar filtros
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              Parcelas filtradas
            </h2>
            <p className="text-sm text-muted-foreground">
              {visibleInstallments.length ? `${visibleInstallments.length} parcelas previstas` : "Registros vazios"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm font-semibold text-blue-600 sm:order-0">{formatCurrencyBR(totalFiltrado)}</p>

            <ConfigurarLimiteModal>
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
              Mostra cada vencimento e o total consolidado do dia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={tableRef}>
              <div className="mb-3 rounded-md border bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Relatório</p>
                <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-base font-semibold leading-tight">Compras faturadas</h3>
                  <p className="text-sm text-muted-foreground">
                    {startDate || endDate
                      ? `Período: ${formatInputDate(startDate) || "Início"} a ${formatInputDate(endDate) || "Fim"}`
                      : "Período: Todos"}
                    {selectedCompanyLabel ? ` • Empresa: ${selectedCompanyLabel}` : ""}
                    {selectedSupplierLabel ? ` • Fornecedor: ${selectedSupplierLabel}` : ""}
                    {selectedObraLabel ? ` • Obra: ${selectedObraLabel}` : ""}
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
                      <TableHead>Obra</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyGroups.map((day) => [
                      <TableRow key={day.key}>
                        <TableCell colSpan={7}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-semibold">{day.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {day.parcels} parcela{day.parcels === 1 ? '' : 's'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-black">
                                Total: {formatCurrencyBR(day.total)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...day.items.map((installment) => (
                        <TableRow key={installment.id}>
                          <TableCell>
                            {installment.dueIso 
                              ? new Date(installment.dueIso + 'T00:00:00').toLocaleDateString('pt-BR')
                              : installment.due}
                          </TableCell>
                          <TableCell className="align-middle">
                            <span
                              className={`px-3 rounded text-xs font-medium ${
                                installment.tipo === 'conta_pagar'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                              style={{
                                display: 'inline-block',
                                height: '22px',
                                lineHeight: '22px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                paddingLeft: '10px',
                                paddingRight: '10px'
                              }}
                            >
                              {installment.tipo === 'conta_pagar'
                                ? 'Conta a Pagar'
                                : 'Compra Faturada'}
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
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{installment.pedido || 'Sem pedido'}</div>
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
