import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Abastecimento } from './combustivelService';
import { formatCurrencyBR, formatDateBR } from './comprasService';

export function exportAbastecimentosPDF(items: Abastecimento[]) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(14);
  doc.text('Relatório de Abastecimentos', 14, 15);

  const total = items.reduce((s, i) => s + i.valor_total, 0);
  const totalLitros = items.reduce((s, i) => s + i.quantidade_litros, 0);

  autoTable(doc, {
    startY: 22,
    head: [['Data', 'Veículo', 'Placa', 'Categoria', 'NF-e', 'Combustível', 'Qtd (L)', 'Valor Unit.', 'Valor Total']],
    body: items.map(i => [
      formatDateBR(i.data),
      i.veiculo?.modelo || '',
      i.veiculo?.placa || '',
      i.veiculo?.categoria || '',
      i.nfe || '',
      i.combustivel?.nome || '',
      i.quantidade_litros.toFixed(2),
      formatCurrencyBR(i.valor_unitario),
      formatCurrencyBR(i.valor_total),
    ]),
    foot: [['', '', '', '', '', 'TOTAL', totalLitros.toFixed(2), '', formatCurrencyBR(total)]],
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [236, 240, 241], textColor: [0, 0, 0], fontStyle: 'bold' },
  });

  doc.save('abastecimentos.pdf');
}

export function exportAbastecimentosXLSX(items: Abastecimento[]) {
  const rows = items.map(i => ({
    Data: formatDateBR(i.data),
    Veículo: i.veiculo?.modelo || '',
    Placa: i.veiculo?.placa || '',
    Categoria: i.veiculo?.categoria || '',
    'NF-e': i.nfe || '',
    Combustível: i.combustivel?.nome || '',
    'Qtd (L)': i.quantidade_litros,
    'Valor Unit.': i.valor_unitario,
    'Valor Total': i.valor_total,
    Observação: i.observacao || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abastecimentos');
  XLSX.writeFile(wb, 'abastecimentos.xlsx');
}
