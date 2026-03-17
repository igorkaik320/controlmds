import { Transaction, Verification, formatCurrency, getSummary } from './cashRegister';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function typeText(type: string) {
  switch (type) {
    case 'inicializacao': return 'Inicialização';
    case 'entrada': return 'Entrada';
    case 'saida': return 'Saída';
    default: return type;
  }
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

const LOGO_STORAGE_KEY = 'controle-caixa-logo';

export function saveLogo(dataUrl: string) { localStorage.setItem(LOGO_STORAGE_KEY, dataUrl); }
export function getLogo(): string | null { return localStorage.getItem(LOGO_STORAGE_KEY); }
export function removeLogo() { localStorage.removeItem(LOGO_STORAGE_KEY); }

export async function exportPDF(transactions: Transaction[], verifications: Verification[], profileMap: Record<string, string>) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const summary = getSummary(transactions, verifications);
  const logo = getLogo();
  let startY = 20;
  let logoDims: { w: number; h: number } | null = null;

  if (logo) {
    try {
      const logoFormat = getImageFormat(logo);
      const natural = await getImageDimensions(logo);
      logoDims = fitLogo(natural.width, natural.height, 40, 20);
      doc.addImage(logo, logoFormat, 14, 12, logoDims.w, logoDims.h);
      startY = 18;
      const textX = 14 + (logoDims?.w ?? 0) + 6;
      doc.setFontSize(18); doc.text('Controle de Caixa - Relatório', textX, startY);
      doc.setFontSize(10); doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, textX, startY + 6);
      doc.text(`Saldo Atual: ${formatCurrency(summary.currentBalance)}`, textX, startY + 12);
      doc.text(`Entradas: ${formatCurrency(summary.totalEntradas)} | Saídas: ${formatCurrency(summary.totalSaidas)} | Última Diferença: ${formatCurrency(summary.totalDifferences)}`, textX, startY + 18);
      startY = startY + 26;
    } catch {
      doc.setFontSize(18); doc.text('Controle de Caixa - Relatório', 14, 20);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
      doc.text(`Saldo Atual: ${formatCurrency(summary.currentBalance)}`, 14, 34);
      doc.text(`Entradas: ${formatCurrency(summary.totalEntradas)} | Saídas: ${formatCurrency(summary.totalSaidas)} | Última Diferença: ${formatCurrency(summary.totalDifferences)}`, 14, 40);
      startY = 46;
    }
  } else {
    doc.setFontSize(18); doc.text('Controle de Caixa - Relatório', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    doc.text(`Saldo Atual: ${formatCurrency(summary.currentBalance)}`, 14, 34);
    doc.text(`Entradas: ${formatCurrency(summary.totalEntradas)} | Saídas: ${formatCurrency(summary.totalSaidas)} | Última Diferença: ${formatCurrency(summary.totalDifferences)}`, 14, 40);
    startY = 46;
  }

  const rows = transactions.map((t) => [formatDate(t.date), typeText(t.type), formatCurrency(t.value), formatCurrency(t.balance_before), formatCurrency(t.balance_after), t.gaveta != null ? formatCurrency(t.gaveta) : '—', formatCurrency(t.difference), t.obra || '', t.fornecedor || '', t.nota_numero || '', t.observation || '', profileMap[t.created_by] || '']);
  autoTable(doc, { startY, head: [['Data', 'Tipo', 'Valor', 'Saldo Ant.', 'Saldo Final', 'Gaveta', 'Diferença', 'Obra', 'Fornecedor', 'Nº Nota', 'Obs.', 'Usuário']], body: rows, styles: { fontSize: 7 }, headStyles: { fillColor: [30, 55, 100] } });

  if (verifications.length > 0) {
    doc.addPage();
    if (logo && logoDims) { try { const logoFormat = getImageFormat(logo); const smallDims = fitLogo(logoDims.w, logoDims.h, 30, 15); doc.addImage(logo, logoFormat, 14, 10, smallDims.w, smallDims.h); } catch {} }
    doc.setFontSize(14); doc.text('Conferências de Caixa', logo ? 40 : 14, 20);
    const vRows = verifications.map((v) => [formatDate(v.date), formatCurrency(v.system_balance), formatCurrency(v.gaveta_value), formatCurrency(v.difference), profileMap[v.created_by] || '', v.observation || '']);
    autoTable(doc, { startY: 28, head: [['Data', 'Saldo Sistema', 'Valor Físico', 'Diferença', 'Conferente', 'Obs.']], body: vRows, styles: { fontSize: 8 }, headStyles: { fillColor: [30, 55, 100] } });
  }
  doc.save('controle-caixa.pdf');
}

export async function exportXLSX(transactions: Transaction[], verifications: Verification[], profileMap: Record<string, string>) {
  const XLSX = await import('xlsx');
  const summary = getSummary(transactions, verifications);
  const wb = XLSX.utils.book_new();
  const ws1Data = [
    ['Data', 'Tipo', 'Valor', 'Saldo Anterior', 'Saldo Final', 'Gaveta', 'Diferença', 'Obra', 'Fornecedor', 'Nº Nota', 'Observação', 'Usuário'],
    ...transactions.map((t) => [formatDate(t.date), typeText(t.type), t.value, t.balance_before, t.balance_after, t.gaveta ?? '', t.difference, t.obra || '', t.fornecedor || '', t.nota_numero || '', t.observation || '', profileMap[t.created_by] || '']),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws1Data), 'Lançamentos');
  const ws2Data = [
    ['Data', 'Saldo Sistema', 'Valor Físico', 'Diferença', 'Conferente', 'Observação'],
    ...verifications.map((v) => [formatDate(v.date), v.system_balance, v.gaveta_value, v.difference, profileMap[v.created_by] || '', v.observation || '']),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws2Data), 'Conferências');
  const ws3Data = [['Resumo do Período'], [''], ['Saldo Atual', summary.currentBalance], ['Total Entradas', summary.totalEntradas], ['Total Saídas', summary.totalSaidas], ['Última Diferença', summary.totalDifferences], ['Divergência?', summary.hasDivergence ? 'Sim' : 'Não']];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws3Data), 'Resumo');
  XLSX.writeFile(wb, 'controle-caixa.xlsx');
}
