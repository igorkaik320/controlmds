import { useState, useEffect } from 'react';

export default function ContasPagarPageDebug() {
  const [items, setItems] = useState<any[]>([]);

  // Simular dados
  useEffect(() => {
    setItems([
      { id: '1', empresa_nome: 'Teste Empresa 1', fornecedor_nome: 'Teste Fornecedor 1', valor_total: 1000 },
      { id: '2', empresa_nome: 'Teste Empresa 2', fornecedor_nome: 'Teste Fornecedor 2', valor_total: 2000 }
    ]);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Contas a Pagar (Debug)</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Status da Página</h2>
        <div className="space-y-1">
          <p>✅ Componente carregou</p>
          <p>✅ Estado funcionando</p>
          <p>✅ Items: {items.length} carregados</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2 text-left">Fornecedor</th>
              <th className="px-4 py-2 text-left">Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="px-4 py-2">{item.empresa_nome}</td>
                <td className="px-4 py-2">{item.fornecedor_nome}</td>
                <td className="px-4 py-2">R$ {item.valor_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
