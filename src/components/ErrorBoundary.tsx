import { Component, type ErrorInfo, type ReactNode } from 'react';

type BoundaryState = { error: Error | null };

/** Last-resort UI so an engine crash never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EKO Cobra crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#080C11] p-6 font-mono-tabular text-[#E2E8F0]">
        <div className="w-full max-w-lg border border-[#EF4444]/60 bg-[#0B111A] p-6 shadow-2xl">
          <h1 className="font-display text-xl font-bold tracking-wide text-[#EF4444]">
            FALLO CRÍTICO DEL SISTEMA TÁCTICO
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
            El motor se ha detenido para evitar un estado inconsistente. Reinicia la simulación para
            volver al puesto de mando.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto border border-[#334155] bg-[#080C11] p-3 text-[11px] whitespace-pre-wrap text-[#FCA5A5]">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 w-full cursor-pointer border border-[#D97706] bg-[#D97706]/15 px-3 py-2 text-xs font-bold text-[#FDE68A] transition-colors hover:bg-[#D97706] hover:text-black"
          >
            REINICIAR OPERACIÓN
          </button>
        </div>
      </div>
    );
  }
}
