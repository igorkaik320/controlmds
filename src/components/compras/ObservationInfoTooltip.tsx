import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { parseDateTimeSafe } from '@/lib/formatters';

interface Props {
  observation?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  profileMap: Record<string, string>;
}

function formatAuditDate(iso?: string | null) {
  if (!iso) return '-';
  const parsed = parseDateTimeSafe(iso);
  if (!parsed) return '-';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function ObservationInfoTooltip({
  observation,
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
  profileMap,
}: Props) {
  const hasInfo = Boolean(observation || createdBy || updatedBy);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Ver observação e auditoria"
        >
          <Info className={hasInfo ? 'h-4 w-4 text-primary' : 'h-4 w-4'} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" align="center" className="max-w-[320px] space-y-2 p-3 text-xs">
        <div>
          <p className="mb-1 font-semibold text-foreground">Observação</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{observation || 'Sem observação'}</p>
        </div>
        <div className="border-t pt-2 text-muted-foreground">
          {createdBy && (
            <p>
              Criado por {profileMap[createdBy] || '-'} em {formatAuditDate(createdAt)}
            </p>
          )}
          {updatedBy && (
            <p>
              Atualizado por {profileMap[updatedBy] || '-'} em {formatAuditDate(updatedAt)}
            </p>
          )}
          {!createdBy && !updatedBy && <p>Sem histórico de auditoria</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
