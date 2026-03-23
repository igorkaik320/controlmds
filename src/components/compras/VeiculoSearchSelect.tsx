import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VeiculoMaquina } from '@/lib/combustivelService';

interface Props {
  value: string;
  onChange: (veiculoId: string) => void;
  veiculos: VeiculoMaquina[];
  label?: string;
  placeholder?: string;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export default function VeiculoSearchSelect({
  value,
  onChange,
  veiculos,
  label = 'Veículo *',
  placeholder = 'Digite placa, modelo, marca ou categoria',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedVeiculo = useMemo(
    () => veiculos.find((veiculo) => veiculo.id === value) || null,
    [value, veiculos]
  );

  useEffect(() => {
    if (selectedVeiculo) {
      setQuery(`${selectedVeiculo.placa} - ${selectedVeiculo.modelo}`);
      return;
    }
    setQuery('');
  }, [selectedVeiculo]);

  const filteredVeiculos = useMemo(() => {
    const term = normalize(query);
    if (!term) return veiculos;

    return veiculos.filter((veiculo) => {
      const haystack = normalize(
        [veiculo.placa, veiculo.modelo, veiculo.marca, veiculo.categoria].filter(Boolean).join(' ')
      );
      return haystack.includes(term);
    });
  }, [query, veiculos]);

  function selectVeiculo(veiculo: VeiculoMaquina) {
    onChange(veiculo.id);
    setQuery(`${veiculo.placa} - ${veiculo.modelo}`);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange('');
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
        />

        {open && filteredVeiculos.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-lg">
            {filteredVeiculos.map((veiculo) => (
              <button
                key={veiculo.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => selectVeiculo(veiculo)}
              >
                <div className="font-medium">
                  {veiculo.placa} - {veiculo.modelo}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[veiculo.marca, veiculo.categoria].filter(Boolean).join(' • ') || 'Sem detalhes'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
