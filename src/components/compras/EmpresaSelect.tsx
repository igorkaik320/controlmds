import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchEmpresas, Empresa } from "@/lib/empresasService";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  labelClassName?: string;
  allowAll?: boolean;
}

export default function EmpresaSelect({
  value,
  onChange,
  label = "Empresa",
  className,
  labelClassName,
  allowAll = false,
}: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  useEffect(() => {
    fetchEmpresas()
      .then(setEmpresas)
      .catch(() => {});
  }, []);

  const selectValue = allowAll ? (value || "_all") : (value || undefined);

  return (
    <div className={cn(className)}>
      {label && <Label className={cn("text-xs", labelClassName)}>{label}</Label>}
      <Select value={selectValue} onValueChange={(v) => onChange(v === "_all" ? "" : v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value="_all">Todas as empresas</SelectItem>}
          {empresas.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

