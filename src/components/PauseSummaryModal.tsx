import type { HudSnapshot } from '../game/types';

interface PauseSummaryModalProps {
  gameState: 'PAUSED' | 'VICTORY' | 'DEFEAT';
  hud: HudSnapshot;
  pauseAuditOpen: boolean;
  onToggleAudit: () => void;
  onOpenModal: (modal: 'PAD' | 'BLUEPRINT' | 'GDD' | 'CONTROLS') => void;
  onContinue: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseSummaryModal({
  gameState,
  hud,
  pauseAuditOpen,
  onToggleAudit,
  onOpenModal,
  onContinue,
  onRestart,
  onReturnTitle,
}: PauseSummaryModalProps) {
  return (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#080C11]/55 backdrop-blur-sm p-4 md:p-6 overflow-y-auto">
            <div className="w-full max-w-3xl border border-[#334155]/70 bg-[#0B111A]/75 backdrop-blur-md p-6 md:p-8 shadow-2xl">
              {/* Top Modal Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-[#1E293B] font-mono-tabular text-xs">
                <span className="text-[#D97706] font-bold">
                  {gameState === 'PAUSED'
                    ? '⏸️ CENTRO DE MANDO EN PAUSA'
                    : '📊 INFORME OFICIAL POST-OPERACIÓN'}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onOpenModal('PAD')}
                    className="px-3 py-1 border border-[#38BDF8] bg-[#0F172A] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-black font-bold cursor-pointer"
                  >
                    📱 EKO-PAD Táctico [M]
                  </button>
                  <button
                    onClick={() => onOpenModal('BLUEPRINT')}
                    className="px-3 py-1 border border-[#334155] bg-[#0F172A] text-[#38BDF8] hover:border-[#38BDF8] cursor-pointer"
                  >
                    📋 Blaupause &amp; Equipo
                  </button>
                  <button
                    onClick={() => onOpenModal('GDD')}
                    className="px-3 py-1 border border-[#334155] bg-[#0F172A] text-[#CBD5E1] hover:text-white cursor-pointer"
                  >
                    📘 Manual GDD
                  </button>
                  <button
                    onClick={() => onOpenModal('CONTROLS')}
                    className="px-3 py-1 border border-[#334155] bg-[#0F172A] text-[#10B981] hover:border-[#10B981] cursor-pointer"
                  >
                    ⌨️ Controles
                  </button>
                </div>
              </div>

              {gameState === 'PAUSED' ? (
                <>
                  <h2 className="font-display text-3xl font-bold text-white">
                    Einsatz in Graz - Lend (3. Stock)
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1 font-mono-tabular">
                    Perfil: {hud.profileName} · Rango: {hud.xpTelemetry.rankEs} (NV.{hud.xpTelemetry.level}) · Fatiga: {hud.fatigue}% ({hud.pulseBpm} BPM)
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-mono-tabular text-[#D97706]">
                        AUDITORÍA FISCALÍA DE GRAZ Y DIRECCIÓN EKO COBRA
                      </div>
                      <h2 className="font-display text-3xl font-bold text-white mt-1">
                        {hud.missionResult?.title}
                      </h2>
                    </div>
                    <div className="px-4 py-2 border border-[#D97706] bg-[#D97706]/15 font-display text-4xl font-bold text-[#F59E0B]">
                      GRADO {hud.missionResult?.grade}
                    </div>
                  </div>
                  <p className="text-sm text-[#CBD5E1] mt-3 leading-relaxed">
                    {hud.missionResult?.subtitle}
                  </p>
                </>
              )}

              {/* ROE & XP Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 font-mono-tabular">
                <div className="border border-[#1E293B] bg-[#080C11] p-3">
                  <div className="text-[10px] text-[#94A3B8]">PUNTUACIÓN ROE</div>
                  <div className="text-lg font-bold text-white mt-0.5">{hud.score} PTS</div>
                </div>
                <div className="border border-[#1E293B] bg-[#080C11] p-3">
                  <div className="text-[10px] text-[#94A3B8]">SOSPECHOSOS</div>
                  <div className="text-lg font-bold text-[#10B981] mt-0.5">
                    {hud.suspectsSecured}/{hud.suspectsTotal}
                  </div>
                </div>
                <div className="border border-[#1E293B] bg-[#080C11] p-3">
                  <div className="text-[10px] text-[#94A3B8]">REHENES SALVOS</div>
                  <div className="text-lg font-bold text-[#38BDF8] mt-0.5">
                    {hud.hostagesSecured}/{hud.hostagesTotal}
                  </div>
                </div>
                <div className="border border-[#1E293B] bg-[#080C11] p-3">
                  <div className="text-[10px] text-[#94A3B8]">XP OPERADOR</div>
                  <div className="text-lg font-bold text-[#FBBF24] mt-0.5">
                    +{hud.xpTelemetry.sessionXp} XP
                  </div>
                </div>
              </div>

              {/* Collapsible ROE Event Audit Log (Smooth Accordion fadeIn / fadeOut) */}
              {hud.roeEvents.length > 0 && (
                <div className="border border-[#1E293B] bg-[#080C11] mb-6 font-mono-tabular">
                  <button
                    onClick={onToggleAudit}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    <span>
                      REGISTRO DE AUDITORÍA LEGAL (WAFFENGEBRAUCHSGESETZ) · {hud.roeEvents.length}{' '}
                      EVENTOS
                    </span>
                    <span>{pauseAuditOpen ? '▾ PLEGAR' : '▸ DESPLEGAR'}</span>
                  </button>
                  <div
                    className={`tactical-collapse-grid ${
                      pauseAuditOpen ? 'tactical-collapse-open' : 'tactical-collapse-closed'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-4 pb-3 pt-1 border-t border-[#1E293B] max-h-40 overflow-y-auto space-y-1.5 text-xs">
                        {hud.roeEvents.map((ev) => (
                          <div key={ev.id} className="flex items-center justify-between gap-2">
                            <span className="text-[#CBD5E1]">{ev.label}</span>
                            <span className={ev.lawful ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                              {ev.points > 0 ? `+${ev.points}` : ev.points} PTS
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Critical Events Timeline (After Action Review - AAR) */}
              {hud.criticalEvents && hud.criticalEvents.length > 0 && (
                <div className="border border-[#334155] bg-[#080C11] p-3 mb-5 font-mono-tabular">
                  <div className="text-xs font-bold text-[#38BDF8] border-b border-[#1E293B] pb-1.5 mb-2 flex items-center justify-between">
                    <span>⏱️ CRONOLOGÍA DETALLADA DE EVENTOS (AFTER ACTION REVIEW - AAR)</span>
                    <span className="text-[#94A3B8] text-[10px]">{hud.criticalEvents.length} eventos registrados</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 text-[11px] pr-1">
                    {hud.criticalEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between gap-2 p-1.5 bg-[#0F172A]/70 border border-[#1E293B]">
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#1E293B] text-[#38BDF8] font-bold shrink-0">{ev.timeStr}</span>
                          <span className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${
                            ev.severity === 'SUCCESS' ? 'bg-[#064E3B] text-[#A7F3D0]' :
                            ev.severity === 'VIOLATION' ? 'bg-[#7F1D1D] text-[#FCA5A5]' :
                            ev.severity === 'WARN' ? 'bg-[#78350F] text-[#FDE68A]' : 'bg-[#1E293B] text-[#CBD5E1]'
                          }`}>
                            {ev.type}
                          </span>
                          <span className="text-white truncate font-medium">{ev.title}</span>
                          <span className="text-[#94A3B8] text-[10px] truncate">({ev.location})</span>
                        </div>
                        {ev.pointsDelta !== undefined && (
                          <span className={`font-bold shrink-0 text-xs ${ev.pointsDelta >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                            {ev.pointsDelta >= 0 ? `+${ev.pointsDelta}` : ev.pointsDelta} PTS
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {gameState === 'PAUSED' && (
                    <button
                      onClick={onContinue}
                      className="px-5 py-2.5 text-xs font-bold text-black bg-[#D97706] hover:bg-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Continuar Operación [Esc]
                    </button>
                  )}
                  <button
                    onClick={onRestart}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#1E293B] border border-[#475569] hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Reiniciar Intervención
                  </button>
                </div>

                <button
                  onClick={onReturnTitle}
                  className="px-4 py-2.5 text-xs font-semibold text-[#94A3B8] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Menú Principal
                </button>
              </div>
            </div>
          </div>
  );
}
