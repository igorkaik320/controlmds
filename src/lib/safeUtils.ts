// Utilitários seguros para evitar erros de split e outras operações

export function safeSplit(str: string | null | undefined, separator: string): string[] {
  if (!str || typeof str !== 'string') return [];
  try {
    return str.split(separator);
  } catch {
    return [];
  }
}

export function safeFormatDate(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  try {
    const parts = safeSplit(dateStr, '-');
    if (parts.length !== 3) return '-';
    const [y, m, d] = parts;
    if (!y || !m || !d) return '-';
    return `${d}/${m}/${y}`;
  } catch {
    return '-';
  }
}

export function safeFormatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

export function safeToLocaleString(num: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (num === null || num === undefined || typeof num !== 'number' || isNaN(num)) {
    return '0';
  }
  try {
    return num.toLocaleString('pt-BR', options);
  } catch {
    return '0';
  }
}

export function safeCurrencyFormat(num: number | null | undefined): string {
  if (num === null || num === undefined || typeof num !== 'number' || isNaN(num)) {
    return 'R$ 0,00';
  }
  try {
    return num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  } catch {
    return 'R$ 0,00';
  }
}

// Interceptar erros globais se necessário
export function setupGlobalErrorHandling() {
  // Interceptar erros não tratados
  const originalError = console.error;
  console.error = (...args) => {
    // Se for erro de split, mostrar mensagem amigável e stack trace
    const errorString = args.join(' ');
    if (errorString.includes('Cannot read properties of null (reading \'split\')')) {
      console.warn('🔍 ERRO DE SPLIT DETECTADO - Stack trace completo:');
      console.trace('Stack trace do erro de split:');
      console.warn('Argumentos do erro:', args);
      return;
    }
    originalError.apply(console, args);
  };

  // Interceptar erros não capturados
  const originalHandler = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (message && message.toString().includes('Cannot read properties of null (reading \'split\')')) {
      console.warn('🔍 ERRO DE SPLIT GLOBAL - Stack trace completo:');
      console.trace('Stack trace:', error?.stack);
      console.warn('Source:', source, 'Line:', lineno, 'Col:', colno);
      return true; // Prevenir o erro de aparecer
    }
    if (originalHandler) {
      return originalHandler(message, source, lineno, colno, error);
    }
    return false;
  };

  // Interceptar promessas rejeitadas
  const originalRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    if (event.reason && event.reason.toString().includes('Cannot read properties of null (reading \'split\')')) {
      console.warn('🔍 ERRO DE SPLIT EM PROMESSA - Stack trace completo:');
      console.trace('Stack trace:', event.reason?.stack);
      event.preventDefault(); // Prevenir o erro de aparecer
      return;
    }
    if (originalRejection) {
      return originalRejection.call(this, event);
    }
  };
}
