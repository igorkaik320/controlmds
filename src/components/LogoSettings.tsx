import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImagePlus, Trash2 } from 'lucide-react';
import { getLogo, saveLogo, removeLogo } from '@/lib/exportUtils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LogoSettings({ open, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPreview(getLogo());
    }
  }, [open]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      toast.error('Imagem muito grande. Máximo 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      saveLogo(dataUrl);
      setPreview(dataUrl);
      toast.success('Logo salva com sucesso');
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    removeLogo();
    setPreview(null);
    toast.success('Logo removida');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logo do Relatório</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A logo será incluída nos relatórios PDF exportados.
        </p>

        <div className="flex flex-col items-center gap-4 py-4">
          {preview ? (
            <div className="border rounded-lg p-4 bg-muted/30">
              <img src={preview} alt="Logo" className="max-h-24 max-w-48 object-contain" />
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma logo configurada</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1" />
              {preview ? 'Alterar Logo' : 'Adicionar Logo'}
            </Button>
            {preview && (
              <Button variant="destructive" size="sm" onClick={handleRemove}>
                <Trash2 className="h-4 w-4 mr-1" /> Remover
              </Button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
