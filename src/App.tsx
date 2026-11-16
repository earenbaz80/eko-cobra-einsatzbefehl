import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Mic,
  Radio,
} from 'lucide-react';
import { TouchControls } from './components/TouchControls';
import { TitleScreen } from './components/TitleScreen';
import { KeybindRemapModal } from './components/KeybindRemapModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { PauseSummaryModal } from './components/PauseSummaryModal';
import { ControlsModal } from './components/ControlsModal';
import { TacticalHud } from './components/TacticalHud';
import { construirResumen, publicarResumen, quiereMenu } from './components/errorReport';
const BlueprintModal = lazy(() =>
  import('./components/BlueprintModal').then((m) => ({ default: m.BlueprintModal }))
);
const GddModal = lazy(() =>
  import('./components/GddModal').then((m) => ({ default: m.GddModal }))
);
const TacticalPadModal = lazy(() =>
  import('./components/TacticalPadModal').then((m) => ({ default: m.TacticalPadModal }))
);
const ArmoryInspectorModal = lazy(() =>
  import('./components/ArmoryInspectorModal').then((m) => ({ default: m.ArmoryInspectorModal }))
);
const EkisIntelModal = lazy(() =>
  import('./components/EkisIntelModal').then((m) => ({ default: m.EkisIntelModal }))
);
const OperatorCareerModal = lazy(() =>
  import('./components/OperatorCareerModal').then((m) => ({ default: m.OperatorCareerModal }))
);
import { soundEngine } from './game/soundEngine';
import { instalarHookE2E } from './game/e2e';
import { TacticalEngine } from './game/TacticalEngine';
import { loadGame, hasSave, saveGame, clearSave } from './game/save';
import { GameState, HudSnapshot, MissionPlan, SquadCommand, RadioFeedItem } from './game/types';

const INITIAL_PLAN: MissionPlan = {
  profile: 'AUFKLAERER',
  entryPoint: 'HAUPTEINGANG_A',
  doctrine: 'STEALTH',
  primaryWeapon: 'AUG_PARA',
  inspectionDevice: 'THERMAL_CAM',
  gadget: 'CS_GAS',
  squadGear: 'SHIELD',
  squadOrderInitial: 'FOLLOW',
};

type ActiveModalId = 'NONE' | 'PAD' | 'BLUEPRINT' | 'GDD' | 'CONTROLS' | 'ARMORY' | 'INTEL' | 'CAREER';

