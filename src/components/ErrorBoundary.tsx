import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ClipboardCheck, ClipboardCopy, Home } from 'lucide-react';
import { copiarAlPortapapeles, enlaceAlMenu, formatearInforme, leerResumen } from './errorReport';

type BoundaryState = { error: Error | null; copiado: 'NO' | 'SI' | 'ERROR' };

/**
 * Last-resort UI so an engine crash never leaves a blank screen. Muestra el resumen de la
 * partida, deja copiar un informe con el error y ofrece volver al menú (`?menu=1`) en vez
 * de recargar la misma partida que acaba de romperse.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null, copiado: 'NO' };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EKO Cobra crashed:', error, info.componentStack);
  }

  private informe() {
    const { error } = this.state;
    if (!error) return '';
    return formatearInforme({
      error: { message: error.message, stack: error.stack },
      resumen: leerResumen(),
      entorno: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        marca: document.querySelector('meta[name="eko-build"]')?.getAttribute('content') ?? 'desconocida',
        fecha: new Date().toISOString(),
      },
    });
  }

  private copiar = async () => {
    const copiado = await copiarAlPortapapeles(this.informe(), navigator.clipboard);
    this.setState({ copiado: copiado ? 'SI' : 'ERROR' });
  };

  render() {
    const { error, copiado } = this.state;
    if (!error) return this.props.children;

    const resumen = leerResumen();

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#080C11] p-6 font-mono-tabular text-[#E2E8F0]">
        <div className="w-full max-w-lg border border-[#EF4444]/60 bg-[#0B111A] p-6 shadow-2xl">
          <h1 className="font-display text-xl font-bold tracking-wide text-[#EF4444]">
            FALLO CRÍTICO DEL SISTEMA TÁCTICO
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
            El motor se ha detenido para evitar un estado inconsistente. Revisa el informe, vuelve al menú y
            arranca otra operación.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 border border-[#334155] bg-[#080C11] p-3 text-[11px]">
            <dt className="text-[#64748B]">Partida</dt>
            <dd className="text-[#E2E8F0]">{resumen ? resumen.mision : 'sin datos'}</dd>
            <dt className="text-[#64748B]">Estado</dt>
            <dd className="text-[#E2E8F0]">{resumen ? `${resumen.estado} · ${resumen.segundos} s` : '—'}</dd>
            <dt className="text-[#64748B]">Tick</dt>
            <dd className="text-[#E2E8F0]">{resumen ? resumen.tick.toLocaleString('es-ES') : '—'}</dd>
            <dt className="text-[#64748B]">Entidades</dt>
            <dd className="text-[#E2E8F0]">
              {resumen
                ? `${resumen.entidades.total} (escuadra ${resumen.entidades.escuadra}, sospechosos ${resumen.entidades.sospechosos}, rehenes ${resumen.entidades.rehenes})`
                : '—'}
            </dd>
            <dt className="text-[#64748B]">Sala</dt>
            <dd className="text-[#E2E8F0]">{resumen ? resumen.sala : '—'}</dd>
          </dl>

          <pre className="mt-3 max-h-40 overflow-auto border border-[#334155] bg-[#080C11] p-3 text-[11px] whitespace-pre-wrap text-[#FCA5A5]">
            {error.message}
          </pre>

          <button
            type="button"
            onClick={this.copiar}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 border border-[#38BDF8] bg-[#38BDF8]/10 px-3 py-2 text-xs font-bold text-[#BAE6FD] transition-colors hover:bg-[#38BDF8] hover:text-black"
          >
            {copiado === 'SI' ? <ClipboardCheck className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            {copiado === 'SI' ? 'INFORME COPIADO' : copiado === 'ERROR' ? 'NO SE PUDO COPIAR' : 'COPIAR INFORME'}
          </button>

          <a
            href={enlaceAlMenu(window.location.pathname)}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 border border-[#D97706] bg-[#D97706]/15 px-3 py-2 text-xs font-bold text-[#FDE68A] transition-colors hover:bg-[#D97706] hover:text-black"
          >
            <Home className="h-3.5 w-3.5" /> VOLVER AL MENÚ
          </a>
        </div>
      </div>
    );
  }
}
