import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { fetchConfigRelatorio, saveConfigRelatorio, ConfigRelatorio } from '@/lib/comprasService';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function ConfigRelatorioPage() {
  const { user, userRole } = useAuth();
  const [config, setConfig] = useState<Partial<ConfigRelatorio>>({
    fonte: 'DM Sans', tamanho_fonte: 10, negrito: false,
    cor_texto: '#1e1e1e', cor_cabecalho: '#1e3764', cor_linhas: '#f5f5f5', cor_rodape: '#1e3764', cor_total: '#1e3764',
    logo_esquerda: null, logo_direita: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigRelatorio().then(c => {
      if (c) setConfig(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!user) return;
    try {
      await saveConfigRelatorio(config, user.id);
      toast.success('Configurações salvas');
    } catch (e: any) { toast.error(e.message); }
  }

  function handleLogoUpload(side: 'logo_esquerda' | 'logo_direita') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setConfig(prev => ({ ...prev, [side]: reader.result as string }));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  if (userRole !== 'admin') return <div className="p-8 text-destructive font-medium">Acesso restrito ao administrador.</div>;
  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">Configuração do Relatório</h2>

      <Card>
        <CardHeader><CardTitle className="text-base">Logos</CardTitle></CardHeader>
        <CardContent className="flex gap-6">
          <div className="text-center space-y-2">
            <Label>Logo Esquerda</Label>
            {config.logo_esquerda && <img src={config.logo_esquerda} alt="Logo esquerda" className="h-16 mx-auto object-contain" />}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => handleLogoUpload('logo_esquerda')}>Upload</Button>
              {config.logo_esquerda && <Button variant="ghost" size="sm" onClick={() => setConfig(p => ({ ...p, logo_esquerda: null }))}>Remover</Button>}
            </div>
          </div>
          <div className="text-center space-y-2">
            <Label>Logo Direita</Label>
            {config.logo_direita && <img src={config.logo_direita} alt="Logo direita" className="h-16 mx-auto object-contain" />}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => handleLogoUpload('logo_direita')}>Upload</Button>
              {config.logo_direita && <Button variant="ghost" size="sm" onClick={() => setConfig(p => ({ ...p, logo_direita: null }))}>Remover</Button>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tipografia</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fonte</Label><Input value={config.fonte || ''} onChange={e => setConfig(p => ({ ...p, fonte: e.target.value }))} /></div>
            <div><Label>Tamanho da Fonte</Label><Input type="number" value={config.tamanho_fonte || 10} onChange={e => setConfig(p => ({ ...p, tamanho_fonte: parseInt(e.target.value) }))} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={config.negrito || false} onCheckedChange={v => setConfig(p => ({ ...p, negrito: v }))} />
            <Label>Negrito</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cores</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'cor_texto', label: 'Cor do Texto' },
              { key: 'cor_cabecalho', label: 'Cor do Cabeçalho' },
              { key: 'cor_linhas', label: 'Cor das Linhas' },
              { key: 'cor_rodape', label: 'Cor do Rodapé' },
              { key: 'cor_total', label: 'Cor do Total' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={(config as any)[key] || '#000000'} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={(config as any)[key] || ''} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} className="text-xs" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar Configurações</Button>
    </div>
  );
}
