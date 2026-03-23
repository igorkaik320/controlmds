import React from 'react';

interface Props {
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  profileMap: Record<string, string>;
}

function formatAuditDate(iso?: string | null) {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AuditInfo({ createdBy, createdAt, updatedBy, updatedAt, profileMap }: Props) {
  if (!createdBy && !updatedBy) return null;

  return (
    <div className="text-[11px] text-muted-foreground space-y-0.5">
      {createdBy && (
        <div>
          Criado por {profileMap[createdBy] || '—'} em {formatAuditDate(createdAt)}
        </div>
      )}
      {updatedBy && (
        <div>
          Atualizado por {profileMap[updatedBy] || '—'} em {formatAuditDate(updatedAt)}
        </div>
      )}
    </div>
  );
}
