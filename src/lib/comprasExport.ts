import { CompraFaturada, CompraAvista, EspelhoItem, ConfigRelatorio, ProgramacaoSemanal, formatCurrencyBR, formatDateBR } from './comprasService';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16)
  ];
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

function fitLogo(naturalW: number, naturalH: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / naturalW, maxH / naturalH);
  return { w: naturalW * ratio, h: naturalH * ratio };
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

function addObservation(doc: any, observation: string | undefined) {
  if (!observation?.trim()) return;

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  let y = finalY + 10;

  if (y > pageHeight - 30) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('OBSERVAÇÃO:', 14, y);
  doc.setFont(undefined, 'normal');
  const lines = doc.splitTextToSize(observation, pageWidth - 28);
  doc.text(lines, 14, y + 6);
}

function applySheetColumns(ws: any, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function buildGroupedEspelhoRows(items: EspelhoItem[]) {
  const sorted = [...items].sort((a, b) => {
    const f = a.fornecedor.localeCompare(b.fornecedor);
    if (f !== 0) return f;
    return a.obra.localeCompare(b.obra);
  });

  const rows: any[] = [];
  let idx = 0;

  while (idx < sorted.length) {
    const fornecedorAtual = sorted[idx].fornecedor;
    const grupo: EspelhoItem[] = [];
    let j = idx;

    while (j < sorted.length && sorted[j].fornecedor === fornecedorAtual) {
      grupo.push(sorted[j]);
      j++;
    }

    const totalFornecedor = grupo.reduce((s, x) => s + x.valor_por_obra, 0);

    grupo.forEach((item, groupIndex) => {
      if (groupIndex === 0) {
        rows.push([
          { content: String(item.item), rowSpan: grupo.length, styles: { halign: 'center', valign: 'middle' } },
          { content: item.fornecedor, rowSpan: grupo.length, styles: { valign: 'middle' } },
          { content: item.razao_social, rowSpan: grupo.length, styles: { valign: 'middle' } },
          { content: item.banco, rowSpan: grupo.length, styles: { halign: 'center', valign: 'middle' } },
          { content: item.agencia, rowSpan: grupo.length, styles: { halign: 'center', valign: 'middle' } },
          { content: item.conta, rowSpan: grupo.length, styles: { valign: 'middle' } },
          item.obra,
          { content: item.pedido || '', styles: { halign: 'center' } },
          { content: formatCurrencyBR(item.valor_por_obra), styles: { halign: 'right' } },
          {
            content: formatCurrencyBR(totalFornecedor),
            rowSpan: grupo.length,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' }
          }
        ]);
      } else {
        rows.push([
          item.obra,
          { content: item.pedido || '', styles: { halign: 'center' } },
          { content: formatCurrencyBR(item.valor_por_obra), styles: { halign: 'right' } }
        ]);
      }
    });

    idx = j;
  }

  return rows;
}

function buildEspelhoXlsxData(title1: string, title2: string, items: EspelhoItem[], dateStr: string, observation?: string) {
  const sorted = [...items].sort((a, b) => {
    const f = a.fornecedor.localeCompare(b.fornecedor);
    if (f !== 0) return f;
    return a.obra.localeCompare(b.obra);
  });

  const totalGeral = sorted.reduce((s, i) => s + i.valor_por_obra, 0);

  const data: any[][] = [
    [title1],
    [title2],
    [`DATA: ${dateStr || new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['ITEM', 'FORNECEDOR', 'RAZÃO SOCIAL', 'BANCO', 'AGÊNCIA', 'CONTA', 'OBRA', 'Nº PEDIDO', 'VALOR POR OBRA', 'TOTAL FORNECEDOR'],
  ];

  let lastFornecedor = '';
  for (const i of sorted) {
    if (lastFornecedor && i.fornecedor.toLowerCase() !== lastFornecedor.toLowerCase()) {
      data.push(['', '', '', '', '', '', '', '', '', '']);
    }
    data.push([i.item, i.fornecedor, i.razao_social, i.banco, i.agencia, i.conta, i.obra, i.pedido || '', i.valor_por_obra, i.total_fornecedor]);
    lastFornecedor = i.fornecedor;
  }

  data.push(['', '', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', '', 'TOTAL GERAL', totalGeral, '']);

  if (observation?.trim()) {
    data.push([]);
    data.push(['OBSERVAÇÃO:', observation]);
  }

  return data;
}

// ---- Faturadas PDF ----
export async function exportFaturadasPDF(items: CompraFaturada[], config?: ConfigRelatorio | null, observation?: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config ? hexToRgb(config.cor_cabecalho) : [30, 55, 100] as [number, number, number];
  const fontSize = config?.tamanho_fonte || 8;

  await addLogos(doc, config || null, pageWidth);

  doc.setFontSize(16);
  doc.text('PREVISÃO DE COMPRAS FATURADO', pageWidth / 2, 16, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

  const rows = items.map(i => [
    formatDateBR(i.data),
    i.fornecedor,
    i.pedido || '',
    i.forma_pagamento || '',
    i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '',
    i.cnpj_cpf || '',
    formatCurrencyBR(i.valor),
    i.obra || '',
    i.observacao || ''
  ]);

  const total = items.reduce((s, i) => s + i.valor, 0);
  rows.push(['', '', '', '', '', 'TOTAL', formatCurrencyBR(total), '', '']);

  autoTable(doc, {
    startY: 34,
    head: [['Data', 'Fornecedor', 'Nº Pedido', 'Forma Pgto', 'Dt. Liquidação', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação']],
    body: rows,
    tableWidth: 'auto',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize,
      fontStyle: config?.negrito ? 'bold' : 'normal',
      overflow: 'linebreak',
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: headerColor,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    footStyles: {
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    tableLineWidth: 0.3,
    tableLineColor: [0, 0, 0]
  });

  addObservation(doc, observation);
  doc.save('previsao-compras-faturado.pdf');
}

// ---- Faturadas XLSX ----
export async function exportFaturadasXLSX(items: CompraFaturada[], observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const data: any[][] = [
    ['Data', 'Fornecedor', 'Nº Pedido', 'Forma Pgto', 'Dt. Liquidação', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação'],
    ...items.map(i => [
      formatDateBR(i.data),
      i.fornecedor,
      i.pedido || '',
      i.forma_pagamento || '',
      i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '',
      i.cnpj_cpf || '',
      i.valor,
      i.obra || '',
      i.observacao || ''
    ]),
    ['', '', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.valor, 0), '', ''],
  ];

  if (observation?.trim()) {
    data.push([]);
    data.push(['OBSERVAÇÃO:', observation]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetColumns(ws, [12, 28, 16, 16, 16, 18, 14, 22, 28]);

  XLSX.utils.book_append_sheet(wb, ws, 'Faturadas');
  XLSX.writeFile(wb, 'previsao-compras-faturado.xlsx');
}

// ---- À Vista PDF ----
export async function exportAvistaPDF(items: CompraAvista[], config?: ConfigRelatorio | null, observation?: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config ? hexToRgb(config.cor_cabecalho) : [30, 55, 100] as [number, number, number];
  const fontSize = config?.tamanho_fonte || 8;

  await addLogos(doc, config || null, pageWidth);

  doc.setFontSize(16);
  doc.text('PREVISÃO DE COMPRAS À VISTA', pageWidth / 2, 16, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

  const rows = items.map(i => [
    formatDateBR(i.data),
    i.fornecedor,
    i.pedido || '',
    i.banco || '',
    i.agencia || '',
    i.conta || '',
    i.cnpj_cpf || '',
    formatCurrencyBR(i.valor),
    i.obra || '',
    i.observacao || ''
  ]);

  const total = items.reduce((s, i) => s + i.valor, 0);
  rows.push(['', '', '', '', '', '', 'TOTAL', formatCurrencyBR(total), '', '']);

  autoTable(doc, {
    startY: 34,
    head: [['Data', 'Fornecedor', 'Pedido', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação']],
    body: rows,
    tableWidth: 'auto',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize,
      fontStyle: config?.negrito ? 'bold' : 'normal',
      overflow: 'linebreak',
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: headerColor,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    footStyles: {
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    tableLineWidth: 0.3,
    tableLineColor: [0, 0, 0]
  });

  addObservation(doc, observation);
  doc.save('previsao-compras-avista.pdf');
}

// ---- À Vista XLSX ----
export async function exportAvistaXLSX(items: CompraAvista[], observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const data: any[][] = [
    ['Data', 'Fornecedor', 'Pedido', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação'],
    ...items.map(i => [
      formatDateBR(i.data),
      i.fornecedor,
      i.pedido || '',
      i.banco || '',
      i.agencia || '',
      i.conta || '',
      i.cnpj_cpf || '',
      i.valor,
      i.obra || '',
      i.observacao || ''
    ]),
    ['', '', '', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.valor, 0), '', ''],
  ];

  if (observation?.trim()) {
    data.push([]);
    data.push(['OBSERVAÇÃO:', observation]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetColumns(ws, [12, 28, 16, 12, 12, 14, 18, 14, 22, 28]);

  XLSX.utils.book_append_sheet(wb, ws, 'À Vista');
  XLSX.writeFile(wb, 'previsao-compras-avista.xlsx');
}

// ---- Espelho Geral PDF ----
export async function exportEspelhoPDF(
  items: EspelhoItem[],
  dateStr: string,
  config?: ConfigRelatorio | null,
  observation?: string
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config
    ? hexToRgb(config.cor_cabecalho)
    : [30, 55, 100] as [number, number, number];
  const fontSize = config?.tamanho_fonte || 8;

  await addLogos(doc, config || null, pageWidth);

  doc.setFontSize(16);
  doc.text('PROGRAMAÇÃO SEMANAL', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(12);
  doc.text('PROGRAMAÇÃO RESUMO', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`DATA: ${dateStr || new Date().toLocaleDateString('pt-BR')}`, 14, 30);

  const rows = buildGroupedEspelhoRows(items);
  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);

  rows.push([
    '', '', '', '', '', '', '',
    'TOTAL GERAL',
    formatCurrencyBR(totalGeral),
    ''
  ]);

  autoTable(doc, {
    startY: 36,
    head: [[
      'ITEM',
      'FORNECEDOR',
      'RAZÃO SOCIAL',
      'BANCO',
      'AGÊNCIA',
      'CONTA',
      'OBRA',
      'Nº PEDIDO',
      'VALOR POR OBRA',
      'TOTAL FORNECEDOR'
    ]],
    body: rows,
    tableWidth: 'auto',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize,
      fontStyle: config?.negrito ? 'bold' : 'normal',
      overflow: 'linebreak',
      cellPadding: 2,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'right' },
      9: { halign: 'center' }
    },
    headStyles: {
      fillColor: headerColor,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    didParseCell(data) {
      const text = data.cell.text?.[0] || '';
      if (text === 'TOTAL GERAL') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    tableLineWidth: 0.3,
    tableLineColor: [0, 0, 0]
  });

  addObservation(doc, observation);
  doc.save('espelho-geral.pdf');
}

// ---- Espelho Geral XLSX ----
export async function exportEspelhoXLSX(items: EspelhoItem[], dateStr: string, observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const data = buildEspelhoXlsxData(
    'PREVISÃO DE COMPRAS À VISTA',
    'PLANILHA RESUMO PREVISÃO DE COMPRAS',
    items,
    dateStr,
    observation
  );

  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetColumns(ws, [6, 25, 25, 12, 10, 15, 20, 18, 18]);

  XLSX.utils.book_append_sheet(wb, ws, 'Espelho Geral');
  XLSX.writeFile(wb, 'espelho-geral.xlsx');
}

// ---- Programação Semanal PDF ----
export async function exportProgramacaoSemanalPDF(items: ProgramacaoSemanal[], config?: ConfigRelatorio | null, observation?: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config ? hexToRgb(config.cor_cabecalho) : [30, 55, 100] as [number, number, number];
  const fontSize = config?.tamanho_fonte || 8;

  await addLogos(doc, config || null, pageWidth);

  doc.setFontSize(16);
  doc.text('PROGRAMAÇÃO SEMANAL', pageWidth / 2, 16, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

  const rows = items.map(i => [
    formatDateBR(i.data),
    i.fornecedor,
    i.pedido || '',
    i.banco || '',
    i.agencia || '',
    i.conta || '',
    i.cnpj_cpf || '',
    formatCurrencyBR(i.valor),
    i.obra || '',
    i.responsavel || '',
    i.observacao || ''
  ]);

  const total = items.reduce((s, i) => s + i.valor, 0);
  rows.push(['', '', '', '', '', '', 'TOTAL', formatCurrencyBR(total), '', '', '']);

  autoTable(doc, {
    startY: 34,
    head: [['Data', 'Fornecedor', 'Pedido', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Responsável', 'Observação']],
    body: rows,
    tableWidth: 'auto',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize,
      fontStyle: config?.negrito ? 'bold' : 'normal',
      overflow: 'linebreak',
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: headerColor,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    footStyles: {
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    tableLineWidth: 0.3,
    tableLineColor: [0, 0, 0]
  });

  addObservation(doc, observation);
  doc.save('programacao-semanal.pdf');
}

// ---- Programação Semanal XLSX ----
export async function exportProgramacaoSemanalXLSX(items: ProgramacaoSemanal[], observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const data: any[][] = [
    ['Data', 'Fornecedor', 'Pedido', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Responsável', 'Observação'],
    ...items.map(i => [
      formatDateBR(i.data),
      i.fornecedor,
      i.pedido || '',
      i.banco || '',
      i.agencia || '',
      i.conta || '',
      i.cnpj_cpf || '',
      i.valor,
      i.obra || '',
      i.responsavel || '',
      i.observacao || ''
    ]),
    ['', '', '', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.valor, 0), '', '', ''],
  ];

  if (observation?.trim()) {
    data.push([]);
    data.push(['OBSERVAÇÃO:', observation]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetColumns(ws, [12, 28, 16, 12, 12, 14, 18, 14, 20, 20, 28]);

  XLSX.utils.book_append_sheet(wb, ws, 'Programação Semanal');
  XLSX.writeFile(wb, 'programacao-semanal.xlsx');
}

// ---- Espelho Semanal PDF ----
export async function exportEspelhoSemanalPDF(items: EspelhoItem[], dateStr: string, config?: ConfigRelatorio | null, observation?: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config ? hexToRgb(config.cor_cabecalho) : [30, 55, 100] as [number, number, number];
  const fontSize = config?.tamanho_fonte || 8;

  await addLogos(doc, config || null, pageWidth);

  doc.setFontSize(16);
  doc.text('ESPELHO SEMANAL', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(12);
  doc.text('RESUMO PROGRAMAÇÃO SEMANAL', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`DATA: ${dateStr || new Date().toLocaleDateString('pt-BR')}`, 14, 30);

  const rows = buildGroupedEspelhoRows(items);
  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);

  rows.push(['', '', '', '', '', '', 'TOTAL GERAL', formatCurrencyBR(totalGeral), '']);

  autoTable(doc, {
    startY: 36,
    head: [['ITEM', 'FORNECEDOR', 'RAZÃO SOCIAL', 'BANCO', 'AGÊNCIA', 'CONTA', 'OBRA', 'VALOR POR OBRA', 'TOTAL FORNECEDOR']],
    body: rows,
    tableWidth: 'auto',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize,
      fontStyle: config?.negrito ? 'bold' : 'normal',
      overflow: 'linebreak',
      cellPadding: 2,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center' },
      7: { halign: 'right' },
      8: { halign: 'center' }
    },
    headStyles: {
      fillColor: headerColor,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    didParseCell(data) {
      const text = data.cell.text?.[0] || '';
      if (text === 'TOTAL GERAL') data.cell.styles.fontStyle = 'bold';
    },
    tableLineWidth: 0.3,
    tableLineColor: [0, 0, 0]
  });

  addObservation(doc, observation);
  doc.save('espelho-semanal.pdf');
}

// ---- Espelho Semanal XLSX ----
export async function exportEspelhoSemanalXLSX(items: EspelhoItem[], dateStr: string, observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const data = buildEspelhoXlsxData(
    'ESPELHO SEMANAL',
    'RESUMO PROGRAMAÇÃO SEMANAL',
    items,
    dateStr,
    observation
  );

  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetColumns(ws, [6, 25, 25, 12, 10, 15, 20, 18, 18]);

  XLSX.utils.book_append_sheet(wb, ws, 'Espelho Semanal');
  XLSX.writeFile(wb, 'espelho-semanal.xlsx');
}
