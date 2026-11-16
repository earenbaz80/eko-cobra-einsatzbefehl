import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Crosshair,
  Flame,
  Heart,
  Menu,
  Mic,
  MicOff,
  Radio,
  Shield,
  Tablet,
  Target,
  TrainFront,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine';
import type { TacticalEngine } from '../game/TacticalEngine';
import type { HudSnapshot, PrimaryWeaponId, SquadCommand } from '../game/types';
import { COBRA_RANK_TIERS, computePlayerMissionRank } from '../game/types';

interface TacticalHudProps {
  anatomyDrawerOpen: boolean;
  commandMenuOpen: boolean;
  engineRef: React.RefObject<TacticalEngine | null>;
  handleHudOpacityChange: (value: number, persist?: boolean) => void;
  handleReturnToTitle: () => void;
  handleSquadCommand: (command: SquadCommand) => void;
  handleStartApartmentMission: () => void;
  handleStartMission: () => void;
  handleStartStationMission: () => void;
  handleStartTrainingRange: () => void;
  handleToggleMute: () => void;
  handleToggleRadioAudio: () => void;
  hud: HudSnapshot;
  hudOpacity: number;
  hudStackRef: React.RefObject<HTMLDivElement | null>;
  isListening: boolean;
  muted: boolean;
  openModalExclusive: (modal: 'PAD' | 'BLUEPRINT' | 'GDD' | 'CONTROLS') => void;
  primaryWeapon: PrimaryWeaponId;
  radioAudioEnabled: boolean;
  radioLogOpen: boolean;
  rankDrawerOpen: boolean;
  setAnatomyDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCommandMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRadioLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRankDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSquadDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  squadDrawerOpen: boolean;
  startVoiceCapture: () => void;
  stopVoiceCapture: () => void;
}

export function TacticalHud({
  anatomyDrawerOpen,
  commandMenuOpen,
  engineRef,
  handleHudOpacityChange,
  handleReturnToTitle,
  handleSquadCommand,
  handleStartApartmentMission,
  handleStartMission,
  handleStartStationMission,
  handleStartTrainingRange,
  handleToggleMute,
  handleToggleRadioAudio,
  hud,
  hudOpacity,
  hudStackRef,
  isListening,
  muted,
  openModalExclusive,
  primaryWeapon,
  radioAudioEnabled,
  radioLogOpen,
  rankDrawerOpen,
  setAnatomyDrawerOpen,
  setCommandMenuOpen,
  setRadioLogOpen,
  setRankDrawerOpen,
  setSquadDrawerOpen,
  squadDrawerOpen,
  startVoiceCapture,
  stopVoiceCapture,
}: TacticalHudProps) {
  return (
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
                      primaryWeapon === w.id
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
  );
}
