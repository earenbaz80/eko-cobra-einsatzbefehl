import { useEffect, useRef } from 'react';

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accesibilidad mínima de un diálogo modal: encierra el foco dentro mientras está
 * activo y lo devuelve al elemento que lo abrió al cerrarse. Los atributos
 * `role="dialog"`, `aria-modal` y `aria-label` van en el propio elemento; este hook solo
 * se ocupa del foco, que es lo que React no resuelve por sí solo.
 *
 * Se engancha con `ref={ref}` en el contenedor raíz (que debe llevar `tabIndex={-1}`).
 * No intercepta `Escape`: el teclado global de la app ya cierra los paneles y así no se
 * producen dos cierres por pulsación.
 */
export function useModalA11y(active: boolean = true) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = ref.current;
    if (!active || !contenedor) return;

    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const primerFoco = contenedor.querySelector<HTMLElement>(FOCUSABLES);
    (primerFoco ?? contenedor).focus({ preventScroll: true });

    const alPulsarTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(contenedor.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
        (elemento) => elemento.offsetParent !== null || elemento === document.activeElement
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement;
      if (event.shiftKey && (activo === primero || activo === contenedor)) {
        event.preventDefault();
        event.stopPropagation();
        ultimo.focus();
      } else if (!event.shiftKey && activo === ultimo) {
        event.preventDefault();
        event.stopPropagation();
        primero.focus();
      }
    };

    contenedor.addEventListener('keydown', alPulsarTab);
    return () => {
      contenedor.removeEventListener('keydown', alPulsarTab);
      if (previo && typeof previo.focus === 'function') previo.focus({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
