import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

export default function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange }: Props) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <Label className="text-xs">De</Label>
        <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="w-40" />
      </div>
      <div>
        <Label className="text-xs">Até</Label>
        <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="w-40" />
      </div>
    </div>
  );
}
