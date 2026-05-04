import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchFornecedores, type Fornecedor } from '@/lib/comprasService';
import { toast } from 'sonner';

/** `name` (default): value/onChange usam o nome - compras e relatorios. `id`: usam o UUID - FKs (ex.: revisoes). */
export type FornecedorSelectValueMode = 'name' | 'id';

interface Props {
  value: string;
  onChange: (fornecedor: string) => void;
  fornecedores?: Fornecedor[];
  label?: string;
  placeholder?: string;
  onFornecedorSelect?: (fornecedor: Fornecedor) => void;
  valueMode?: FornecedorSelectValueMode;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function FornecedorSelect({
  value,
  onChange,
  fornecedores: fornecedoresProp,
  label = 'Fornecedor *',
  placeholder = 'Digite nome, razao social ou CNPJ/CPF',
  onFornecedorSelect,
  valueMode = 'name',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loadedFornecedores, setLoadedFornecedores] = useState<Fornecedor[]>([]);

  useEffect(() => {
    if (fornecedoresProp) return;

    let cancelled = false;

    async function loadFornecedores() {
      try {
        const fornecedores = await fetchFornecedores();
        if (!cancelled) {
          setLoadedFornecedores(fornecedores);
        }
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error.message || 'Nao foi possivel carregar os fornecedores');
        }
      }
    }

    loadFornecedores();

    return () => {
      cancelled = true;
    };
  }, [fornecedoresProp]);

  const fornecedores = fornecedoresProp ?? loadedFornecedores;

  const selectedFornecedor = useMemo(() => {
    if (valueMode === 'id') {
      return fornecedores.find((fornecedor) => fornecedor.id === value) || null;
    }
    return (
      fornecedores.find(
        (fornecedor) =>
          fornecedor.id === value || normalize(fornecedor.nome_fornecedor) === normalize(value || '')
      ) || null
    );
  }, [fornecedores, value, valueMode]);

  useEffect(() => {
    if (valueMode === 'id') {
      const fornecedor = value ? fornecedores.find((item) => item.id === value) : null;
      if (fornecedor) setQuery(fornecedor.nome_fornecedor);
      return;
    }

    if (selectedFornecedor) {
      setQuery(selectedFornecedor.nome_fornecedor);
      return;
    }

    setQuery(value || '');
  }, [valueMode, value, fornecedores, selectedFornecedor]);

  const filteredFornecedores = useMemo(() => {
    const term = normalize(query);
    const digits = digitsOnly(query);

    if (!term && !digits) return fornecedores;

    return fornecedores.filter((fornecedor) => {
      const nome = normalize(fornecedor.nome_fornecedor || '');
      const razao = normalize(fornecedor.razao_social || '');
      const cnpj = digitsOnly(fornecedor.cnpj_cpf || '');

      return nome.includes(term) || razao.includes(term) || (!!digits && cnpj.includes(digits));
    });
  }, [fornecedores, query]);

  function selectFornecedor(fornecedor: Fornecedor) {
    onChange(valueMode === 'id' ? fornecedor.id : fornecedor.nome_fornecedor);
    setQuery(fornecedor.nome_fornecedor);
    setOpen(false);
    onFornecedorSelect?.(fornecedor);
  }

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}

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

        {open && filteredFornecedores.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-lg">
            {filteredFornecedores.map((fornecedor) => (
              <button
                key={fornecedor.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => selectFornecedor(fornecedor)}
              >
                <div className="font-medium">{fornecedor.nome_fornecedor}</div>
                <div className="text-xs text-muted-foreground">
                  {fornecedor.razao_social || 'Sem razao social'}
                  {fornecedor.cnpj_cpf ? ` - ${fornecedor.cnpj_cpf}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
