import { useState, useEffect } from 'react';

export default function EmpresasDebugSelect() {
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
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <label className="text-sm font-medium">Empresa *</label>
        <select className="w-full p-2 border rounded" disabled>
          <option>Carregando empresas...</option>
        </select>
      </div>
    );
  }

  return (
    <div className="p-4">
      <label className="text-sm font-medium">Empresa *</label>
      <select className="w-full p-2 border rounded">
        <option value="">Selecione a empresa</option>
        {empresas.map((empresa) => (
          <option key={empresa.id} value={empresa.id}>
            {empresa.nome}
          </option>
        ))}
      </select>
      <div className="mt-2 text-sm text-gray-600">
        Empresas carregadas: {empresas.length}
      </div>
    </div>
  );
}
