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
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-t from-[#080C11]/95 via-[#080C11]/70 to-[#080C11]/85 p-2 sm:p-4 overflow-y-auto">
      {/* Top Quiet Identification Line */}
      <div className="flex items-center justify-between text-[10.5px] font-mono-tabular text-[#94A3B8] pb-1 border-b border-[#334155]/40">
        <div>BUNDESMINISTERIUM FÜR INNERES · DIREKTION FÜR SPEZIALEINHEITEN (DSE)</div>
        <div>EINSATZORT: GRAZ - BEZIRK LEND (STEIERMARK)</div>
      </div>

      {/* Main Content Grid: Left Hero Branding, Right Sidebar Menu with All Buttons */}
      <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-center w-full py-2 max-w-7xl mx-auto">
        {/* Left Hero Lockup */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-2">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/Embl_me_du_Einsatzkommando_Cobra__EKO_Cobra__ff5e252c.svg`}
              alt="EKO Cobra Emblem"
              className="w-20 h-24 sm:w-24 sm:h-28 object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.5)] shrink-0"
            />
            <div className="flex flex-col gap-1">
              <h1
                className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] [text-shadow:_0_2px_0_#1E293B,_0_4px_0_#0F172A,_0_6px_20px_rgba(56,189,248,0.5)]"
                style={{ textWrap: 'balance' }}
              >
                EKO COBRA: EINSATZBEFEHL
              </h1>
              <div className="text-[11px] sm:text-xs font-mono-tabular tracking-widest text-[#D97706] font-bold">
                EINSATZKOMMANDO COBRA
              </div>
            </div>
          </div>

          <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
            Simulador táctico top-down 2D de intervención policial en Austria. Cada disparo es auditado bajo la{' '}
            <span className="text-white font-semibold">Waffengebrauchsgesetz</span>. Selecciona tu perfil de operador, equipa cámara térmica FLIR, micro-cámara óptica o gas lacrimógeno CS y arresta con vida.
          </p>

          {/* Current Pre-Mission Configuration Summary Line */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-[#94A3B8] bg-[#0F172A]/70 p-2 border border-[#334155]/60">
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
        <div className="lg:col-span-5 flex flex-col gap-2.5 bg-[#080C11]/92 backdrop-blur-md border border-[#334155] p-3.5 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <div className="text-[10px] font-mono-tabular tracking-widest text-[#D97706] border-b border-[#334155]/60 pb-1 flex items-center justify-between">
            <span>MENÚ TÁCTICO · INICIO</span>
            <span className="text-[#38BDF8]">DSE-AT</span>
          </div>

          {hasSavedGame && (
            <button
              onClick={handleResumeGame}
              className="w-full px-3 py-2 text-xs font-bold text-black bg-[#10B981] hover:bg-[#34D399] transition-colors cursor-pointer flex items-center justify-between border border-[#10B981]"
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
              className="w-full px-3 py-2 text-xs font-bold text-white bg-[#1E293B]/90 hover:bg-[#334155]/90 transition-colors cursor-pointer flex items-center justify-between border border-[#38BDF8]/40"
            >
              <span className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#38BDF8]" />
                <span>MISIONES EKO COBRA</span>
              </span>
              {missionsAccordionOpen ? <ChevronUp className="w-4 h-4 text-[#38BDF8]" /> : <ChevronDown className="w-4 h-4 text-[#38BDF8]" />}
            </button>

            {missionsAccordionOpen && (
              <div className="mt-1 flex flex-col gap-1 bg-[#080C11]/95 border border-[#38BDF8] p-1.5 shadow-xl">
                <button onClick={handleStartApartmentMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#FDE68A] bg-[#0F172A] border border-[#D97706] hover:bg-[#D97706]/20 transition-colors">Misión 1: Piso Graz - Lend</button>
                <button onClick={handleStartInvestigationMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#A7F3D0] bg-[#064E3B]/80 border border-[#10B981] hover:bg-[#10B981]/20 transition-colors">Misión Investigación (sin disparos)</button>
                <button onClick={handleStartStationMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-black bg-[#38BDF8] hover:bg-[#38BDF8]/80 transition-colors">Misión 2: Estación de Trenes</button>
                <button onClick={handleStartNightStationMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#E0F2FE] bg-[#0B111A] border border-[#38BDF8] hover:bg-[#38BDF8]/20 transition-colors">Misión 2B: Estación Nocturna</button>
                <button onClick={handleStartMetroMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#FDE68A] bg-[#422006] border border-[#F59E0B] hover:bg-[#F59E0B]/20 transition-colors">Misión 6: Metro U3 (Incidente)</button>
                <button onClick={handleStartLinzMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#A7F3D0] bg-[#064E3B]/80 border border-[#10B981] hover:bg-[#10B981]/20 transition-colors">Misión 3: Laboratorio Químico</button>
                <button onClick={handleStartTirolMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#E0F2FE] bg-[#0369A1]/80 border border-[#38BDF8] hover:bg-[#38BDF8]/20 transition-colors">Misión 4: Chalet Alpino (Tirol)</button>
                <button onClick={handleStartSchwechatMission} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#FECDD3] bg-[#881337]/80 border border-[#F43F5E] hover:bg-[#F43F5E]/20 transition-colors">Misión 5: Aeropuerto Wien-Schwechat</button>
                <button onClick={handleStartTrainingRange} className="text-left px-2.5 py-1.5 text-xs font-bold text-[#FDE68A] bg-[#0F172A] border border-[#F59E0B] hover:bg-[#F59E0B]/20 transition-colors">Entrenamiento de Tiro CQB</button>
                <button onClick={handleStartTutorial} className="text-left px-2.5 py-1.5 text-xs font-bold text-black bg-[#10B981] hover:bg-[#34D399] transition-colors">Tutorial Interactivo CQB</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => openModalExclusive('ARMORY')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#FDE68A] bg-[#0F172A] border border-[#F59E0B]/70 hover:bg-[#1E293B] transition-colors cursor-pointer">
              <Crosshair className="w-3.5 h-3.5 text-[#F59E0B]" /> Armería
            </button>
            <button onClick={() => openModalExclusive('INTEL')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#A7F3D0] bg-[#0F172A] border border-[#10B981]/70 hover:bg-[#1E293B] transition-colors cursor-pointer">
              <Radio className="w-3.5 h-3.5 text-[#10B981]" /> Inteligencia EKIS
            </button>
            <button onClick={() => openModalExclusive('CAREER')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#BAE6FD] bg-[#0F172A] border border-[#38BDF8]/70 hover:bg-[#1E293B] transition-colors cursor-pointer">
              <Award className="w-3.5 h-3.5 text-[#38BDF8]" /> Expediente
            </button>
            <button onClick={() => openModalExclusive('BLUEPRINT')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F172A] border border-[#38BDF8]/60 hover:bg-[#1E293B] transition-colors cursor-pointer">
              <Tablet className="w-3.5 h-3.5 text-[#38BDF8]" /> Blueprint
            </button>
            <button onClick={() => openModalExclusive('GDD')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] bg-[#0F172A] border border-[#334155] hover:bg-[#1E293B] transition-colors cursor-pointer">
              <Award className="w-3.5 h-3.5 text-[#94A3B8]" /> GDD
            </button>
            <button onClick={() => openModalExclusive('CONTROLS')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#38BDF8] bg-[#0F172A] border border-[#334155] hover:bg-[#1E293B] transition-colors cursor-pointer">
              <Crosshair className="w-3.5 h-3.5 text-[#38BDF8]" /> Controles
            </button>
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setKeybindModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#A7F3D0] bg-[#0F172A] border border-[#10B981]/70 hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              Remapear Teclas
            </button>
          </div>

          <button onClick={handleToggleMute} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] border border-[#334155] hover:bg-[#1E293B] transition-colors cursor-pointer">
            {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-green-400" />} Audio: {muted ? 'Silenciado' : 'Activo'}
          </button>
          <button onClick={handleToggleRadioAudio} title="Pitido y textura TETRA; no afecta al ticker, subtítulos ni burbujas" className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] border border-[#334155] hover:bg-[#1E293B] transition-colors cursor-pointer">
            <Radio className={`w-3.5 h-3.5 ${radioAudioEnabled ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}`} /> Radio: {radioAudioEnabled ? 'Pitido TETRA' : 'Silenciada'}
          </button>
          <button onClick={handleToggleSubtitles} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] border border-[#334155] hover:bg-[#1E293B] transition-colors cursor-pointer">
            Subtítulos: {subtitlesEnabled ? 'Activos' : 'Desactivados'}
          </button>
          <button onClick={handleCycleColorblind} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] bg-[#0F172A] border border-[#334155] hover:bg-[#1E293B] transition-colors cursor-pointer">
            Daltonismo: {colorblindMode}
          </button>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="text-[10px] font-mono-tabular text-[#64748B] text-center pt-1 border-t border-[#334155]/40">
        EKO COBRA TACTICAL ENGINE v3.8 · REPUBLIK ÖSTERREICH
      </div>
    </div>
  );
}
