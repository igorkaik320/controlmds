import { Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, Verification } from '@/lib/cashRegister';
import { parseDateTimeSafe } from '@/lib/formatters';

interface Props {
  verifications: Verification[];
  profileMap: Record<string, string>;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

function formatDate(iso: string) {
  if (!iso) return '—';

  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '—';

  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string) {
  if (!iso) return '—';

  const date = parseDateTimeSafe(iso);
  if (!date) return '—';

  return date.toLocaleString('pt-BR');
}

export default function VerificationTable({ verifications, profileMap, onDelete, canDelete = false }: Props) {
  if (verifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma conferência registrada.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-24">Data</TableHead>
              <TableHead className="text-right w-32">Saldo Sistema</TableHead>
              <TableHead className="text-right w-32">Valor Físico</TableHead>
              <TableHead className="text-right w-28">Diferença</TableHead>
              <TableHead>Conferente</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="w-36">Data/Hora</TableHead>
              {canDelete && <TableHead className="w-16 text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifications.map((v) => (
              <TableRow key={v.id} className="group">
                <TableCell className="font-mono text-sm">{formatDate(v.date)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatCurrency(v.system_balance)}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(v.gaveta_value)}</TableCell>
                <TableCell className={`text-right font-mono font-medium ${
                  v.difference < 0 
                    ? 'text-red-600' 
                    : v.difference === 0 
                      ? 'text-black' 
                      : 'text-green-600'
                }`}>
                  {formatCurrency(v.difference)}
                </TableCell>
                <TableCell className="text-sm">{profileMap[v.created_by] || '—'}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{v.observation || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</TableCell>
                {canDelete && (
                  <TableCell>
                    <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(v.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
