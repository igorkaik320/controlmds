import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  level?: number;
  keywords?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  label?: string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  onOptionSelect?: (option: SearchableSelectOption) => void;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  label,
  placeholder = 'Digite para pesquisar',
  emptyText = 'Nenhum resultado',
  className,
  inputClassName,
  labelClassName,
  onOptionSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);

  useEffect(() => {
    setQuery(selected?.label || '');
  }, [selected]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.description || ''} ${option.keywords || ''}`).includes(term)
    );
  }, [options, query]);

  function handleSelect(option: SearchableSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    onOptionSelect?.(option);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <Label className={labelClassName}>{label}</Label> : null}
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange('');
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          className={inputClassName}
        />
        {open && (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-lg">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70',
                    option.disabled && 'bg-muted/30 font-semibold text-muted-foreground'
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
                >
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${(option.level || 0) * 14}px` }}>
                    <span className={cn('truncate', option.disabled && 'font-semibold')}>
                      {option.label}
                    </span>
                  </div>
                  {option.description ? (
                    <div
                      className="truncate text-xs text-muted-foreground"
                      style={{ paddingLeft: `${(option.level || 0) * 14}px` }}
                    >
                      {option.description}
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
