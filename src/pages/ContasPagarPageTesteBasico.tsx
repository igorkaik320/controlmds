export default function ContasPagarPageTesteBasico() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Contas a Pagar (Teste Básico)</h1>
      
      <div className="mb-6 p-4 bg-green-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Status da Página</h2>
        <div className="space-y-1">
          <p>✅ Componente carregou com sucesso!</p>
          <p>✅ Sem dependências externas</p>
          <p>✅ Renderização básica funcionando</p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Teste de Funcionalidades</h2>
        <div className="space-y-2">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Teste Botão
          </button>
          <input 
            type="text" 
            placeholder="Teste Input" 
            className="px-3 py-2 border rounded w-full max-w-xs"
          />
          <select className="px-3 py-2 border rounded">
            <option>Opção 1</option>
            <option>Opção 2</option>
            <option>Opção 3</option>
          </select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-4 py-2">1</td>
              <td className="px-4 py-2">Teste 1</td>
              <td className="px-4 py-2">Ativo</td>
            </tr>
            <tr className="border-b">
              <td className="px-4 py-2">2</td>
              <td className="px-4 py-2">Teste 2</td>
              <td className="px-4 py-2">Ativo</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
