import React from 'react';
import {
  computeLoadoutMetrics,
  EKO_COBRA_AMMO,
  EKO_COBRA_ATTACHMENTS,
  EKO_COBRA_GADGETS,
  EKO_COBRA_INSPECTION_DEVICES,
  EKO_COBRA_PROFILES,
  EKO_COBRA_WEAPONS,
} from '../game/grazMap';
import { getPixelPreviewCanvas } from '../game/pixelSprites';
import {
  AmmoTypeId,
  EntryDoctrine,
  EntryPointId,
  InspectionDeviceId,
  MissionPlan,
  OperatorProfileId,
  PrimaryWeaponId,
  TacticalGadgetId,
  WeaponAttachmentId,
} from '../game/types';

interface BlueprintModalProps {
  plan: MissionPlan;
  onChangePlan: (updated: MissionPlan) => void;
  onClose: () => void;
  onDeployNow: () => void;
}

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  plan,
  onChangePlan,
  onClose,
  onDeployNow,
}) => {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    PROFILE: true,
    SENSORS: true,
    GADGETS: false,
    WEAPONS: true,
    ATTACHMENTS: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () =>
    setOpenSections({ PROFILE: true, SENSORS: true, GADGETS: true, SQUAD_GEAR: true, WEAPONS: true, ATTACHMENTS: true });
  const collapseAll = () =>
    setOpenSections({ PROFILE: false, SENSORS: false, GADGETS: false, SQUAD_GEAR: false, WEAPONS: false, ATTACHMENTS: false });

  const setProfile = (profile: OperatorProfileId) => {
    const spec = EKO_COBRA_PROFILES[profile];
    onChangePlan({
      ...plan,
      profile,
      primaryWeapon: spec.recommendedWeapon,
      inspectionDevice: spec.recommendedInspection,
      gadget: spec.recommendedGadget,
    });
  };
  const setEntry = (entryPoint: EntryPointId) => onChangePlan({ ...plan, entryPoint });
  const setDoctrine = (doctrine: EntryDoctrine) => onChangePlan({ ...plan, doctrine });
  const setWeapon = (primaryWeapon: PrimaryWeaponId) => onChangePlan({ ...plan, primaryWeapon });
  const setAttachment = (attachment: WeaponAttachmentId) => onChangePlan({ ...plan, attachment });
  const setAmmoType = (ammoType: AmmoTypeId) => onChangePlan({ ...plan, ammoType });
  const setInspection = (inspectionDevice: InspectionDeviceId) =>
    onChangePlan({ ...plan, inspectionDevice });
  const setGadget = (gadget: TacticalGadgetId) => onChangePlan({ ...plan, gadget });

  const metrics = computeLoadoutMetrics(plan);
  const activeProfile = EKO_COBRA_PROFILES[plan.profile];
  const activeWeapon = EKO_COBRA_WEAPONS[plan.primaryWeapon];
  const activeAttachment = EKO_COBRA_ATTACHMENTS[plan.attachment ?? 'NONE'];
  const activeAmmo = EKO_COBRA_AMMO[plan.ammoType ?? 'FMJ_STANDARD'];
  const activeSensor = EKO_COBRA_INSPECTION_DEVICES[plan.inspectionDevice];
  const activeGadget = EKO_COBRA_GADGETS[plan.gadget];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C11]/95 p-4 md:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-7xl border border-[#334155] bg-[#0B111A] text-[#E2E8F0] shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] px-6 py-4 bg-[#0F172A] shrink-0">
          <div>
            <div className="text-xs font-mono-tabular text-[#D97706] tracking-wider">
              BLAUPAUSE &amp; AUSRÜSTUNG · EINSATZBEFEHL NR. 2026-884 · BUNDESPOLIZEI STEIERMARK
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-wide text-white">
              Planificación Pre-Misión y Gestión de Equipo: Einsatz in Graz - Lend
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#94A3B8] border border-[#334155] hover:text-white hover:border-[#64748B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cerrar [Esc]
            </button>
            <button
              onClick={onDeployNow}
              className="px-5 py-2 text-xs font-bold text-black bg-[#D97706] hover:bg-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar Intervención (Zugriff Starten)
            </button>
          </div>
        </div>

        {/* Scrollable 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
          {/* Left Column: Interactive Architectural Blueprint + Loadout Telemetry */}
          <div className="lg:col-span-6 flex flex-col justify-between border border-[#1E293B] bg-[#070B10] p-5">
            <div>
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Plano Arquitectónico — Wohnung 14 (Graz - Lend, 3. Stock)
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Selecciona Tür A (Escalera) o Tür B (Loggia) directamente sobre el plano.
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[#38BDF8]">ESCALA 1:75</span>
              </div>

              {/* Interactive SVG Floorplan */}
              <div className="relative w-full aspect-[16/10] bg-[#09121E] border border-[#1E293B] overflow-hidden">
                <svg viewBox="0 0 1120 700" className="w-full h-full">
                  <defs>
                    <pattern id="bpGrid" width="35" height="35" patternUnits="userSpaceOnUse">
                      <path
                        d="M 35 0 L 0 0 0 35"
                        fill="none"
                        stroke="rgba(56, 189, 248, 0.08)"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="1120" height="700" fill="url(#bpGrid)" />

                  {/* Stiegenhaus */}
                  <rect
                    x="60"
                    y="70"
                    width="150"
                    height="560"
                    fill="rgba(15, 23, 42, 0.8)"
                    stroke="#475569"
                    strokeWidth="3"
                  />
                  <text x="80" y="105" fill="#94A3B8" fontSize="13" fontFamily="JetBrains Mono">
                    STIEGENHAUS
                  </text>
                  <text x="80" y="124" fill="#64748B" fontSize="11" fontFamily="Plus Jakarta Sans">
                    Escalera 3. Stock
                  </text>

                  {/* Vorraum */}
                  <rect
                    x="210"
                    y="240"
                    width="240"
                    height="230"
                    fill="rgba(30, 41, 59, 0.55)"
                    stroke="#64748B"
                    strokeWidth="3"
                  />
                  <text x="235" y="275" fill="#E2E8F0" fontSize="14" fontFamily="JetBrains Mono">
                    VORRAUM / FLUR
                  </text>
                  <text
                    x="235"
                    y="294"
                    fill="#94A3B8"
                    fontSize="11"
                    fontFamily="Plus Jakarta Sans"
                  >
                    Recibidor Central
                  </text>

                  {/* Wohnküche */}
                  <rect
                    x="210"
                    y="70"
                    width="370"
                    height="170"
                    fill="rgba(30, 41, 59, 0.7)"
                    stroke="#64748B"
                    strokeWidth="3"
                  />
                  <text x="235" y="105" fill="#E2E8F0" fontSize="14" fontFamily="JetBrains Mono">
                    ZIMMER 1: WOHNKÜCHE
                  </text>
                  <text x="235" y="124" fill="#F59E0B" fontSize="11" fontFamily="JetBrains Mono">
                    Cómplice: Lukas K. (Steyr M9)
                  </text>

                  {/* Badezimmer */}
                  <rect
                    x="210"
                    y="470"
                    width="240"
                    height="160"
                    fill="rgba(15, 23, 42, 0.75)"
                    stroke="#64748B"
                    strokeWidth="3"
                  />
                  <text x="235" y="505" fill="#E2E8F0" fontSize="13" fontFamily="JetBrains Mono">
                    BAD / WC
                  </text>
                  <text x="235" y="525" fill="#38BDF8" fontSize="11" fontFamily="JetBrains Mono">
                    Civil refugiada (Hanna S.)
                  </text>

                  {/* Wohnzimmer */}
                  <rect
                    x="450"
                    y="240"
                    width="420"
                    height="390"
                    fill="rgba(30, 41, 59, 0.65)"
                    stroke="#64748B"
                    strokeWidth="3"
                  />
                  <text x="480" y="280" fill="#E2E8F0" fontSize="15" fontFamily="JetBrains Mono">
                    ZIMMER 2: WOHNZIMMER (SALÓN)
                  </text>
                  <text x="480" y="302" fill="#EF4444" fontSize="11" fontFamily="JetBrains Mono">
                    Sospechoso: Milan V. (CZ-75)
                  </text>

                  {/* Schlafzimmer */}
                  <rect
                    x="580"
                    y="70"
                    width="360"
                    height="220"
                    fill="rgba(127, 29, 29, 0.25)"
                    stroke="#EF4444"
                    strokeWidth="3"
                  />
                  <text x="605" y="105" fill="#FCA5A5" fontSize="15" fontFamily="JetBrains Mono">
                    ZIMMER 3: SCHLAFZIMMER (CRÍTICO)
                  </text>
                  <text x="605" y="128" fill="#F8FAFC" fontSize="12" fontFamily="JetBrains Mono">
                    Markus K. + Rehén Julia M.
                  </text>

                  {/* Loggia */}
                  <rect
                    x="870"
                    y="290"
                    width="180"
                    height="340"
                    fill="rgba(15, 23, 42, 0.8)"
                    stroke="#475569"
                    strokeWidth="3"
                  />
                  <text x="890" y="330" fill="#94A3B8" fontSize="13" fontFamily="JetBrains Mono">
                    LOGGIA / BALKON
                  </text>

                  {/* Pixel Art Agent Sprites on Blueprint */}
                  <image
                    href={getPixelPreviewCanvas('MARKUS')}
                    x="795"
                    y="145"
                    width="42"
                    height="42"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <image
                    href={getPixelPreviewCanvas('JULIA')}
                    x="865"
                    y="155"
                    width="40"
                    height="40"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <image
                    href={getPixelPreviewCanvas('MARKUS')}
                    x="680"
                    y="420"
                    width="38"
                    height="38"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <image
                    href={getPixelPreviewCanvas('MARKUS')}
                    x="380"
                    y="145"
                    width="38"
                    height="38"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {/* Entry Point A Interactive Node */}
                  <g onClick={() => setEntry('HAUPTEINGANG_A')} className="cursor-pointer">
                    <rect
                      x="130"
                      y="322"
                      width="88"
                      height="66"
                      fill={
                        plan.entryPoint === 'HAUPTEINGANG_A'
                          ? 'rgba(217, 119, 6, 0.25)'
                          : 'rgba(15, 23, 42, 0.9)'
                      }
                      stroke={plan.entryPoint === 'HAUPTEINGANG_A' ? '#D97706' : '#64748B'}
                      strokeWidth="2.5"
                    />
                    <image
                      href={getPixelPreviewCanvas(
                        plan.primaryWeapon === 'GLOCK_SHIELD' ? 'KOBRA_SHIELD' : 'KOBRA1'
                      )}
                      x="136"
                      y="328"
                      width="36"
                      height="36"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <image
                      href={getPixelPreviewCanvas('KOBRA2')}
                      x="174"
                      y="328"
                      width="36"
                      height="36"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <text
                      x="174"
                      y="380"
                      textAnchor="middle"
                      fill={plan.entryPoint === 'HAUPTEINGANG_A' ? '#FBBF24' : '#CBD5E1'}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono"
                    >
                      TÜR A (KOBRA)
                    </text>
                  </g>

                  {/* Entry Point B Interactive Node */}
                  <g onClick={() => setEntry('BALKON_B')} className="cursor-pointer">
                    <rect
                      x="882"
                      y="432"
                      width="88"
                      height="66"
                      fill={
                        plan.entryPoint === 'BALKON_B'
                          ? 'rgba(217, 119, 6, 0.25)'
                          : 'rgba(15, 23, 42, 0.9)'
                      }
                      stroke={plan.entryPoint === 'BALKON_B' ? '#D97706' : '#64748B'}
                      strokeWidth="2.5"
                    />
                    <image
                      href={getPixelPreviewCanvas(
                        plan.primaryWeapon === 'GLOCK_SHIELD' ? 'KOBRA_SHIELD' : 'KOBRA1'
                      )}
                      x="888"
                      y="438"
                      width="36"
                      height="36"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <image
                      href={getPixelPreviewCanvas('KOBRA2')}
                      x="926"
                      y="438"
                      width="36"
                      height="36"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <text
                      x="926"
                      y="490"
                      textAnchor="middle"
                      fill={plan.entryPoint === 'BALKON_B' ? '#FBBF24' : '#CBD5E1'}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono"
                    >
                      TÜR B (KOBRA)
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Loadout Ergonomics & Telemetry Strip */}
            <div className="mt-4 pt-3 border-t border-[#1E293B]">
              <div className="text-[11px] font-mono-tabular text-[#38BDF8] mb-2">
                TELEMETRÍA DE CARGA Y RENDIMIENTO DEL OPERADOR ({activeProfile.nameDe})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono-tabular">
                <div className="border border-[#1E293B] bg-[#0B111A] p-2.5">
                  <div className="text-[10px] text-[#94A3B8]">PESO TOTAL EQUIPO</div>
                  <div className="text-base font-bold text-white">{metrics.totalWeightKg} kg</div>
                  <div className="text-[10px] text-[#64748B]">Vel: {metrics.speedMetersPerSec} m/s</div>
                </div>
                <div className="border border-[#1E293B] bg-[#0B111A] p-2.5">
                  <div className="text-[10px] text-[#94A3B8]">BLINDAJE BALÍSTICO</div>
                  <div className="text-base font-bold text-[#10B981]">{metrics.totalArmor} PTS</div>
                  <div className="text-[10px] text-[#64748B]">Mehler Vario System</div>
                </div>
                <div className="border border-[#1E293B] bg-[#0B111A] p-2.5">
                  <div className="text-[10px] text-[#94A3B8]">ALCANCE SENSOR [Q]</div>
                  <div className="text-base font-bold text-[#38BDF8]">
                    {metrics.effectiveSensorRangeMeters} m
                  </div>
                  <div className="text-[10px] text-[#64748B]">
                    {plan.inspectionDevice === 'THERMAL_CAM' ? 'Atraviesa muros' : 'Bajo puerta'}
                  </div>
                </div>
                <div className="border border-[#1E293B] bg-[#0B111A] p-2.5">
                  <div className="text-[10px] text-[#94A3B8]">INTIMIDACIÓN ROE</div>
                  <div className="text-base font-bold text-[#D97706]">
                    {metrics.intimidationScore}%
                  </div>
                  <div className="text-[10px] text-[#64748B]">
                    Taser: {metrics.totalTaser}x · Gadget: {metrics.totalGadgets}x
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Collapsible Tactical Loadout Menus */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="flex items-center justify-between bg-[#080C11] border border-[#1E293B] px-3.5 py-2 font-mono-tabular text-[11px]">
              <span className="text-[#94A3B8]">MENÚS PLEGABLES DE DOTACIÓN TÁCTICA</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="text-[#38BDF8] hover:text-white cursor-pointer"
                >
                  [+ Expandir todo]
                </button>
                <span className="text-[#334155]">·</span>
                <button
                  onClick={collapseAll}
                  className="text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  [− Plegar todo]
                </button>
              </div>
            </div>

            {/* 01. Perfil del Operador EKO Cobra (Collapsible) */}
            <div className="border border-[#1E293B] bg-[#0F172A]/60">
              <button
                onClick={() => toggleSection('PROFILE')}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-display text-base font-bold text-white">
                    01. Perfil del Operador (Einsatzprofil)
                  </span>
                  <span className="ml-2 font-mono-tabular text-xs text-[#D97706]">
                    [{activeProfile.nameDe}]
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-[#94A3B8]">
                  {openSections.PROFILE ? '▾ PLEGAR' : '▸ DESPLEGAR'}
                </span>
              </button>

              {openSections.PROFILE && (
                <div className="px-4 pb-4 pt-1 border-t border-[#1E293B]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    {(Object.keys(EKO_COBRA_PROFILES) as OperatorProfileId[]).map((pId) => {
                      const p = EKO_COBRA_PROFILES[pId];
                      const active = plan.profile === pId;
                      return (
                        <button
                          key={pId}
                          onClick={() => setProfile(pId)}
                          className={`p-2.5 text-left border transition-colors cursor-pointer ${
                            active
                              ? 'border-[#D97706] bg-[#D97706]/15 text-white'
                              : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <div className="font-mono-tabular text-[11px] font-bold text-[#D97706]">
                            {p.nameDe}
                          </div>
                          <div className="text-xs font-semibold text-white mt-0.5">{p.nameEs}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border border-[#1E293B] bg-[#080C11] p-3 text-xs">
                    <div className="text-[#CBD5E1] mb-1.5">{activeProfile.description}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono-tabular text-[11px] text-[#10B981]">
                      {activeProfile.perks.map((perk) => (
                        <span key={perk}>· {perk}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 02. Accesorios de Inspección Óptica / Térmica (Collapsible) */}
            <div className="border border-[#1E293B] bg-[#0F172A]/60">
              <button
                onClick={() => toggleSection('SENSORS')}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-display text-base font-bold text-white">
                    02. Sensores Tácticos de Inspección (Tecla Q)
                  </span>
                  <span className="ml-2 font-mono-tabular text-xs text-[#38BDF8]">
                    [{activeSensor.nameEs}]
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-[#94A3B8]">
                  {openSections.SENSORS ? '▾ PLEGAR' : '▸ DESPLEGAR'}
                </span>
              </button>

              {openSections.SENSORS && (
                <div className="px-4 pb-4 pt-2 border-t border-[#1E293B]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.keys(EKO_COBRA_INSPECTION_DEVICES) as InspectionDeviceId[]).map(
                      (devId) => {
                        const dev = EKO_COBRA_INSPECTION_DEVICES[devId];
                        const active = plan.inspectionDevice === devId;
                        const isRec = activeProfile.recommendedInspection === devId;
                        return (
                          <button
                            key={devId}
                            onClick={() => setInspection(devId)}
                            className={`p-3 text-left border transition-colors cursor-pointer flex flex-col justify-between ${
                              active
                                ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white'
                                : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono-tabular text-[11px] font-bold text-[#38BDF8]">
                                  {dev.nameDe}
                                </span>
                                {isRec && (
                                  <span className="text-[10px] font-mono-tabular text-[#D97706]">
                                    ★ PERFIL
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-white mt-0.5">
                                {dev.nameEs}
                              </div>
                              <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug">
                                {dev.description}
                              </p>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-[#1E293B] font-mono-tabular text-[10px] text-[#CBD5E1]">
                              Peso: {dev.weightKg} kg · Alcance: {(dev.rangePx / 42).toFixed(1)}m
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 03. Granadas de Gas Lacrimógeno y Dispositivos No-Letales (Collapsible) */}
            <div className="border border-[#1E293B] bg-[#0F172A]/60">
              <button
                onClick={() => toggleSection('GADGETS')}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-display text-base font-bold text-white">
                    03. Agentes Químicos y Granadas Tácticas (Tecla G)
                  </span>
                  <span className="ml-2 font-mono-tabular text-xs text-[#10B981]">
                    [{activeGadget.nameDe} · {metrics.totalGadgets}x]
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-[#94A3B8]">
                  {openSections.GADGETS ? '▾ PLEGAR' : '▸ DESPLEGAR'}
                </span>
              </button>

              {openSections.GADGETS && (
                <div className="px-4 pb-4 pt-2 border-t border-[#1E293B]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.keys(EKO_COBRA_GADGETS) as TacticalGadgetId[]).map((gId) => {
                      const g = EKO_COBRA_GADGETS[gId];
                      const active = plan.gadget === gId;
                      const isRec = activeProfile.recommendedGadget === gId;
                      return (
                        <button
                          key={gId}
                          onClick={() => setGadget(gId)}
                          className={`p-3 text-left border transition-colors cursor-pointer flex flex-col justify-between ${
                            active
                              ? 'border-[#10B981] bg-[#10B981]/15 text-white'
                              : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono-tabular text-[11px] font-bold text-[#10B981]">
                                {g.nameDe}
                              </span>
                              {isRec && (
                                <span className="text-[10px] font-mono-tabular text-[#D97706]">
                                  ★ PERFIL
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-white mt-0.5">
                              {g.nameEs}
                            </div>
                            <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug">
                              {g.description}
                            </p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-[#1E293B] font-mono-tabular text-[10px] text-[#CBD5E1]">
                            Moral: -{g.moraleDrop} pts · Duración: {g.durationSec}s
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 04. Equipamiento de Kobra-2 (Collapsible) */}
              <div className="border border-[#1E293B] bg-[#0F172A]/60">
                <button
                  onClick={() => toggleSection('SQUAD_GEAR')}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-display text-base font-bold text-white">
                      04. Equipamiento de Kobra-2 (Escuadrón)
                    </span>
                    <span className="ml-2 font-mono-tabular text-xs text-[#F59E0B]">
                      [{plan.squadGear}]
                    </span>
                  </div>
                  <span className="font-mono-tabular text-xs text-[#94A3B8]">
                    {openSections.SQUAD_GEAR ? '▾ PLEGAR' : '▸ DESPLEGAR'}
                  </span>
                </button>

                {openSections.SQUAD_GEAR && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#1E293B]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'SHIELD' as const, nameDe: 'Ballistisches Schild', nameEs: 'Escudo Balístico' },
                        { id: 'RAM' as const, nameDe: 'Türramme', nameEs: 'Ariete' },
                        { id: 'PROBE_CAM' as const, nameDe: 'Sonden-Kamera', nameEs: 'Cámara Sonda' },
                      ].map((gear) => {
                        const active = plan.squadGear === gear.id;
                        return (
                          <button
                            key={gear.id}
                            onClick={() => onChangePlan({ ...plan, squadGear: gear.id })}
                            className={`p-3 text-left border transition-colors cursor-pointer ${
                              active
                                ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-white'
                                : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <div className="font-mono-tabular text-[11px] font-bold text-[#F59E0B]">
                              {gear.nameDe}
                            </div>
                            <div className="text-xs font-semibold text-white mt-0.5">
                              {gear.nameEs}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            {/* 04. Arma Principal & Punto de Inserción (Collapsible) */}
            <div className="border border-[#1E293B] bg-[#0F172A]/60">
              <button
                onClick={() => toggleSection('WEAPONS')}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-display text-base font-bold text-white">
                    05. Arma Principal EKO Cobra y Doctrina
                  </span>
                  <span className="ml-2 font-mono-tabular text-xs text-[#D97706]">
                    [{activeWeapon.name} · {plan.doctrine}]
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-[#94A3B8]">
                  {openSections.WEAPONS ? '▾ PLEGAR' : '▸ DESPLEGAR'}
                </span>
              </button>

              {openSections.WEAPONS && (
                <div className="px-4 pb-4 pt-2 border-t border-[#1E293B]">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(Object.keys(EKO_COBRA_WEAPONS) as PrimaryWeaponId[]).map((wId) => {
                      const w = EKO_COBRA_WEAPONS[wId];
                      const active = plan.primaryWeapon === wId;
                      return (
                        <button
                          key={wId}
                          onClick={() => setWeapon(wId)}
                          className={`p-2.5 text-left border transition-colors cursor-pointer ${
                            active
                              ? 'border-[#D97706] bg-[#D97706]/15 text-white'
                              : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-white">{w.name}</span>
                            <span className="font-mono-tabular text-[10px] text-[#D97706]">
                              {w.weightKg} kg
                            </span>
                          </div>
                          <div className="font-mono-tabular text-[10px] text-[#94A3B8] mt-0.5">
                            {w.caliber}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDoctrine('STEALTH')}
                      className={`px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                        plan.doctrine === 'STEALTH'
                          ? 'border-[#10B981] bg-[#10B981]/15 text-white'
                          : 'border-[#334155] bg-[#080C11] text-[#94A3B8]'
                      }`}
                    >
                      Doctrina Sigilosa (Sensores + Ganzúa)
                    </button>
                    <button
                      onClick={() => setDoctrine('DYNAMIC')}
                      className={`px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                        plan.doctrine === 'DYNAMIC'
                          ? 'border-[#D97706] bg-[#D97706]/15 text-white'
                          : 'border-[#334155] bg-[#080C11] text-[#94A3B8]'
                      }`}
                    >
                      Doctrina Dinámica (Ariete al Iniciar)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 06. Módulos de Armas y Tipos de Munición (Collapsible) */}
            <div className="border border-[#1E293B] bg-[#0F172A]/60">
              <button
                onClick={() => toggleSection('ATTACHMENTS')}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-display text-base font-bold text-white">
                    06. Módulos Modulares y Tipo de Munición
                  </span>
                  <span className="ml-2 font-mono-tabular text-xs text-[#38BDF8]">
                    [{activeAttachment.nameEs} · {activeAmmo.nameEs}]
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-[#94A3B8]">
                  {openSections.ATTACHMENTS ? '▾ PLEGAR' : '▸ DESPLEGAR'}
                </span>
              </button>

              {openSections.ATTACHMENTS && (
                <div className="px-4 pb-4 pt-2 border-t border-[#1E293B]">
                  <div className="text-[11px] font-mono-tabular text-[#CBD5E1] mb-1.5 font-bold">
                    ACCESORIO DE BOCA Y DESIGNADOR LÁSER
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(Object.keys(EKO_COBRA_ATTACHMENTS) as WeaponAttachmentId[]).map((attId) => {
                      const att = EKO_COBRA_ATTACHMENTS[attId];
                      const active = (plan.attachment ?? 'NONE') === attId;
                      return (
                        <button
                          key={attId}
                          onClick={() => setAttachment(attId)}
                          className={`p-2.5 text-left border transition-colors cursor-pointer flex flex-col justify-between ${
                            active
                              ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white'
                              : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="font-mono-tabular text-[11px] font-bold text-[#38BDF8]">
                              {att.nameDe}
                            </div>
                            <div className="text-xs font-semibold text-white mt-0.5">
                              {att.nameEs}
                            </div>
                            <p className="text-[10px] text-[#94A3B8] mt-1 leading-tight">
                              {att.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] font-mono-tabular text-[#CBD5E1] mb-1.5 font-bold">
                    TIPO DE MUNICIÓN BALÍSTICA EKO COBRA
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(EKO_COBRA_AMMO) as AmmoTypeId[]).map((amId) => {
                      const am = EKO_COBRA_AMMO[amId];
                      const active = (plan.ammoType ?? 'FMJ_STANDARD') === amId;
                      return (
                        <button
                          key={amId}
                          onClick={() => setAmmoType(amId)}
                          className={`p-2.5 text-left border transition-colors cursor-pointer flex flex-col justify-between ${
                            active
                              ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-white'
                              : 'border-[#334155] bg-[#080C11] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="font-mono-tabular text-[10px] font-bold text-[#F59E0B]">
                              {am.nameDe}
                            </div>
                            <div className="text-xs font-semibold text-white mt-0.5">
                              {am.nameEs}
                            </div>
                            <p className="text-[10px] text-[#94A3B8] mt-1 leading-tight">
                              {am.description}
                            </p>
                          </div>
                          <div className="mt-2 pt-1 border-t border-[#1E293B] font-mono-tabular text-[9px] text-[#CBD5E1]">
                            Penetración: {am.armorPenetration}% · Riesgo sobrepen: {am.overpenetrationRisk}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
