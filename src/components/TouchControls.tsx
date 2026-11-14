import { useEffect, useRef, useState } from 'react';

interface TouchControlsProps {
  /** Vector normalizado -1..1 del joystick; (0,0) al soltarlo. */
  onMove: (x: number, y: number) => void;
  /** Pulsación de un botón de acción, ya traducida a código de tecla. */
  onAction: (code: string) => void;
  onFire: () => void;
  onOpenPad: () => void;
}

const STICK_RADIUS = 44;
const DEAD_ZONE = 0.2;

const ACTIONS: { code: string; label: string; title: string }[] = [
  { code: 'KeyE', label: 'ACCIÓN', title: 'Interactuar (E)' },
  { code: 'KeyR', label: 'RECARGA', title: 'Recargar (R)' },
  { code: 'KeyZ', label: 'POSTURA', title: 'Agacharse / levantarse (Z)' },
  { code: 'KeyL', label: 'LINTERNA', title: 'Linterna (L)' },
];

/**
 * Controles en pantalla para móvil: joystick de movimiento a la izquierda,
 * fuego y acciones a la derecha. Se oculta solo en escritorio.
 */
export function TouchControls({ onMove, onAction, onFire, onOpenPad }: TouchControlsProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const accionesRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  // Publica el alto del bloque más alto de controles para que los subtítulos se
  // apilen justo encima sin repetir números a mano en el CSS.
  useEffect(() => {
    const clusters = [baseRef.current, accionesRef.current].filter((el): el is HTMLDivElement => Boolean(el));
    if (!clusters.length) return;
    const raiz = document.documentElement;
    let previo = -1;
    const medir = () => {
      const alto = Math.max(...clusters.map((el) => Math.ceil(el.getBoundingClientRect().height)));
      if (alto !== previo) {
        previo = alto;
        raiz.style.setProperty('--eko-touch-cluster-h', `${alto}px`);
      }
    };
    medir();
    const observador = new ResizeObserver(medir);
    clusters.forEach((el) => observador.observe(el));
    return () => {
      observador.disconnect();
      raiz.style.removeProperty('--eko-touch-cluster-h');
    };
  }, []);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > STICK_RADIUS) {
      dx = (dx / distance) * STICK_RADIUS;
      dy = (dy / distance) * STICK_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / STICK_RADIUS;
    const ny = dy / STICK_RADIUS;
    onMove(Math.abs(nx) < DEAD_ZONE ? 0 : nx, Math.abs(ny) < DEAD_ZONE ? 0 : ny);
  };

  const release = () => {
    pointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 select-none"
      style={{ touchAction: 'none' }}
    >
      {hintVisible && (
        <div className="absolute right-3 top-[48px] w-[52vw] max-w-[230px] rounded border border-[#334155]/70 bg-[#080C11]/88 px-2.5 py-1.5 text-left font-mono-tabular text-[10px] leading-tight text-[#CBD5E1] sm:left-1/2 sm:right-auto sm:top-14 sm:w-auto sm:max-w-[92vw] sm:-translate-x-1/2 sm:px-3 sm:text-center sm:text-[10.5px]">
          <span className="hidden landscape:inline">
            Joystick para moverte · toca la escena para apuntar y disparar
          </span>
          <span className="landscape:hidden">
            Mejor en horizontal · gira el móvil. Toca la escena para disparar
          </span>
        </div>
      )}

      <div
        ref={baseRef}
        role="group"
        aria-label="Joystick de movimiento"
        className="touch-pad pointer-events-auto absolute left-3 h-24 w-24 rounded-full border-2 border-[#38BDF8]/35 bg-[#0B1220]/55 backdrop-blur-sm sm:bottom-[78px] sm:left-4 sm:h-[124px] sm:w-[124px]"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          event.preventDefault();
          pointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (pointerRef.current !== event.pointerId) return;
          updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (pointerRef.current !== event.pointerId) return;
          release();
        }}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38BDF8]/50" />
        <div
          className="absolute left-1/2 top-1/2 h-11 w-11 rounded-full border-2 border-[#38BDF8]/80 bg-[#0F172A]/90 shadow-[0_0_18px_rgba(56,189,248,0.25)] sm:h-[52px] sm:w-[52px]"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>

      <div
        ref={accionesRef}
        className="touch-pad pointer-events-auto absolute right-3 flex flex-col items-end gap-1.5 sm:bottom-[78px] sm:right-4 sm:gap-2"
        style={{ touchAction: 'none' }}
      >
        <button
          type="button"
          aria-label="Disparar"
          className="h-[52px] w-[52px] rounded-full border-2 border-[#D97706] bg-[#D97706]/25 font-mono-tabular text-[10px] font-bold tracking-wider text-[#FDE68A] active:bg-[#D97706]/50 sm:h-16 sm:w-16 sm:text-[11px]"
          onPointerDown={(event) => {
            event.preventDefault();
            onFire();
          }}
        >
          FUEGO
        </button>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-2 sm:gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.code}
              type="button"
              aria-label={action.title}
              title={action.title}
              className="h-11 w-11 rounded-full border border-[#38BDF8]/50 bg-[#0B1220]/75 font-mono-tabular text-[8.5px] font-bold tracking-wide text-[#BAE6FD] active:bg-[#38BDF8]/25 sm:h-14 sm:w-14 sm:text-[9px]"
              onPointerDown={(event) => {
                event.preventDefault();
                onAction(action.code);
              }}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="Abrir EKO-Pad"
            className="h-11 w-11 rounded-full border border-[#38BDF8]/50 bg-[#0B1220]/75 font-mono-tabular text-[8.5px] font-bold tracking-wide text-[#BAE6FD] active:bg-[#38BDF8]/25 sm:h-14 sm:w-14 sm:text-[9px]"
            onPointerDown={(event) => {
              event.preventDefault();
              onOpenPad();
            }}
          >
            EKO-PAD
          </button>
        </div>
      </div>
    </div>
  );
}
