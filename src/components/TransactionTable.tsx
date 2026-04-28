import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Transaction, formatCurrency } from '@/lib/cashRegister';
import AuditInfo from '@/components/AuditInfo';

interface Props {
  transactions: Transaction[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  profileMap: Record<string, string>;
  canEdit?: boolean;
  canDelete?: boolean;
  currentUserId?: string;
}

function typeLabel(type: string) {
  switch (type) {
    case 'inicializacao':
      return <Badge variant="outline" className="border-primary text-primary">Inicialização</Badge>;
    case 'entrada':
      return <Badge className="bg-entrada text-entrada-foreground hover:bg-entrada/90">Entrada</Badge>;
    case 'saida':
      return <Badge className="bg-saida text-saida-foreground hover:bg-saida/90">Saída</Badge>;
    default:
      return null;
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso || typeof iso !== 'string') return '-';
  try {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return '-';
    return `${d}/${m}/${y}`;
  } catch {
    return '-';
  }
}

export default function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  profileMap,
  canEdit = false,
  canDelete = false,
  currentUserId,
}: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Nenhum lançamento registrado.</p>
        <p className="text-sm mt-1">Comece com uma Inicialização de Saldo.</p>
      </div>
    );
  }

  const showActions = canEdit || canDelete;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-24">Data</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="text-right w-28">Valor</TableHead>
              <TableHead className="text-right w-32">Saldo Anterior</TableHead>
              <TableHead className="text-right w-32">Saldo Final</TableHead>
              <TableHead className="text-right w-28">Gaveta</TableHead>
              <TableHead className="text-right w-28">Diferença</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Nº Nota</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Criado por</TableHead>
              {showActions && <TableHead className="w-20 text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const canEditThis = canEdit && (!currentUserId || t.created_by === currentUserId);

              return (
                <TableRow key={t.id} className="group">
                  <TableCell className="font-mono text-sm">{formatDate(t.date)}</TableCell>
                  <TableCell>{typeLabel(t.type)}</TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${
                      t.type === 'entrada' ? 'text-entrada' : t.type === 'saida' ? 'text-saida' : ''
                    }`}
                  >
                    {t.type === 'entrada' ? '+' : t.type === 'saida' ? '-' : ''}
                    {formatCurrency(t.value)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {formatCurrency(t.balance_before)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(t.balance_after)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {t.gaveta != null ? formatCurrency(t.gaveta) : '—'}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm font-medium ${
                      Math.abs(t.difference) > 0.01 ? 'text-warning' : 'text-muted-foreground'
                    }`}
                  >
                    {formatCurrency(t.difference)}
                  </TableCell>
                  <TableCell className="text-sm">{t.obra || '—'}</TableCell>
                  <TableCell className="text-sm">{t.fornecedor || '—'}</TableCell>
                  <TableCell className="text-sm">{t.nota_numero || '—'}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{t.observation || '—'}</TableCell>
                  <TableCell className="text-sm">
                    <AuditInfo
                      createdBy={t.created_by}
                      createdAt={t.created_at}
                      updatedBy={t.updated_by}
                      updatedAt={t.updated_at}
                      profileMap={profileMap}
                    />
                  </TableCell>

                  {showActions && (
                    <TableCell>
                      <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEditThis && onEdit && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {canDelete && onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onDelete(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
