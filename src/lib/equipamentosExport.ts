import type { Equipamento } from './equipamentosService';
import { SITUACOES_EQUIPAMENTO } from './equipamentosService';
import type { ConfigRelatorio } from './comprasService';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function getImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return 'PNG';
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

function fitLogo(nW: number, nH: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / nW, maxH / nH);
  return { w: nW * r, h: nH * r };
}

async function addLogos(doc: any, config: ConfigRelatorio | null, pageWidth: number) {
  if (!config) return;
  const margin = 14;
  if (config.logo_esquerda) {
    try {
      const fmt = getImageFormat(config.logo_esquerda);
      const nat = await getImageDimensions(config.logo_esquerda);
      const dims = fitLogo(nat.width, nat.height, 40, 20);
      doc.addImage(config.logo_esquerda, fmt, margin, 5, dims.w, dims.h);
    } catch {}
  }
  if (config.logo_direita) {
    try {
      const fmt = getImageFormat(config.logo_direita);
      const nat = await getImageDimensions(config.logo_direita);
      const dims = fitLogo(nat.width, nat.height, 40, 20);
      doc.addImage(config.logo_direita, fmt, pageWidth - margin - dims.w, 5, dims.w, dims.h);
    } catch {}
  }
}

const situacaoLabel = (v?: string | null) =>
  SITUACOES_EQUIPAMENTO.find((s) => s.value === v)?.label || '-';

export async function exportEquipamentosPDF(items: Equipamento[], config?: ConfigRelatorio | null) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config ? hexToRgb(config.cor_cabecalho) : ([30, 55, 100] as [number, number, number]);
  const fontSize = config?.tamanho_fonte || 8;

  await addLogos(doc, config || null, pageWidth);

  doc.setFontSize(16);
  doc.text('RELATÓRIO DE EQUIPAMENTOS', pageWidth / 2, 16, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
  doc.text(`Total: ${items.length} equipamento(s)`, pageWidth - 14, 28, { align: 'right' });

  const rows = items.map((i) => [
    i.n_patrimonio || '-',
    i.nome,
    i.marca || '-',
    i.modelo || '-',
    i.n_serie || '-',
    i.setor_nome || '-',
    i.localizacao_obra_nome || '-',
    (i as any).responsavel || '-',
    situacaoLabel(i.situacao),
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['Patrimônio', 'Nome', 'Marca', 'Modelo', 'Série', 'Setor', 'Localização', 'Responsável', 'Situação']],
    body: rows,
    margin: { left: 10, right: 10 },
    styles: {
      fontSize,
      fontStyle: config?.negrito ? 'bold' : 'normal',
      overflow: 'linebreak',
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    headStyles: { fillColor: headerColor, lineWidth: 0.3, lineColor: [0, 0, 0] },
    tableLineWidth: 0.3,
    tableLineColor: [0, 0, 0],
  });

  doc.save(`equipamentos_${new Date().toISOString().slice(0, 10)}.pdf`);
}