// Minimal Web Speech API surface (not in lib.dom) for push-to-talk voice commands.
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const scope = window as unknown as Record<string, SpeechRecognitionConstructor | undefined>;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/** Keys the browser must not act on (scroll, focus roaming, Alt menu) while playing. */
const BLOCKED_BROWSER_KEYS = new Set([
  'Space',
  'Tab',
  'AltLeft',
  'AltRight',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TacticalEngine | null>(null);
  const activeModalRef = useRef<ActiveModalId>('NONE');
  const isRebindingNvgKeyRef = useRef<boolean>(false);
  /**
   * Último snapshot del HUD y su firma. El primero permite guardar la partida desde un
   * temporizador estable (sin depender de `hud` en las deps); la segunda evita
   * re-renderizar la app cuando el motor emite el mismo estado.
   */
  const hudRef = useRef<HudSnapshot | null>(null);
  const hudSignatureRef = useRef('');

  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [plan, setPlan] = useState<MissionPlan>(INITIAL_PLAN);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModalId>('NONE');
  const [muted, setMuted] = useState(false);
  const [radioAudioEnabled, setRadioAudioEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('eko_cobra_radio_audio');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore storage errors
    }
    // El pitido TETRA empieza en silencio; los mensajes visuales siguen funcionando.
    return false;
  });
  const [hasSavedGame, setHasSavedGame] = useState<boolean>(() => hasSave());
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('eko_cobra_subtitles');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });
  const [colorblindMode, setColorblindMode] = useState<string>(() => {
    try {
      return window.localStorage.getItem('eko_cobra_colorblind') || 'NONE';
    } catch {
      return 'NONE';
    }
  });
  const [nvgKeyCode, setNvgKeyCode] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('eko_cobra_nvg_key');
      if (saved && saved.trim().length > 0) {
        return saved.trim();
      }
    } catch {
      // ignore storage errors
    }
    return 'KeyN';
  });
  const [isRebindingNvgKey, setIsRebindingNvgKey] = useState(false);
  const [hudOpacity, setHudOpacity] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem('eko_cobra_hud_opacity');
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 15 && parsed <= 100) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 90;
  });

  // Collapsible Tactical HUD Menu States (Default closed so screen is clean and unobstructed)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [, setHudCompactMode] = useState(true);
  const [, setMissionPanelOpen] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [keybindModalOpen, setKeybindModalOpen] = useState(false);
  const [rebindingAction, setRebindingAction] = useState<string | null>(null);
  const [keybinds, setKeybinds] = useState<Record<string, string>>({});
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [anatomyDrawerOpen, setAnatomyDrawerOpen] = useState(false);
  const [squadDrawerOpen, setSquadDrawerOpen] = useState(false);
  const [radioLogOpen, setRadioLogOpen] = useState(false);
  const [rankDrawerOpen, setRankDrawerOpen] = useState(false);
  const [pauseAuditOpen, setPauseAuditOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    target: { type: 'DOOR' | 'WINDOW' | 'POINT'; id?: string; name: string; x: number; y: number };
  } | null>(null);

  // Radio Ticker Minimalist State (Single-line top-center, disappears after 5 seconds)
  const [activeTickerMessage, setActiveTickerMessage] = useState<RadioFeedItem | null>(null);
  const [tickerVisible, setTickerVisible] = useState(false);

  useEffect(() => {
    if (hud?.radioFeed && hud.radioFeed.length > 0) {
      const topMsg = hud.radioFeed[0];
      if (topMsg && topMsg.id !== activeTickerMessage?.id) {
        setActiveTickerMessage(topMsg);
        setTickerVisible(true);
        // Radio y burbujas son siempre visuales: no hay locución sintética.
        const timer = setTimeout(() => {
          setTickerVisible(false);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [hud?.radioFeed]);

  const openModalExclusive = (modal: ActiveModalId) => {
    activeModalRef.current = modal;
    setActiveModal(modal);
    setCommandMenuOpen(false);
    isRebindingNvgKeyRef.current = false;
    setIsRebindingNvgKey(false);
  };

  const formatKeyCodeLabel = (code: string): string => {
    if (code.startsWith('Key')) return code.slice(3).toUpperCase();
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'CapsLock') return 'CAPS';
    if (code === 'Backquote') return 'º';
    return code.toUpperCase();
  };

  const handleNvgKeyChange = (nextCode: string, playClick = true) => {
    if (!nextCode) return;
    if (playClick) {
      soundEngine.playUiClick();
    }
    setNvgKeyCode(nextCode);
    engineRef.current?.setNvgKeyCode(nextCode);
    try {
      window.localStorage.setItem('eko_cobra_nvg_key', nextCode);
    } catch {
      // ignore storage errors
    }
  };

  const toggleHudCompactMode = () => {
    soundEngine.playUiClick();
    setHudCompactMode((prev) => {
      const nextCompact = !prev;
      const expandAll = !nextCompact;
      setMissionPanelOpen(expandAll);
      setAnatomyDrawerOpen(expandAll);
      setSquadDrawerOpen(expandAll);
      setRadioLogOpen(expandAll);
      return nextCompact;
    });
  };

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
      setIsTouchDevice(hasTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'es-ES'; // Set to Spanish as per user prompt commands

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      if (text && engineRef.current) {
        engineRef.current.executeVoiceCommand(text);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
      // Clear the flag first, otherwise onend restarts a permanently failing session.
      isListeningRef.current = false;
      setIsListening(false);
      console.error('Speech recognition error', event.error);
    };

    rec.onend = () => {
      // Restart only while the operator still holds the push-to-talk key.
      if (isListeningRef.current) {
        try {
          rec.start();
        } catch {
          isListeningRef.current = false;
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = rec;

    return () => {
      // Detach first: aborting must not restart the session or log an error.
      isListeningRef.current = false;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    };
  }, []);

  const startVoiceCapture = () => {
    const recognition = recognitionRef.current;
    if (!recognition || isListeningRef.current) return;
    isListeningRef.current = true;
    setIsListening(true);
    try {
      recognition.start();
      soundEngine.playTetraStaticBurst(0.6, 0.25);
    } catch (e) {
      // A failed start must not leave push-to-talk locked in the listening state.
      isListeningRef.current = false;
      setIsListening(false);
      console.error(e);
    }
  };

  const stopVoiceCapture = () => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    setIsListening(false);
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch (e) {}
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new TacticalEngine(
      canvas,
      INITIAL_PLAN,
      (snapshot) => {
        hudRef.current = snapshot;
        const firma = JSON.stringify(snapshot);
        if (firma === hudSignatureRef.current) return;
        hudSignatureRef.current = firma;
        setHud(snapshot);
      },
      (nextState) => {
        // Al terminar la misión la partida deja de ser reanudable: se borra el guardado
        // para que el menú no ofrezca continuar una operación ya cerrada.
        if (nextState === 'VICTORY' || nextState === 'DEFEAT') {
          clearSave();
          setHasSavedGame(false);
        }
        setGameState(nextState);
      }
    );

    // Backing store at devicePixelRatio (capped at 2); the engine draws in CSS pixels.
    const fitToWindow = () =>
      engine.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio || 1, 2));
    fitToWindow();
    window.addEventListener('resize', fitToWindow);
    engine.setHudOpacity(hudOpacity / 100);
    engine.setNvgKeyCode(nvgKeyCode);
    engineRef.current = engine;
    const desinstalarHookE2E = instalarHookE2E(engine);
    setKeybinds({ ...engine.keybinds });

    let rafId = 0;
    let lastTime = performance.now();
    let lowQualityFrames = 0;

    const loop = (now: number) => {
      const rawDt = Math.min(0.042, (now - lastTime) / 1000);
      lastTime = now;
      if (rawDt > 0.033) {
        lowQualityFrames = Math.min(10, lowQualityFrames + 1);
      } else {
        lowQualityFrames = Math.max(0, lowQualityFrames - 1);
      }
      engine.setLowQualityMode(lowQualityFrames >= 3);
      engine.update(rawDt);
      engine.render();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      // Browser defaults are blocked on every event, repeats included.
      if (BLOCKED_BROWSER_KEYS.has(e.code)) e.preventDefault();
      // Auto-repeat must not re-trigger actions or UI toggles (Space, G, 1-8, M, Tab, Esc).
      if (e.repeat) return;
      if (isRebindingNvgKeyRef.current) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') {
          isRebindingNvgKeyRef.current = false;
          setIsRebindingNvgKey(false);
          return;
        }
        const reserved = new Set([
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
          'Tab',
          'KeyM',
          'KeyY',
          'CapsLock',
        ]);
        if (!reserved.has(e.code)) {
          handleNvgKeyChange(e.code, true);
        }
        isRebindingNvgKeyRef.current = false;
        setIsRebindingNvgKey(false);
        return;
      }

      if (e.code === 'KeyY' || e.code === 'CapsLock') {
        e.preventDefault();
        startVoiceCapture();
        return;
      }

      if (e.code === 'Escape' && activeModalRef.current !== 'NONE') {
        openModalExclusive('NONE');
        return;
      }
      if (e.code === 'KeyM') {
        openModalExclusive(activeModalRef.current === 'PAD' ? 'NONE' : 'PAD');
        return;
      }
      if (e.code === 'Tab' && engine.gameState === 'PLAYING') {
        toggleHudCompactMode();
        return;
      }
      if (activeModalRef.current !== 'NONE') {
        return;
      }
      engine.handleKeyDown(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyY' || e.code === 'CapsLock') {
        stopVoiceCapture();
      }
      engine.handleKeyUp(e.code);
    };
    const onBlur = () => engine.clearHeldKeys();
    const onMouseMove = (e: MouseEvent) => {
      engine.handleMouseMove(e.clientX, e.clientY);
      engine.updateRightClickDrag(e.clientX, e.clientY);
    };
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS') {
        setCommandMenuOpen(false);
        setMissionPanelOpen(false);
        if (e.button === 0) {
          setContextMenu(null);
        } else if (e.button === 2) {
          engine.startRightClickDrag(e.clientX, e.clientY);
        }
        engine.handleMouseDown(e.button);
      } else {
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      engine.handleMouseUp();
      if (e.button === 2) {
        engine.completeRightClickDrag();
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS' && engineRef.current) {
        e.preventDefault();
        if (engineRef.current.isRightDragging) return;
        const worldPos = engineRef.current.screenToWorld(e.clientX, e.clientY);
        const target = engineRef.current.getInteractiveTargetAt(worldPos.x, worldPos.y);
        soundEngine.playUiClick();
        setContextMenu({
          open: true,
          x: Math.min(window.innerWidth - 270, Math.max(10, e.clientX)),
          y: Math.min(window.innerHeight - 340, Math.max(10, e.clientY)),
          target,
        });
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      // changedTouches: con el dedo en el joystick, apunta al dedo que toca la escena.
      if ((e.target as HTMLElement)?.tagName === 'CANVAS' && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        engine.handleTouchStart(touch.clientX, touch.clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS' && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        engine.handleTouchMove(touch.clientX, touch.clientY);
      }
    };
    const onTouchEnd = () => {
      engine.handleTouchEnd();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      desinstalarHookE2E();
      engine.destroy();
      engineRef.current = null;
      window.removeEventListener('resize', fitToWindow);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const handlePlanChange = (updated: MissionPlan) => {
    setPlan(updated);
    if (engineRef.current) {
      engineRef.current.resetMission(updated);
    }
  };

  const handleStartMission = () => {
    openModalExclusive('NONE');
    const selectedMode = plan.operationId === 'STATION' ? 'STATION' : 'APARTMENT';
    setPlan((prev) => ({ ...prev, operationId: selectedMode }));
    engineRef.current?.startOperation(selectedMode);
  };

  const handleResumeGame = () => {
    const saved = loadGame();
    if (!saved) {
      setHasSavedGame(false);
      return;
    }
    soundEngine.playUiClick();
    openModalExclusive('NONE');
    const savedPlan = (saved.plan && typeof saved.plan === 'object' ? saved.plan : plan) as MissionPlan;
    setPlan(savedPlan);
    const mode = saved.missionMode === 'STATION' ? 'STATION' : saved.missionMode === 'LINZ' ? 'LINZ' : saved.missionMode === 'TIROL' ? 'TIROL' : saved.missionMode === 'SCHWECHAT' ? 'SCHWECHAT' : 'APARTMENT';
    if (mode === 'STATION') engineRef.current?.startStationOperation();
    else if (mode === 'LINZ') engineRef.current?.startLinzOperation();
    else if (mode === 'TIROL') engineRef.current?.startTirolOperation();
    else if (mode === 'SCHWECHAT') engineRef.current?.startSchwechatOperation();
    else engineRef.current?.startApartmentOperation();
    // El escenario se reconstruye y luego se superpone la simulación guardada:
    // posición, mundo y puertas, además del marcador, el tiempo y el tick.
    engineRef.current?.restoreProgress({
      score: typeof saved.score === 'number' ? saved.score : undefined,
      elapsedSeconds: typeof saved.elapsedSeconds === 'number' ? saved.elapsedSeconds : undefined,
      tick: typeof saved.tick === 'number' ? saved.tick : undefined,
    });
    if (saved.simulacion) engineRef.current?.restaurarSimulacion(saved.simulacion);
    setHasSavedGame(false);
  };

  const handleStartStationMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'STATION' }));
    engineRef.current?.startStationOperation();
  };

  const handleStartNightStationMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'STATION' }));
    engineRef.current?.startNightStationOperation();
  };

  const handleStartMetroMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'STATION' }));
    engineRef.current?.startMetroOperation();
  };

  const handleStartApartmentMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'APARTMENT' }));
    engineRef.current?.startApartmentOperation();
  };

  const handleStartInvestigationMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'APARTMENT' }));
    engineRef.current?.startInvestigationOperation();
  };

  const handleStartLinzMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'LINZ' }));
    engineRef.current?.startLinzOperation();
  };

  const handleStartTirolMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'TIROL' }));
    engineRef.current?.startTirolOperation();
  };

  const handleStartSchwechatMission = () => {
    openModalExclusive('NONE');
    setPlan((prev) => ({ ...prev, operationId: 'SCHWECHAT' }));
    engineRef.current?.startSchwechatOperation();
  };

  const handleStartTrainingRange = () => {
    openModalExclusive('NONE');
    engineRef.current?.startTrainingRange();
  };

  // Safari iOS y Chrome Android mantienen el AudioContext suspendido hasta un gesto
  // real: lo desbloqueamos con el primer toque o tecla para que la misión suene.
  useEffect(() => {
    // En captura: los manejadores táctiles del canvas cortan la propagación, y en
    // burbuja el primer toque nunca llegaría aquí.
    const unlockAudio = () => soundEngine.unlock();
    const opciones: AddEventListenerOptions = { once: true, capture: true };
    window.addEventListener('pointerdown', unlockAudio, opciones);
    window.addEventListener('keydown', unlockAudio, opciones);
    window.addEventListener('touchstart', unlockAudio, { ...opciones, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, opciones);
      window.removeEventListener('keydown', unlockAudio, opciones);
      window.removeEventListener('touchstart', unlockAudio, opciones);
    };
  }, []);

  // El HUD inferior cambia de alto con el ancho y el tamaño de letra (la barra envuelve
  // en más o menos filas). En vez de fijar a mano cuánto suben los controles y los
  // subtítulos, se mide el bloque real apilado sobre el borde inferior y se publica como
  // variable CSS para que index.css coloque los pisos.
  const hudStackRef = useRef<HTMLDivElement | null>(null);
  const medirHudRef = useRef<() => void>(() => {});
  const ultimaAlturaHud = useRef(-1);

  useEffect(() => {
    const medir = () => {
      const columna = hudStackRef.current;
      if (!columna) return;
      let superior = window.innerHeight;
      for (const hijo of Array.from(columna.children)) {
        const caja = hijo.getBoundingClientRect();
        if (caja.height > 0.5 && caja.top < superior) superior = caja.top;
      }
      const altura = Math.max(0, Math.round(window.innerHeight - superior));
      if (altura !== ultimaAlturaHud.current) {
        ultimaAlturaHud.current = altura;
        document.documentElement.style.setProperty('--eko-hud-stack-h', `${altura}px`);
      }
    };
    medirHudRef.current = medir;
    medir();
  });

  useEffect(() => {
    const alRedimensionar = () => medirHudRef.current();
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

  const handleStartTutorial = () => {
    openModalExclusive('NONE');
    setTutorialActive(true);
    setTutorialStep(0);
    engineRef.current?.startTrainingRange();
  };

  const handleReturnToTitle = () => {
    if (engineRef.current) {
      engineRef.current.cambiarEstado('RETURN_TO_TITLE');
      engineRef.current.isTrainingMode = false;
      engineRef.current.resetMission(plan);
      clearSave();
      setHasSavedGame(false);
      setTutorialActive(false);
      setTutorialStep(0);
      soundEngine.stopAmbientDrone();
    }
  };

  // El ErrorBoundary no puede hablar con el motor: App le deja aquí el último estado
  // conocido (misión, tick, entidades) para el informe de fallo.
  useEffect(() => {
    publicarResumen(construirResumen({ hud, gameState, ticks: engineRef.current?.ticks ?? 0 }));
  }, [hud, gameState]);

  // El enlace de recuperación (`?menu=1`) siempre abre el menú: no se retoma la partida
  // que acaba de romperse, y el parámetro se limpia para que un F5 posterior tampoco.
  useEffect(() => {
    if (!quiereMenu(window.location.search)) return;
    if (engineRef.current) engineRef.current.cambiarEstado('RETURN_TO_TITLE');
    else setGameState('TITLE');
    openModalExclusive('NONE');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!tutorialActive || gameState !== 'PLAYING') return;
    const shots = hud?.trainingTelemetry?.shotsFired ?? 0;
    const hits = hud?.trainingTelemetry?.targetsHit ?? 0;
    const elapsed = hud?.elapsedSeconds ?? 0;
    if (tutorialStep === 0 && elapsed > 2) {
      setTutorialStep(1);
    } else if (tutorialStep === 1 && shots > 0) {
      setTutorialStep(2);
    } else if (tutorialStep === 3 && activeModal === 'PAD') {
      setTutorialStep(4);
    } else if (tutorialStep === 4 && hits > 0) {
      setTutorialStep(5);
    }
  }, [tutorialActive, gameState, hud, activeModal, tutorialStep]);

  useEffect(() => {
    if (!rebindingAction) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRebindingAction(null);
        return;
      }
      engineRef.current?.setKeybind(rebindingAction, e.code);
      if (engineRef.current) {
        setKeybinds({ ...engineRef.current.keybinds });
      }
      setRebindingAction(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [rebindingAction]);

  useEffect(() => {
    soundEngine.setRadioAudioEnabled(radioAudioEnabled);
  }, [radioAudioEnabled]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleToggleRadioAudio = () => {
    const next = !radioAudioEnabled;
    setRadioAudioEnabled(next);
    try {
      window.localStorage.setItem('eko_cobra_radio_audio', String(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleToggleSubtitles = () => {
    soundEngine.playUiClick();
    setSubtitlesEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('eko_cobra_subtitles', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleCycleColorblind = () => {
    soundEngine.playUiClick();
    setColorblindMode((prev) => {
      const modes = ['NONE', 'PROTANOPIA', 'DEUTERANOPIA', 'TRITANOPIA'];
      const idx = modes.indexOf(prev);
      const next = modes[(idx + 1) % modes.length];
      try {
        window.localStorage.setItem('eko_cobra_colorblind', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleHudOpacityChange = (value: number, playClick = false) => {
    const clamped = Math.max(15, Math.min(100, Math.round(value)));
    if (playClick) {
      soundEngine.playUiClick();
    }
    setHudOpacity(clamped);
    engineRef.current?.setHudOpacity(clamped / 100);
    try {
      window.localStorage.setItem('eko_cobra_hud_opacity', String(clamped));
    } catch {
      // ignore storage errors
    }
  };

  // Guardado automático de la partida en curso. El temporizador no depende del HUD (que
  // cambia varias veces por segundo y antes reiniciaba el intervalo sin llegar a los 5 s):
  // lee el último snapshot desde un ref. Se guarda además al pausar o salir de la pantalla.
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const persist = (silent = false) => {
      const eng = engineRef.current;
      const ultimo = hudRef.current;
      if (!eng) return;
      const guardado = saveGame({
        gameState: 'PLAYING',
        plan,
        missionMode: eng.missionMode,
        elapsedSeconds: ultimo?.elapsedSeconds ?? 0,
        score: ultimo?.score ?? 0,
        tick: eng.ticks,
        simulacion: eng.capturarSimulacion() ?? undefined,
      });
      if (guardado && !silent) setHasSavedGame(true);
    };
    persist();
    const id = window.setInterval(() => persist(), 5000);
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') persist(true);
    };
    const alSalir = () => persist(true);
    window.addEventListener('pagehide', alSalir);
    window.addEventListener('beforeunload', alSalir);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', alSalir);
      window.removeEventListener('beforeunload', alSalir);
      document.removeEventListener('visibilitychange', alOcultar);
    };
  }, [gameState, plan]);

  const handleSquadCommand = (cmd: SquadCommand) => {
    engineRef.current?.issueSquadCommand(cmd);
  };

  const handleContextMenuCommand = (cmd: SquadCommand) => {
    if (contextMenu && engineRef.current) {
      soundEngine.playUiClick();
      engineRef.current.issueSquadCommandTargeted(cmd, contextMenu.target);
      setContextMenu(null);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#080C11] select-none">
      {/* Isolated 60fps Tactical Canvas with Diegetic Smart Reticle */}
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Campo de operaciones táctico. Muévete con WASD, apunta y dispara con el ratón, abre el EKO-Pad con M y consulta todos los controles en el manual operativo."
        onWheel={(e) => {
          e.preventDefault();
          engineRef.current?.handleWheel(e.deltaY);
        }}
        style={{
          filter:
            colorblindMode === 'PROTANOPIA'
              ? 'hue-rotate(-30deg) saturate(1.2)'
              : colorblindMode === 'DEUTERANOPIA'
                ? 'hue-rotate(30deg) saturate(1.2)'
                : colorblindMode === 'TRITANOPIA'
                  ? 'hue-rotate(180deg) saturate(1.1)'
                  : 'none',
        }}
        className={`block w-full h-full ${
          gameState === 'PLAYING' && activeModal === 'NONE' ? 'cursor-none' : 'cursor-default'
        }`}
      />

      {isTouchDevice && gameState === 'PLAYING' && activeModal === 'NONE' && (
        <TouchControls
          onMove={(x, y) => engineRef.current?.setVirtualStick(x, y)}
          onAction={(code) => {
            engineRef.current?.handleKeyDown(code);
            engineRef.current?.handleKeyUp(code);
          }}
          onFire={() => {
            engineRef.current?.handleMouseDown(0);
            engineRef.current?.handleMouseUp();
          }}
          onOpenPad={() => openModalExclusive('PAD')}
        />
      )}

      {/* ==================== 1. TITLE SCREEN OVERLAY ==================== */}
      {gameState === 'TITLE' && (
        <TitleScreen
          hud={hud}
          hasSavedGame={hasSavedGame}
          handleResumeGame={handleResumeGame}
          handleStartApartmentMission={handleStartApartmentMission}
          handleStartInvestigationMission={handleStartInvestigationMission}
          handleStartStationMission={handleStartStationMission}
          handleStartNightStationMission={handleStartNightStationMission}
          handleStartMetroMission={handleStartMetroMission}
          handleStartLinzMission={handleStartLinzMission}
          handleStartTirolMission={handleStartTirolMission}
          handleStartSchwechatMission={handleStartSchwechatMission}
          handleStartTrainingRange={handleStartTrainingRange}
          handleStartTutorial={handleStartTutorial}
          openModalExclusive={openModalExclusive}
          setKeybindModalOpen={setKeybindModalOpen}
          handleToggleMute={handleToggleMute}
          muted={muted}
          handleToggleRadioAudio={handleToggleRadioAudio}
          radioAudioEnabled={radioAudioEnabled}
          handleToggleSubtitles={handleToggleSubtitles}
          subtitlesEnabled={subtitlesEnabled}
          handleCycleColorblind={handleCycleColorblind}
          colorblindMode={colorblindMode}
        />
      )}

      {/* MINIMALIST RADIO TICKER BAR (Single-line top-center, disappears after 5 seconds) */}
      {gameState === 'PLAYING' && tickerVisible && activeTickerMessage && (
        <div
          onClick={() => engineRef.current?.replayRadioMessage(activeTickerMessage)}
          title="Clic para repetir transmisión de radio TETRA"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-40 max-w-xl sm:max-w-2xl px-3.5 py-1.5 bg-[#060B12]/92 backdrop-blur-md border border-[#38BDF8]/60 shadow-[0_0_25px_rgba(0,0,0,0.85)] flex items-center gap-2.5 text-[10.5px] cursor-pointer animate-fade-in transition-all duration-300 hover:border-[#38BDF8]"
        >
          <div className="flex items-center gap-1.5 shrink-0 border-r border-[#334155]/70 pr-2">
            <Radio className="w-3.5 h-3.5 text-[#38BDF8] animate-pulse" />
            <span className="text-[8px] font-bold tracking-widest text-[#94A3B8] uppercase">TETRA 392.45 MHz</span>
          </div>
          <div className="truncate flex-1 min-w-0">
            <strong className={activeTickerMessage.tone === 'alert' ? 'text-[#EF4444]' : activeTickerMessage.tone === 'ok' ? 'text-[#34D399]' : 'text-[#38BDF8]'}>
              {activeTickerMessage.speaker}:{' '}
            </strong>
            <span className="text-[#F8FAFC] font-medium">{activeTickerMessage.text}</span>
          </div>
          <span className="text-[8px] text-[#64748B] shrink-0 font-mono">[REPETIR]</span>
        </div>
      )}

      {/* SUBTITLES OVERLAY */}
      {subtitlesEnabled && gameState === 'PLAYING' && activeTickerMessage && (
        <div className="radio-subtitles fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-1.5rem)] max-w-3xl px-3 py-1.5 bg-[#080C11]/85 backdrop-blur-md border border-[#334155]/70 text-center text-[11.5px] leading-snug text-white font-medium shadow-lg sm:bottom-16 sm:w-auto sm:px-4 sm:py-2 sm:text-sm">
          <strong className={activeTickerMessage.tone === 'alert' ? 'text-[#EF4444]' : activeTickerMessage.tone === 'ok' ? 'text-[#34D399]' : 'text-[#38BDF8]'}>
            {activeTickerMessage.speaker}:
          </strong>{' '}
          {activeTickerMessage.text}
        </div>
      )}

      {/* KEYBIND REMAPPING MODAL */}
      <KeybindRemapModal
        isOpen={keybindModalOpen}
        keybinds={keybinds}
        rebindingAction={rebindingAction}
        formatKeyCodeLabel={formatKeyCodeLabel}
        onClose={() => {
          soundEngine.playUiClick();
          setKeybindModalOpen(false);
          setRebindingAction(null);
        }}
        onRebind={(action) => {
          soundEngine.playUiClick();
          setRebindingAction(action);
        }}
        onReset={() => {
          soundEngine.playUiClick();
          engineRef.current?.resetKeybinds();
          if (engineRef.current) setKeybinds({ ...engineRef.current.keybinds });
        }}
      />

      {/* INTERACTIVE TUTORIAL OVERLAY */}
      {gameState === 'PLAYING' && tutorialActive && (
        <TutorialOverlay
          tutorialStep={tutorialStep}
          onSkip={() => {
            soundEngine.playUiClick();
            setTutorialActive(false);
            setTutorialStep(0);
          }}
          onNext={() => {
            soundEngine.playUiClick();
            setTutorialStep(3);
          }}
          onDeploy={() => {
            soundEngine.playUiClick();
            setTutorialActive(false);
            setTutorialStep(0);
            handleStartMission();
          }}
        />
      )}

      {/* VOICE COMMAND MIC INDICATOR */}
      {isListening && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 animate-pulse pointer-events-none">
          <div className="bg-red-600/90 backdrop-blur-md border-2 border-red-400 px-4 py-2 flex items-center gap-3 shadow-[0_0_25px_rgba(220,38,38,0.7)]">
            <Mic className="w-4 h-4 text-white animate-bounce" />
            <span className="text-white font-mono-tabular font-black text-xs tracking-[0.2em]">CAPTANDO COMANDO...</span>
          </div>
          <div className="text-[9.5px] text-red-100 font-bold bg-[#080C11]/80 border border-red-500/50 px-2.5 py-1 backdrop-blur-sm shadow-xl">
            ¡POLIZEI, MANOS ARRIBA! · ¡AFLOJA EL ARMA! · ¡QUIETO!
          </div>
        </div>
      )}

      {/* Visceral Bodycam Health Status: Peripheral Edge Blur & Trauma Vignette */}
      {gameState === 'PLAYING' && hud && hud.health < 100 && (
        <div
          className="pointer-events-none fixed inset-0 z-30 transition-all duration-300 overflow-hidden"
          style={{
            backdropFilter: hud.health < 45 ? `blur(${(45 - hud.health) * 0.12}px)` : 'none',
            WebkitBackdropFilter: hud.health < 45 ? `blur(${(45 - hud.health) * 0.12}px)` : 'none',
            maskImage: 'radial-gradient(circle at center, transparent 40%, black 100%)',
            WebkitMaskImage: '-webkit-radial-gradient(center, circle, transparent 40%, black 100%)',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              boxShadow: `inset 0 0 ${Math.round(80 + (100 - hud.health) * 1.2)}px rgba(220, 38, 38, ${Math.min(0.85, (100 - hud.health) * 0.0085 + (hud.bodyHealth?.bleeding ? 0.25 : 0))})`,
            }}
          />
        </div>
      )}

      {/* Tactical Vignette & Film Grain Corner Visual Effect on Danger Situation / Damage */}
      {gameState === 'PLAYING' && hud?.dangerState?.active && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          {/* Corner Red Vignette Glow */}
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(239,68,68,0.7)] animate-pulse" />
          {/* Tactical Danger Corner Markers */}
          <div className="absolute top-2 left-2 border-t-2 border-l-2 border-red-500 w-8 h-8 animate-ping" />
          <div className="absolute top-2 right-2 border-t-2 border-r-2 border-red-500 w-8 h-8 animate-ping" />
          <div className="absolute bottom-2 left-2 border-b-2 border-l-2 border-red-500 w-8 h-8 animate-ping" />
          <div className="absolute bottom-2 right-2 border-b-2 border-r-2 border-red-500 w-8 h-8 animate-ping" />
          {/* Film Grain Vignette Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(239,68,68,0.32)_100%)] mix-blend-overlay" />
        </div>
      )}

      {/* Full-Screen C4 Armed Warning Overlay: no countdown until the area is clear */}
      {gameState === 'PLAYING' && (() => {
        const unsafeC4 = hud?.activeC4Charges?.filter((c) => !c.safeToDetonate);
        if (!unsafeC4 || unsafeC4.length === 0) return null;

        return (
          <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-between p-6 select-none overflow-hidden">
            {/* Pulsing Red Perimeter Vignette */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/45 via-transparent to-red-600/45 border-[10px] border-red-600 animate-pulse shadow-[inset_0_0_100px_rgba(220,38,38,0.9)] opacity-75" />

            {/* Top Emergency Red Banner */}
            <div className="relative z-50 mt-10 bg-[#080C11]/95 border-2 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.9)] px-6 py-2.5 flex items-center gap-4 text-white font-mono-tabular animate-bounce">
              <AlertTriangle className="w-7 h-7 text-red-500 shrink-0 animate-pulse" />
              <div className="flex flex-col text-center">
                <span className="text-[10px] font-black text-red-400 tracking-widest uppercase">
                  ⚠ ALERTA ROJA · C4 ARMADA · ZONA NO DESPEJADA
                </span>
                <span className="text-lg md:text-2xl font-black text-white tracking-wider">
                  {unsafeC4[0].targetName.toUpperCase()} · DETONACIÓN BLOQUEADA
                </span>
              </div>
              <Flame className="w-7 h-7 text-amber-500 shrink-0 animate-pulse" />
            </div>

            {/* Bottom Caution Strip */}
            <div className="relative z-50 mb-14 px-4 py-1.5 bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-mono-tabular font-bold tracking-widest text-center shadow-xl">
              [!] PULSA [J] PARA DESPEJAR · ALÉJATE &gt;190 px DE LA CARGA
            </div>
          </div>
        );
      })()}



      {/* ==================== 2. STREAMLINED PERIMETER CQB HUD WITH ICONS ==================== */}
      {gameState === 'PLAYING' && hud && (
        <TacticalHud
          anatomyDrawerOpen={anatomyDrawerOpen}
          commandMenuOpen={commandMenuOpen}
          engineRef={engineRef}
          handleHudOpacityChange={handleHudOpacityChange}
          handleReturnToTitle={handleReturnToTitle}
          handleSquadCommand={handleSquadCommand}
          handleStartApartmentMission={handleStartApartmentMission}
          handleStartMission={handleStartMission}
          handleStartStationMission={handleStartStationMission}
          handleStartTrainingRange={handleStartTrainingRange}
          handleToggleMute={handleToggleMute}
          handleToggleRadioAudio={handleToggleRadioAudio}
          hud={hud}
          hudOpacity={hudOpacity}
          hudStackRef={hudStackRef}
          isListening={isListening}
          muted={muted}
          openModalExclusive={openModalExclusive}
          primaryWeapon={plan.primaryWeapon}
          radioAudioEnabled={radioAudioEnabled}
          radioLogOpen={radioLogOpen}
          rankDrawerOpen={rankDrawerOpen}
          setAnatomyDrawerOpen={setAnatomyDrawerOpen}
          setCommandMenuOpen={setCommandMenuOpen}
          setRadioLogOpen={setRadioLogOpen}
          setRankDrawerOpen={setRankDrawerOpen}
          setSquadDrawerOpen={setSquadDrawerOpen}
          squadDrawerOpen={squadDrawerOpen}
          startVoiceCapture={startVoiceCapture}
          stopVoiceCapture={stopVoiceCapture}
        />
      )}

      {/* ==================== 3. UNIFIED PAUSE & MISSION SUMMARY MODAL (TRANSLUCENT) ==================== */}
      {(gameState === 'PAUSED' || gameState === 'VICTORY' || gameState === 'DEFEAT') &&
        activeModal === 'NONE' &&
        hud && (
          <PauseSummaryModal
            gameState={gameState as 'PAUSED' | 'VICTORY' | 'DEFEAT'}
            hud={hud}
            pauseAuditOpen={pauseAuditOpen}
            onToggleAudit={() => {
              soundEngine.playUiClick();
              setPauseAuditOpen((v) => !v);
            }}
            onOpenModal={openModalExclusive}
            onContinue={() => engineRef.current?.handleKeyDown('Escape')}
            onRestart={handleStartMission}
            onReturnTitle={() => {
              openModalExclusive('NONE');
              if (engineRef.current) {
                engineRef.current.cambiarEstado('RETURN_TO_TITLE');
                clearSave();
                setHasSavedGame(false);
              }
            }}
          />
        )}

      {/* ==================== 4. INTERACTIVE EKO-PAD C4I TABLET MODAL (With FadeIn / FadeOut & Temporary Markers) ==================== */}
      {hud && (
        <Suspense fallback={null}>
          <TacticalPadModal
            isOpen={activeModal === 'PAD'}
          hud={hud}
          onClose={() => openModalExclusive('NONE')}
          onClearWaypoint={() => {
            engineRef.current?.clearTacticalWaypoint();
          }}
          onAddTacticalMarker={(x, y, type, customLabel) => {
            engineRef.current?.addTacticalMarker(x, y, type, customLabel);
          }}
          onRemoveTacticalMarker={(id) => {
            engineRef.current?.removeTacticalMarker(id);
          }}
          onClearTacticalMarkers={() => {
            engineRef.current?.clearTacticalMarkers();
          }}
          onSquadCommand={(cmd) => {
            engineRef.current?.issueSquadCommand(cmd);
          }}
          onApplyIfak={() => {
            engineRef.current?.applyIfakTreatment();
          }}
          onTriggerBiometricId={(actorId) => {
            engineRef.current?.triggerBiometricRadioId(actorId);
          }}
          onOpenBlueprint={() => {
            openModalExclusive('BLUEPRINT');
          }}
          onCycleThermal={() => engineRef.current?.cycleThermalPaletteMode()}
          thermalActive={hud.inspectionId === 'THERMAL_CAM' && hud.mirrorActive}
          onVoiceStart={startVoiceCapture}
          onVoiceStop={stopVoiceCapture}
          isListening={isListening}
        />
        </Suspense>
      )}

      {/* ==================== 5. PRE-MISSION PLANNING (BLAUPAUSE) MODAL ==================== */}
      {activeModal === 'BLUEPRINT' && (
        <Suspense fallback={null}>
          <BlueprintModal
            plan={plan}
            onChangePlan={handlePlanChange}
            onClose={() => openModalExclusive('NONE')}
            onDeployNow={handleStartMission}
          />
        </Suspense>
      )}

      {/* ==================== 6. COMPLETE GDD MODAL ==================== */}
      {activeModal === 'GDD' && (
        <Suspense fallback={null}>
          <GddModal
            plan={plan}
            onChangePlan={handlePlanChange}
            onClose={() => openModalExclusive('NONE')}
            onStartPrototype={handleStartMission}
          />
        </Suspense>
      )}

      {/* ==================== 7. TACTICAL CONTROLS & CQB DOCTRINE MODAL ==================== */}
            {activeModal === 'CONTROLS' && (
        <ControlsModal
           nvgActive={hud?.nvgActive ?? false}
           hudOpacity={hudOpacity}
           onHudOpacityChange={handleHudOpacityChange}
           nvgKeyCode={nvgKeyCode}
           isRebindingNvgKey={isRebindingNvgKey}
           formatKeyCodeLabel={formatKeyCodeLabel}
           onToggleNightVision={() => engineRef.current?.toggleNightVision()}
           onSelectNvgKey={(code) => {
             isRebindingNvgKeyRef.current = false;
             setIsRebindingNvgKey(false);
             handleNvgKeyChange(code, true);
           }}
           onRebindToggle={() => {
             soundEngine.playUiClick();
             const next = !isRebindingNvgKey;
             isRebindingNvgKeyRef.current = next;
             setIsRebindingNvgKey(next);
           }}
           onOpenBlueprint={() => openModalExclusive('BLUEPRINT')}
           onClose={() => openModalExclusive('NONE')}
         />
      )}

      {/* Armory Inspector Modal */}
      {activeModal === 'ARMORY' && (
        <Suspense fallback={null}>
          <ArmoryInspectorModal
            plan={plan}
            onChangePlan={handlePlanChange}
            onClose={() => openModalExclusive('NONE')}
          />
        </Suspense>
      )}

      {/* EKIS Criminal Intelligence Database Modal */}
      {activeModal === 'INTEL' && (
        <Suspense fallback={null}>
          <EkisIntelModal onClose={() => openModalExclusive('NONE')} />
        </Suspense>
      )}

      {/* Operator Career & Rank Dossier Modal */}
      {activeModal === 'CAREER' && (
        <Suspense fallback={null}>
          <OperatorCareerModal
            xpTelemetry={
            hud?.xpTelemetry ?? {
              totalXp: 0,
              sessionXp: 0,
              level: 1,
              rankDe: 'Aspirant',
              rankEs: 'Aspirante Cobra',
              xpInLevel: 0,
              xpForNextLevel: 500,
              progressPct: 0,
            }
          }
          score={hud?.score ?? 0}
          onClose={() => openModalExclusive('NONE')}
        />
        </Suspense>
      )}

      {/* Right-Click Tactical Context Menu for Doors, Windows & Sectors */}
      {contextMenu?.open && gameState === 'PLAYING' && (
        <div
          className="fixed z-50 w-64 border border-[#38BDF8]/60 bg-[#080C11]/90 backdrop-blur-md text-white font-mono-tabular shadow-[0_0_30px_rgba(0,0,0,0.9)] p-2.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#334155]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#38BDF8]">
              <Radio className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="truncate max-w-[170px]">
                {contextMenu.target.type === 'DOOR'
                  ? `PUERTA: ${contextMenu.target.name}`
                  : contextMenu.target.type === 'WINDOW'
                    ? `VENTANA: ${contextMenu.target.name}`
                    : `SECTOR: (${Math.round(contextMenu.target.x)}, ${Math.round(contextMenu.target.y)})`}
              </span>
            </div>
            <button
              onClick={() => setContextMenu(null)}
              className="text-[#94A3B8] hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="text-[10px] text-[#94A3B8] mb-2">
            ORDEN DE INTERVENCIÓN PARA KOBRA-2:
          </div>

          <div className="space-y-1">
            {contextMenu.target.type === 'DOOR' ? (
              <>
                <button
                  onClick={() => handleContextMenuCommand('BREACH_AND_CLEAR')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#D97706]/20 border border-[#D97706]/50 hover:bg-[#D97706]/40 text-[#FDE68A] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>🚪 Brechar y Despejar</span>
                  <span className="text-[10px] text-[#D97706]">[3]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('PIE_DOOR')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#A855F7]/20 border border-[#A855F7]/50 hover:bg-[#A855F7]/40 text-[#E9D5FF] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>👁 Sonda Óptica / Cortar Ángulo</span>
                  <span className="text-[10px] text-[#A855F7]">[4]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('DEPLOY_CS_GAS')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#10B981]/20 border border-[#10B981]/50 hover:bg-[#10B981]/40 text-[#A7F3D0] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>💨 Lanzar Granada CS</span>
                  <span className="text-[10px] text-[#10B981]">[5]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('HOLD')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#38BDF8]/20 border border-[#38BDF8]/50 hover:bg-[#38BDF8]/40 text-[#BAE6FD] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>🔒 Cubrir y Mantener Umbral</span>
                  <span className="text-[10px] text-[#38BDF8]">[2]</span>
                </button>
              </>
            ) : contextMenu.target.type === 'WINDOW' ? (
              <>
                <button
                  onClick={() => handleContextMenuCommand('HOLD')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#38BDF8]/20 border border-[#38BDF8]/50 hover:bg-[#38BDF8]/40 text-[#BAE6FD] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>🪟 Vigilar Ventana / Overwatch</span>
                  <span className="text-[10px] text-[#38BDF8]">[2]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('DEPLOY_CS_GAS')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#10B981]/20 border border-[#10B981]/50 hover:bg-[#10B981]/40 text-[#A7F3D0] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>💨 Lanzar CS por Ventana</span>
                  <span className="text-[10px] text-[#10B981]">[5]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('SUPPRESS_TARGET')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#EF4444]/20 border border-[#EF4444]/50 hover:bg-[#EF4444]/40 text-[#FCA5A5] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>⚡ Fuego de Supresión</span>
                  <span className="text-[10px] text-[#EF4444]">[7]</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleContextMenuCommand('HOLD')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#38BDF8]/20 border border-[#38BDF8]/50 hover:bg-[#38BDF8]/40 text-[#BAE6FD] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>⌖ Desplazar a Posición</span>
                  <span className="text-[10px] text-[#38BDF8]">[2]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('RESTRAIN_AND_SECURE')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#34D399]/20 border border-[#34D399]/50 hover:bg-[#34D399]/40 text-[#6EE7B7] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>🔒 Esposar Rendidos y Evidencia</span>
                  <span className="text-[10px] text-[#34D399]">[6]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('SUPPRESS_TARGET')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#EF4444]/20 border border-[#EF4444]/50 hover:bg-[#EF4444]/40 text-[#FCA5A5] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>⚡ Fuego de Supresión / Intimidar</span>
                  <span className="text-[10px] text-[#EF4444]">[7]</span>
                </button>
                <button
                  onClick={() => handleContextMenuCommand('REGROUP_HEAL')}
                  className="w-full text-left px-2.5 py-1.5 bg-[#7DD3FC]/20 border border-[#7DD3FC]/50 hover:bg-[#7DD3FC]/40 text-[#BAE6FD] text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>🏥 Reagrupar y Curar</span>
                  <span className="text-[10px] text-[#7DD3FC]">[8]</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Immersive Tactical Screen Danger Border Overlay */}
      {gameState === 'PLAYING' && hud?.dangerState?.active && (
        <div className="fixed inset-0 pointer-events-none z-30 border-4 border-[#EF4444]/70 shadow-[inset_0_0_90px_rgba(220,38,38,0.65)] animate-pulse" />
      )}
    </div>
  );
}


