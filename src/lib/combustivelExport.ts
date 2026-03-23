import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Abastecimento } from './combustivelService';
import { formatCurrencyBR, formatDateBR } from './comprasService';

export function exportAbastecimentosPDF(items: Abastecimento[]) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(14);
  doc.text('Relatorio de Abastecimentos', 14, 15);

  const total = items.reduce((sum, item) => sum + item.valor_total, 0);
  const totalLitros = items.reduce((sum, item) => sum + item.quantidade_litros, 0);

  autoTable(doc, {
    startY: 22,
    head: [[
      'Data',
      'Veiculo',
      'Obra',
      'Posto',
      'NF-e',
      'Combustivel',
      'Qtd (L)',
      'Valor Unit.',
      'Valor Total'
    ]],
    body: items.map((item) => [
      formatDateBR(item.data),
      item.veiculo?.placa || '',
      item.obra?.nome || '',
      item.posto?.nome || '',
      item.nfe || '',
      item.combustivel?.nome || '',
      item.quantidade_litros.toFixed(2),
      formatCurrencyBR(item.valor_unitario),
      formatCurrencyBR(item.valor_total),
    ]),
    foot: [[
      '',
      '',
      '',
      '',
      '',
      'TOTAL',
      totalLitros.toFixed(2),
      '',
      formatCurrencyBR(total)
    ]],
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: {
      fillColor: [236, 240, 241],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
  });

  doc.save('abastecimentos.pdf');
}

export function exportAbastecimentosXLSX(items: Abastecimento[]) {
  const rows = items.map((item) => ({
    Data: formatDateBR(item.data),
    Veiculo: item.veiculo?.placa || '',
    Obra: item.obra?.nome || '',
    Posto: item.posto?.nome || '',
    'NF-e': item.nfe || '',
    Combustivel: item.combustivel?.nome || '',
    'Qtd (L)': item.quantidade_litros,
    'Valor Unit.': item.valor_unitario,
    'Valor Total': item.valor_total,
    Observacao: item.observacao || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
  XLSX.writeFile(wb, 'abastecimentos.xlsx');
}
