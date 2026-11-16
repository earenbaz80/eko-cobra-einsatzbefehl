import type { RefObject } from 'react';
import { conflictosDeKeybinds } from '../game/keybinds';

interface KeybindRemapModalProps {
  isOpen: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  keybinds: Record<string, string>;
  rebindingAction: string | null;
  formatKeyCodeLabel: (code: string) => string;
  onClose: () => void;
  onRebind: (action: string) => void;
  onReset: () => void;
}

export function KeybindRemapModal({
  isOpen,
  dialogRef,
  keybinds,
  rebindingAction,
  formatKeyCodeLabel,
  onClose,
  onRebind,
  onReset,
}: KeybindRemapModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C11]/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl border border-[#334155] bg-[#0B111A] p-5 shadow-2xl font-mono-tabular"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Remapear teclas"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Remapear Teclas</h2>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            [×]
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {[
            ['moveForward', 'Mover adelante'],
            ['moveBackward', 'Mover atrás'],
            ['moveLeft', 'Mover izquierda'],
            ['moveRight', 'Mover derecha'],
            ['policeShout', 'Grito policial'],
            ['interact', 'Interactuar'],
            ['breachKick', 'Brecha patada'],
            ['breachC4', 'Brecha C4'],
            ['breachRam', 'Brecha ariete'],
            ['inspect', 'Sensor óptico'],
            ['gadget', 'Lanzar gadget'],
            ['toolTaser', 'Cambiar a Taser'],
            ['flashlight', 'Linterna'],
            ['ifak', 'IFAK / Torniquete'],
            ['aimZone', 'Zona de impacto'],
            ['stance', 'Cambiar postura'],
            ['thermalPalette', 'Paleta térmica'],
            ['biometric', 'ID biométrico'],
            ['interrogate', 'Interrogatorio'],
            ['reload', 'Recargar'],
            ['clearBlastArea', 'Despejar zona C4'],
          ].map(([action, label]) => {
            const current = keybinds[action];
            const conflict = Object.entries(keybinds).some(
              ([otherAction, otherCode]) => otherAction !== action && otherCode === current
            );
            return (
              <div
                key={action}
                className={`flex items-center justify-between gap-2 border px-3 py-2 ${
                  conflict ? 'border-[#EF4444] bg-[#7F1D1D]/20' : 'border-[#334155] bg-[#0F172A]'
                }`}
              >
                <span className="text-xs text-[#CBD5E1]">{label}</span>
                <button
                  onClick={() => onRebind(action)}
                  className={`px-2 py-1 text-xs font-bold border cursor-pointer ${
                    rebindingAction === action
                      ? 'border-[#F59E0B] text-[#FDE68A] bg-[#F59E0B]/20 animate-pulse'
                      : conflict
                        ? 'border-[#EF4444] text-[#FCA5A5] hover:bg-[#EF4444]/20'
                        : 'border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8]/20'
                  }`}
                >
                  {rebindingAction === action
                    ? 'Pulsa tecla…'
                    : formatKeyCodeLabel(current || 'KeyA')}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-bold text-[#94A3B8] border border-[#334155] hover:text-white cursor-pointer"
          >
            Restablecer por defecto
          </button>
          {conflictosDeKeybinds(keybinds).length > 0 && (
            <span className="text-[10px] text-[#EF4444]">
              Teclas duplicadas: {conflictosDeKeybinds(keybinds).map(formatKeyCodeLabel).join(', ')}
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#94A3B8] mt-3">
          Pulsa Escape para cancelar la asignación. Los cambios se guardan automáticamente.
        </p>
      </div>
    </div>
  );
}
