import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export default function ContasPagarPageTest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('Carregando contas a pagar...');
      setItems([
        { id: '1', empresa_nome: 'Teste Empresa', fornecedor_nome: 'Teste Fornecedor', valor_total: 1000 }
      ]);
      console.log('Contas carregadas');
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-center text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Financeiro</p>
        <h1 className="text-2xl font-bold">Contas a Pagar (Test)</h1>
        <p className="text-sm text-muted-foreground">
          Teste básico para verificar se a tela carrega.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-2xl font-bold">Contas a Pagar</h2>
          <Button size="sm">
            Teste
          </Button>
        </div>

        <div className="rounded-md border overflow-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="border-b px-4 py-2 text-left">Empresa</th>
                <th className="border-b px-4 py-2 text-left">Fornecedor</th>
                <th className="border-b px-4 py-2 text-left">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="border-b px-4 py-2">{item.empresa_nome}</td>
                  <td className="border-b px-4 py-2">{item.fornecedor_nome}</td>
                  <td className="border-b px-4 py-2">R$ {item.valor_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
