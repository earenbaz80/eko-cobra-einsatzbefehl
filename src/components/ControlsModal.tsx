import type { RefObject } from 'react';
import { Eye } from 'lucide-react';

interface ControlsModalProps {
  controlsDialogRef: RefObject<HTMLDivElement | null>;
  nvgActive: boolean;
  hudOpacity: number;
  onHudOpacityChange: (value: number, persist?: boolean) => void;
  nvgKeyCode: string;
  isRebindingNvgKey: boolean;
  formatKeyCodeLabel: (code: string) => string;
  onToggleNightVision: () => void;
  onSelectNvgKey: (code: string) => void;
  onRebindToggle: () => void;
  onOpenBlueprint: () => void;
  onClose: () => void;
}

export function ControlsModal({
  controlsDialogRef,
  nvgActive,
  hudOpacity,
  onHudOpacityChange,
  nvgKeyCode,
  isRebindingNvgKey,
  formatKeyCodeLabel,
  onToggleNightVision,
  onSelectNvgKey,
  onRebindToggle,
  onOpenBlueprint,
  onClose,
}: ControlsModalProps) {
  return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C11]/55 backdrop-blur-sm p-4 md:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="w-full max-w-4xl border border-[#334155]/70 bg-[#0B111A]/75 backdrop-blur-md text-[#E2E8F0] shadow-2xl p-6 md:p-8"
            ref={controlsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Manual operativo de controles"
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#334155]/50 pb-4 mb-6">
              <div>
                <div className="text-xs font-mono-tabular text-[#D97706]">
                  MANUAL OPERATIVO DE CONTROLES · EKO COBRA CQB
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-white mt-0.5">
                  Controles Tácticos, EKO-PAD, Brechas Acústicas y ROE
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenBlueprint()}
                  className="px-3.5 py-2 text-xs font-semibold border border-[#334155]/70 bg-[#080C11]/55 text-[#38BDF8] hover:border-[#38BDF8] cursor-pointer"
                >
                  Ir a Blaupause
                </button>
                <button
                  onClick={() => onClose()}
                  className="px-4 py-2 text-xs font-bold bg-[#D97706] text-black hover:bg-[#F59E0B] cursor-pointer"
                >
                  Cerrar [Esc]
                </button>
              </div>
            </div>

            {/* GLOBAL HUD OPACITY CONTROL BAR (SLIDER + PRESET BUTTONS) */}
            <div className="mb-5 border border-[#38BDF8]/50 bg-[#080C11]/70 p-4 font-mono-tabular shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs font-bold text-[#38BDF8] flex items-center gap-2">
                    <span>🎛️ OPACIDAD GLOBAL DE LA INTERFAZ TÁCTICA (HUD &amp; MINIMAPA)</span>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#38BDF8]/20 border border-[#38BDF8] text-[#BAE6FD]">
                      {hudOpacity}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Ajusta la transparencia global de todos los paneles del HUD, barra TETRA y minimapa para despejar la visión durante entradas CQB intensas.
                  </p>
                </div>

                {/* Step & Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <button
                    onClick={() => onHudOpacityChange(hudOpacity - 10, true)}
                    disabled={hudOpacity <= 15}
                    className="px-2 py-1 border border-[#334155] bg-[#0F172A] text-[#CBD5E1] hover:text-white hover:border-[#38BDF8] disabled:opacity-40 cursor-pointer font-bold"
                    title="Reducir opacidad un 10%"
                  >
                    −10%
                  </button>
                  {[
                    { val: 25, label: '25% Sigilo' },
                    { val: 50, label: '50% Táctico' },
                    { val: 75, label: '75% Medio' },
                    { val: 90, label: '90% Estándar' },
                    { val: 100, label: '100% Máx.' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => onHudOpacityChange(preset.val, true)}
                      className={`px-2.5 py-1 border transition-colors cursor-pointer font-semibold ${
                        hudOpacity === preset.val
                          ? 'bg-[#38BDF8] text-black border-[#38BDF8] font-bold shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                          : 'bg-[#0F172A]/80 border-[#334155] text-[#CBD5E1] hover:text-white hover:border-[#38BDF8]/60'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    onClick={() => onHudOpacityChange(hudOpacity + 10, true)}
                    disabled={hudOpacity >= 100}
                    className="px-2 py-1 border border-[#334155] bg-[#0F172A] text-[#CBD5E1] hover:text-white hover:border-[#38BDF8] disabled:opacity-40 cursor-pointer font-bold"
                    title="Aumentar opacidad un 10%"
                  >
                    +10%
                  </button>
                </div>
              </div>

              {/* Interactive Range Slider with Visual Scale */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#94A3B8] shrink-0">15% (Mín)</span>
                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min={15}
                    max={100}
                    step={5}
                    value={hudOpacity}
                    onChange={(e) => onHudOpacityChange(Number(e.target.value))}
                    aria-label="Control deslizante de opacidad global del HUD"
                    className="w-full h-2 bg-[#1E293B] accent-[#38BDF8] cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-[#94A3B8] shrink-0">100% (Opaco)</span>
              </div>
            </div>

            {/* NIGHT VISION (NVG) POST-PROCESSING & CONFIGURABLE KEYBIND BAR */}
            <div className="mb-5 border border-[#10B981]/55 bg-[#080C11]/75 p-4 font-mono-tabular shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#34D399] flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#10B981]" />
                    <span>VISIÓN NOCTURNA MONOCROMÁTICA (GPNVG-18 GEN-3 PHOSPHOR)</span>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#10B981]/20 border border-[#10B981] text-[#A7F3D0]">
                      TECLA [{formatKeyCodeLabel(nvgKeyCode)}]
                    </span>
                    {nvgActive && (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#10B981] text-black animate-pulse">
                        ACTIVA (+24dB)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Aplica un filtro de post-procesamiento de fósforo verde monocromático e intensificación de luz residual que amplifica el contraste en habitaciones oscuras sin delatar tu posición con la linterna.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <button
                    onClick={() => onToggleNightVision()}
                    className={`px-3 py-1.5 border font-bold transition-colors cursor-pointer ${
                      nvgActive
                        ? 'bg-[#10B981] text-black border-[#34D399] shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : 'bg-[#0F172A] text-[#34D399] border-[#10B981]/60 hover:bg-[#10B981]/20'
                    }`}
                  >
                    {nvgActive ? '🟢 NVG: ENCENDIDA' : '⚫ NVG: APAGADA'}
                  </button>

                  <span className="text-[#475569] mx-0.5">|</span>
                  <span className="text-[#94A3B8]">Tecla:</span>
                  {[
                    { code: 'KeyN', label: '[N]' },
                    { code: 'KeyK', label: '[K]' },
                    { code: 'KeyJ', label: '[J]' },
                    { code: 'KeyP', label: '[P]' },
                  ].map((kb) => (
                    <button
                      key={kb.code}
                      onClick={() => {
                        onSelectNvgKey(kb.code)
                      }}
                      className={`px-2 py-1 border transition-colors cursor-pointer font-semibold ${
                        nvgKeyCode === kb.code && !isRebindingNvgKey
                          ? 'bg-[#10B981] text-black border-[#10B981] font-bold'
                          : 'bg-[#0F172A]/80 border-[#334155] text-[#CBD5E1] hover:text-white hover:border-[#10B981]/60'
                      }`}
                    >
                      {kb.label}
                    </button>
                  ))}

                  <button
                    onClick={() => {
                      onRebindToggle()
                    }}
                    className={`px-2.5 py-1 border transition-colors cursor-pointer font-bold ${
                      isRebindingNvgKey
                        ? 'bg-[#F59E0B] text-black border-[#FDE68A] animate-pulse'
                        : 'bg-[#0F172A] border-[#38BDF8]/60 text-[#38BDF8] hover:bg-[#38BDF8]/20'
                    }`}
                    title="Haz clic y pulsa cualquier tecla del teclado para asignarla a la Visión Nocturna"
                  >
                    {isRebindingNvgKey
                      ? '⌨️ Pulsa una tecla...'
                      : `Personalizar [${formatKeyCodeLabel(nvgKeyCode)}]`}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono-tabular text-xs">
              <div className="border border-[#334155]/55 bg-[#080C11]/50 p-4 space-y-2.5">
                <div className="text-[#F59E0B] font-bold text-sm">
                  01. MOVIMIENTO, PASOS Y FATIGA
                </div>
                <p className="text-[#CBD5E1]">
                  <strong>[WASD / Flechas]:</strong> Caminar táctico (pasos silenciosos y firmes).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Shift + WASD]:</strong> Correr / Sprint táctico (+36% velocidad, pasos fuertes de botas y equipo, aumenta la barra de <strong>Fatiga</strong>).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Mantener Z / Alt / Ctrl]:</strong> <strong>Apuntado Enfocado (Präzisionsanschlag)</strong> — amortigua la velocidad de giro del operador, reduce la dispersión un 38% y aumenta la precisión de tiro.
                </p>
                <p className="text-[#94A3B8]">
                  <strong>Fatiga y Signos Vitales:</strong> Correr o recibir impactos aumenta la fatiga y los BPM tuyos y de Kobra-2, reduciendo la precisión y estabilidad hasta descansar.
                </p>
              </div>

              <div className="border border-[#334155]/55 bg-[#080C11]/50 p-4 space-y-2.5">
                <div className="text-[#38BDF8] font-bold text-sm">
                  02. EKO-PAD C4I, INTERROGATORIO Y ROE
                </div>
                <p className="text-[#CBD5E1]">
                  <strong>[Tecla M]:</strong> Abrir el <strong>EKO-PAD Táctico</strong> (Colocar marcadores en tiempo real).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Tecla I]:</strong> <strong>Interrogatorio Exprès</strong> a sospechosos esposados (revela a todos los hostiles y rehenes ocultos en la red C4I +100 XP).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Tecla B]:</strong> Identificar objetivo por cámara en radio TETRA (+90 / +75 PTS ROE y XP).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Tecla V] / [Espacio]:</strong> <strong>Modo Torso/Extremidades (§7 WVG)</strong> · Grito policial <em>&quot;¡POLIZEI!&quot;</em>.
                </p>
                <p className="text-[#38BDF8] text-[11px] bg-[#0F172A]/70 p-2 border border-[#38BDF8]/40">
                  📷 <strong>Bodycam PIP de Kobra-2:</strong> Transmisión en directo de la cámara de casco de Kobra-2 en la esquina superior izquierda.
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Tecla T] / [Tecla H]:</strong> Alternar Taser X2 / Aplicar torniquete IFAK.
                </p>
              </div>

              <div className="border border-[#334155]/55 bg-[#080C11]/50 p-4 space-y-2.5">
                <div className="text-[#10B981] font-bold text-sm">
                  03. BALÍSTICA, BREACHING Y ÓRDENES CQB
                </div>
                <p className="text-[#CBD5E1]">
                  <strong>Disparo a Cerraduras &amp; Penetración:</strong> Disparar a la cerradura de una puerta la destruye y la fuerza al instante. Munición FMJ y AP atraviesa tabiques de yeso y puertas de madera.
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Clic Derecho en Puertas/Ventanas]:</strong> Menú táctico emergente para Kobra-2 (brechado, sonda u órdenes).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[F] Patada / [X] Ariete / [C] C4:</strong> Abrir brecha en puertas o ventanas exteriores con astillado real y destrucción de muebles por impacto.
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[Q] / [G] / [L] / [{formatKeyCodeLabel(nvgKeyCode)}]:</strong> Sensor óptico/térmico, Lanzar granada CS/Flash, Linterna y Visión Nocturna GPNVG-18 (NVG).
                </p>
                <p className="text-[#CBD5E1]">
                  <strong>[1]–[8] Órdenes CQB:</strong> [1] Seguimiento · [2] Posición · [3] Brechar · [4] Sonda · [5] Gas CS · [6] Esposar · [7] Supresión · [8] Reagrupar.
                </p>
              </div>
            </div>
          </div>
        </div>
  );
}
