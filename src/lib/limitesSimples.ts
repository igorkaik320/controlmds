export interface LimiteSimples {
  valor: number;
  ativo: boolean;
}

export interface AlertaSimples {
  tipo: 'perigo' | 'alerta' | 'normal';
  mes: string;
  valorAtual: number;
  valorLimite: number;
  valorDisponivel: number;
  percentual: number;
}

const STORAGE_KEY = 'limite_global_simples';

export function salvarLimiteGlobal(valor: number): void {
  const limite = { valor, ativo: true };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limite));
}

export function buscarLimiteGlobal(): LimiteSimples | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function verificarLimiteGlobal(mes: string, valorAtual: number): AlertaSimples | null {
  const limite = buscarLimiteGlobal();
  
  if (!limite || !limite.ativo) return null;
  
  const percentual = (valorAtual / limite.valor) * 100;
  const valorDisponivel = Math.max(0, limite.valor - valorAtual);
  
  let tipo: AlertaSimples['tipo'] = 'normal';
  if (percentual >= 100) tipo = 'perigo';
  else if (percentual >= 80) tipo = 'alerta';
  
  return {
    tipo,
    mes,
    valorAtual,
    valorLimite: limite.valor,
    valorDisponivel,
    percentual
  };
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}
