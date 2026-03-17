import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { fetchObras, Obra } from '@/lib/obrasService';

interface Props { value: string; onChange: (value: string) => void; }

export default function ObraSelect({ value, onChange }: Props) {
  const [obras, setObras] = useState<Obra[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { fetchObras().then(setObras).catch(() => {}); }, []);

  const filtered = value
    ? obras.filter(o => o.nome.toLowerCase().includes(value.toLowerCase()))
    : obras;

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Selecione ou digite..."
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
          {filtered.map(o => (
            <div key={o.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
              onMouseDown={() => { onChange(o.nome); setOpen(false); }}>
              {o.nome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
