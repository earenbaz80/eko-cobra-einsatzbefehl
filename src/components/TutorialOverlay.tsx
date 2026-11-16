interface TutorialOverlayProps {
  tutorialStep: number;
  onSkip: () => void;
  onNext: () => void;
  onDeploy: () => void;
}

export function TutorialOverlay({
  tutorialStep,
  onSkip,
  onNext,
  onDeploy,
}: TutorialOverlayProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,42rem)] bg-[#080C11]/95 backdrop-blur-md border border-[#10B981]/70 shadow-[0_0_30px_rgba(16,185,129,0.35)] p-4 font-mono-tabular">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#10B981] tracking-widest">
          TUTORIAL INTERACTIVO · PASO {tutorialStep + 1}/6
        </span>
        <button
          onClick={onSkip}
          className="text-[#94A3B8] hover:text-white text-xs cursor-pointer"
        >
          Saltar [×]
        </button>
      </div>
      <div className="text-sm font-bold text-white mb-1">
        {[
          'Movimiento',
          'Disparo',
          'Postura',
          'EKO-Pad C4I',
          'Impacto',
          'Despliegue',
        ][tutorialStep]}
      </div>
      <div className="text-xs text-[#CBD5E1] mb-3">
        {[
          'Usa WASD para moverte por la galería de tiro.',
          'Apunta con el ratón y haz clic izquierdo para disparar.',
          'Pulsa Z para agacharte y mejorar precisión (avanza manualmente).',
          'Pulsa M para abrir el EKO-Pad C4I.',
          'Derriba un objetivo de la galería.',
          'Dominas lo básico. Despliega a una misión real cuando estés listo.',
        ][tutorialStep]}
      </div>
      <div className="flex items-center gap-2">
        {tutorialStep === 2 && (
          <button
            onClick={onNext}
            className="px-3 py-1.5 text-xs font-bold text-black bg-[#10B981] hover:bg-[#34D399] cursor-pointer"
          >
            Siguiente
          </button>
        )}
        {tutorialStep === 5 && (
          <button
            onClick={onDeploy}
            className="px-3 py-1.5 text-xs font-bold text-black bg-[#D97706] hover:bg-[#F59E0B] cursor-pointer"
          >
            Desplegar a misión
          </button>
        )}
        {tutorialStep < 5 && tutorialStep !== 2 && (
          <span className="text-[10px] text-[#94A3B8]">
            Completa la acción para avanzar…
          </span>
        )}
      </div>
    </div>
  );
}
