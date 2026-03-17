import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { fetchResponsaveis, Responsavel } from '@/lib/comprasService';

interface Props { value: string; onChange: (value: string) => void; }

export default function ResponsavelSelect({ value, onChange }: Props) {
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  useEffect(() => { fetchResponsaveis().then(setResponsaveis).catch(() => {}); }, []);

  return (
    <div>
      <Label className="text-xs">Responsável</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos</SelectItem>
          {responsaveis.map(r => (
            <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
