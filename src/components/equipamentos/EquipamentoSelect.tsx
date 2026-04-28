import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type EquipamentoSelectValueMode = 'name' | 'id';

interface Equipamento {
  id: string;
  nome: string;
  n_patrimonio?: string;
  setor_id?: string;
}

interface Props {
  value: string;
  onChange: (equipamento: string) => void;
  equipamentos?: Equipamento[];
  label?: string;
  placeholder?: string;
  onEquipamentoSelect?: (equipamento: Equipamento) => void;
  valueMode?: EquipamentoSelectValueMode;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function EquipamentoSelect({
  value,
  onChange,
  equipamentos: equipamentosProp,
  label = 'Equipamento *',
  placeholder = 'Digite nome ou número de patrimônio',
  onEquipamentoSelect,
  valueMode = 'id',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loadedEquipamentos, setLoadedEquipamentos] = useState<Equipamento[]>([]);

  const equipamentos = equipamentosProp ?? loadedEquipamentos;

  const selectedEquipamento = useMemo(() => {
    if (valueMode === 'id') {
      return equipamentos.find((equipamento) => equipamento.id === value) || null;
    }
    return (
      equipamentos.find(
        (equipamento) =>
          equipamento.id === value || normalize(equipamento.nome) === normalize(value || '')
      ) || null
    );
  }, [equipamentos, value, valueMode]);

  useEffect(() => {
    if (valueMode === 'id') {
      const e = value ? equipamentos.find((x) => x.id === value) : null;
      if (e) setQuery(e.nome);
      return;
    }
    if (selectedEquipamento) {
      setQuery(selectedEquipamento.nome);
      return;
    }
    setQuery(value || '');
  }, [valueMode, value, equipamentos, selectedEquipamento]);

  const filteredEquipamentos = useMemo(() => {
    const term = normalize(query);
    const digits = digitsOnly(query);

    if (!term && !digits) return equipamentos;

    return equipamentos.filter((equipamento) => {
      const nome = normalize(equipamento.nome || '');
      const patrimonio = digitsOnly(equipamento.n_patrimonio || '');

      return nome.includes(term) || (!!digits && patrimonio.includes(digits));
    });
  }, [equipamentos, query]);

  function selectEquipamento(equipamento: Equipamento) {
    onChange(valueMode === 'id' ? equipamento.id : equipamento.nome);
    setQuery(equipamento.nome);
    setOpen(false);
    onEquipamentoSelect?.(equipamento);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            if (valueMode === 'id') {
              onChange('');
            } else {
              onChange(nextValue);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
        />

        {open && filteredEquipamentos.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-lg">
            {filteredEquipamentos.map((equipamento) => (
              <button
                key={equipamento.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => selectEquipamento(equipamento)}
              >
                <div className="font-medium">{equipamento.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {equipamento.n_patrimonio ? `Patrimônio: ${equipamento.n_patrimonio}` : 'Sem número de patrimônio'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
