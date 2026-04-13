import { useState, useEffect } from 'react';

export default function ContasPagarPageMinimal() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular dados de empresas
    const mockEmpresas = [
      { id: '1', nome: 'Empresa Teste 1' },
      { id: '2', nome: 'Empresa Teste 2' },
      { id: '3', nome: 'Empresa Teste 3' }
    ];
    
    setTimeout(() => {
      setEmpresas(mockEmpresas);
      setLoading(false);
      console.log('Empresas carregadas:', mockEmpresas.length);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Contas a Pagar (Minimal)</h1>
        <p className="text-center">Carregando empresas...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Contas a Pagar (Minimal)</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Status da Página</h2>
        <div className="space-y-1">
          <p>✅ Componente carregou</p>
          <p>✅ Estado funcionando</p>
          <p>✅ Empresas: {empresas.length} carregadas</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Selecione Empresa</label>
        <select className="w-full p-2 border rounded">
          <option value="">Selecione uma empresa</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Nome da Empresa</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.id} className="border-b">
                <td className="px-4 py-2">{empresa.id}</td>
                <td className="px-4 py-2">{empresa.nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
