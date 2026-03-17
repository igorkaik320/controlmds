import { CompraFaturada, CompraAvista, EspelhoItem, ConfigRelatorio, ProgramacaoSemanal, formatCurrencyBR, formatDateBR } from './comprasService';

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
  if (y > pageHeight - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('OBSERVAÇÃO:', 14, y);
  doc.setFont(undefined, 'normal');
  const lines = doc.splitTextToSize(observation, pageWidth - 28);
  doc.text(lines, 14, y + 6);
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
  const rows = items.map(i => [formatDateBR(i.data), i.fornecedor, i.pedido || '', i.forma_pagamento || '', i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '', i.cnpj_cpf || '', formatCurrencyBR(i.valor), i.obra || '', i.observacao || '']);
  const total = items.reduce((s, i) => s + i.valor, 0);
  rows.push(['', '', '', '', '', 'TOTAL', formatCurrencyBR(total), '', '']);
  autoTable(doc, { startY: 34, head: [['Data', 'Fornecedor', 'Nº Pedido', 'Forma Pgto', 'Dt. Liquidação', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação']], body: rows, styles: { fontSize, fontStyle: config?.negrito ? 'bold' : 'normal' }, headStyles: { fillColor: headerColor } });
  addObservation(doc, observation);
  doc.save('previsao-compras-faturado.pdf');
}

// ---- Faturadas XLSX ----
export async function exportFaturadasXLSX(items: CompraFaturada[], observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const data: any[][] = [
    ['Data', 'Fornecedor', 'Nº Pedido', 'Forma Pgto', 'Dt. Liquidação', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação'],
    ...items.map(i => [formatDateBR(i.data), i.fornecedor, i.pedido || '', i.forma_pagamento || '', i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '', i.cnpj_cpf || '', i.valor, i.obra || '', i.observacao || '']),
    ['', '', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.valor, 0), '', ''],
  ];
  if (observation?.trim()) { data.push([]); data.push(['OBSERVAÇÃO:', observation]); }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Faturadas');
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
  const rows = items.map(i => [formatDateBR(i.data), i.fornecedor, i.banco || '', i.agencia || '', i.conta || '', i.cnpj_cpf || '', formatCurrencyBR(i.valor), i.obra || '', i.observacao || '']);
  const total = items.reduce((s, i) => s + i.valor, 0);
  rows.push(['', '', '', '', '', 'TOTAL', formatCurrencyBR(total), '', '']);
  autoTable(doc, { startY: 34, head: [['Data', 'Fornecedor', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação']], body: rows, styles: { fontSize, fontStyle: config?.negrito ? 'bold' : 'normal' }, headStyles: { fillColor: headerColor } });
  addObservation(doc, observation);
  doc.save('previsao-compras-avista.pdf');
}

// ---- À Vista XLSX ----
export async function exportAvistaXLSX(items: CompraAvista[], observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const data: any[][] = [
    ['Data', 'Fornecedor', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Observação'],
    ...items.map(i => [formatDateBR(i.data), i.fornecedor, i.banco || '', i.agencia || '', i.conta || '', i.cnpj_cpf || '', i.valor, i.obra || '', i.observacao || '']),
    ['', '', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.valor, 0), '', ''],
  ];
  if (observation?.trim()) { data.push([]); data.push(['OBSERVAÇÃO:', observation]); }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'À Vista');
  XLSX.writeFile(wb, 'previsao-compras-avista.xlsx');
}

// ---- Espelho Geral PDF ----
export async function exportEspelhoPDF(items: EspelhoItem[], dateStr: string, config?: ConfigRelatorio | null, observation?: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = config ? hexToRgb(config.cor_cabecalho) : [30, 55, 100] as [number, number, number];
  const fontSize = config?.tamanho_fonte || 8;
  await addLogos(doc, config || null, pageWidth);
  doc.setFontSize(16);
  doc.text('PROGRAMAÇÃO SEMANAL', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(12);
  doc.text('PROGRAMAÇÃO RESUMO', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`DATA: ${dateStr || new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  const rows = items.map(i => [String(i.item), i.fornecedor, i.razao_social, i.banco, i.agencia, i.conta, i.obra, formatCurrencyBR(i.valor_por_obra), formatCurrencyBR(i.total_fornecedor)]);
  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);
  rows.push(['', '', '', '', '', '', 'TOTAL GERAL', formatCurrencyBR(totalGeral), '']);
  autoTable(doc, { startY: 36, head: [['ITEM', 'FORNECEDOR', 'RAZÃO SOCIAL', 'BANCO', 'AGÊNCIA', 'CONTA', 'OBRA', 'VALOR POR OBRA', 'TOTAL FORNECEDOR']], body: rows, styles: { fontSize, fontStyle: config?.negrito ? 'bold' : 'normal' }, headStyles: { fillColor: headerColor } });
  addObservation(doc, observation);
  doc.save('espelho-geral.pdf');
}

// ---- Espelho Geral XLSX (with separator lines) ----
export async function exportEspelhoXLSX(items: EspelhoItem[], dateStr: string, observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);

  const data: any[][] = [
    ['PREVISÃO DE COMPRAS À VISTA'],
    ['PLANILHA RESUMO PREVISÃO DE COMPRAS'],
    [`DATA: ${dateStr || new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['ITEM', 'FORNECEDOR', 'RAZÃO SOCIAL', 'BANCO', 'AGÊNCIA', 'CONTA', 'OBRA', 'VALOR POR OBRA', 'TOTAL FORNECEDOR'],
  ];

  // Group items by fornecedor and add separator lines between groups
  let lastFornecedor = '';
  for (const i of items) {
    if (lastFornecedor && i.fornecedor.toLowerCase() !== lastFornecedor.toLowerCase()) {
      // Add empty separator row between different fornecedores
      data.push(['', '', '', '', '', '', '', '', '']);
    }
    data.push([i.item, i.fornecedor, i.razao_social, i.banco, i.agencia, i.conta, i.obra, i.valor_por_obra, i.total_fornecedor]);
    lastFornecedor = i.fornecedor;
  }

  data.push(['', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', 'TOTAL GERAL', totalGeral, '']);

  if (observation?.trim()) { data.push([]); data.push(['OBSERVAÇÃO:', observation]); }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better readability
  ws['!cols'] = [
    { wch: 6 },   // ITEM
    { wch: 25 },  // FORNECEDOR
    { wch: 25 },  // RAZÃO SOCIAL
    { wch: 12 },  // BANCO
    { wch: 10 },  // AGÊNCIA
    { wch: 15 },  // CONTA
    { wch: 20 },  // OBRA
    { wch: 18 },  // VALOR POR OBRA
    { wch: 18 },  // TOTAL FORNECEDOR
  ];

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
  const rows = items.map(i => [formatDateBR(i.data), i.fornecedor, i.banco || '', i.agencia || '', i.conta || '', i.cnpj_cpf || '', formatCurrencyBR(i.valor), i.obra || '', i.responsavel || '', i.observacao || '']);
  const total = items.reduce((s, i) => s + i.valor, 0);
  rows.push(['', '', '', '', '', 'TOTAL', formatCurrencyBR(total), '', '', '']);
  autoTable(doc, { startY: 34, head: [['Data', 'Fornecedor', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Responsável', 'Observação']], body: rows, styles: { fontSize, fontStyle: config?.negrito ? 'bold' : 'normal' }, headStyles: { fillColor: headerColor } });
  addObservation(doc, observation);
  doc.save('programacao-semanal.pdf');
}

// ---- Programação Semanal XLSX ----
export async function exportProgramacaoSemanalXLSX(items: ProgramacaoSemanal[], observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const data: any[][] = [
    ['Data', 'Fornecedor', 'Banco', 'Agência', 'Conta', 'CNPJ/CPF', 'Valor', 'Obra', 'Responsável', 'Observação'],
    ...items.map(i => [formatDateBR(i.data), i.fornecedor, i.banco || '', i.agencia || '', i.conta || '', i.cnpj_cpf || '', i.valor, i.obra || '', i.responsavel || '', i.observacao || '']),
    ['', '', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.valor, 0), '', '', ''],
  ];
  if (observation?.trim()) { data.push([]); data.push(['OBSERVAÇÃO:', observation]); }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Programação Semanal');
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
  const rows = items.map(i => [String(i.item), i.fornecedor, i.razao_social, i.banco, i.agencia, i.conta, i.obra, formatCurrencyBR(i.valor_por_obra), formatCurrencyBR(i.total_fornecedor)]);
  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);
  rows.push(['', '', '', '', '', '', 'TOTAL GERAL', formatCurrencyBR(totalGeral), '']);
  autoTable(doc, { startY: 36, head: [['ITEM', 'FORNECEDOR', 'RAZÃO SOCIAL', 'BANCO', 'AGÊNCIA', 'CONTA', 'OBRA', 'VALOR POR OBRA', 'TOTAL FORNECEDOR']], body: rows, styles: { fontSize, fontStyle: config?.negrito ? 'bold' : 'normal' }, headStyles: { fillColor: headerColor } });
  addObservation(doc, observation);
  doc.save('espelho-semanal.pdf');
}

// ---- Espelho Semanal XLSX (with separator lines) ----
export async function exportEspelhoSemanalXLSX(items: EspelhoItem[], dateStr: string, observation?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);

  const data: any[][] = [
    ['ESPELHO SEMANAL'],
    ['RESUMO PROGRAMAÇÃO SEMANAL'],
    [`DATA: ${dateStr || new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['ITEM', 'FORNECEDOR', 'RAZÃO SOCIAL', 'BANCO', 'AGÊNCIA', 'CONTA', 'OBRA', 'VALOR POR OBRA', 'TOTAL FORNECEDOR'],
  ];

  let lastFornecedor = '';
  for (const i of items) {
    if (lastFornecedor && i.fornecedor.toLowerCase() !== lastFornecedor.toLowerCase()) {
      data.push(['', '', '', '', '', '', '', '', '']);
    }
    data.push([i.item, i.fornecedor, i.razao_social, i.banco, i.agencia, i.conta, i.obra, i.valor_por_obra, i.total_fornecedor]);
    lastFornecedor = i.fornecedor;
  }

  data.push(['', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', 'TOTAL GERAL', totalGeral, '']);

  if (observation?.trim()) { data.push([]); data.push(['OBSERVAÇÃO:', observation]); }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Espelho Semanal');
  XLSX.writeFile(wb, 'espelho-semanal.xlsx');
}
