import React, { useEffect, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  Activity,
  Award,
  CheckCircle2,
  Compass,
  Crosshair,
  FileCheck2,
  Flame,
  Heart,
  Lock,
  MapPin,
  Mic,
  MicOff,
  Radio,
  Shield,
  ShieldAlert,
  Sparkles,
  Tablet,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine';
import type { TacticalEngine } from '../game/TacticalEngine';
import { HudSnapshot, SquadCommand, TacticalMarkerType } from '../game/types';

interface TacticalPadModalProps {
  isOpen: boolean;
  hud: HudSnapshot;
  engineRef: React.RefObject<TacticalEngine | null>;
  onClose: () => void;
  onOpenBlueprint: () => void;
  /** Comando de voz: se mantiene pulsado, igual que en la barra inferior. */
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isListening: boolean;
}

type PadTabId = 'OVERVIEW' | 'MAP' | 'LOG' | 'VITALS_DOSSIERS' | 'ROE_XP' | 'HELP';

const MARKER_MODES: Array<{
  type: TacticalMarkerType;
  labelEs: string;
  shortEs: string;
  color: string;
  borderClass: string;
  bgActiveClass: string;
  descEs: string;
}> = [
  {
    type: 'HOSTILE',
    labelEs: 'Hostil detectado',
    shortEs: '⚠ Hostil',
    color: '#EF4444',
    borderClass: 'border-[#EF4444]/60',
    bgActiveClass: 'bg-[#EF4444]/25 text-[#FCA5A5] border-[#EF4444]',
    descEs: 'Alerta a Kobra-2 para apuntar y cubrir la amenaza en esa posición (35s)',
  },
  {
    type: 'BREACH_ZONE',
    labelEs: 'Zona de brecha',
    shortEs: '💥 Zona Brecha',
    color: '#F59E0B',
    borderClass: 'border-[#F59E0B]/60',
    bgActiveClass: 'bg-[#F59E0B]/25 text-[#FDE68A] border-[#F59E0B]',
    descEs: 'Marca puerta o muro para entrada dinámica con ariete, patada o C4 (45s)',
  },
  {
    type: 'RALLY_POINT',
    labelEs: 'Punto de avance',
    shortEs: '⌖ Avance GPS',
    color: '#38BDF8',
    borderClass: 'border-[#38BDF8]/60',
    bgActiveClass: 'bg-[#38BDF8]/25 text-[#BAE6FD] border-[#38BDF8]',
    descEs: 'Desplaza a Kobra-2 hacia la coordenada táctica seleccionada (50s)',
  },
  {
    type: 'OBSERVE_SECTOR',
    labelEs: 'Vigilar sector',
    shortEs: '👁 Vigilar Sector',
    color: '#A855F7',
    borderClass: 'border-[#A855F7]/60',
    bgActiveClass: 'bg-[#A855F7]/25 text-[#E9D5FF] border-[#A855F7]',
    descEs: 'Ordena a Kobra-2 sostener ángulo de cobertura sobre ese sector (40s)',
  },
  {
    type: 'EVIDENCE_LOC',
    labelEs: 'Asegurar evidencia',
    shortEs: '📦 Evidencia',
    color: '#10B981',
    borderClass: 'border-[#10B981]/60',
    bgActiveClass: 'bg-[#10B981]/25 text-[#A7F3D0] border-[#10B981]',
    descEs: 'Marca arma caída o rehén para aseguramiento y custodia forense (45s)',
  },
];

const SQUAD_ORDER_CATALOG: Array<{
  cmd: SquadCommand;
  keyNum: string;
  titleDe: string;
  titleEs: string;
  descEs: string;
  accent: string;
}> = [
  {
    cmd: 'FOLLOW',
    keyNum: '1',
    titleDe: 'Folgen',
    titleEs: 'Seguimiento CQB',
    descEs: 'Avanza en binomio cubriendo tu retaguardia',
    accent: 'border-[#38BDF8]/50 text-[#BAE6FD]',
  },
  {
    cmd: 'HOLD',
    keyNum: '2',
    titleDe: 'Halten',
    titleEs: 'Mantener Posición',
    descEs: 'Ancla posición actual o avanza al marcador GPS',
    accent: 'border-[#38BDF8]/50 text-[#BAE6FD]',
  },
  {
    cmd: 'BREACH_AND_CLEAR',
    keyNum: '3',
    titleDe: 'Zugriff!',
    titleEs: 'Brechar y Despejar',
    descEs: 'Abre puerta cerrada, lanza Flashbang y despeja sala',
    accent: 'border-[#F59E0B]/60 text-[#FDE68A]',
  },
  {
    cmd: 'PIE_DOOR',
    keyNum: '4',
    titleDe: 'Winkel schneiden',
    titleEs: 'Cortar el Pastel',
    descEs: 'Toma ángulo en el umbral de puerta sin exponerse',
    accent: 'border-[#A855F7]/60 text-[#E9D5FF]',
  },
  {
    cmd: 'DEPLOY_CS_GAS',
    keyNum: '5',
    titleDe: 'CS-Gas werfen',
    titleEs: 'Lanzar Gas CS',
    descEs: 'Despliega granada lacrimógena en el foco hostil',
    accent: 'border-[#10B981]/60 text-[#A7F3D0]',
  },
  {
    cmd: 'RESTRAIN_AND_SECURE',
    keyNum: '6',
    titleDe: 'Sichern & Fesseln',
    titleEs: 'Esposar y Asegurar',
    descEs: 'Esposa rendidos/rehenes e incauta armas automáticamente',
    accent: 'border-[#34D399]/60 text-[#6EE7B7]',
  },
  {
    cmd: 'SUPPRESS_TARGET',
    keyNum: '7',
    titleDe: 'Sperrfeuer!',
    titleEs: 'Fuego de Supresión',
    descEs: 'Cobertura e intimidación táctica sobre amenaza armada',
    accent: 'border-[#EF4444]/60 text-[#FCA5A5]',
  },
  {
    cmd: 'REGROUP_HEAL',
    keyNum: '8',
    titleDe: 'Sammeln & IFAK',
    titleEs: 'Reagrupar y Curar',
    descEs: 'Cierra formación contigo y estabiliza signos vitales',
    accent: 'border-[#38BDF8]/60 text-[#7DD3FC]',
  },
  {
    cmd: 'CLEAR_BLAST_AREA',
    keyNum: 'J',
    titleDe: 'Sprengzone räumen',
    titleEs: 'Despejar Zona C4',
    descEs: 'Retira a Kobra-2 del radio de la carga antes de detonar',
    accent: 'border-[#F59E0B]/60 text-[#FDE68A]',
  },
  {
    cmd: 'FORM_WEDGE',
    keyNum: '9',
    titleDe: 'Keilformation',
    titleEs: 'Formación en Cuña',
    descEs: 'Posición asimétrica para maximizar cobertura lateral',
    accent: 'border-[#818CF8]/60 text-[#C7D2FE]',
  },
  {
    cmd: 'FORM_STAGGERED',
    keyNum: '0',
    titleDe: 'Staffelformation',
    titleEs: 'Escalonado Táctico',
    descEs: 'Desplazamiento alterno para pasillos y espacios largos',
    accent: 'border-[#F472B6]/60 text-[#FBCFE8]',
  },
];

export const TacticalPadModal: React.FC<TacticalPadModalProps> = ({
  isOpen,
  hud,
  engineRef,
  onClose,
  onOpenBlueprint,
  onVoiceStart,
  onVoiceStop,
  isListening,
}) => {
  const thermalActive = hud.inspectionId === 'THERMAL_CAM' && hud.mirrorActive;
  const [activeTab, setActiveTab] = useState<PadTabId>('OVERVIEW');
  const [selectedMarkerType, setSelectedMarkerType] = useState<TacticalMarkerType>('HOSTILE');
  const [padHeaderOpen, setPadHeaderOpen] = useState(true);
  const [mapToolsOpen, setMapToolsOpen] = useState(true);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      soundEngine.playUiClick();
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 210);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const pad = hud.tacticalPad;
  const sq = hud.squadVitals;
  const xp = hud.xpTelemetry;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Compute projected operational grade based on current ROE score and violations
  const projectedGrade =
    hud.roeViolations >= 2
      ? 'F'
      : hud.roeViolations === 1
        ? 'C'
        : hud.score >= 950
          ? 'S'
          : hud.score >= 600
            ? 'A'
            : 'B';

  const handleSvgMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    // Map viewBox is 80..1140 (width 1060), 60..760 (height 700)
    const worldX = 80 + relX * 1060;
    const worldY = 60 + relY * 700;
                            engineRef.current?.addTacticalMarker(worldX, worldY, selectedMarkerType);
  };

  const dialogRef = useModalA11y(isOpen);

  const activeMarkerMeta =
    MARKER_MODES.find((m) => m.type === selectedMarkerType) || MARKER_MODES[0];

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto select-none transition-opacity duration-200 ease-out ${
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Tablet Body */}
      <div
        className={`w-full max-w-6xl border-[12px] border-[#1E293B] bg-[#090E17] text-[#E2E8F0] shadow-[0_0_50px_rgba(0,0,0,0.9)] font-mono-tabular flex flex-col max-h-[92vh] rounded-[2rem] overflow-hidden ${
          isVisible ? 'animate-ekopad-in' : 'animate-ekopad-out'
        }`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="EKO-Pad: mapa táctico, órdenes de escuadra y telemetría"
        tabIndex={-1}
      >
        {/* Top Rugged Tablet Hardware Bezel & Telemetry Header (Collapsible inside Header) */}
        <div className="flex flex-col bg-[#0F172A]/65 border-b border-[#334155]/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#D97706]/20 border border-[#D97706]/70 text-[#F59E0B]">
                <Tablet className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <span>EKO-PAD C4I · ATAK-BOS AUSTRIA</span>
                  <span className="text-[#475569]">|</span>
                  <span className="text-[#38BDF8]">{hud.currentRoom}</span>
                </div>
                <div className="text-[10px] text-[#94A3B8]">
                  ENLACE CRIPTOGRÁFICO TETRA 392.45 MHz · TIEMPO EN OPERACIÓN:{' '}
                  <strong className="text-white">{formatTime(hud.elapsedSeconds)}</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  setPadHeaderOpen(!padHeaderOpen);
                }}
                className="px-2.5 py-1 text-[10px] font-bold border border-[#334155] bg-[#080C11] text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer flex items-center gap-1"
                title={padHeaderOpen ? "Plegar menú del header" : "Expandir menú del header"}
              >
                <span>{padHeaderOpen ? '▲ Telemetría [Plegar]' : '▼ Telemetría [Expandir]'}</span>
              </button>

              <button
                onClick={onClose}
                className="px-3 py-1 text-xs font-bold bg-[#D97706]/85 text-black hover:bg-[#F59E0B] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar</span>
              </button>
            </div>
          </div>

          {padHeaderOpen && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-[#334155]/40 bg-[#080C11]/80 animate-fadeIn">
              {/* Operator XP & Rank Quick Pill in Header Dropdown */}
              <div className="flex items-center gap-2.5 bg-[#0F172A] border border-[#334155]/60 px-3 py-1.5">
                <Award className="w-4 h-4 text-[#FBBF24] shrink-0" />
                <div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold text-[#FDE68A]">
                      NV. {xp.level} · {xp.rankDe.toUpperCase()}
                    </span>
                    <span className="text-[#38BDF8] font-bold">
                      {xp.totalXp} XP (+{xp.sessionXp} Misión)
                    </span>
                  </div>
                  <div className="w-36 h-1.5 bg-[#1E293B]/80 mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-[#38BDF8] transition-all duration-150"
                      style={{ width: `${xp.progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={onOpenBlueprint}
                className="px-3 py-1 text-xs font-semibold border border-[#334155]/70 bg-[#0F172A] text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Blaupause &amp; Equipo</span>
              </button>
              {/* Térmica y voz: en pantallas estrechas no caben en la barra del HUD. */}
              <div className="flex w-full items-center gap-1.5 sm:w-auto">
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                                            engineRef.current?.cycleThermalPaletteMode();
                  }}
                  disabled={!thermalActive}
                  title={
                    thermalActive
                      ? 'Cambiar paleta térmica: White-Hot, Black-Hot, Ironbow [K]'
                      : 'Requiere cámara térmica activa [K]'
                  }
                  className={`flex-1 sm:flex-none px-2.5 py-1 border font-mono-tabular text-[9.5px] whitespace-nowrap font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors ${
                    thermalActive
                      ? 'border-pink-500/70 text-pink-400 hover:border-pink-500 hover:bg-pink-500/15 cursor-pointer'
                      : 'border-[#334155]/50 text-[#64748B] cursor-not-allowed'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>FLIR · {thermalActive ? hud.thermalPaletteMode?.replace('_', ' ') || 'WHITE HOT' : 'SIN TÉRMICA'}</span>
                </button>

                <button
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onVoiceStart();
                  }}
                  onPointerUp={() => onVoiceStop()}
                  onPointerLeave={() => onVoiceStop()}
                  onPointerCancel={() => onVoiceStop()}
                  title="Mantén pulsado para dictar una orden por voz [Y / CapsLock]"
                  className={`flex-1 sm:flex-none px-2.5 py-1 border font-mono-tabular text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isListening
                      ? 'bg-red-600 border-red-400 text-white animate-pulse'
                      : 'border-[#EF4444]/70 text-[#EF4444] hover:bg-[#EF4444]/15'
                  }`}
                >
                  {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  <span>VOZ · {isListening ? 'ESCANEANDO' : 'MANTENER'}</span>
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Tablet Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#0B111B]/55 border-b border-[#334155]/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('OVERVIEW');
              }}
              className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'OVERVIEW'
                  ? 'bg-[#D97706]/90 text-black border-[#F59E0B]'
                  : 'bg-[#080C11]/55 text-[#CBD5E1] border-[#334155]/60 hover:border-[#64748B]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Vista Integrada (Mapa + Órdenes + Vitales)</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('MAP');
              }}
              className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'MAP'
                  ? 'bg-[#38BDF8]/90 text-black border-[#7DD3FC]'
                  : 'bg-[#080C11]/55 text-[#CBD5E1] border-[#334155]/60 hover:border-[#64748B]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Mapa Táctico C4I Ampliado ({pad.markers.length} Marcadores)</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('VITALS_DOSSIERS');
              }}
              className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'VITALS_DOSSIERS'
                  ? 'bg-[#10B981]/90 text-black border-[#34D399]'
                  : 'bg-[#080C11]/55 text-[#CBD5E1] border-[#334155]/60 hover:border-[#64748B]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Biomonitor Binomio &amp; Dossiers EKIS</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('LOG');
              }}
              className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'LOG'
                  ? 'bg-[#EF4444]/90 text-white border-[#FCA5A5]'
                  : 'bg-[#080C11]/55 text-[#CBD5E1] border-[#334155]/60 hover:border-[#64748B]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#FCA5A5]" />
              <span>Registro Crítico ({hud.criticalEvents?.length || 0})</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('ROE_XP');
              }}
              className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ROE_XP'
                  ? 'bg-[#F59E0B]/90 text-black border-[#FDE68A]'
                  : 'bg-[#080C11]/55 text-[#CBD5E1] border-[#334155]/60 hover:border-[#64748B]'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Auditoría ROE, Brechas &amp; Rango XP</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('HELP');
              }}
              className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'HELP'
                  ? 'bg-[#38BDF8]/90 text-black border-[#BAE6FD]'
                  : 'bg-[#080C11]/55 text-[#CBD5E1] border-[#334155]/60 hover:border-[#64748B]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Ayuda</span>
            </button>
          </div>

          {/* Active Squad Command Indicator */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-[#94A3B8]">ORDEN ACTIVA KOBRA-2:</span>
            <span className="px-2 py-0.5 border border-[#38BDF8]/60 bg-[#38BDF8]/15 text-[#BAE6FD] font-bold">
              {hud.squadCommand}
            </span>
          </div>
        </div>

        {/* ==================== PAD CONTENT BODY ==================== */}
        <div className="p-4 overflow-y-auto space-y-3.5">
          {/* 1. TOP MISSION STATUS KPI STRIP (Translucent boxes) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-[#080C11]/50 border border-[#334155]/50 p-2.5">
              <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                <span>SOSPECHOSOS</span>
                <Crosshair className="w-3.5 h-3.5 text-[#EF4444]" />
              </div>
              <div className="text-base font-bold text-[#10B981] mt-0.5">
                {hud.suspectsSecured} / {hud.suspectsTotal}
              </div>
              <div className="w-full h-1 bg-[#1E293B]/70 mt-1">
                <div
                  className="h-full bg-[#10B981]"
                  style={{
                    width: `${(hud.suspectsSecured / Math.max(1, hud.suspectsTotal)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-[#080C11]/50 border border-[#334155]/50 p-2.5">
              <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                <span>REHENES SALVOS</span>
                <Users className="w-3.5 h-3.5 text-[#38BDF8]" />
              </div>
              <div className="text-base font-bold text-[#38BDF8] mt-0.5">
                {hud.hostagesSecured} / {hud.hostagesTotal}
              </div>
              <div className="w-full h-1 bg-[#1E293B]/70 mt-1">
                <div
                  className="h-full bg-[#38BDF8]"
                  style={{
                    width: `${(hud.hostagesSecured / Math.max(1, hud.hostagesTotal)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-[#080C11]/50 border border-[#334155]/50 p-2.5">
              <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                <span>ID CÁMARA [B]</span>
                <Radio className="w-3.5 h-3.5 text-[#FBBF24]" />
              </div>
              <div className="text-base font-bold text-[#FBBF24] mt-0.5">
                {hud.identifiedCount} / {hud.identifiableTotal}
              </div>
              <div className="w-full h-1 bg-[#1E293B]/70 mt-1">
                <div
                  className="h-full bg-[#FBBF24]"
                  style={{
                    width: `${(hud.identifiedCount / Math.max(1, hud.identifiableTotal)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-[#080C11]/50 border border-[#334155]/50 p-2.5">
              <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                <span>EVIDENCIAS [E]</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CBD5E1]" />
              </div>
              <div className="text-base font-bold text-white mt-0.5">
                {hud.evidenceSecured} / {hud.evidenceTotal}
              </div>
              <div className="w-full h-1 bg-[#1E293B]/70 mt-1">
                <div
                  className="h-full bg-white"
                  style={{
                    width: `${(hud.evidenceSecured / Math.max(1, hud.evidenceTotal)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-[#080C11]/50 border border-[#334155]/50 p-2.5">
              <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                <span>PUNTUACIÓN ROE</span>
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              </div>
              <div className="text-base font-bold text-[#D97706] mt-0.5">
                {hud.score} PTS{' '}
                <span className="text-xs text-white font-normal">(Grado {projectedGrade})</span>
              </div>
              <div className="text-[9px] text-[#94A3B8] mt-0.5">
                Infracciones WVG:{' '}
                <strong className={hud.roeViolations === 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                  {hud.roeViolations}
                </strong>
              </div>
            </div>

            <div className="bg-[#080C11]/50 border border-[#334155]/50 p-2.5">
              <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                <span>EXPERIENCIA (XP)</span>
                <Award className="w-3.5 h-3.5 text-[#38BDF8]" />
              </div>
              <div className="text-base font-bold text-[#38BDF8] mt-0.5">
                NV. {xp.level} · {xp.totalXp} XP
              </div>
              <div className="text-[9px] text-[#94A3B8] mt-0.5 truncate">{xp.rankEs}</div>
            </div>
          </div>

          {/* 2. MAIN TAB VIEWS (with smooth tactical fadeIn transition on tab switch) */}
          {(activeTab === 'OVERVIEW' || activeTab === 'MAP') && (
            <div
              key={activeTab}
              className={`animate-tactical-tab grid grid-cols-1 ${
                activeTab === 'OVERVIEW' ? 'lg:grid-cols-12' : ''
              } gap-4`}
            >
              {/* LEFT / MAIN COLUMN: Interactive Live Tactical Map with Temporary Markers */}
              <div
                className={`${
                  activeTab === 'OVERVIEW' ? 'lg:col-span-7' : ''
                } bg-[#080C11]/50 border border-[#334155]/55 p-3.5 flex flex-col justify-between`}
              >
                <div className="space-y-2 pb-2.5 mb-2.5 border-b border-[#334155]/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>MAPA TÁCTICO INTERACTIVO · MARCADORES DE EQUIPO C4I</span>
                      </div>
                      <div className="text-[10px] text-[#94A3B8]">
                        Haz clic en cualquier punto del mapa táctico para colocar marcadores visibles.
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Map Tools & Marker Selection Menu */}
                  <div className="border border-[#334155]/70 bg-[#0F172A]/70 mt-2">
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        setMapToolsOpen(!mapToolsOpen);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-white bg-[#1E293B]/80 hover:bg-[#334155]/80 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Crosshair className="w-4 h-4 text-[#38BDF8]" />
                        <span>HERRAMIENTAS Y MARCADORES DEL MAPA</span>
                        <span className="text-[10px] text-[#94A3B8] font-normal">
                          (Activo: {activeMarkerMeta.labelEs})
                        </span>
                      </div>
                      <span className="text-[#38BDF8] text-[10px]">
                        {mapToolsOpen ? '▲ Ocultar Herramientas' : '▼ Mostrar Herramientas'}
                      </span>
                    </button>

                    {mapToolsOpen && (
                      <div className="p-3 space-y-2 bg-[#080C11]/60">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155]/50 pb-2">
                          <div className="text-[11px] font-bold text-[#38BDF8]">
                            OPCIONES DE MARCADORES Y GPS
                          </div>
                          <div className="flex items-center gap-1.5">
                            {pad.markers.length > 0 && (
                              <button
                                onClick={() => engineRef.current?.clearTacticalMarkers()}
                                className="px-2 py-1 text-[10px] border border-[#EF4444]/60 bg-[#EF4444]/15 text-[#FCA5A5] hover:bg-[#EF4444]/30 flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Limpiar Marcadores ({pad.markers.length})</span>
                              </button>
                            )}
                            {pad.waypoint && (
                              <button
                                onClick={() => engineRef.current?.clearTacticalWaypoint()}
                                className="px-2 py-1 text-[10px] border border-[#38BDF8]/60 bg-[#38BDF8]/15 text-[#BAE6FD] hover:bg-[#38BDF8]/30 cursor-pointer"
                              >
                                ⌖ Quitar GPS
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Tactical Marker Mode Selector Toolbar */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-[#94A3B8] mr-1">
                            TIPO DE MARCADOR:
                          </span>
                          {MARKER_MODES.map((m) => {
                            const active = selectedMarkerType === m.type;
                            return (
                              <button
                                key={m.type}
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setSelectedMarkerType(m.type);
                                }}
                                className={`px-2.5 py-1 text-[10px] font-bold border transition-all cursor-pointer ${
                                  active
                                    ? m.bgActiveClass
                                    : `bg-[#0B111B]/60 text-[#CBD5E1] ${m.borderClass} hover:text-white`
                                }`}
                              >
                                {m.shortEs}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-[#CBD5E1] bg-[#0B111B]/50 border border-[#334155]/45 px-2.5 py-1 flex items-center justify-between">
                          <span>
                            Modo activo:{' '}
                            <strong style={{ color: activeMarkerMeta.color }}>
                              {activeMarkerMeta.labelEs.toUpperCase()}
                            </strong>{' '}
                            — {activeMarkerMeta.descEs}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive SVG Blue-Force & Threat Map */}
                <div className="relative w-full bg-[#05080D]/65 border border-[#334155]/60 overflow-hidden">
                  <svg
                    viewBox="80 60 1060 700"
                    className="w-full h-auto max-h-[410px] cursor-crosshair block"
                    onClick={handleSvgMapClick}
                  >
                    {/* Subtle Tactical Grid */}
                    <defs>
                      <pattern
                        id="padTacticalGrid"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.06)"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect x="80" y="60" width="1060" height="700" fill="url(#padTacticalGrid)" />

                    {/* Rooms */}
                    {pad.rooms.map((r) => {
                      const fill =
                        r.knownHostiles > 0
                          ? 'rgba(127, 29, 29, 0.30)'
                          : r.hasPlayer || r.hasSquad
                            ? 'rgba(12, 74, 110, 0.30)'
                            : r.cleared
                              ? 'rgba(6, 78, 59, 0.24)'
                              : 'rgba(15, 23, 42, 0.55)';
                      const stroke =
                        r.knownHostiles > 0
                          ? '#EF4444'
                          : r.hasPlayer || r.hasSquad
                            ? '#38BDF8'
                            : r.cleared
                              ? '#10B981'
                              : '#334155';
                      return (
                        <g key={r.id}>
                          <rect
                            x={r.x}
                            y={r.y}
                            width={r.w}
                            height={r.h}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth="2"
                          />
                          <text
                            x={r.x + 12}
                            y={r.y + 22}
                            fill="#CBD5E1"
                            fontSize="13"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {r.nameDe}
                          </text>
                          <text
                            x={r.x + 12}
                            y={r.y + 38}
                            fill="#94A3B8"
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {r.nameEs}
                          </text>
                          {r.knownHostiles > 0 && (
                            <text
                              x={r.x + 12}
                              y={r.y + 56}
                              fill="#FCA5A5"
                              fontSize="11"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              ⚠ {r.knownHostiles} HOSTIL(ES)
                            </text>
                          )}
                          {r.knownHostages > 0 && (
                            <text
                              x={r.x + 12}
                              y={r.y + 72}
                              fill="#7DD3FC"
                              fontSize="11"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              🛡 {r.knownHostages} REHÉN(ES)
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Exterior Windows / Breachable Walls */}
                    {pad.exteriorWindows.map((w) => (
                      <g key={w.id}>
                        <line
                          x1={w.x1}
                          y1={w.y1}
                          x2={w.x2}
                          y2={w.y2}
                          stroke={w.isBreached ? '#F59E0B' : '#38BDF8'}
                          strokeWidth="6"
                          strokeDasharray={w.isBreached ? '4 4' : undefined}
                        />
                      </g>
                    ))}

                    {/* Doors */}
                    {pad.doors.map((d) => {
                      const mx = (d.x1 + d.x2) * 0.5;
                      const my = (d.y1 + d.y2) * 0.5;
                      const color = d.isBreached
                        ? '#F59E0B'
                        : d.isOpen
                          ? '#10B981'
                          : d.isLocked
                            ? '#EF4444'
                            : '#CBD5E1';
                      return (
                        <g key={d.id}>
                          <line
                            x1={d.x1}
                            y1={d.y1}
                            x2={d.x2}
                            y2={d.y2}
                            stroke={color}
                            strokeWidth="7"
                          />
                          <circle cx={mx} cy={my} r="6" fill="#090E17" stroke={color} strokeWidth="2" />
                        </g>
                      );
                    })}

                    {/* Dropped Evidence Markers */}
                    {pad.evidence
                      .filter((ev) => !ev.secured)
                      .map((ev) => (
                        <g key={ev.id} transform={`translate(${ev.x}, ${ev.y})`}>
                          <rect
                            x="-7"
                            y="-7"
                            width="14"
                            height="14"
                            fill="#F59E0B"
                            stroke="#090E17"
                            strokeWidth="1.5"
                          />
                          <text
                            x="0"
                            y="-11"
                            textAnchor="middle"
                            fill="#FDE68A"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            [E] ARMA
                          </text>
                        </g>
                      ))}

                    {/* Temporary Tactical Markers placed by Player/Team */}
                    {pad.markers.map((mk) => {
                      const color =
                        mk.type === 'HOSTILE'
                          ? '#EF4444'
                          : mk.type === 'BREACH_ZONE'
                            ? '#F59E0B'
                            : mk.type === 'OBSERVE_SECTOR'
                              ? '#A855F7'
                              : mk.type === 'EVIDENCE_LOC'
                                ? '#10B981'
                                : '#38BDF8';
                      const iconChar =
                        mk.type === 'HOSTILE'
                          ? '!'
                          : mk.type === 'BREACH_ZONE'
                            ? '💥'
                            : mk.type === 'OBSERVE_SECTOR'
                              ? '👁'
                              : mk.type === 'EVIDENCE_LOC'
                                ? '📦'
                                : '⌖';
                      return (
                        <g
                          key={mk.id}
                          transform={`translate(${mk.x}, ${mk.y})`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            engineRef.current?.removeTacticalMarker(mk.id);
                          }}
                          className="cursor-pointer"
                        >
                          <circle
                            cx="0"
                            cy="0"
                            r="22"
                            fill={`${color}22`}
                            stroke={color}
                            strokeWidth="2"
                            strokeDasharray="5 3"
                          />
                          <circle
                            cx="0"
                            cy="0"
                            r="10"
                            fill="#090E17"
                            stroke={color}
                            strokeWidth="2.5"
                          />
                          <text
                            x="0"
                            y="3.5"
                            textAnchor="middle"
                            fill={color}
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {iconChar}
                          </text>
                          <rect
                            x="-74"
                            y="-36"
                            width="148"
                            height="16"
                            rx="2"
                            fill="rgba(8, 12, 17, 0.78)"
                            stroke={color}
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="-25"
                            textAnchor="middle"
                            fill="#F8FAFC"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {mk.label} ({Math.ceil(mk.remainingSeconds)}s)
                          </text>
                        </g>
                      );
                    })}

                    {/* Known Contacts (Kobra-1, Kobra-2, Spotted Suspects & Hostages) */}
                    {pad.contacts.map((c) => {
                      const isPlayer = c.role === 'PLAYER';
                      const isSquad = c.role === 'SQUAD';
                      const isSuspect = c.role === 'SUSPECT';
                      const color = isPlayer
                        ? '#10B981'
                        : isSquad
                          ? '#38BDF8'
                          : isSuspect
                            ? c.state === 'ARRESTED'
                              ? '#34D399'
                              : '#EF4444'
                            : '#7DD3FC';

                      return (
                        <g key={c.id} transform={`translate(${c.x}, ${c.y})`}>
                          {c.state !== 'DEAD' && c.state !== 'ARRESTED' && (
                            <line
                              x1="0"
                              y1="0"
                              x2={Math.cos(c.angle) * 26}
                              y2={Math.sin(c.angle) * 26}
                              stroke={color}
                              strokeWidth="2.5"
                            />
                          )}
                          <circle
                            cx="0"
                            cy="0"
                            r={isPlayer || isSquad ? 11 : 9}
                            fill="#090E17"
                            stroke={color}
                            strokeWidth="3"
                          />
                          <text
                            x="0"
                            y="3.5"
                            textAnchor="middle"
                            fill={color}
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {isPlayer ? 'K1' : isSquad ? 'K2' : isSuspect ? 'H' : 'R'}
                          </text>
                          <text
                            x="0"
                            y="-14"
                            textAnchor="middle"
                            fill="#F8FAFC"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {isPlayer
                              ? 'KOBRA-1'
                              : isSquad
                                ? 'KOBRA-2'
                                : `${c.name.split(' ')[0]} ${c.identifiedByRadio ? '✓' : ''}`}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Active Temporary Markers Chips Strip */}
                {pad.markers.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#334155]/50 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#94A3B8]">
                      MARCADORES ACTIVOS (CLIC PARA BORRAR):
                    </span>
                    {pad.markers.map((mk) => {
                      const c =
                        mk.type === 'HOSTILE'
                          ? 'border-[#EF4444]/70 text-[#FCA5A5] bg-[#EF4444]/15'
                          : mk.type === 'BREACH_ZONE'
                            ? 'border-[#F59E0B]/70 text-[#FDE68A] bg-[#F59E0B]/15'
                            : mk.type === 'OBSERVE_SECTOR'
                              ? 'border-[#A855F7]/70 text-[#E9D5FF] bg-[#A855F7]/15'
                              : mk.type === 'EVIDENCE_LOC'
                                ? 'border-[#10B981]/70 text-[#A7F3D0] bg-[#10B981]/15'
                                : 'border-[#38BDF8]/70 text-[#BAE6FD] bg-[#38BDF8]/15';
                      return (
                        <button
                          key={mk.id}
                                                          onClick={() => engineRef.current?.removeTacticalMarker(mk.id)}
                          className={`px-2 py-0.5 text-[10px] border ${c} hover:opacity-80 flex items-center gap-1 cursor-pointer`}
                        >
                          <span>
                            {mk.label} · {mk.roomName} ({Math.ceil(mk.remainingSeconds)}s)
                          </span>
                          <X className="w-2.5 h-2.5" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Map Legend Footer */}
                <div className="mt-2.5 pt-2 border-t border-[#334155]/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#94A3B8]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Kobra-1 (Tú)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#38BDF8]" /> Kobra-2 (Escuadra)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Hostil
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#7DD3FC]" /> Rehén
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#EF4444] flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Cerrada
                    </span>
                    <span className="text-[#F59E0B] flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Brechada
                    </span>
                    <span className="text-[#10B981] flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Abierta
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN IN OVERVIEW: Full 8 Tactical Orders Panel + Squad Biomonitor */}
              {activeTab === 'OVERVIEW' && (
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  {/* FULL CQB TACTICAL ORDERS PANEL (All 8 Commands) */}
                  <div className="bg-[#080C11]/50 border border-[#334155]/55 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#334155]/50 pb-1.5">
                      <div className="text-xs font-bold text-[#38BDF8] flex items-center gap-2">
                        <Radio className="w-4 h-4 text-[#38BDF8]" />
                        <span>PANEL DE ÓRDENES TÁCTICAS CQB (TECLAS [1]–[8], [9], [0], [J])</span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">Binomio Kobra-2</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {SQUAD_ORDER_CATALOG.map((ord) => {
                        const isCurrent = hud.squadCommand === ord.cmd;
                        return (
                          <button
                            key={ord.cmd}
                            onClick={() => engineRef.current?.issueSquadCommand(ord.cmd)}
                            className={`p-2 text-left border transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#38BDF8]/25 border-[#38BDF8] text-white shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                                : `bg-[#0B111B]/50 hover:bg-[#1E293B]/60 ${ord.accent}`
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span>
                                [{ord.keyNum}] {ord.titleEs}
                              </span>
                              <span className="text-[9px] opacity-75">{ord.titleDe}</span>
                            </div>
                            <div className="text-[9.5px] text-[#94A3B8] mt-0.5 leading-tight">
                              {ord.descEs}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Biomonitor Card: KOBRA-1 & KOBRA-2 Vital Signs */}
                  <div className="bg-[#080C11]/50 border border-[#334155]/55 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#334155]/50 pb-2">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#10B981]" />
                        <span>BIOMONITOR DE ESCUADRA (SIGNOS VITALES)</span>
                      </div>
                      <button
                        onClick={() => engineRef.current?.applyIfakTreatment()}
                        className="px-2.5 py-1 text-[10px] font-bold bg-[#0F172A]/70 border border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-black transition-colors cursor-pointer"
                      >
                        [H] Aplicar IFAK ({hud.ifakCount}x)
                      </button>
                    </div>

                    {/* Operator 1: KOBRA-1 (Jugador) */}
                    <div className="p-2.5 bg-[#0B111B]/50 border border-[#334155]/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#10B981] flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>KOBRA-1 (TÚ · {hud.profileName.split('/')[0].trim()})</span>
                        </span>
                        <span className="text-[11px] font-bold text-[#F8FAFC] flex items-center gap-2">
                          <span className="text-[#EF4444] flex items-center gap-0.5">
                            <Activity className="w-3 h-3" /> {hud.pulseBpm} BPM
                          </span>
                          <span>·</span>
                          <span className="text-[#38BDF8]">Pulso {hud.pulseStabilityPct}%</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-[#10B981]" /> SALUD
                            </span>
                            <strong className="text-white">{hud.health}%</strong>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E293B]/80 mt-0.5">
                            <div
                              className="h-full bg-[#10B981]"
                              style={{ width: `${hud.health}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3 text-[#38BDF8]" /> KEVLAR
                            </span>
                            <strong className="text-white">{hud.armor}%</strong>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E293B]/80 mt-0.5">
                            <div
                              className="h-full bg-[#38BDF8]"
                              style={{ width: `${hud.armor}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3 text-[#F59E0B]" /> FATIGA
                            </span>
                            <strong className="text-white">{hud.fatigue}%</strong>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E293B]/80 mt-0.5">
                            <div
                              className={`h-full ${
                                hud.fatigue > 70
                                  ? 'bg-[#EF4444]'
                                  : hud.fatigue > 35
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#10B981]'
                              }`}
                              style={{ width: `${hud.fatigue}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Operator 2: KOBRA-2 (Compañero de Escuadra) */}
                    <div className="p-2.5 bg-[#0B111B]/50 border border-[#334155]/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#38BDF8] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>KOBRA-2 (COMPAÑERO · {sq.roomName})</span>
                        </span>
                        <span className="text-[11px] font-bold text-[#F8FAFC] flex items-center gap-2">
                          <span className="text-[#EF4444] flex items-center gap-0.5">
                            <Activity className="w-3 h-3" /> {sq.pulseBpm} BPM
                          </span>
                          <span>·</span>
                          <span className="text-[#38BDF8]">Pulso {sq.pulseStabilityPct}%</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-[#10B981]" /> SALUD
                            </span>
                            <strong className="text-white">{sq.health}%</strong>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E293B]/80 mt-0.5">
                            <div
                              className="h-full bg-[#10B981]"
                              style={{ width: `${sq.health}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3 text-[#38BDF8]" /> KEVLAR
                            </span>
                            <strong className="text-white">{sq.armor}%</strong>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E293B]/80 mt-0.5">
                            <div
                              className="h-full bg-[#38BDF8]"
                              style={{ width: `${sq.armor}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3 text-[#F59E0B]" /> FATIGA
                            </span>
                            <strong className="text-white">{sq.fatigue}%</strong>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E293B]/80 mt-0.5">
                            <div
                              className={`h-full ${
                                sq.fatigue > 70
                                  ? 'bg-[#EF4444]'
                                  : sq.fatigue > 35
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#10B981]'
                              }`}
                              style={{ width: `${sq.fatigue}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VITALS & EKIS BIOMETRIC DOSSIERS */}
          {activeTab === 'VITALS_DOSSIERS' && (
            <div key="VITALS_DOSSIERS" className="animate-tactical-tab grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#080C11]/50 border border-[#334155]/55 p-4 space-y-3">
                <div className="text-xs font-bold text-[#38BDF8] border-b border-[#334155]/50 pb-2">
                  CONTACTOS AVISTADOS Y DOSSIERS BIOMÉTRICOS EKIS / ZMR
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {pad.contacts
                    .filter((c) => c.role !== 'PLAYER' && c.role !== 'SQUAD')
                    .map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 bg-[#0B111B]/55 border border-[#334155]/50 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{c.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 border ${
                                c.role === 'SUSPECT'
                                  ? 'border-[#EF4444] text-[#FCA5A5]'
                                  : 'border-[#38BDF8] text-[#BAE6FD]'
                              }`}
                            >
                              {c.ekisCode || c.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#94A3B8] mt-0.5">
                            Ubicación: <strong className="text-white">{c.roomName}</strong> · Estado:{' '}
                            <strong className="text-[#FDE68A]">{c.state}</strong>
                            {c.isArmed && c.weaponLabel ? ` · Arma: ${c.weaponLabel}` : ''}
                          </div>
                          {c.warrantStatus && (
                            <div className="text-[10px] text-[#94A3B8] mt-0.5">{c.warrantStatus}</div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {c.identifiedByRadio ? (
                            <span className="px-2 py-1 text-[10px] font-bold bg-[#064E3B]/50 border border-[#10B981] text-[#A7F3D0]">
                              ✓ ID RADIO OK
                            </span>
                          ) : (
                            <button
                              onClick={() => engineRef.current?.triggerBiometricRadioId(c.id)}
                              className="px-2.5 py-1 text-[10px] font-bold bg-[#D97706] text-black hover:bg-[#F59E0B] cursor-pointer"
                            >
                              [B] Marcar ID
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  {pad.contacts.filter((c) => c.role !== 'PLAYER' && c.role !== 'SQUAD').length ===
                    0 && (
                    <div className="text-xs text-[#94A3B8] py-6 text-center">
                      Usa la cámara térmica/óptica [Q] en puertas o explora las salas para registrar
                      contactos en el EKO-Pad.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#080C11]/50 border border-[#334155]/55 p-4 space-y-3">
                <div className="text-xs font-bold text-[#10B981] border-b border-[#334155]/50 pb-2">
                  ESTADO DE PUERTAS Y PUNTOS DE BRECHA (CLIC PARA MARCAR ZONA DE BRECHA)
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto text-xs">
                  {pad.doors.map((d) => (
                    <div
                      key={d.id}
                      onClick={() =>
                        engineRef.current?.addTacticalMarker(
                          (d.x1 + d.x2) * 0.5,
                          (d.y1 + d.y2) * 0.5,
                          'BREACH_ZONE',
                          `Brecha: ${d.name}`
                        )
                      }
                      className="p-2 bg-[#0B111B]/55 border border-[#334155]/50 hover:border-[#F59E0B] flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-[#E2E8F0] font-semibold">{d.name}</span>
                      <span
                        className={`text-[10px] font-bold ${
                          d.isBreached
                            ? 'text-[#F59E0B]'
                            : d.isOpen
                              ? 'text-[#10B981]'
                              : d.isLocked
                                ? 'text-[#EF4444]'
                                : 'text-[#94A3B8]'
                        }`}
                      >
                        {d.isBreached
                          ? '💥 BRECHADA'
                          : d.isOpen
                            ? '🔓 ABIERTA'
                            : d.isLocked
                              ? '🔒 CERRADA (LLAVE)'
                              : 'CERRADA'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ROE AUDIT & OPERATOR XP PROGRESSION */}
          {activeTab === 'ROE_XP' && (
            <div key="ROE_XP" className="animate-tactical-tab grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#080C11]/50 border border-[#334155]/55 p-4 space-y-3">
                <div className="text-xs font-bold text-[#FBBF24] border-b border-[#334155]/50 pb-2 flex items-center justify-between">
                  <span>AUDITORÍA LEGAL EN VIVO (WAFFENGEBRAUCHSGESETZ §7)</span>
                  <span>{hud.score} PTS</span>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto text-xs">
                  {hud.roeEvents.length > 0 ? (
                    hud.roeEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2 bg-[#0B111B]/55 border border-[#334155]/50 flex items-center justify-between gap-2"
                      >
                        <span className="text-[#CBD5E1]">{ev.label}</span>
                        <span
                          className={`font-bold shrink-0 ${
                            ev.lawful ? 'text-[#10B981]' : 'text-[#EF4444]'
                          }`}
                        >
                          {ev.points > 0 ? `+${ev.points}` : ev.points} PTS
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#94A3B8] py-6 text-center">
                      Aún no se han registrado eventos auditables en esta intervención.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#080C11]/50 border border-[#334155]/55 p-4 space-y-3">
                <div className="text-xs font-bold text-[#38BDF8] border-b border-[#334155]/50 pb-2 flex items-center justify-between">
                  <span>CARRERA Y EXPERIENCIA TÁCTICA (EKO COBRA XP)</span>
                  <span>NIVEL {xp.level}</span>
                </div>
                <div className="p-3 bg-[#0B111B]/55 border border-[#334155]/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{xp.rankDe}</div>
                      <div className="text-xs text-[#94A3B8]">{xp.rankEs}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#38BDF8]">{xp.totalXp} XP TOTAL</div>
                      <div className="text-[11px] text-[#10B981]">
                        +{xp.sessionXp} XP en esta misión
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-[#1E293B]/80 overflow-hidden border border-[#334155]/60">
                    <div
                      className="h-full bg-[#38BDF8] transition-all duration-150"
                      style={{ width: `${xp.progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#94A3B8]">
                    <span>Progreso de Nivel: {xp.xpInLevel} / {xp.xpForNextLevel} XP</span>
                    <span>{xp.progressPct}% completado</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#94A3B8] space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Bonificaciones de Experiencia (XP) en CQB:</span>
                  </div>
                  <div>· Arresto con vida de sospechoso rendido: +160 XP</div>
                  <div>· Evacuación segura de rehén/civil: +130 XP</div>
                  <div>· Identificación biométrica por cámara en radio [B]: +58 XP</div>
                  <div>· Brecha táctica de puerta o ventana ([F] / [X] / [C]): +35 a +55 XP</div>
                </div>
              </div>
            </div>
          )}
          {/* TAB 5: REGISTRO CRÍTICO DE EVENTOS EN TIEMPO REAL */}
          {activeTab === 'LOG' && (
            <div key="LOG" className="animate-tactical-tab space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#080C11]/55 border border-[#334155]/60">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
                    REGISTRO Y CRONOLOGÍA DE EVENTOS CRÍTICOS EN TIEMPO REAL
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Auditoría cronológica de disparos percutidos, arrestos, neutralizaciones, brechas y violaciones de las Reglas de Compromiso (ROE).
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#FCA5A5] font-bold">
                    Violaciones ROE: {hud.roeViolations}
                  </span>
                  <span className="px-2.5 py-1 bg-[#10B981]/20 border border-[#10B981]/50 text-[#A7F3D0] font-bold">
                    Puntos Tácticos: {hud.score} PTS
                  </span>
                </div>
              </div>

              {(!hud.criticalEvents || hud.criticalEvents.length === 0) ? (
                <div className="p-12 text-center bg-[#080C11]/45 border border-[#334155]/50 text-[#94A3B8]">
                  <Activity className="w-8 h-8 text-[#38BDF8] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-[#E2E8F0]">No hay eventos críticos registrados aún en esta misión.</p>
                  <p className="text-xs text-[#64748B] mt-1">Los disparos ejecutados, despejes de puertas, arrestos y violaciones de ROE se irán listando cronológicamente.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
                  {/* Timeline Bar (Caja Negra) */}
                  <div className="p-3 bg-[#080C11]/80 border border-[#334155]/80 font-mono-tabular">
                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mb-1.5 font-bold">
                      <span className="flex items-center gap-1.5 text-white">
                        <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
                        LÍNEA DE TIEMPO TÁCTICA (CAJA NEGRA)
                      </span>
                      <span>00:00 — {formatTime(hud.elapsedSeconds || 0)}</span>
                    </div>
                    <div className="relative h-5 bg-[#0F172A] border border-[#1E293B] overflow-hidden flex items-center">
                      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px] opacity-15 pointer-events-none" />
                      {hud.criticalEvents.map((ev) => {
                        const maxSec = Math.max(10, hud.elapsedSeconds || 1);
                        const pct = Math.min(99, Math.max(1, (ev.elapsedSeconds / maxSec) * 100));
                        const colorClass =
                          ev.severity === 'VIOLATION'
                            ? 'bg-[#EF4444]'
                            : ev.severity === 'WARN'
                              ? 'bg-[#F59E0B]'
                              : ev.severity === 'SUCCESS'
                                ? 'bg-[#10B981]'
                                : 'bg-[#38BDF8]';
                        return (
                          <div
                            key={ev.id}
                            className={`absolute top-0 bottom-0 w-1.5 -ml-0.5 ${colorClass} hover:w-2 hover:scale-y-110 transition-all cursor-pointer z-10`}
                            style={{ left: `${pct}%` }}
                            title={`[${ev.timeStr}] ${ev.title} (${ev.location})`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[#64748B] mt-1 font-mono-tabular">
                      <span>DESPLIEGUE</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#10B981] inline-block" /> Éxito / Arresto
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#38BDF8] inline-block" /> Táctico / Brecha
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#F59E0B] inline-block" /> Advertencia
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#EF4444] inline-block" /> Infracción WVG
                        </span>
                      </div>
                      <span>EXTRACCIÓN</span>
                    </div>
                  </div>

                  {/* List of critical events */}
                  <div className="space-y-2">
                    {hud.criticalEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`p-3 border transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                          ev.severity === 'VIOLATION'
                            ? 'bg-[#EF4444]/15 border-[#EF4444]/60 text-[#FCA5A5]'
                            : ev.severity === 'WARN'
                              ? 'bg-[#F59E0B]/15 border-[#F59E0B]/60 text-[#FDE68A]'
                              : ev.severity === 'SUCCESS'
                                ? 'bg-[#10B981]/15 border-[#10B981]/60 text-[#A7F3D0]'
                                : 'bg-[#080C11]/55 border-[#334155]/60 text-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 bg-[#000000]/50 font-bold text-xs border border-current shrink-0">
                            [{ev.timeStr}]
                          </span>
                          <div>
                            <div className="text-xs font-bold flex items-center gap-2">
                              <span>{ev.title}</span>
                              <span className="text-[10px] text-[#94A3B8]">· {ev.location}</span>
                            </div>
                            <div className="text-[11px] text-[#CBD5E1] mt-0.5">{ev.details}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          {ev.pointsDelta !== undefined && (
                            <span
                              className={`text-xs font-bold px-2 py-0.5 border ${
                                ev.pointsDelta >= 0
                                  ? 'bg-[#10B981]/20 border-[#10B981]/50 text-[#A7F3D0]'
                                  : 'bg-[#EF4444]/20 border-[#EF4444]/50 text-[#FCA5A5]'
                              }`}
                            >
                              {ev.pointsDelta >= 0 ? `+${ev.pointsDelta}` : ev.pointsDelta} PTS
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 border uppercase ${
                              ev.severity === 'VIOLATION'
                                ? 'bg-[#EF4444] text-black border-[#EF4444]'
                                : ev.severity === 'WARN'
                                  ? 'bg-[#F59E0B] text-black border-[#F59E0B]'
                                  : ev.severity === 'SUCCESS'
                                    ? 'bg-[#10B981] text-black border-[#10B981]'
                                    : 'bg-[#38BDF8]/20 border-[#38BDF8]/50 text-[#BAE6FD]'
                            }`}
                          >
                            {ev.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AYUDA Y MANUAL OPERATIVO CQB */}
          {activeTab === 'HELP' && (
            <div key="HELP" className="animate-tactical-tab space-y-4">
              <div className="p-3 bg-[#080C11]/55 border border-[#334155]/60 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#38BDF8]" />
                    MANUAL DE CAMPO Y GUÍA DE CONTROLES TÁCTICOS · EKO COBRA
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Protocolos de intervención, movimiento en sigilo o dinámico, órdenes a Kobra-2 y legislación WVG.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* Movement & Navigation */}
                <div className="p-3 bg-[#080C11]/50 border border-[#334155]/60 space-y-2">
                  <div className="text-xs font-bold text-[#38BDF8] flex items-center gap-1.5 border-b border-[#334155]/50 pb-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    <span>MOVIMIENTO Y APUNTE</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-[#CBD5E1]">
                    <div className="flex justify-between">
                      <span className="font-bold text-white">WASD</span>
                      <span className="text-[#94A3B8]">Caminar en sigilo (bajo ruido)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[Shift]</span>
                      <span className="text-[#94A3B8]">Correr táctico (aumenta fatiga)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">Ratón</span>
                      <span className="text-[#94A3B8]">Orientación y puntería láser 360°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">Clic Izquierdo</span>
                      <span className="text-[#94A3B8]">Disparar arma primaria</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[R]</span>
                      <span className="text-[#94A3B8]">Recarga táctica</span>
                    </div>
                  </div>
                </div>

                {/* Breaching & Tools */}
                <div className="p-3 bg-[#080C11]/50 border border-[#334155]/60 space-y-2">
                  <div className="text-xs font-bold text-[#F59E0B] flex items-center gap-1.5 border-b border-[#334155]/50 pb-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    <span>BRECHAS Y GADGETS</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-[#CBD5E1]">
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[F]</span>
                      <span className="text-[#94A3B8]">Patada Dinámica (Tritt)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[X]</span>
                      <span className="text-[#94A3B8]">Türramme (Ariete táctico)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[C]</span>
                      <span className="text-[#94A3B8]">C4 Sprengladung (Carga explosiva)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[G]</span>
                      <span className="text-[#94A3B8]">Desplegar Gadget (CS-Gas / Flash)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[Q]</span>
                      <span className="text-[#94A3B8]">Sensor óptico / FLIR / Espejo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[H]</span>
                      <span className="text-[#94A3B8]">Torniquete IFAK (hemostático)</span>
                    </div>
                  </div>
                </div>

                {/* ROE & Commands */}
                <div className="p-3 bg-[#080C11]/50 border border-[#334155]/60 space-y-2">
                  <div className="text-xs font-bold text-[#10B981] flex items-center gap-1.5 border-b border-[#334155]/50 pb-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>ÓRDENES BINOMIO Y ROE</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-[#CBD5E1]">
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[Espacio]</span>
                      <span className="text-[#94A3B8]">Grito de intimidación &quot;¡POLIZEI!&quot;</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[B]</span>
                      <span className="text-[#94A3B8]">Identificación biométrica radio</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[1 - 8]</span>
                      <span className="text-[#94A3B8]">Órdenes directas a Kobra-2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[M] / [Esc]</span>
                      <span className="text-[#94A3B8]">Abrir / Cerrar EKO-PAD Táctico</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-white">[Tab]</span>
                      <span className="text-[#94A3B8]">Alternar HUD compacto / extendido</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

