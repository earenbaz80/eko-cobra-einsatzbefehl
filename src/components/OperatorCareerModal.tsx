import React from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  Award,
  Star,
  Shield,
  Target,
  Crosshair,
  X,
  Sparkles,
} from 'lucide-react';
import {
  computePlayerMissionRank,
  OperatorXpTelemetry,
  PlayerMissionRank,
} from '../game/types';
import { soundEngine } from '../game/soundEngine';

interface OperatorCareerModalProps {
  xpTelemetry: OperatorXpTelemetry;
  score: number;
  onClose: () => void;
}

export const OperatorCareerModal: React.FC<OperatorCareerModalProps> = ({
  xpTelemetry,
  score,
  onClose,
}) => {
  const dialogRef = useModalA11y();
  const currentRank: PlayerMissionRank = computePlayerMissionRank(score);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C11]/95 p-4 md:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl border border-[#38BDF8]/60 bg-[#0B111A] text-[#E2E8F0] shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[92vh] overflow-hidden font-mono-tabular"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Expediente y hoja de servicio del operador"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] px-6 py-4 bg-[#0F172A] shrink-0">
          <div className="flex items-center gap-3">
            <Award className="w-7 h-7 text-[#F59E0B] shrink-0" />
            <div>
              <div className="text-xs text-[#D97706] tracking-wider uppercase font-bold">
                EXPEDIENTE Y HOJA DE SERVICIO POLICIAL DSE COBRA
              </div>
              <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide text-white">
                Carrera de Operador Táctico y Condecoraciones WVG
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="p-2 text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* Left Column: Rank Insignia & Level Progress */}
          <div className="lg:col-span-5 flex flex-col gap-4 bg-[#060B12] p-5 border border-[#334155] items-center text-center">
            {/* Large Rank Insignia Badge */}
            <div
              className="w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center p-3 shadow-[0_0_25px_rgba(0,0,0,0.8)]"
              style={{
                borderColor: currentRank.color,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
              }}
            >
              <span className="text-3xl font-black" style={{ color: currentRank.color }}>
                {currentRank.badgeCode}
              </span>
              <span className="text-[10px] font-bold text-white mt-1">
                {currentRank.insignia}
              </span>
            </div>

            <div>
              <div className="text-xs text-[#94A3B8] uppercase">RANGO OFICIAL DSE</div>
              <h3 className="text-xl font-black text-white mt-0.5" style={{ color: currentRank.color }}>
                {currentRank.titleDe}
              </h3>
              <div className="text-xs text-[#CBD5E1] mt-0.5">{currentRank.titleEs}</div>
            </div>

            {/* Stars */}
            <div className="flex items-center gap-1">
              {Array.from({ length: currentRank.stars }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-[#F59E0B] text-[#F59E0B]" />
              ))}
            </div>

            {/* XP Bar */}
            <div className="w-full flex flex-col gap-1.5 mt-2 text-left">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#94A3B8]">EXPERIENCIA OPERATIVA (XP):</span>
                <span className="text-[#38BDF8]">{xpTelemetry.totalXp} XP</span>
              </div>
              <div className="w-full h-3.5 bg-[#1E293B] overflow-hidden border border-[#334155] flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-[#38BDF8] to-[#10B981] transition-all duration-500"
                  style={{ width: `${xpTelemetry.progressPct}%` }}
                />
              </div>
              <div className="text-[10px] text-[#64748B] text-right">
                Nivel {xpTelemetry.level} · Progresión {xpTelemetry.xpInLevel} / {xpTelemetry.xpForNextLevel} XP
              </div>
            </div>
          </div>

          {/* Right Column: Career Statistics & Medals */}
          <div className="lg:col-span-7 flex flex-col gap-4 justify-between">
            {/* Score & ROE Compliance Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#080C11] border border-[#334155] flex flex-col gap-1">
                <span className="text-[#94A3B8] text-[10px]">PUNTUACIÓN TÁCTICA ACUMULADA:</span>
                <span className="text-xl font-black text-[#FDE68A]">{score} PTS</span>
              </div>
              <div className="p-3 bg-[#080C11] border border-[#334155] flex flex-col gap-1">
                <span className="text-[#94A3B8] text-[10px]">CUMPLIMIENTO DE ROE §7 WVG:</span>
                <span className="text-xl font-black text-[#10B981]">
                  {score >= 0 ? '100% LEGAL' : 'AUDITORÍA DISCIPLINARIA'}
                </span>
              </div>
            </div>

            {/* Condecoraciones y Medallas Oficiales */}
            <div className="bg-[#080C11] border border-[#334155] p-4 flex flex-col gap-3">
              <div className="text-xs font-bold text-[#F59E0B] border-b border-[#1E293B] pb-1.5 flex items-center justify-between">
                <span>CONDECORACIONES TÁCTICAS COBRA</span>
                <Award className="w-4 h-4 text-[#F59E0B]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-[#0F172A] border border-[#38BDF8]/40 flex items-center gap-3">
                  <Shield className="w-6 h-6 text-[#38BDF8] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Medalla de Honor EKO Cobra</div>
                    <div className="text-[10px] text-[#94A3B8]">Otorgada por misiones con Grado S (Cero Bajas).</div>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0F172A] border border-[#10B981]/40 flex items-center gap-3">
                  <Target className="w-6 h-6 text-[#10B981] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Insignia de Tirador Quirúrgico</div>
                    <div className="text-[10px] text-[#94A3B8]">Otorgada por precisión balística superior al 85%.</div>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0F172A] border border-[#F59E0B]/40 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-[#F59E0B] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Cruz de Desescalada Verbal</div>
                    <div className="text-[10px] text-[#94A3B8]">Conseguida tras rendiciones negociadas sin disparos.</div>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0F172A] border border-[#A78BFA]/40 flex items-center gap-3">
                  <Crosshair className="w-6 h-6 text-[#A78BFA] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Distintivo Maestro CQB</div>
                    <div className="text-[10px] text-[#94A3B8]">Despeje de escenarios críticos en bajo tiempo.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Close / Action Button */}
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="w-full py-3 bg-[#38BDF8] hover:bg-[#7DD3FC] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] cursor-pointer"
            >
              VOLVER AL MENÚ DE COMANDO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
