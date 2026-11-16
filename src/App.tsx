import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Crosshair,
  Flame,
  Heart,
  Menu,
  Radio,
  Shield,
  Tablet,
  Target,
  TrainFront,
  Users,
  Volume2,
  VolumeX,
  Zap,
  Mic,
  MicOff,
} from 'lucide-react';
import { TouchControls } from './components/TouchControls';
import { TitleScreen } from './components/TitleScreen';
import { KeybindRemapModal } from './components/KeybindRemapModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { PauseSummaryModal } from './components/PauseSummaryModal';
import { ControlsModal } from './components/ControlsModal';
import { useModalA11y } from './hooks/useModalA11y';
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
import { GameState, HudSnapshot, MissionPlan, SquadCommand, COBRA_RANK_TIERS, computePlayerMissionRank, RadioFeedItem } from './game/types';

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
  const [missionsAccordionOpen, setMissionsAccordionOpen] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [, setHudCompactMode] = useState(true);
  const [, setMissionPanelOpen] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [keybindModalOpen, setKeybindModalOpen] = useState(false);
  const keybindDialogRef = useModalA11y(keybindModalOpen);
  const controlsDialogRef = useModalA11y(activeModal === 'CONTROLS');
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
          missionsAccordionOpen={missionsAccordionOpen}
          setMissionsAccordionOpen={setMissionsAccordionOpen}
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
        dialogRef={keybindDialogRef}
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
        <div
          style={{ opacity: hudOpacity / 100 }}
          ref={hudStackRef}
          className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end transition-opacity duration-150"
        >
          {/* ==================== SITUACIÓN DE PELIGRO HUD BADGE (DOCKED ABOVE FOOTER) ==================== */}
          {hud.dangerState?.active && (
            <div className="pointer-events-auto self-center mb-1.5 max-w-[calc(100vw-1rem)] px-3 py-1 bg-[#EF4444]/90 backdrop-blur-sm border border-[#FCA5A5] text-black font-mono-tabular font-extrabold text-[11px] shadow-[0_0_22px_rgba(239,68,68,0.9)] flex items-center gap-2 animate-pulse shrink-0">
              <AlertTriangle className="w-4 h-4 fill-current shrink-0 text-black" />
              <span>⚠ SITUACIÓN DE PELIGRO: {hud.dangerState.reason}</span>
            </div>
          )}

          {/* ==================== TRAINING MODE DOCKED STRIP (ONLY WHEN IN TRAINING) ==================== */}
          {hud.isTrainingMode && (
            <div className="pointer-events-auto self-center mb-1.5 flex flex-col items-center gap-1 font-mono-tabular">
              <div className="flex flex-wrap items-center justify-center gap-2 bg-[#080C11]/95 backdrop-blur-md border border-[#F59E0B]/75 px-3 py-1 shadow-[0_0_20px_rgba(245,158,11,0.25)] text-[10.5px] text-white">
                <span className="font-extrabold text-[#FBBF24] flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#F59E0B]" />
                  GALERÍA DE TIRO
                </span>
                <span className="text-[#334155]">|</span>
                <div className="flex items-center gap-1.5 bg-[#0F172A] border border-[#334155] px-2 py-0.5 text-[9.5px]">
                  <span className="text-[#94A3B8]">SACUDIDA:</span>
                  <div className="w-16 h-2 bg-[#1E293B] overflow-hidden flex items-center">
                    <div
                      className="h-full bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((hud.trainingTelemetry?.currentShake || 0) / 14) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="font-bold text-[#FDE68A]">{hud.trainingTelemetry?.currentShake || 0}px</span>
                </div>
                <span className="text-[#334155]">|</span>
                <div className="text-[10px] text-[#CBD5E1]">
                  Disparos: <strong className="text-white">{hud.trainingTelemetry?.shotsFired || 0}</strong> · Aciertos:{' '}
                  <strong className="text-[#10B981]">{hud.trainingTelemetry?.targetsHit || 0}</strong> (
                  {hud.trainingTelemetry?.accuracyPct || 0}%)
                </div>
                <span className="text-[#334155]">|</span>
                <button
                  onClick={handleReturnToTitle}
                  className="px-2 py-0.5 bg-[#1E293B] border border-[#475569] text-[#CBD5E1] hover:text-white hover:border-[#94A3B8] transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Menú
                </button>
                <button
                  onClick={handleStartMission}
                  className="px-2.5 py-0.5 bg-[#D97706] hover:bg-[#F59E0B] text-black font-bold transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                >
                  ▶ Desplegar
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1 bg-[#080C11]/90 backdrop-blur-sm border border-[#334155]/70 px-2.5 py-1 text-[9.5px]">
                <span className="text-[#94A3B8] font-semibold mr-1">CALIBRES [1–4]:</span>
                {[
                  { id: 'AUG_A3' as const, key: '1', label: 'AUG A3' },
                  { id: 'AUG_PARA' as const, key: '2', label: 'AUG Para' },
                  { id: 'MP7A1' as const, key: '3', label: 'MP7A1' },
                  { id: 'GLOCK_SHIELD' as const, key: '4', label: 'Glock 17' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => engineRef.current?.switchTrainingWeapon(w.id)}
                    className={`px-1.5 py-0.5 border transition-all cursor-pointer ${
                      plan.primaryWeapon === w.id
                        ? 'bg-[#F59E0B]/25 border-[#F59E0B] text-[#FDE68A] font-bold'
                        : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    [{w.key}] {w.label}
                  </button>
                ))}
                <span className="text-[#475569] mx-1">|</span>
                <span className="text-[#94A3B8] font-semibold">BRECHA:</span>
                <button
                  onClick={() => engineRef.current?.triggerTrainingDoorBreach('KICK')}
                  className="px-1.5 py-0.5 bg-[#0F172A] border border-[#38BDF8]/60 text-[#BAE6FD] hover:bg-[#38BDF8]/20 transition-colors cursor-pointer"
                >
                  [F] Patada
                </button>
                <button
                  onClick={() => engineRef.current?.triggerTrainingDoorBreach('RAM')}
                  className="px-1.5 py-0.5 bg-[#0F172A] border border-[#F59E0B]/60 text-[#FDE68A] hover:bg-[#F59E0B]/20 transition-colors cursor-pointer"
                >
                  [X] Ariete
                </button>
                <button
                  onClick={() => engineRef.current?.triggerTrainingDoorBreach('C4')}
                  className="px-1.5 py-0.5 bg-[#0F172A] border border-[#EF4444]/70 text-[#FCA5A5] hover:bg-[#EF4444]/20 transition-colors cursor-pointer"
                >
                  [C] C4
                </button>
              </div>
            </div>
          )}

          {/* ==================== SINGLE COMPACT CONTEXTUAL PROMPT (TRANSLUCENT) ==================== */}
          <div className="mb-1.5 flex flex-col items-center pointer-events-none px-2">
            {hud.c4Planting ? (
              <div className="px-4 py-1.5 bg-[#080C11]/80 backdrop-blur-sm border border-[#EF4444]/80 shadow-[0_0_20px_rgba(239,68,68,0.35)] flex items-center gap-3 font-mono-tabular text-[11px] text-white">
                <span className="font-bold text-[#FCA5A5]">
                  ⚙ PLANTANDO C4 · {hud.c4Planting.targetName.toUpperCase()}
                </span>
                <div className="w-36 bg-[#1E293B]/80 h-1.5 overflow-hidden border border-[#EF4444]/50">
                  <div
                    className="bg-[#EF4444] h-full transition-all duration-75"
                    style={{ width: `${hud.c4Planting.progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#CBD5E1]">{hud.c4Planting.executionTime} · MANTÉN POSICIÓN</span>
              </div>
            ) : hud.breachAction ? (
              <div className="px-4 py-1.5 bg-[#080C11]/55 backdrop-blur-sm border border-[#D97706]/80 shadow-lg flex items-center gap-3 font-mono-tabular text-[11px]">
                <span className="font-bold text-[#FDE68A]">
                  💥 {hud.breachAction.name.toUpperCase()}
                </span>
                <div className="w-36 bg-[#1E293B]/80 h-1.5 overflow-hidden border border-[#334155]">
                  <div
                    className="bg-[#D97706] h-full transition-all duration-75"
                    style={{ width: `${hud.breachAction.progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#CBD5E1]">{hud.breachAction.executionTime}</span>
              </div>
            ) : hud.contextPrompt ? (
              <div className="px-3.5 py-1 bg-[#080C11]/50 backdrop-blur-sm border border-[#D97706]/70 text-[11px] font-mono-tabular text-[#FDE68A]">
                {hud.contextPrompt}
              </div>
            ) : hud.bodyHealth.bleeding ? (
              <div className="px-3 py-1 bg-[#7F1D1D]/55 backdrop-blur-sm border border-[#EF4444]/80 text-[11px] font-mono-tabular text-[#FECACA] animate-pulse">
                HEMORRAGIA ACTIVA · PULSA [H] PARA TORNIQUETE IFAK
              </div>
            ) : null}
          </div>

          {/* ==================== ACTIVE PLACED C4 CHARGES: CLEAR AREA, THEN DETONATE ==================== */}
          {hud.activeC4Charges && hud.activeC4Charges.length > 0 && (
            <div className="pointer-events-auto fixed bottom-24 right-4 z-40 flex flex-col gap-2 max-w-xs select-none animate-fadeIn">
              {hud.activeC4Charges.map((charge) => (
                <div key={charge.id} className="border-2 border-[#EF4444] bg-[#080C11]/95 p-3 shadow-[0_0_35px_rgba(239,68,68,0.75)] font-mono-tabular text-white flex flex-col gap-1.5">
                  <div className="flex items-center justify-between border-b border-[#EF4444]/60 pb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#FCA5A5]">
                      <span>💥</span>
                      <span>C4 ARMADA · {charge.targetName}</span>
                    </div>
                    <div
                      className={`text-[9px] font-bold border px-1.5 py-0.5 ${
                        charge.safeToDetonate
                          ? 'text-[#34D399] border-[#34D399]/50 bg-[#34D399]/10'
                          : 'text-[#F59E0B] border-[#F59E0B]/50 bg-[#F59E0B]/10 animate-pulse'
                      }`}
                    >
                      {charge.safeToDetonate ? 'ZONA DESPEJADA' : '¡DESPEJAR!'}
                    </div>
                  </div>
                  <div className="text-[10px] text-[#CBD5E1] leading-tight">
                    {charge.safeToDetonate
                      ? 'Binomio fuera del radio. Detonación remota autorizada.'
                      : '1) Pulsa [J] para ordenar a Kobra-2 despejar. 2) Aléjate de la carga. Después podrás detonar.'}
                  </div>
                  <div className={`border p-2 text-center ${charge.safeToDetonate ? 'border-[#34D399]/70 bg-[#052E1B]' : 'border-[#EF4444]/70 bg-[#0F172A]'}`}>
                    <div className="text-[8.5px] text-[#94A3B8] font-bold tracking-wider mb-0.5">
                      ESTADO DE DETONACIÓN:
                    </div>
                    <div className={`text-sm font-black tracking-widest ${charge.safeToDetonate ? 'text-[#34D399]' : 'text-[#EF4444]'}`}>
                      {charge.safeToDetonate ? 'LISTO PARA DETONAR' : 'ESPERANDO DESPEJE'}
                    </div>
                    <div className="text-[9px] text-[#94A3B8] mt-1">Radio seguro: &gt;190 px</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => engineRef.current?.orderBlastAreaClear()}
                      className="py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold text-[10px] tracking-wider border border-[#FCD34D] transition-colors active:scale-95 cursor-pointer"
                    >
                      [J] DESPEJAR ZONA
                    </button>
                    <button
                      onClick={() => engineRef.current?.detonateActiveC4()}
                      disabled={!charge.safeToDetonate}
                      className={`py-1.5 font-bold text-[10px] tracking-wider border transition-colors flex items-center justify-center gap-1 ${
                        charge.safeToDetonate
                          ? 'bg-[#EF4444] hover:bg-[#DC2626] text-white border-red-400 active:scale-95 cursor-pointer'
                          : 'bg-[#1E293B] text-[#64748B] border-[#334155] cursor-not-allowed'
                      }`}
                    >
                      ⚡ DETONAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ==================== UNIFIED TACTICAL HUD FOOTER ==================== */}
          <div className="pointer-events-auto bg-[#080C11]/92 backdrop-blur-md border-t border-[#334155]/70 px-1.5 sm:px-2 py-0.5 font-mono-tabular shadow-2xl flex flex-row flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-1.5 overflow-visible sm:overflow-x-auto whitespace-nowrap z-20">
            {/* 1. OPERATOR & SQUADMATE TELEMETRY */}
            <div className="hud-operador relative flex items-center gap-3 shrink-0">
              {/* Upward Popover 1: Anatomical Telemetry */}
              <div
                aria-hidden={!anatomyDrawerOpen}
                className={`tactical-popover-up origin-bottom-left absolute left-0 bottom-full mb-2 w-64 bg-[#080C11]/95 backdrop-blur-md border border-[#334155]/65 p-2.5 shadow-2xl text-[10px] space-y-1 z-30 ${
                  anatomyDrawerOpen ? 'tactical-popover-up-open' : 'tactical-popover-up-closed'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[#CBD5E1] font-bold border-b border-[#334155]/50 pb-1">
                  <span>TELEMETRÍA ANATÓMICA KOBRA-1</span>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setAnatomyDrawerOpen(false);
                    }}
                    className="text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    [×]
                  </button>
                </div>
                <div className="flex items-center gap-2.5 font-semibold">
                  <span className={hud.bodyHealth.torso > 60 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                    Torso {Math.round(hud.bodyHealth.torso)}%
                  </span>
                  <span>·</span>
                  <span className={hud.bodyHealth.arms > 60 ? 'text-[#10B981]' : 'text-[#F59E0B]'}>
                    Brazos {Math.round(hud.bodyHealth.arms)}%
                  </span>
                  <span>·</span>
                  <span className={hud.bodyHealth.legs > 60 ? 'text-[#10B981]' : 'text-[#F59E0B]'}>
                    Piernas {Math.round(hud.bodyHealth.legs)}%
                  </span>
                </div>
                <div className="text-[#CBD5E1]">
                  Movilidad: <strong className="text-white">{hud.moveSpeedPct}%</strong> · Visión:{' '}
                  <strong className="text-white">{hud.visionStabilityPct}%</strong>
                </div>
              </div>

              {/* Upward Popover 2: Squadmate Tactical Orders & Vitals */}
              <div
                aria-hidden={!squadDrawerOpen}
                className={`tactical-popover-up origin-bottom-left absolute left-0 sm:left-48 bottom-full mb-2 bg-[#080C11]/95 backdrop-blur-md border border-[#334155]/65 p-3 shadow-2xl text-[11px] space-y-2 w-80 sm:w-96 z-30 ${
                  squadDrawerOpen ? 'tactical-popover-up-open' : 'tactical-popover-up-closed'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] text-[#38BDF8] font-bold border-b border-[#334155]/50 pb-1">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> ÓRDENES TÁCTICAS KOBRA-2 ({hud.squadVitals.roomName})
                  </span>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSquadDrawerOpen(false);
                    }}
                    className="text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    [×]
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-[#0B111A]/50 p-2 border border-[#334155]/50">
                  <div>
                    <div className="text-[#94A3B8] flex items-center gap-1">
                      <Heart className={`w-3 h-3 ${hud.squadVitals.health <= 25 ? 'text-[#EF4444] animate-pulse' : 'text-[#10B981]'}`} /> Salud
                    </div>
                    <div className="font-bold text-white mt-0.5">
                      {hud.squadVitals.health}% · KV {hud.squadVitals.armor}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#94A3B8] flex items-center gap-1">
                      <Flame className="w-3 h-3 text-[#F59E0B]" /> Fatiga
                    </div>
                    <div className="font-bold text-[#FDE68A] mt-0.5">
                      {hud.squadVitals.fatigue}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[#94A3B8] flex items-center gap-1">
                      <Activity className="w-3 h-3 text-[#38BDF8]" /> Pulso
                    </div>
                    <div className="font-bold text-[#38BDF8] mt-0.5">
                      {hud.squadVitals.pulseBpm} BPM
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {(
                    [
                      ['FOLLOW', '[1] Seguimiento (Folgen)'],
                      ['HOLD', '[2] Mantener Posición'],
                      ['BREACH_AND_CLEAR', '[3] Brechar y Despejar'],
                      ['PIE_DOOR', '[4] Cortar el Pastel'],
                      ['DEPLOY_CS_GAS', '[5] Lanzar Gas CS'],
                      ['RESTRAIN_AND_SECURE', '[6] Esposar y Asegurar'],
                      ['SUPPRESS_TARGET', '[7] Fuego de Supresión'],
                      ['REGROUP_HEAL', '[8] Reagrupar y Curar'],
                      ['CLEAR_BLAST_AREA', '[J] Despejar zona C4'],
                    ] as Array<[SquadCommand, string]>
                  ).map(([cmd, label]) => (
                    <button
                      key={cmd}
                      onClick={() => handleSquadCommand(cmd)}
                      className={`px-2 py-1 text-left border transition-colors cursor-pointer truncate ${
                        hud.squadCommand === cmd
                          ? 'border-[#38BDF8] bg-[#38BDF8]/25 text-white font-bold'
                          : 'border-[#334155]/60 bg-[#0B111B]/45 text-[#CBD5E1] hover:text-white hover:border-[#38BDF8]/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* K1 Leader: Diegetic Status, Armor, IFAK */}
              <div className="flex items-center gap-2">
                <div className="w-28 sm:w-32">
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className={`flex items-center gap-1 font-bold ${
                        hud.health > 70
                          ? 'text-[#10B981]'
                          : hud.health > 35
                            ? 'text-[#F59E0B]'
                            : 'text-[#EF4444]'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {hud.health > 70
                          ? 'K1 OPERATIVO'
                          : hud.health > 35
                            ? 'K1 TRAUMA LEVE'
                            : 'K1 TRAUMA GRAVE'}
                      </span>
                    </span>
                    <span className="flex items-center gap-0.5 text-[#38BDF8] font-bold text-[9px]">
                      <Shield className="w-3 h-3" />
                      <span>{hud.armor > 50 ? 'KV III-A' : hud.armor > 0 ? 'KV DAÑADO' : 'SIN BLINDAJE'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#94A3B8] mt-1">
                    <span>TÚ (LÍDER)</span>
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        setAnatomyDrawerOpen((v) => !v);
                      }}
                      className="text-[#38BDF8] hover:underline cursor-pointer"
                    >
                      {anatomyDrawerOpen ? '▾ Cuerpo' : '▴ Cuerpo'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => engineRef.current?.applyIfakTreatment()}
                  title="Aplicar torniquete IFAK [H]"
                  className={`px-1.5 py-1 text-[9px] font-bold border transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    hud.bodyHealth.bleeding
                      ? 'bg-[#EF4444] text-black border-[#FCA5A5] animate-pulse'
                      : 'bg-[#0F172A] text-[#10B981] border-[#334155] hover:border-[#10B981]'
                  }`}
                >
                  <span>✚ IFAK</span>
                  <span className="text-[8px] text-[#CBD5E1]">[H]×{hud.ifakCount}</span>
                </button>
              </div>

              {/* K1 Fatigue & Pulse */}
              <div className="border-l border-[#334155]/60 pl-2.5 w-28 sm:w-32 hidden sm:block">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 font-bold text-[#F59E0B]">
                    <Flame className="w-3 h-3" />
                    <span>
                      {hud.fatigue > 75
                        ? 'AGOTADO'
                        : hud.fatigue > 35
                          ? 'FATIGA LEVE'
                          : 'RITMO ESTABLE'}
                    </span>
                  </span>
                  <span
                    className={`flex items-center gap-0.5 font-bold text-[9px] ${
                      hud.pulseBpm > 125
                        ? 'text-[#EF4444] animate-pulse'
                        : hud.pulseBpm > 95
                          ? 'text-[#F59E0B]'
                          : 'text-[#10B981]'
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    <span>{hud.pulseBpm} BPM</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#94A3B8] mt-1">
                  <span>Prec. {hud.accuracyPct}%</span>
                  <span className={hud.focusedAimActive ? 'text-[#34D399] font-bold' : ''}>
                    {hud.focusedAimActive ? '🎯 ENFOQUE' : 'NORMAL'}
                  </span>
                </div>
              </div>

              {/* K2 Squadmate */}
              <div
                onClick={() => {
                  soundEngine.playUiClick();
                  setSquadDrawerOpen((v) => !v);
                }}
                title="Clic para abrir órdenes tácticas de Kobra-2"
                className="border-l border-[#334155]/60 pl-2.5 w-28 sm:w-36 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span
                    className={`flex items-center gap-1 font-bold ${
                      hud.squadVitals.health > 70
                        ? 'text-[#38BDF8]'
                        : hud.squadVitals.health > 35
                          ? 'text-[#F59E0B]'
                          : 'text-[#EF4444]'
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    <span>
                      {hud.squadVitals.health > 70
                        ? 'K2 OPERATIVO'
                        : hud.squadVitals.health > 35
                          ? 'K2 HERIDO'
                          : 'K2 CRÍTICO'}
                    </span>
                  </span>
                  <span className="hud-k2-blindaje text-[9px] text-[#CBD5E1]">
                    {hud.squadVitals.armor > 50 ? 'KV III-A' : hud.squadVitals.armor > 0 ? 'KV DAÑADO' : 'SIN BLINDAJE'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#94A3B8] mt-1">
                  <span className="text-[#38BDF8] font-semibold truncate">
                    {squadDrawerOpen ? '▾' : '▴'}{' '}
                    {hud.squadCommand === 'FOLLOW'
                      ? '[1] Sigue'
                      : hud.squadCommand === 'HOLD'
                        ? '[2] Posición'
                        : hud.squadCommand === 'BREACH_AND_CLEAR'
                          ? '[3] Brecha'
                          : hud.squadCommand === 'PIE_DOOR'
                            ? '[4] Ángulo'
                            : hud.squadCommand === 'DEPLOY_CS_GAS'
                              ? '[5] Gas'
                              : hud.squadCommand === 'RESTRAIN_AND_SECURE'
                                ? '[6] Esposa'
                                : hud.squadCommand === 'SUPPRESS_TARGET'
                                  ? '[7] Suprime'
                                  : hud.squadCommand === 'CLEAR_BLAST_AREA'
                                    ? '[J] Despeja C4'
                                    : '[8] Reagrupa'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. DYNAMIC MISSION RANK & SCORE INDICATOR */}
            {(() => {
              const rank = hud.playerMissionRank || computePlayerMissionRank(hud.score || 0);
              return (
                <div className="relative hidden sm:flex items-center shrink-0 border-l border-r border-[#334155]/60 px-2.5">
                  {/* Upward Popover: Rank Tiers & Mission Performance Details */}
                  <div
                    aria-hidden={!rankDrawerOpen}
                    className={`tactical-popover-up origin-bottom-center absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 sm:w-96 bg-[#080C11]/98 backdrop-blur-md border border-[#334155]/75 p-3 shadow-2xl text-[10.5px] space-y-2.5 z-40 ${
                      rankDrawerOpen ? 'tactical-popover-up-open' : 'tactical-popover-up-closed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[#CBD5E1] font-bold border-b border-[#334155]/60 pb-1.5">
                      <span className="flex items-center gap-1.5 text-white">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>SISTEMA DE RANGO & DESEMPEÑO EKO COBRA</span>
                      </span>
                      <button
                        onClick={() => {
                          soundEngine.playUiClick();
                          setRankDrawerOpen(false);
                        }}
                        className="text-[#94A3B8] hover:text-white cursor-pointer"
                      >
                        [×]
                      </button>
                    </div>

                    {/* Current Rank Spotlight Card */}
                    <div
                      className="p-2.5 border bg-[#0B111A]/85 flex items-center justify-between"
                      style={{ borderColor: `${rank.color}70` }}
                    >
                      <div>
                        <div className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-semibold">
                          Rango Actual en Operación
                        </div>
                        <div className="text-sm font-black tracking-wide" style={{ color: rank.color }}>
                          {rank.titleDe} ({rank.titleEs})
                        </div>
                        <div className="text-[9.5px] text-[#CBD5E1] mt-0.5">
                          Puntuación acumulada: <strong className="text-white font-bold">{rank.score} PTS</strong>
                          {hud.roeViolations > 0 && (
                            <span className="text-[#EF4444] ml-1.5">· {hud.roeViolations} violaciones §7 WVG</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-amber-400">{rank.insignia}</div>
                        <div className="text-[8px] text-[#94A3B8] font-bold">{rank.badgeCode}</div>
                      </div>
                    </div>

                    {/* Rank Progression Ladder */}
                    <div>
                      <div className="text-[9px] text-[#94A3B8] uppercase font-bold tracking-wider mb-1">
                        Escalafón de Ascensos por Desempeño:
                      </div>
                      <div className="space-y-1">
                        {COBRA_RANK_TIERS.map((tier) => {
                          const isCurrent = rank.titleDe === tier.titleDe;
                          const isUnlocked = (hud.score || 0) >= tier.threshold;
                          return (
                            <div
                              key={tier.titleDe}
                              className={`px-2 py-1 text-[9.5px] flex items-center justify-between border transition-colors ${
                                isCurrent
                                  ? 'border-amber-400/80 bg-amber-500/15 font-bold text-white shadow-sm'
                                  : isUnlocked
                                    ? 'border-[#334155]/50 bg-[#0F172A]/40 text-[#94A3B8]'
                                    : 'border-[#1E293B]/40 bg-[#080C11]/40 text-[#64748B] opacity-70'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] w-6 text-center font-bold" style={{ color: tier.color }}>
                                  {tier.badgeCode}
                                </span>
                                <span>{tier.titleDe} ({tier.titleEs})</span>
                                {isCurrent && (
                                  <span className="px-1 py-0.2 text-[7.5px] bg-amber-500 text-black font-extrabold uppercase">
                                    ACTUAL
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-amber-400/90 font-mono">{tier.insignia}</span>
                                <span className="font-mono text-[9px] min-w-[56px] text-right">
                                  {tier.threshold}+ PTS
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[8.5px] text-[#94A3B8] border-t border-[#334155]/50 pt-1 leading-tight">
                      ℹ Los ascensos se obtienen dinámicamente con arrestos vivos (+250), identificación (+90), rescate y aseguramiento de evidencia. El exceso de fuerza penaliza la puntuación y degrada el rango.
                    </div>
                  </div>

                  {/* Rank Trigger Button */}
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setRankDrawerOpen((v) => !v);
                    }}
                    title="Rango táctico del operador en la misión. Clic para ver detalles y tabla de ascensos."
                    className="flex items-center gap-2 px-2.5 py-1 bg-[#0F172A]/85 hover:bg-[#1E293B]/80 border transition-all cursor-pointer group shadow-inner"
                    style={{ borderColor: `${rank.color}70` }}
                  >
                    <div
                      className="w-5 h-5 flex items-center justify-center border font-bold text-xs shrink-0"
                      style={{ borderColor: rank.color, color: rank.color, backgroundColor: `${rank.color}15` }}
                    >
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col text-left leading-tight min-w-[105px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">
                          RANGO · {rank.badgeCode}
                        </span>
                        <span className="text-[8.5px] font-bold text-amber-400">
                          {rank.insignia}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black tracking-wide" style={{ color: rank.color }}>
                          {rank.titleDe}
                        </span>
                        <span className="text-[9px] font-bold text-white bg-[#1E293B] px-1 rounded border border-[#334155]">
                          {rank.score >= 0 ? `+${rank.score}` : rank.score}p
                        </span>
                      </div>
                      {/* Micro progress bar to next promotion */}
                      {!rank.isMaxRank && !rank.isDemoted ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-14 h-1 bg-[#1E293B] overflow-hidden">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${rank.progressPct}%`, backgroundColor: rank.color }}
                            />
                          </div>
                          <span className="text-[7.5px] text-[#94A3B8] whitespace-nowrap">
                            {rank.nextThreshold - rank.score}p sig.
                          </span>
                        </div>
                      ) : rank.isMaxRank ? (
                        <span className="text-[7.5px] text-[#10B981] font-bold">★ MÁXIMO RANGO</span>
                      ) : (
                        <span className="text-[7.5px] text-[#EF4444] font-bold">⚠ PENALIZADO ROE</span>
                      )}
                    </div>
                    <span className="text-[9px] text-[#64748B] group-hover:text-white transition-colors ml-0.5">
                      {rankDrawerOpen ? '▾' : '▴'}
                    </span>
                  </button>
                </div>
              );
            })()}

            {/* 3. WEAPON, AMMO & TACTICAL STANCE */}
            <div className="flex items-center gap-3 shrink-0 border-r border-[#334155]/60 pr-3">
              {/* Tactical Stance Toggle Button [Z] */}
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  engineRef.current?.togglePlayerStance();
                }}
                title="Postura táctica: Clic para alternar Parado / Agachado [Z]"
                className={`hidden sm:flex px-2.5 py-1.5 bg-[#080C11]/95 border items-center gap-2 font-mono-tabular transition-all duration-200 transform cursor-pointer hover:scale-105 active:scale-95 scale-100 rotate-0 ${
                  hud.playerStance === 'AGACHADO'
                    ? 'border-[#10B981] bg-[#064E3B]/60 text-[#34D399] shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                    : 'border-[#38BDF8] bg-[#0F172A]/95 text-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center drop-shadow-[0_0_6px_currentColor]">
                  {hud.playerStance === 'AGACHADO' ? (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <circle cx="12" cy="7" r="3" />
                      <path d="M19 19H5v-2c0-2.2 1.8-4 4-4h6c2.2 0 4 1.8 4 4v2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <circle cx="12" cy="4.5" r="2.5" />
                      <path d="M14 21v-7h-4v7H8V9c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v12h-2z" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">
                    POSTURA [Z]
                  </span>
                  <span className="text-[10px] font-black tracking-wide">
                    {hud.playerStance === 'AGACHADO' ? 'AGACHADO' : 'PARADO'}
                  </span>
                </div>
              </button>

              {/* Verbal Negotiation Button [Y] */}
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  engineRef.current?.triggerVerbalNegotiation();
                }}
                title="Negociación Verbal / Desescalada con sospechosos [Y]"
                className="px-2.5 py-1.5 bg-[#080C11]/95 border border-[#38BDF8]/70 hover:border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8]/20 flex items-center gap-2 font-mono-tabular transition-all cursor-pointer shadow-[0_0_12px_rgba(56,189,248,0.3)]"
              >
                <div className="w-5 h-5 flex items-center justify-center text-sm font-bold">
                  🗣
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">
                    NEGOCIAR [Y]
                  </span>
                  <span className="text-[10px] font-black tracking-wide">
                    VERBAL
                  </span>
                </div>
              </button>

              {/* FLIR Palette Cycle Button (Only if Thermal Cam is active) */}
              {hud.inspectionId === 'THERMAL_CAM' && hud.mirrorActive && (
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    engineRef.current?.cycleThermalPaletteMode();
                  }}
                  title="Cambiar paleta de colores térmica: White-Hot, Black-Hot, Ironbow [K]"
                  className="hidden sm:flex px-2.5 py-1.5 bg-[#080C11]/95 border border-pink-500/70 hover:border-pink-500 text-pink-500 hover:bg-pink-500/20 items-center gap-2 font-mono-tabular transition-all cursor-pointer shadow-[0_0_12px_rgba(236,72,153,0.3)]"
                >
                  <div className="w-5 h-5 flex items-center justify-center text-xs font-bold">
                    FLIR
                  </div>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">
                      PALETA
                    </span>
                    <span className="text-[10px] font-black tracking-wide uppercase">
                      {hud.thermalPaletteMode?.replace('_', ' ') || 'WHITE HOT'}
                    </span>
                  </div>
                </button>
              )}

              {/* Primary Weapon & Smart Diegetic HUD Telemetry indicator */}
              <div
                title="HUD Diegético Activo: El contador de balas, cargador y modo de disparo [V] flotan en la retícula del cursor para evitar el viaje ocular."
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-[#080C11]/85 border border-[#334155]/70"
              >
                <div className="w-5 h-5 flex items-center justify-center text-xs text-[#F59E0B]">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                      {hud.activeTool === 'TASER' ? 'TASER X2' : hud.primaryName}
                    </span>
                    <span className="text-[7.5px] px-1 py-0.2 bg-[#0284C7]/20 border border-[#0284C7]/50 text-[#38BDF8] font-bold rounded flex items-center gap-1">
                      <Crosshair className="w-2.5 h-2.5" />
                      RETÍCULA DIEGÉTICA
                    </span>
                  </div>
                  <span className="text-[8px] text-[#94A3B8] truncate max-w-[210px]">
                    {hud.attachmentName} · Zona [V] · Recarga [R]
                  </span>
                </div>
              </div>

              {/* Mic Command Button [Y] */}
              <button
                onMouseDown={startVoiceCapture}
                onMouseUp={stopVoiceCapture}
                onTouchStart={(e) => { e.preventDefault(); startVoiceCapture(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopVoiceCapture(); }}
                title="Mantener pulsado para transmitir comandos tácticos por voz [Y / CapsLock]"
                className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 border transition-all cursor-pointer shadow-lg font-mono-tabular ${
                  isListening
                    ? 'bg-red-600 border-red-400 text-white animate-pulse'
                    : 'bg-[#080C11]/95 border-[#EF4444]/70 text-[#EF4444] hover:bg-[#EF4444]/20 hover:border-[#EF4444]'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[8px] uppercase tracking-wider font-bold">COMANDO [Y]</span>
                  <span className="text-[10px] font-black uppercase tracking-wide">{isListening ? 'ESCANEANDO VOZ' : 'DSE-VOICE'}</span>
                </div>
              </button>
            </div>

            {/* 3. COMMUNICATIONS, EKO-PAD & MENU */}
            <div className="relative flex items-center gap-2 shrink-0">

              {/* Compact Radio TETRA Bar */}
              <div
                className={`relative hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#0F172A]/80 border text-[10px] max-w-xs md:max-w-sm transition-colors ${
                  hud.radioTransmitting ? 'border-[#10B981] bg-[#064E3B]/30' : 'border-[#334155]/60'
                }`}
              >
                {/* Radio History Upward Popover */}
                <div
                  aria-hidden={!radioLogOpen}
                  className={`tactical-popover-up origin-bottom-right absolute right-0 bottom-full mb-2 w-80 sm:w-96 bg-[#080C11]/95 backdrop-blur-md border p-2.5 shadow-2xl space-y-1 text-[10px] z-30 ${
                    hud.radioTransmitting ? 'border-[#10B981]/70' : 'border-[#334155]/65'
                  } ${radioLogOpen ? 'tactical-popover-up-open' : 'tactical-popover-up-closed'}`}
                >
                  <div className="flex items-center justify-between text-[#CBD5E1] border-b border-[#334155]/50 pb-1 mb-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Radio className={`w-3 h-3 ${hud.radioTransmitting ? 'text-[#10B981] animate-pulse' : 'text-[#38BDF8]'}`} />
                      <span>HISTORIAL RADIO TETRA (392.45 MHz)</span>
                    </span>
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        setRadioLogOpen(false);
                      }}
                      className="hover:text-white cursor-pointer"
                    >
                      [×]
                    </button>
                  </div>
                  {hud.radioFeed.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => engineRef.current?.replayRadioMessage(item)}
                      className="truncate cursor-pointer px-1 py-0.5 hover:bg-[#1E293B]/50"
                    >
                      <span className="text-[#94A3B8]">[{item.time}]</span>{' '}
                      <span
                        className={
                          item.tone === 'alert'
                            ? 'text-[#EF4444] font-semibold'
                            : item.tone === 'ok'
                              ? 'text-[#10B981] font-semibold'
                              : 'text-[#38BDF8] font-semibold'
                        }
                      >
                        {item.speaker}:
                      </span>{' '}
                      <span className="text-[#E2E8F0]">{item.text}</span>
                    </div>
                  ))}
                </div>

                <div
                  onClick={() => hud.radioFeed[0] && engineRef.current?.replayRadioMessage(hud.radioFeed[0])}
                  className="flex items-center gap-1.5 truncate cursor-pointer flex-1 min-w-0"
                  title="Clic para repetir última transmisión TETRA"
                >
                  <Radio
                    className={`w-3.5 h-3.5 shrink-0 ${
                      hud.radioTransmitting ? 'text-[#34D399] animate-pulse' : 'text-[#10B981]'
                    }`}
                  />
                  <span className="truncate text-[9.5px]">
                    {hud.radioFeed[0] ? (
                      <>
                        <strong className={hud.radioTransmitting ? 'text-[#6EE7B7]' : 'text-[#38BDF8]'}>
                          {hud.radioFeed[0].speaker}:{' '}
                        </strong>
                        <span className="text-[#E2E8F0]">{hud.radioFeed[0].text}</span>
                      </>
                    ) : (
                      <span className="text-[#94A3B8]">TETRA 392.45 MHz</span>
                    )}
                  </span>
                </div>

                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    setRadioLogOpen((v) => !v);
                  }}
                  className="text-[9px] text-[#CBD5E1] hover:text-white px-1 border border-[#334155]/60 bg-[#080C11]/50 cursor-pointer shrink-0"
                >
                  {radioLogOpen ? '▾' : '▴'} Log
                </button>
              </div>

              {/* [M] EKO-PAD Button */}
              <button
                onClick={() => openModalExclusive('PAD')}
                title="Abrir Pad Táctico C4I [M]"
                className="px-2.5 py-1.5 text-[10px] font-bold border bg-[#0F172A]/85 border-[#38BDF8]/80 text-[#38BDF8] hover:bg-[#38BDF8] hover:text-black transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span>[M] PAD</span>
              </button>

              {/* Menú Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    setCommandMenuOpen((v) => !v);
                  }}
                  className={`px-2.5 py-1.5 text-[10px] font-bold border transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    commandMenuOpen
                      ? 'bg-[#D97706] text-black border-[#F59E0B]'
                      : 'bg-[#080C11]/90 border-[#38BDF8]/60 text-[#38BDF8] hover:bg-[#0F172A]'
                  }`}
                >
                  <Menu className="w-3.5 h-3.5" />
                  <span>Menú {commandMenuOpen ? '▴' : '▾'}</span>
                </button>

                {/* Upward Dropdown Menu */}
                <div
                  aria-hidden={!commandMenuOpen}
                  className={`tactical-popover-up origin-bottom-right absolute right-0 bottom-full mb-2 w-64 bg-[#080C11]/95 backdrop-blur-md border border-[#334155]/65 shadow-2xl p-2 flex flex-col gap-1 text-xs z-30 ${
                    commandMenuOpen ? 'tactical-popover-up-open' : 'tactical-popover-up-closed'
                  }`}
                >
                  <div className="px-2 py-1 text-[10px] text-[#94A3B8] border-b border-[#334155]/50">
                    PAD TÁCTICO, PLANIFICACIÓN Y SISTEMA
                  </div>
                  <button
                    onClick={() => openModalExclusive('PAD')}
                    className="w-full text-left px-2.5 py-1.5 text-[#38BDF8] font-bold hover:bg-[#1E293B]/60 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Tablet className="w-3.5 h-3.5" /> EKO-PAD (Mapa &amp; Órdenes)
                    </span>
                    <span className="text-[10px] text-[#38BDF8]">[M]</span>
                  </button>
                  <div className="px-2 py-0.5 text-[9px] text-[#94A3B8] border-t border-[#334155]/40 mt-0.5">
                    OPERACIONES DISPONIBLES:
                  </div>
                  <button
                    onClick={() => {
                      handleStartStationMission();
                      setCommandMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                      hud?.missionMode === 'STATION'
                        ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-l-2 border-[#38BDF8]'
                        : 'text-[#E2E8F0] hover:bg-[#1E293B]/60'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <TrainFront className="w-3.5 h-3.5 text-[#38BDF8]" /> Estación de Trenes (Hauptbahnhof)
                    </span>
                    <span className="text-[9px] text-[#38BDF8]">Misión 2</span>
                  </button>
                  <button
                    onClick={() => {
                      handleStartApartmentMission();
                      setCommandMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                      hud?.missionMode === 'APARTMENT'
                        ? 'bg-[#D97706]/20 text-[#F59E0B] border-l-2 border-[#D97706]'
                        : 'text-[#E2E8F0] hover:bg-[#1E293B]/60'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-[#D97706]" /> Piso Graz - Lend (Residencial)
                    </span>
                    <span className="text-[9px] text-[#D97706]">Misión 1</span>
                  </button>
                  <button
                    onClick={() => {
                      handleStartTrainingRange();
                      setCommandMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                      hud?.isTrainingMode
                        ? 'bg-[#10B981]/20 text-[#10B981] border-l-2 border-[#10B981]'
                        : 'text-[#E2E8F0] hover:bg-[#1E293B]/60'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-[#10B981]" /> Galería de Tiro CQB
                    </span>
                    <span className="text-[9px] text-[#10B981]">Pruebas</span>
                  </button>
                  <button
                    onClick={() => {
                      engineRef.current?.randomizeBattlemapProps();
                      setCommandMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[#A7F3D0] font-semibold hover:bg-[#1E293B]/60 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>🎲 Variar Mobiliario / Props</span>
                    <span className="text-[10px] text-[#10B981]">Aleatorio</span>
                  </button>
                  <button
                    onClick={() => openModalExclusive('BLUEPRINT')}
                    className="w-full text-left px-2.5 py-1.5 text-[#E2E8F0] hover:bg-[#1E293B]/60 hover:text-[#38BDF8] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>📋 Equipo &amp; Blaupause</span>
                    <span className="text-[10px] text-[#94A3B8]">Plano</span>
                  </button>
                  <button
                    onClick={() => openModalExclusive('GDD')}
                    className="w-full text-left px-2.5 py-1.5 text-[#E2E8F0] hover:bg-[#1E293B]/60 hover:text-[#D97706] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>📘 Documento de Diseño (GDD)</span>
                    <span className="text-[10px] text-[#94A3B8]">Doctrina</span>
                  </button>
                  <button
                    onClick={() => openModalExclusive('CONTROLS')}
                    className="w-full text-left px-2.5 py-1.5 text-[#E2E8F0] hover:bg-[#1E293B]/60 hover:text-[#10B981] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>⌨️ Controles &amp; Ley ROE</span>
                    <span className="text-[10px] text-[#10B981]">HUD {hudOpacity}%</span>
                  </button>
                  <div className="px-2.5 py-1.5 bg-[#0F172A]/60 border border-[#334155]/50 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#94A3B8]">Opacidad HUD</span>
                      <span className="font-bold text-[#38BDF8]">{hudOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      step={5}
                      value={hudOpacity}
                      onChange={(e) => handleHudOpacityChange(Number(e.target.value))}
                      aria-label="Opacidad global del HUD"
                      className="w-full h-1.5 bg-[#1E293B] accent-[#38BDF8] cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={handleToggleMute}
                    className="w-full text-left px-2.5 py-1.5 text-[#E2E8F0] hover:bg-[#1E293B]/60 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      Audio del Simulador
                    </span>
                    <span className={muted ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                      {muted ? 'SILENCIADO' : 'ACTIVO'}
                    </span>
                  </button>
                  <button
                    onClick={handleToggleRadioAudio}
                    title="Solo pitido TETRA; no afecta al ticker ni a las burbujas de Kobra-2"
                    className="w-full text-left px-2.5 py-1.5 text-[#E2E8F0] hover:bg-[#1E293B]/60 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Radio className={`w-3.5 h-3.5 ${radioAudioEnabled ? 'text-[#38BDF8]' : 'text-[#64748B]'}`} />
                      Radio (pitido TETRA)
                    </span>
                    <span className={radioAudioEnabled ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                      {radioAudioEnabled ? 'ACTIVA' : 'SILENCIADA'}
                    </span>
                  </button>
                  <div className="border-t border-[#334155]/50 my-0.5" />
                  <button
                    onClick={() => {
                      setCommandMenuOpen(false);
                      engineRef.current?.handleKeyDown('Escape');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[#FDE68A] hover:bg-[#D97706]/25 transition-colors cursor-pointer flex items-center justify-between font-semibold"
                  >
                    <span>⏸️ Pausar Operación</span>
                    <span className="text-[10px] text-[#D97706]">[Esc]</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
           controlsDialogRef={controlsDialogRef}
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


