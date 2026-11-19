import { useState } from 'react';
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Radio,
  Tablet,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine';
import type { HudSnapshot } from '../game/types';

type TitleModal = 'ARMORY' | 'INTEL' | 'CAREER' | 'BLUEPRINT' | 'GDD' | 'CONTROLS';

interface TitleScreenProps {
  hud: HudSnapshot | null;
  hasSavedGame: boolean;
  handleResumeGame: () => void;
  handleStartApartmentMission: () => void;
  handleStartInvestigationMission: () => void;
  handleStartStationMission: () => void;
  handleStartNightStationMission: () => void;
  handleStartMetroMission: () => void;
  handleStartLinzMission: () => void;
  handleStartTirolMission: () => void;
  handleStartSchwechatMission: () => void;
  handleStartTrainingRange: () => void;
  handleStartTutorial: () => void;
  openModalExclusive: (modal: TitleModal) => void;
  setKeybindModalOpen: (open: boolean) => void;
  handleToggleMute: () => void;
  muted: boolean;
  handleToggleRadioAudio: () => void;
  radioAudioEnabled: boolean;
  handleToggleSubtitles: () => void;
  subtitlesEnabled: boolean;
  handleCycleColorblind: () => void;
  colorblindMode: string;
}

export function TitleScreen({
  hud,
  hasSavedGame,
  handleResumeGame,
  handleStartApartmentMission,
  handleStartInvestigationMission,
  handleStartStationMission,
  handleStartNightStationMission,
  handleStartMetroMission,
  handleStartLinzMission,
  handleStartTirolMission,
  handleStartSchwechatMission,
  handleStartTrainingRange,
  handleStartTutorial,
  openModalExclusive,
  setKeybindModalOpen,
  handleToggleMute,
  muted,
  handleToggleRadioAudio,
  radioAudioEnabled,
  handleToggleSubtitles,
  subtitlesEnabled,
  handleCycleColorblind,
  colorblindMode,
}: TitleScreenProps) {
  const [missionsAccordionOpen, setMissionsAccordionOpen] = useState(true);

  return (
    <div className="hud-pixel absolute inset-0 z-20 flex flex-col justify-between bg-[#080C11]/85 p-2 sm:p-4 overflow-y-auto">
      {/* Top Quiet Identification Line */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 text-[10.5px] text-[#94A3B8] pb-1 border-b border-[#334155]/40">
        <div>BUNDESMINISTERIUM FÜR INNERES · DIREKTION FÜR SPEZIALEINHEITEN (DSE)</div>
        <div className="sm:text-right">EINSATZORT: GRAZ - BEZIRK LEND (STEIERMARK)</div>
      </div>

      {/* Main Content Grid: Left Hero Branding, Right Sidebar Menu with All Buttons */}
      <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-center w-full py-2 max-w-7xl mx-auto">
        {/* Left Hero Lockup */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-2">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/Embl_me_du_Einsatzkommando_Cobra__EKO_Cobra__ff5e252c.svg`}
              alt="EKO Cobra Emblem"
              className="w-20 h-24 sm:w-24 sm:h-28 object-contain shrink-0"
            />
            <div className="flex flex-col gap-1 min-w-0">
              {/* Wordmark en rejilla de píxeles: 25/30/35 px son múltiplos del
                  diseño de 5 px de Tiny5, así cada píxel cae en bloque entero. */}
              <h1
                className="font-normal text-[25px] sm:text-[30px] lg:text-[35px] leading-[1.05] tracking-tight text-white"
                style={{ textWrap: 'balance' }}
              >
                EKO COBRA: EINSATZBEFEHL
              </h1>
              <div className="text-[12px] tracking-[0.14em] text-[#D97706] font-bold">
                EINSATZKOMMANDO COBRA
              </div>
            </div>
          </div>

          <p className="mt-2 max-w-2xl text-xs text-[#CBD5E1] leading-relaxed">
            Simulador táctico top-down 2D de intervención policial en Austria. Cada disparo es auditado bajo la{' '}
            <span className="text-white font-semibold">Waffengebrauchsgesetz</span>. Selecciona tu perfil de operador, equipa cámara térmica FLIR, micro-cámara óptica o gas lacrimógeno CS y arresta con vida.
          </p>

          {/* Current Pre-Mission Configuration Summary Line */}
          <div className="pixel-frame-tenue mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#94A3B8] p-2">
            <span className="text-white font-semibold">
              Perfil: {hud?.profileName || 'Aufklärer / Optik-Spezialist'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#D97706]">
              Arma: {hud?.primaryName || 'Steyr AUG A3 Para 9mm'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#38BDF8]">
              Sensor [Q]: {hud?.inspectionName || 'Cámara Térmica Infrarroja'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#10B981]">
              Gadget [G]: {hud?.gadgetName || 'CS-Reizgasgranate'}
            </span>
          </div>
        </div>

        {/* Right Sidebar Menu with Vertical Stack (Original Title Screen Layout) */}
        <div className="pixel-frame lg:col-span-5 flex flex-col gap-2.5 p-3.5">
          <div className="text-[10px] tracking-[0.14em] text-[#D97706] border-b border-[#334155]/60 pb-1 flex items-center justify-between">
            <span>MENÚ TÁCTICO · INICIO</span>
            <span className="text-[#38BDF8]">DSE-AT</span>
          </div>

          {hasSavedGame && (
            <button
              onClick={handleResumeGame}
              className="pixel-edge w-full px-3 py-2 text-xs font-bold text-black bg-[#10B981] hover:bg-[#34D399] cursor-pointer flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>REANUDAR PARTIDA GUARDADA</span>
              </span>
            </button>
          )}

          {/* Misiones Dropdown / Buttons */}
          <div className="relative">
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setMissionsAccordionOpen((prev) => !prev);
              }}
              aria-expanded={missionsAccordionOpen}
              aria-controls="lista-misiones-eko"
              className="pixel-edge w-full px-3 py-2 text-xs font-bold text-white bg-[#1E293B] hover:bg-[#334155] cursor-pointer flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#38BDF8]" />
                <span>MISIONES EKO COBRA</span>
              </span>
              {missionsAccordionOpen ? <ChevronUp className="w-4 h-4 text-[#38BDF8]" /> : <ChevronDown className="w-4 h-4 text-[#38BDF8]" />}
            </button>

            {missionsAccordionOpen && (
              <div id="lista-misiones-eko" className="pixel-frame mt-1 flex flex-col gap-1 p-1.5">
                <button onClick={handleStartApartmentMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#FDE68A] bg-[#0F172A] hover:bg-[#D97706]/20 transition-colors">Misión 1: Piso Graz - Lend</button>
                <button onClick={handleStartInvestigationMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#A7F3D0] bg-[#064E3B] hover:bg-[#10B981]/20 transition-colors">Misión Investigación (sin disparos)</button>
                <button onClick={handleStartStationMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-black bg-[#38BDF8] hover:bg-[#38BDF8]/80 transition-colors">Misión 2: Estación de Trenes</button>
                <button onClick={handleStartNightStationMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#E0F2FE] bg-[#0B111A] hover:bg-[#38BDF8]/20 transition-colors">Misión 2B: Estación Nocturna</button>
                <button onClick={handleStartMetroMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#FDE68A] bg-[#422006] hover:bg-[#F59E0B]/20 transition-colors">Misión 6: Metro U3 (Incidente)</button>
                <button onClick={handleStartLinzMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#A7F3D0] bg-[#064E3B] hover:bg-[#10B981]/20 transition-colors">Misión 3: Laboratorio Químico</button>
                <button onClick={handleStartTirolMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#E0F2FE] bg-[#0369A1] hover:bg-[#38BDF8]/20 transition-colors">Misión 4: Chalet Alpino (Tirol)</button>
                <button onClick={handleStartSchwechatMission} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#FECDD3] bg-[#881337] hover:bg-[#F43F5E]/20 transition-colors">Misión 5: Aeropuerto Wien-Schwechat</button>
                <button onClick={handleStartTrainingRange} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-[#FDE68A] bg-[#0F172A] hover:bg-[#F59E0B]/20 transition-colors">Entrenamiento de Tiro CQB</button>
                <button onClick={handleStartTutorial} className="pixel-edge text-left px-2.5 py-1.5 text-xs font-bold text-black bg-[#10B981] hover:bg-[#34D399] transition-colors">Tutorial Interactivo CQB</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => openModalExclusive('ARMORY')} className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#FDE68A] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
              <Crosshair className="w-3.5 h-3.5 text-[#F59E0B]" /> Armería
            </button>
            <button onClick={() => openModalExclusive('INTEL')} className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#A7F3D0] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
              <Radio className="w-3.5 h-3.5 text-[#10B981]" /> Inteligencia EKIS
            </button>
            <button onClick={() => openModalExclusive('CAREER')} className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#BAE6FD] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
              <Award className="w-3.5 h-3.5 text-[#38BDF8]" /> Expediente
            </button>
            <button onClick={() => openModalExclusive('BLUEPRINT')} className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
              <Tablet className="w-3.5 h-3.5 text-[#38BDF8]" /> Blueprint
            </button>
            <button onClick={() => openModalExclusive('GDD')} className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
              <Award className="w-3.5 h-3.5 text-[#94A3B8]" /> GDD
            </button>
            <button onClick={() => openModalExclusive('CONTROLS')} className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#38BDF8] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
              <Crosshair className="w-3.5 h-3.5 text-[#38BDF8]" /> Controles
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setKeybindModalOpen(true);
              }}
              className="pixel-edge flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#A7F3D0] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer"
            >
              Remapear Teclas
            </button>
          </div>

          <button onClick={handleToggleMute} className="pixel-edge w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
            {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-green-400" />} Audio: {muted ? 'Silenciado' : 'Activo'}
          </button>
          <button onClick={handleToggleRadioAudio} title="Pitido y textura TETRA; no afecta al ticker, subtítulos ni burbujas" className="pixel-edge w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
            <Radio className={`w-3.5 h-3.5 ${radioAudioEnabled ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}`} /> Radio: {radioAudioEnabled ? 'Pitido TETRA' : 'Silenciada'}
          </button>
          <button onClick={handleToggleSubtitles} className="pixel-edge w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
            Subtítulos: {subtitlesEnabled ? 'Activos' : 'Desactivados'}
          </button>
          <button onClick={handleCycleColorblind} className="pixel-edge w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer">
            Daltonismo: {colorblindMode}
          </button>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="text-[10px] text-[#64748B] text-center pt-1 border-t border-[#334155]/40">
        EKO COBRA TACTICAL ENGINE v3.8 · REPUBLIK ÖSTERREICH
      </div>
    </div>
  );
}
