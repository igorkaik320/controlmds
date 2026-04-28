import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔍 ERRO CAPTURADO PELO ERROR BOUNDARY:', error);
    console.error('Error Info:', errorInfo);
    console.trace('Stack trace completo:', error);
    
    // Se for erro de split, mostrar mensagem específica
    if (error.message.includes('Cannot read properties of null (reading \'split\')')) {
      console.warn('🎯 ERRO DE SPLIT IDENTIFICADO NO ERROR BOUNDARY!');
      console.warn('Component stack:', errorInfo.componentStack);
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="text-red-800 font-semibold">Ocorreu um erro inesperado</h3>
          <p className="text-red-600 text-sm mt-1">
            {this.state.error?.message.includes('Cannot read properties of null (reading \'split\')') 
              ? 'Erro de formatação de dados detectado.' 
              : 'Ocorreu um erro ao renderizar este componente.'}
          </p>
          <details className="mt-2 text-xs text-gray-600">
            <summary>Detalhes técnicos</summary>
            <pre className="mt-1 whitespace-pre-wrap">
              {this.state.error?.message}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
