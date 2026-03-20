import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchResponsaveis, Responsavel } from '@/lib/comprasService';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  allowAll?: boolean;
}

export default function ResponsavelSelect({
  value,
  onChange,
  label = 'Responsável',
  allowAll = true,
}: Props) {
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  useEffect(() => {
    fetchResponsaveis().then(setResponsaveis).catch(() => {});
  }, []);

  return (
    <div>
      {label && <Label className="text-xs">{label}</Label>}
      <Select value={value || '_all'} onValueChange={(next) => onChange(next === '_all' ? '' : next)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value="_all">Todos os responsáveis</SelectItem>}
          {responsaveis.map((r) => (
            <SelectItem key={r.id} value={r.nome}>
              {r.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
