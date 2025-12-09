import './index.css';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center" style={{ fontFamily: 'Arial, sans-serif' }}>
          <h1 className="text-2xl font-bold text-red-500 mb-4">¡Vaya! Algo salió mal.</h1>
          <p className="mb-4 text-gray-300">La aplicación ha encontrado un error inesperado.</p>
          <div className="bg-black/30 p-4 rounded-md text-left w-full max-w-md overflow-x-auto mb-6 border border-white/10">
            <code className="text-xs text-red-300 whitespace-pre-wrap font-mono">
              {this.state.error?.toString()}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-md transition-colors"
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);