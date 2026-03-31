export interface LimiteMensal {
  id: string;
  mes: string;
  valor: number;
  empresaId?: string;
  ativo: boolean;
  notificarAtingido: boolean;
  notificarProximo: boolean;
  percentualProximo: number;
}

export interface AlertaLimite {
  tipo: 'ultrapassado' | 'atingido' | 'proximo';
  mes: string;
  valorAtual: number;
  valorLimite: number;
  percentual: number;
  empresaNome?: string;
}

const STORAGE_KEY = 'limites_mensais';

export function salvarLimite(limite: Omit<LimiteMensal, 'id'>): void {
  const limites = buscarLimites();
  const novo: LimiteMensal = { ...limite, id: crypto.randomUUID() };
  limites.push(novo);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limites));
}

export function buscarLimites(): LimiteMensal[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function verificarAlertas(mes: string, valorAtual: number, empresaId?: string): AlertaLimite[] {
  const limites = buscarLimites().filter(l => l.ativo && l.mes === mes && (!l.empresaId || l.empresaId === empresaId));
  
  return limites.map(limite => {
    const percentual = (valorAtual / limite.valor) * 100;
    let tipo: AlertaLimite['tipo'] = 'proximo';
    if (percentual >= 100) tipo = 'ultrapassado';
    else if (percentual >= limite.percentualProximo) tipo = 'proximo';
    else return null;
    
    return { tipo, mes, valorAtual, valorLimite: limite.valor, percentual };
  }).filter(Boolean) as AlertaLimite[];
}
