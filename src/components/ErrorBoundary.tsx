import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isExtensionError } from '@/lib/extensionShield';

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
    // Erros gerados por extensões NÃO devem travar a UI
    if (isExtensionError(error)) {
      console.warn('[ErrorBoundary] Erro de extensão detectado — recuperando automaticamente.');
      return { hasError: false };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isExtensionError(error)) {
      // Não polui o console com erros que não são nossos
      console.warn('[ErrorBoundary] Ignorando erro originado em extensão de navegador.');
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
      return;
    }

    console.error('🔍 ERRO CAPTURADO PELO ERROR BOUNDARY:', error);
    console.error('Error Info:', errorInfo);

    if (error.message.includes("Cannot read properties of null (reading 'split')")) {
      console.warn('🎯 ERRO DE SPLIT IDENTIFICADO NO ERROR BOUNDARY!');
      console.warn('Component stack:', errorInfo.componentStack);
    }

    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="max-w-lg rounded-lg border border-destructive/30 bg-destructive/5 p-6">
              <h3 className="font-semibold text-destructive">Ocorreu um erro inesperado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {this.state.error?.message ?? 'Algo deu errado ao renderizar esta tela.'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Se o problema persistir, tente desativar extensões do navegador (tradutor, bloqueador de anúncios, gerenciador de senhas, dark reader, etc.) e recarregar a página.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={this.handleReset}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                >
                  Tentar novamente
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Recarregar página
                </button>
              </div>
              <details className="mt-3 text-xs text-muted-foreground">
                <summary>Detalhes técnicos</summary>
                <pre className="mt-1 whitespace-pre-wrap break-words">
                  {this.state.error?.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
